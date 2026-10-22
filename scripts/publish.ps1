[CmdletBinding()]
param(
    [string]$Server = '47.116.73.143',
    [string]$User = 'root',
    [int]$Port = 22,
    [string]$RemoteDirectory = '/root/casino',
    [string]$Service = 'heyuan-mahjong.service',
    [string]$PublicUrl = 'http://47.116.73.143:3000',
    [switch]$FrontendOnly,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if ($Server -notmatch '^[a-zA-Z0-9.-]+$' -or $User -notmatch '^[a-zA-Z0-9_-]+$' -or
    $RemoteDirectory -notmatch '^/[a-zA-Z0-9_./-]+$' -or $Service -notmatch '^[a-zA-Z0-9_.@-]+$' -or
    $Port -lt 1 -or $Port -gt 65535) {
    throw 'Invalid server, username, remote directory, service or port.'
}
function Invoke-Native {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}
foreach ($tool in @('node', 'tar', 'ssh', 'scp')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command missing: $tool" }
}
$id = 'release-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$temp = Join-Path ([IO.Path]::GetTempPath()) $id
New-Item -ItemType Directory -Path $temp | Out-Null
Push-Location $root
try {
    $tests = @(Get-ChildItem tests\*.test.js | ForEach-Object { $_.FullName })
    Invoke-Native 'node' (@('--test') + $tests)
    foreach ($file in @(Get-ChildItem public\js\*.js) + @(Get-ChildItem src -Recurse -Filter *.js)) {
        Invoke-Native 'node' @('--check', $file.FullName)
    }
    $files = @('public')
    if (-not $FrontendOnly) { $files += @('src', 'tests', 'package.json', 'package-lock.json') }
    $archive = Join-Path $temp 'release.tar.gz'
    Invoke-Native 'tar' (@('-czf', $archive) + $files)
    $hash = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($CheckOnly) {
        Write-Host 'Checks and packaging passed. No connection or deployment performed.'
        return
    }
    if (-not $FrontendOnly) { Write-Warning 'Full release restarts the service and interrupts active games.' }
    $target = "$User@$Server"
    $remoteTemp = "/tmp/$id"
    Invoke-Native 'ssh' @('-p', "$Port", '-o', 'ConnectTimeout=15', $target, "umask 077; mkdir '$remoteTemp'")
    $remoteScript = @'
set -eu
cd '__ROOT__'
stage='__STAGE__'
backup="__ROOT__/.deploy-backup/__ID__"
mode='__MODE__'
service='__SERVICE__'
changed=0
had_manifest=1
[ -f package.json ] || { echo 'Application not found'; exit 1; }
cleanup() { rm -rf "$stage"; }
rollback() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$changed" = 1 ]; then
    echo "Release failed. Restoring $backup" >&2
    for item in public src tests package.json package-lock.json; do
      if [ -e "$backup/$item" ]; then rm -rf "$item"; cp -a "$backup/$item" "$item"; fi
    done
    if [ "$mode" = full ]; then
      npm ci --omit=dev && systemctl restart "$service" || echo 'Rollback needs manual inspection' >&2
    fi
  fi
  cleanup
  exit "$status"
}
trap rollback EXIT
printf '%s  %s\n' '__HASH__' "$stage/release.tar.gz" | sha256sum -c -
mkdir "$stage/unpacked"
tar -xzf "$stage/release.tar.gz" -C "$stage/unpacked"
mkdir -p "$backup"
cp -a public "$backup/"
if [ "$mode" = full ]; then
  cp -a src tests package.json package-lock.json "$backup/"
  if cmp -s package.json "$stage/unpacked/package.json" && cmp -s package-lock.json "$stage/unpacked/package-lock.json"; then
    had_manifest=0
  fi
fi
changed=1
cp -a "$stage/unpacked/public/." public/
if [ "$mode" = full ]; then
  cp -a "$stage/unpacked/src/." src/
  cp -a "$stage/unpacked/tests/." tests/
  cp "$stage/unpacked/package.json" "$stage/unpacked/package-lock.json" ./
  if [ "$had_manifest" = 1 ]; then npm ci --omit=dev; fi
  npm test
  systemctl restart "$service"
fi
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if systemctl is-active --quiet "$service" && curl -fsS http://127.0.0.1:3000/health; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || { echo 'Health check failed'; exit 1; }
echo
printf 'Release successful. Backup: %s\n' "$backup"
'@
    $mode = 'full'
    if ($FrontendOnly) { $mode = 'frontend' }
    $remoteScript = $remoteScript.Replace('__ROOT__', $RemoteDirectory).Replace('__STAGE__', $remoteTemp).Replace('__ID__', $id).Replace('__MODE__', $mode).Replace('__SERVICE__', $Service).Replace('__HASH__', $hash)
    $script = Join-Path $temp 'release.sh'
    [IO.File]::WriteAllText($script, $remoteScript.Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
    Invoke-Native 'scp' @('-P', "$Port", $archive, $script, "${target}:${remoteTemp}/")
    Invoke-Native 'ssh' @('-p', "$Port", $target, "sh '$remoteTemp/release.sh'")
    $health = Invoke-RestMethod -Uri ($PublicUrl.TrimEnd('/') + '/health') -TimeoutSec 15
    if (-not $health.ok) { throw 'Public health check failed.' }
    foreach ($file in @('index.html', 'js/app.js', 'js/sound.js', 'styles.css')) {
        $download = Join-Path $temp ([IO.Path]::GetFileName($file))
        Invoke-WebRequest -UseBasicParsing -Uri ($PublicUrl.TrimEnd('/') + '/' + $file + '?release=' + $id) -OutFile $download -TimeoutSec 20
        $local = Join-Path $root ('public\' + $file.Replace('/', '\'))
        if ((Get-FileHash $local).Hash -ne (Get-FileHash $download).Hash) { throw "Public file mismatch: $file" }
    }
    Write-Host "Published and verified: $PublicUrl"
} finally {
    Pop-Location
    Remove-Item -LiteralPath $temp -Recurse -Force
}

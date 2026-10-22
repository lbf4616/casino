# 发布到服务器

在项目根目录打开 PowerShell。需要已安装 Node.js、Windows OpenSSH（`ssh`、`scp`）和 `tar`。

## 完整发布并重启

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1
```

默认目标：`root@47.116.73.143:22`，目录 `/root/casino`，服务 `heyuan-mahjong.service`。

SSH 会在终端交互要求输入密码，输入时不会显示字符。密码不会保存到项目；也支持系统现有的 SSH 密钥。首次连接时请核对服务器指纹，不要盲目确认。可能需要多次输入密码。

完整发布会中断当前牌局：先运行本地测试和语法检查，打包代码，校验上传包，备份远端文件，再更新前后端。仅在依赖清单变化时执行 `npm ci --omit=dev`，远端测试通过后重启，最后检查内网和公网服务。

不会上传本地 `node_modules`、Git 目录、部署备份或资金数据。远端备份保留在 `/root/casino/.deploy-backup/release-*`。

## 只发布前端，不重启

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -FrontendOnly
```

仅适用于静态页面、样式、图片和浏览器脚本变化。若改过服务端逻辑，请使用完整发布。

## 只检查，不上传

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -CheckOnly
```

## 修改目标

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -Server 47.116.73.143 -User root -Port 22 -RemoteDirectory /root/casino -Service heyuan-mahjong.service -PublicUrl http://47.116.73.143:3000
```

远端依赖 Linux、Node.js/npm、systemd、curl、tar、sha256sum；账号需具备应用目录写入及服务重启权限。默认内网健康检查端口是 3000。

## 故障处理

远端更新或内网健康检查失败时，脚本尝试从本次备份恢复并重启旧服务。若 SSH 中断，或出现回滚失败，需要人工检查服务和备份。公网验证失败会报错，但不会自动回滚：先检查公网端口、安全组和网络。

备份不包含资金数据，不会回滚真实的资金变化。不要在发布过程中同时修改本地文件；发布完成后浏览器刷新加载最新版本。

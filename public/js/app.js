import { CHARACTERS, getCharacter, avatarHTML } from './characters.js?v=20261018-17';
import { renderTile, renderBack, renderMeld, tileLabel } from './tiles.js?v=20261018-18';
import { audio } from './sound.js?v=20261022-2';

const ROOM_STORAGE = 'heyuan.room';
const CLIENT_STORAGE = 'heyuan.client';
const PROFILE_STORAGE = 'heyuan.profile';
const PROFILE_COOKIE = 'heyuan_identity';
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
const WINDS = ['东', '南', '西', '北'];
const CLAIM_WINDOW = 10000;
const TURN_LIMIT = 30000;
const INITIAL_BALANCE = 1000;

const appRoot = document.getElementById('appRoot');
const modalRoot = document.getElementById('modalRoot');
const toastRoot = document.getElementById('toastRoot');
const flashLayer = document.getElementById('flashLayer');

const ICON = {
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m16 9 5 5m0-5-5 5"/></svg>',
  musicOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5.5l10-2V16"/><ellipse cx="6.5" cy="18" rx="2.7" ry="2.2"/><ellipse cx="16.5" cy="16" rx="2.7" ry="2.2"/></svg>',
  musicOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5.5l10-2V16"/><ellipse cx="6.5" cy="18" rx="2.7" ry="2.2"/><ellipse cx="16.5" cy="16" rx="2.7" ry="2.2"/><path d="m4 4 16 16"/></svg>',
  rules: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.4 1.1-1.4 2.2M12 17.2v.1"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  seat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M5 10h14v6H5zM7 16v3M17 16v3"/></svg>',
  logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8M16 8l4 4-4 4M20 12H9"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.4 10.8 7.2-4M8.4 13.2l7.2 4"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M3 8a9 9 0 0 0 1.6 10.4M2.5 13.5V8.8h4.7"/></svg>',
  dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.6" cy="8.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.1" fill="currentColor" stroke="none"/></svg>',
};

function readCookieProfile() {
  try {
    const match = document.cookie.match(/(?:^|;\s*)heyuan_identity=([^;]*)/);
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match[1]));
  } catch (error) {
    return null;
  }
}

function loadProfile() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE) || 'null');
  } catch (error) {
    stored = null;
  }
  if (!stored || typeof stored !== 'object') stored = readCookieProfile();
  const parsed = stored && typeof stored === 'object' ? stored : {};
  const hasAvatar = CHARACTERS.some((item) => item.id === parsed.avatar);
  return {
    avatar: hasAvatar ? parsed.avatar : CHARACTERS[0].id,
    name: typeof parsed.name === 'string' ? cleanInviteName(parsed.name) : '',
    remembered: Boolean(hasAvatar && parsed.remembered === true),
  };
}

function saveProfile() {
  const payload = {
    avatar: state.profile.avatar,
    name: state.profile.name,
    remembered: state.identityRemembered,
  };
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(PROFILE_STORAGE, serialized);
  } catch (error) {
    // The cookie below can still carry the identity.
  }
  try {
    document.cookie = `${PROFILE_COOKIE}=${encodeURIComponent(serialized)}; path=/; max-age=${PROFILE_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch (error) {
    // Cookies may be disabled; local storage is the primary store.
  }
}

function getClientId() {
  let clientId = sessionStorage.getItem(CLIENT_STORAGE);
  if (clientId && /^[A-Za-z0-9_-]{8,80}$/.test(clientId)) return clientId;
  if (window.crypto?.randomUUID) {
    clientId = window.crypto.randomUUID().replace(/-/g, '');
  } else {
    clientId = Array.from({ length: 32 }, () => (
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    )).join('');
  }
  sessionStorage.setItem(CLIENT_STORAGE, clientId);
  return clientId;
}

function cleanInviteName(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

const initialProfile = loadProfile();

const state = {
  screen: 'loading',
  online: false,
  hasConnected: false,
  profile: { avatar: initialProfile.avatar, name: initialProfile.name },
  identityRemembered: initialProfile.remembered,
  identityEditing: false,
  identitySaved: { avatar: initialProfile.avatar, name: initialProfile.name },
  invite: null,
  room: null,
  selectedTileId: null,
  balances: null,
  modal: null,
  showResult: false,
  dismissedResult: null,
  actionInFlight: false,
  lastGameLogId: null,
  titleTurn: false,
  orientationDismissed: false,
  diceRolling: false,
  serverOffset: 0,
};

let openingTimers = [];
let turnWarningDeadline = null;

const clientId = getClientId();
const socket = io({
  auth: { clientId },
  reconnection: true,
  reconnectionAttempts: Infinity,
});

function isWeChatBrowser() {
  return /MicroMessenger/i.test(navigator.userAgent || '');
}

function isMobileDevice() {
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(ua)) return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const shortSide = Math.min(window.screen?.width || 0, window.screen?.height || 0);
  return Boolean(coarse && navigator.maxTouchPoints > 0 && shortSide > 0 && shortSide <= 900);
}

function isIOSDevice() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function isStandaloneApp() {
  return window.navigator.standalone === true
    || Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
    || Boolean(window.matchMedia?.('(display-mode: fullscreen)').matches);
}

window.matchMedia?.('(display-mode: standalone)').addEventListener('change', () => {
  if (isStandaloneApp()) appRoot.querySelector('.home-screen-hint')?.remove();
});

function renderHomeScreenHint() {
  if (isStandaloneApp() || state.homeScreenHintDismissed) return '';
  const instruction = isWeChatBrowser()
    ? '先用浏览器打开，再点「共享」→「添加到主屏幕」。'
    : '点浏览器的「共享」（分享）→「添加到主屏幕」。';
  return `<aside class="home-screen-hint" role="note" aria-label="添加到主屏幕提示">
    <div><strong>添加到主屏幕，打开更方便</strong><span>${instruction}以后从桌面图标进入，即可全屏游玩。${isIOSDevice() ? '' : '也可在浏览器菜单中选择「安装应用」或「添加到主屏幕」。'}</span></div>
    <button type="button" class="icon-button" data-action="dismiss-home-screen-hint" aria-label="关闭主屏幕提示">${ICON.close}</button>
  </aside>`;
}

function isPortrait() {
  return window.matchMedia?.('(orientation: portrait)').matches
    ?? window.innerHeight >= window.innerWidth;
}

function supportsAutoLandscape() {
  return typeof document.documentElement.requestFullscreen === 'function'
    && typeof screen.orientation?.lock === 'function';
}

function buildInviteUrl(code, from) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';

  const inviter = cleanInviteName(from);
  if (inviter) url.searchParams.set('from', inviter);
  return url.toString();
}

function clearInviteParam() {
  if (!state.invite) return;
  state.invite = null;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('from');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (error) {
    // History rewriting is a nicety; joining still works without it.
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Fall through to the legacy clipboard path on plain HTTP.
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.top = '-1000px';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, text.length);
  try {
    const copied = document.execCommand('copy');
    return copied;
  } catch (error) {
    return false;
  } finally {
    input.remove();
  }
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function currentCharacter() {
  return getCharacter(state.profile.avatar);
}

function effectiveName() {
  return (state.profile.name || '').trim() || currentCharacter().name;
}

function formatScore(score) {
  if (score > 0) return `+${score}`;
  return String(score);
}

function balanceOf(characterId) {
  const value = state.balances?.[characterId];
  return Number.isFinite(value) ? value : INITIAL_BALANCE;
}

function fundsText(value) {
  return `${value} 元`;
}

async function loadBalances(refresh = false) {
  try {
    const response = await fetch('/api/scores', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload?.scores && typeof payload.scores === 'object') {
      state.balances = payload.scores;
      if (refresh && state.screen === 'home') render();
    }
  } catch (error) {
    // The table still works with the default starting funds.
  }
}

function serverNow() {
  return Date.now() + state.serverOffset;
}

function clearOpeningTimers() {
  openingTimers.forEach((timer) => clearTimeout(timer));
  openingTimers = [];
}

function scheduleOpeningStep(delay, run) {
  openingTimers.push(setTimeout(run, Math.max(0, delay)));
}

function openingKey(room) {
  const game = room?.game;
  const opening = game?.opening;
  if (!opening?.rolledAt) return null;
  return `${room.code}:${game.roundNumber}:${opening.rolledAt}`;
}

function currentOpeningKey() {
  return openingKey(state.room);
}

function windForLobbySeat(seat, hostSeat) {
  return WINDS[(seat - hostSeat + 4) % 4];
}

function showToast(message, type = 'info') {
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  const dot = document.createElement('span');
  dot.className = 'toast-dot';
  const text = document.createElement('span');
  text.textContent = message;
  node.append(dot, text);
  toastRoot.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 280);
  }, 3200);
}

function flashTable(text, type = 'info') {
  if (!flashLayer) return;
  const node = document.createElement('div');
  node.className = `table-flash table-flash--${type}`;
  node.textContent = text;
  flashLayer.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => node.classList.add('is-leaving'), 1400);
  setTimeout(() => node.remove(), 1900);
}

function actionLabel(kind) {
  if (kind === 'peng') return '碰';
  if (kind === 'chengdiao') return '惩';
  if (['gang', 'huihui'].includes(kind)) return '杠';
  return '';
}

function seatEffectAnchor(seat) {
  const pod = appRoot.querySelector(`.machine-pod[data-seat="${seat}"], .self-identity[data-seat="${seat}"]`);
  const avatar = pod?.querySelector('.pod-avatar, .self-avatar');
  if (!avatar) return null;
  const rect = avatar.getBoundingClientRect();
  return {
    x: Math.max(48, Math.min(window.innerWidth - 48, rect.left + rect.width / 2)),
    y: Math.max(64, rect.top),
  };
}

function showSeatAction(entry) {
  const label = actionLabel(entry.kind);
  if (!flashLayer || !label || entry.seat === null || entry.seat === undefined) return;
  const anchor = seatEffectAnchor(entry.seat);
  if (!anchor) return;
  const node = document.createElement('span');
  node.className = `seat-action-pop seat-action-pop--${entry.kind}`;
  node.textContent = label;
  node.style.left = `${anchor.x}px`;
  node.style.top = `${anchor.y - 36}px`;
  flashLayer.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => node.classList.add('is-leaving'), 1050);
  setTimeout(() => node.remove(), 1450);

  (entry.scoreChanges || []).forEach((change) => {
    const changeAnchor = seatEffectAnchor(change.seat);
    if (!changeAnchor || !change.delta) return;
    const amount = document.createElement('span');
    amount.className = `seat-score-pop ${change.delta > 0 ? 'is-positive' : 'is-negative'}`;
    amount.textContent = formatScore(change.delta);
    amount.style.left = `${changeAnchor.x}px`;
    amount.style.top = `${changeAnchor.y + 18}px`;
    amount.style.right = 'auto';
    flashLayer.appendChild(amount);
    requestAnimationFrame(() => amount.classList.add('is-visible'));
    setTimeout(() => amount.classList.add('is-leaving'), 1150);
    setTimeout(() => amount.remove(), 1550);
  });
}

function setModal(modal) {
  state.modal = modal;
  renderModal();
}

function closeModal() {
  state.modal = null;
  renderModal();
}

function isMuted() {
  return audio.muted;
}

function soundButton(compact = false) {
  return `<button class="icon-button${compact ? ' icon-button--compact' : ''}" type="button" data-action="toggle-sound" aria-label="${isMuted() ? '打开声音' : '关闭声音'}" title="${isMuted() ? '打开声音' : '关闭声音'}">${isMuted() ? ICON.soundOff : ICON.soundOn}</button>`;
}

function rulesButton() {
  return `<button class="text-icon-button" type="button" data-action="open-rules">${ICON.rules}<span>玩法</span></button>`;
}

function brandHTML(small = false) {
  return `<div class="brand${small ? ' brand--small' : ''}">
    <img class="brand-seal" src="/assets/app-icon-192.png?v=20261021-5" alt="" aria-hidden="true">
    <span class="brand-copy">
      <strong>牛牛棋牌室</strong>
      ${small ? '' : '<small>家里人的一桌牌</small>'}
    </span>
  </div>`;
}

function offlineBanner() {
  if (state.online) return '';
  return `<div class="offline-banner"><span class="offline-dot"></span>网络断开，正在重新连接…</div>`;
}

async function request(event, payload, options = {}) {
  if (state.actionInFlight) return { ok: false, error: '正在处理上一次操作，请稍候' };
  if (!socket.connected) {
    if (!options.silent) showToast('网络还没有连上，请稍等一下', 'error');
    return { ok: false, error: 'offline' };
  }
  state.actionInFlight = true;
  document.body.classList.add('is-requesting');
  try {
    const response = await new Promise((resolve) => {
      socket.timeout(9000).emit(event, payload, (error, result) => {
        if (error) {
          resolve({ ok: false, error: '操作超时，请重试' });
          return;
        }
        resolve(result || { ok: false, error: '没有收到回应' });
      });
    });
    if (!response.ok && !options.silent) {
      showToast(response.error || '操作没有完成', 'error');
      audio.play('error');
    }
    return response;
  } finally {
    state.actionInFlight = false;
    document.body.classList.remove('is-requesting');
  }
}

function handleServerState(room) {
  if (!room || !room.code) return;
  const previous = state.room;
  const previousCode = previous?.code;
  const previousRound = previous?.game?.roundNumber;
  const previousLogs = previous?.game?.log || [];
  const prevLastLogId = previousLogs.length ? previousLogs[previousLogs.length - 1].id : null;
  const previousOpening = previous?.game?.opening || null;
  const nextOpening = room.game?.opening || null;

  if (Number.isFinite(room.serverTime)) {
    state.serverOffset = room.serverTime - Date.now();
  }

  if (state.invite && state.invite.code === room.code) clearInviteParam();
  state.room = room;
  state.online = true;
  sessionStorage.setItem(ROOM_STORAGE, room.code);
  state.screen = room.game ? 'game' : 'room';

  if (state.selectedTileId) {
    const hand = room.game?.you?.hand || [];
    const actions = room.game?.you?.actions;
    if (actions?.kind !== 'self' || !hand.some((tile) => tile.id === state.selectedTileId)) {
      state.selectedTileId = null;
    }
  }

  const result = room.game?.result;
  const resultKey = result ? `${room.code}:${room.game.roundNumber}` : null;
  if (result) {
    if (!previous?.game?.result && previous?.game && result.type === 'win') {
      state.showResult = false;
      state.resultEffectKey = resultKey;
      setTimeout(() => {
        if (state.resultEffectKey !== resultKey || `${state.room?.code}:${state.room?.game?.roundNumber}` !== resultKey) return;
        state.resultEffectKey = null;
        if (state.dismissedResult !== resultKey) state.showResult = true;
        render();
      }, 2400);
    } else if (state.resultEffectKey !== resultKey && state.dismissedResult !== resultKey) {
      state.showResult = true;
    }
  } else {
    state.resultEffectKey = null;
    state.showResult = false;
    state.dismissedResult = null;
  }

  if (state.modal?.type === 'gang') {
    const actions = room.game?.you?.actions;
    if (!actions || actions.kind !== 'self' || !actions.gangs?.length) {
      state.modal = null;
    }
  }

  if (previousCode && previousCode !== room.code) {
    state.modal = null;
    state.lastGameLogId = null;
  }

  if (nextOpening?.rolledAt && nextOpening.rolledAt !== previousOpening?.rolledAt) {
    state.diceRolling = false;
    audio.play('dice');
  }
  if (!nextOpening?.rolledAt) state.diceRolling = false;

  let feedbackLogs = [];
  if (room.game) {
    const newLogs = [];
    if (previous?.game && previousRound === room.game.roundNumber) {
      const existingIndex = room.game.log.findIndex((entry) => entry.id === prevLastLogId);
      if (existingIndex >= 0) newLogs.push(...room.game.log.slice(existingIndex + 1));
      else if (room.game.log.length) newLogs.push(room.game.log[room.game.log.length - 1]);
    } else if (previous?.game && previousRound !== room.game.roundNumber) {
      newLogs.push(...room.game.log.slice(0, 3));
    } else if (previousCode === room.code && !previous?.game) {
      newLogs.push(...room.game.log.slice(-3));
    }
    if (previous?.code === room.code && room.game.phase !== 'opening') {
      feedbackLogs = newLogs;
    }
    if (room.game.log.length) state.lastGameLogId = room.game.log[room.game.log.length - 1].id;
  }

  render();
  playLogFeedback(feedbackLogs, previousRound !== room.game?.roundNumber, room);
}

function playLogFeedback(logs, isNewRound, room) {
  if (!logs.length) return;
  const important = new Set(['hu', 'gang', 'huihui', 'peng', 'chengdiao', 'discard', 'start', 'drawEnd']);
  const usable = logs.filter((entry) => important.has(entry.kind));
  if (!usable.length) return;

  if (isNewRound) {
    audio.play('start');
    flashTable('新一局，牌已洗好', 'start');
    return;
  }

  usable.filter((entry) => actionLabel(entry.kind)).forEach(showSeatAction);

  const priority = { hu: 6, gang: 5, huihui: 4, chengdiao: 3, peng: 2, start: 2, discard: 1, drawEnd: 0 };
  usable.sort((a, b) => (priority[a.kind] || 0) - (priority[b.kind] || 0));
  const chosen = usable[usable.length - 1];
  if (chosen.kind === 'hu') {
    audio.play('hu');
    audio.announceWin(room.game?.result?.soft, getCharacter(room?.seats?.find((entry) => entry?.seat === chosen.seat)?.avatar));
    flashTable(`自摸（${room.game?.result?.soft ? '软的' : '黑的'}）`, 'hu');
  }
  else if (chosen.kind === 'gang') audio.play('gang');
  else if (chosen.kind === 'huihui') audio.play('gang');
  else if (chosen.kind === 'chengdiao') audio.play('select');
  else if (chosen.kind === 'peng') audio.play('peng');
  else if (chosen.kind === 'start') audio.play('start');

  const actor = room?.seats?.find((entry) => entry?.seat === chosen.seat);
  if (['hu', 'gang', 'huihui', 'peng', 'chengdiao'].includes(chosen.kind)) {
    if (chosen.kind !== 'hu') audio.announceAction(chosen.kind, getCharacter(actor?.avatar));
  } else if (chosen.kind === 'discard' && chosen.tile) {
    audio.announceDiscard(chosen.tile, getCharacter(actor?.avatar));
  }

  const shouldFlash = usable.filter((entry) => ['start', 'drawEnd'].includes(entry.kind));
  if (shouldFlash.length) {
    const latest = shouldFlash[shouldFlash.length - 1];
    flashTable(latest.text, latest.kind);
  }
}

function handleRoomClosed(payload) {
  if (!state.room) return;
  sessionStorage.removeItem(ROOM_STORAGE);
  state.room = null;
  state.screen = 'home';
  state.showResult = false;
  state.modal = null;
  state.selectedTileId = null;
  state.orientationDismissed = false;
  state.diceRolling = false;
  clearOpeningTimers();
  exitLandscapeMode();
  render();
  showToast(payload?.reason === 'idle' ? '房间很久没人，已经收桌了' : '这个牌局已经结束', 'info');
  loadBalances(true);
}

socket.on('connect', async () => {
  state.online = true;
  const wasConnected = state.hasConnected;
  state.hasConnected = true;
  audio.unlock();
  if (!wasConnected) {
    await bootIntoRoom();
  } else if (state.room) {
    await resumeCurrentRoom();
  } else {
    await bootIntoRoom();
  }
});

socket.on('disconnect', () => {
  state.online = false;
  if (state.screen !== 'loading') render();
});

socket.on('connect_error', () => {
  state.online = false;
  if (state.screen === 'loading') {
    state.screen = 'home';
  }
  render();
});

socket.on('session:replaced', () => {
  socket.disconnect();
  sessionStorage.removeItem(ROOM_STORAGE);
  state.room = null;
  state.online = false;
  state.screen = 'home';
  state.modal = null;
  state.showResult = false;
  render();
  showToast('角色已在其他设备登录，本设备已退出', 'info');
});

const DANMAKU_PHRASES = {
  lobby: ['快开局吧', '快拉人', '还有人吗', '人齐就开', '准备好了！'],
  game: ['等到花都谢了', '快出牌呀', '打得漂亮', '这牌有点难', '好运快来！'],
};
let danmakuNextLane = 0;
let danmakuNextAt = 0;
socket.on('room:danmaku', (message) => {
  if (!state.room || message.code !== state.room.code || !Object.values(DANMAKU_PHRASES).flat().includes(message.phrase)) return;
  let layer = document.getElementById('danmaku-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'danmaku-layer';
    layer.className = 'danmaku-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  const bubble = document.createElement('div');
  bubble.className = 'danmaku-bubble';
  bubble.style.setProperty('--danmaku-lane', String(danmakuNextLane++ % 3));
  const delay = Math.max(0, danmakuNextAt - Date.now());
  danmakuNextAt = Date.now() + delay + 650;
  bubble.style.animationDelay = `${delay}ms`;
  bubble.innerHTML = `${avatarHTML(message.avatar)}<span>${escapeHTML(message.phrase)}</span>`;
  bubble.addEventListener('animationend', () => bubble.remove(), { once: true });
  layer.append(bubble);
});

socket.on('room:state', handleServerState);
socket.on('room:closed', handleRoomClosed);
socket.on('server:error', (payload) => {
  showToast(payload?.error || '连接出现问题，请刷新页面', 'error');
});

loadBalances(true);

async function bootIntoRoom() {
  const savedCode = sessionStorage.getItem(ROOM_STORAGE);
  if (!savedCode) {
    state.screen = state.hasConnected ? 'home' : 'loading';
    render();
    if (state.identityRemembered) await createRoom();
    return;
  }
  state.screen = 'loading';
  render();
  const response = await request('room:resume', { code: savedCode }, { silent: true });
  if (!response.ok) {
    sessionStorage.removeItem(ROOM_STORAGE);
    state.room = null;
    state.screen = 'home';
    render();
    if (state.identityRemembered) await createRoom();
  } else {
    render();
  }
}

async function resumeCurrentRoom() {
  if (!state.room) return;
  const code = state.room.code;
  const response = await request('room:resume', { code }, { silent: true });
  if (!response.ok) {
    sessionStorage.removeItem(ROOM_STORAGE);
    state.room = null;
    state.screen = 'home';
    render();
    showToast('没能回到原牌局，房间可能已关闭', 'info');
  } else {
    render();
  }
}

function setOfflineScreenForNoConnection() {
  if (socket.connected) return;
  if (state.screen === 'loading') {
    state.screen = 'home';
    render();
  }
}

window.setTimeout(setOfflineScreenForNoConnection, 2500);

function render() {
  clearOpeningTimers();
  if (state.screen === 'loading') {
    appRoot.innerHTML = renderLoading();
  } else if (state.screen === 'home' || !state.room) {
    appRoot.innerHTML = renderHome();
  } else if (state.screen === 'room') {
    appRoot.innerHTML = renderLobby();
  } else {
    appRoot.innerHTML = renderGame();
  }
  if (state.room && (state.screen === 'room' || state.screen === 'game')) {
    const category = state.room.game && state.room.game.phase !== 'ended' ? 'game' : 'lobby';
    appRoot.querySelector('.screen')?.insertAdjacentHTML('beforeend', `<div class="danmaku-control"><button type="button" class="danmaku-trigger" data-action="open-danmaku" aria-label="发送快捷弹幕" aria-expanded="false" aria-controls="danmaku-options">聊两句</button><div id="danmaku-options" class="danmaku-options" hidden>${DANMAKU_PHRASES[category].map((phrase) => `<button type="button" data-action="send-danmaku" data-phrase="${escapeHTML(phrase)}">${escapeHTML(phrase)}</button>`).join('')}</div></div>`);
  } else {
    document.getElementById('danmaku-layer')?.remove();
    danmakuNextAt = 0;
  }
  const portraitBlocked = isMobileDevice() && isPortrait();
  appRoot.querySelector('.screen')?.toggleAttribute('inert', portraitBlocked);
  appRoot.insertAdjacentHTML('beforeend', orientationOverlay());
  if (state.screen !== 'loading') appRoot.insertAdjacentHTML('beforeend', renderHomeScreenHint());
  document.body.dataset.screen = state.screen;
  document.body.classList.toggle('has-offline', !state.online);
  updateDocumentTitle();
  tickCountdowns();
  syncTableSize();
  syncDockHeight();
  scheduleOpeningAnimation();
}

function syncTableSize() {
  const tables = [
    ['.game-table-shell', '.game-table-rim'],
    ['.opening-stage', '.opening-machine'],
  ];
  for (const [shellSelector, tableSelector] of tables) {
    const shell = appRoot.querySelector(shellSelector);
    const table = shell?.querySelector(tableSelector);
    if (!shell || !table) continue;
    const style = getComputedStyle(shell);
    const availW = shell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availH = shell.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (availW <= 0 || availH <= 0) continue;
    const dist = 1000;
    const sin = Math.sin((24 * Math.PI) / 180);
    const cos = Math.cos((24 * Math.PI) / 180);
    const ratio = 1.62;
    const landscape = availW > availH;
    const tableStyle = getComputedStyle(table);
    const rim = parseFloat(tableStyle.getPropertyValue('--rim-pad') || tableStyle.getPropertyValue('--machine-pad'));
    const inset = landscape ? (parseFloat(getComputedStyle(table.querySelector('.machine-rim') || table).paddingBottom) || rim || 0) : 0;
    // Fit the inner bottom edge; the front rim may extend beyond the viewport.
    let low = 0;
    let high = Math.min(availW, dist / sin * ratio * 0.9);
    for (let step = 0; step < 40; step += 1) {
      const candidate = (low + high) / 2;
      const depth = Math.max(0, candidate / ratio - inset);
      const scale = dist / (dist - depth * sin);
      if (Math.max(0, candidate - 2 * inset) * scale > availW || depth * cos * scale > availH) high = candidate;
      else low = candidate;
    }
    let width = low;
    let height = width / ratio;
    let shift;
    if (landscape) {
      const top = inset * cos * dist / (dist - inset * sin);
      const bottom = availH + top;
      const depth = bottom * dist / (dist * cos + bottom * sin);
      height = depth + inset;
      width = availW * (dist - depth * sin) / dist + 2 * inset;
      shift = -top;
    } else {
      const projected = height * cos * dist / (dist - height * sin);
      shift = Math.max(0, (availH - projected) / 2);
    }
    table.style.setProperty('--table-ratio', String(width / height));
    // The play felt is inset by the rim, so deriving its tiles from its own cqh makes them
    // smaller than the deal table's; both phases instead share one scale from the table height.
    const tileW = Math.min(30, Math.max(9, height * 0.0434));
    table.style.setProperty('--table-w', `${width.toFixed(2)}px`);
    table.style.setProperty('--table-shift', `${shift.toFixed(2)}px`);
    table.style.setProperty('--table-tile-w', `${tileW.toFixed(2)}px`);
    const shellRect = shell.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const visibleTop = Math.max(0, shellRect.top) + 6;
    const visibleBottom = Math.min(viewportHeight, shellRect.bottom) - 6;
    for (const pod of table.querySelectorAll('.machine-pod--top, .machine-pod--bottom')) {
      pod.style.translate = 'none';
      let offset = 0;
      for (let step = 0; step < 3; step += 1) {
        const rect = pod.getBoundingClientRect();
        const correction = rect.top < visibleTop ? visibleTop - rect.top
          : rect.bottom > visibleBottom ? visibleBottom - rect.bottom : 0;
        if (Math.abs(correction) < 0.5) break;
        const scale = rect.width / pod.offsetWidth || 1;
        offset += correction / scale;
        pod.style.translate = `0 ${offset.toFixed(2)}px`;
      }
    }
  }
}

function syncDockHeight() {
  const felt = appRoot.querySelector('.game-table-felt');
  const dock = appRoot.querySelector('.self-dock');
  if (!felt || !dock) return;
  felt.style.setProperty('--dock-h', `${dock.offsetHeight}px`);
}

function renderLoading() {
  return `<div class="screen loading-screen">
    <div class="loading-brand">
      <span class="brand-seal brand-seal--large">合</span>
      <h1>牛牛棋牌室</h1>
      <p>正在摆好牌桌…</p>
      <div class="loading-line"><span></span></div>
    </div>
  </div>`;
}

function identityMode() {
  if (!state.identityRemembered) return 'first';
  return state.identityEditing ? 'edit' : 'returning';
}

function identityCardHTML() {
  const character = currentCharacter();
  const customName = state.profile.name.trim();
  return `<div class="identity-card">
    <span class="identity-portrait">${avatarHTML(character.id, { className: 'identity-avatar' })}</span>
    <span class="identity-copy">
      <small>这台设备记得你</small>
      <strong>${escapeHTML(customName || character.name)}</strong>
      <em>${customName ? `${character.name} · 属${character.animal}` : `生肖 · ${character.animal}`} · 资金 ${fundsText(balanceOf(character.id))}</em>
    </span>
    <button type="button" class="identity-edit" data-action="edit-identity">换角色</button>
  </div>`;
}

function identityFieldsHTML() {
  const character = currentCharacter();
  return `<div class="character-grid" role="listbox" aria-label="选择你的角色">
      ${CHARACTERS.map((item) => characterCard(item)).join('')}
    </div>
    <label class="field-label" for="player-name">怎么称呼你<span>可不填</span></label>
    <div class="name-field">
      <span class="name-field-avatar">${avatarHTML(state.profile.avatar, { className: 'name-avatar' })}</span>
      <input id="player-name" data-input="name" type="text" maxlength="12" autocomplete="nickname" value="${escapeHTML(state.profile.name)}" placeholder="就叫${character.name}吧" aria-label="你的称呼">
    </div>`;
}

function identityEntryHTML(context, code = '') {
  const mode = identityMode();
  const heading = mode === 'returning' ? '直接入座' : mode === 'edit' ? '换一个角色' : '选你自己的角色';
  const intro = mode === 'returning'
    ? '这台设备记得你，上次挑的角色不用再选。'
    : mode === 'edit'
      ? '选好后，这台设备会改记新的角色。'
      : '选好后，这台设备会记住你，下次打开不用再选。称呼可以留空。';
  const foot = mode === 'returning'
    ? '角色资金存在服务器 · 有 AI 参战的牌局不记账'
    : mode === 'edit'
      ? '换好之后，资金跟着新角色走'
      : '每人初始 1000 元 · 有 AI 参战的牌局不记账';
  const formId = mode === 'edit' ? 'identity-form' : 'create-form';
  const submitLabel = mode === 'edit'
    ? '记住这个角色'
    : '直接入座';
  return `<div class="entry-heading">
      <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>入座</p>
      <h2 id="entry-title">${heading}</h2>
      <p>${intro}</p>
    </div>
    ${mode === 'returning' ? identityCardHTML() : ''}
    <form id="${formId}" class="create-form">
      ${mode === 'returning' ? '' : identityFieldsHTML()}
      <button type="submit" class="button button--primary button--wide">
        <span>${submitLabel}</span>${ICON.arrow}
      </button>
      ${mode === 'edit' ? '<button type="button" class="identity-cancel" data-action="cancel-identity-edit">还是原来的角色</button>' : ''}
    </form>
    <p class="entry-foot">${foot}</p>`;
}

function renderHome() {
  return `<div class="screen home-screen">
    ${offlineBanner()}
    <div class="home-ornaments" aria-hidden="true">
      <div class="home-ornament home-ornament--one"></div>
      <div class="home-ornament home-ornament--two"></div>
    </div>
    <header class="site-header">
      ${brandHTML()}
      <div class="header-tools">
        ${rulesButton()}
        ${soundButton()}
      </div>
    </header>
    <main class="home-main">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span>湖北麻将 · 一百零八张</p>
          <h1>家里人齐了，<br><em>就开一桌。</em></h1>
          <p class="hero-intro">不用注册，不必登录。家里人共用这一桌，选好角色就自动落座，四个座位坐满就不能再进。人不齐时，也可以让 AI 邻居补位开局。</p>
          <div class="hero-scene" aria-hidden="true">
            <div class="hero-table">
              <span class="hero-table-line"></span>
              <div class="hero-fan">
                ${renderTile({ suit: 'wan', rank: 5, key: 'wan-5' }, { size: 'hero' })}
                ${renderTile({ suit: 'tong', rank: 8, key: 'tong-8' }, { size: 'hero' })}
                ${renderTile({ suit: 'tiao', rank: 3, key: 'tiao-3' }, { size: 'hero' })}
              </div>
              <span class="hero-stamp">牛牛<br>小局</span>
              <span class="hero-table-caption">四方桌 · 家人闲坐</span>
            </div>
          </div>
          <div class="hero-facts">
            <div><strong>108</strong><span>张序数牌</span></div>
            <div><strong>4</strong><span>个家中席位</span></div>
            <div><strong>只</strong><span>自摸得胡</span></div>
          </div>
        </div>
      </section>
        <section class="entry-panel" aria-labelledby="entry-title">
          ${identityEntryHTML('home')}
        </section>
      </main>
      <footer class="site-footer">
        <span>牛牛棋牌室</span>
        <span>给家里人的一桌牌</span>
      </footer>
    </div>`;
}

function characterCard(character) {
  const selected = character.id === state.profile.avatar;
  return `<button type="button" class="character-card${selected ? ' is-selected' : ''}" data-action="select-avatar" data-avatar="${character.id}" role="option" aria-selected="${selected}" aria-label="${character.name}，属${character.animal}">
    <span class="character-portrait">${avatarHTML(character.id, { className: 'character-avatar' })}</span>
    <span class="character-name">${character.name}<small>${character.animal}</small></span>
    <span class="character-funds">${fundsText(balanceOf(character.id))}</span>
    <span class="character-motto">${character.motto}</span>
    <span class="character-check" aria-hidden="true"></span>
  </button>`;
}

function renderLobby() {
  const room = state.room;
  const seats = room.seats || [];
  const occupied = seats.filter(Boolean).length;
  const you = room.you;
  const isHost = Boolean(you?.isHost);
  const hostSeat = room.hostSeat;

  return `<div class="screen lobby-screen">
    ${offlineBanner()}
    <header class="site-header site-header--compact">
      ${brandHTML(true)}
      <div class="lobby-room-chip"><span>家里人的</span><b>一桌牌</b></div>
      <div class="header-tools">
        ${rulesButton()}
        ${soundButton()}
      </div>
    </header>
    <main class="lobby-main">
      <section class="lobby-copy">
        <p class="eyebrow"><span class="eyebrow-line"></span>牌桌已经摆好</p>
        <h1>${occupied === 4 ? '人齐了，' : '等家里人，'}<em>${occupied === 4 ? '开桌吧。' : '慢慢来。'}</em></h1>
        <p class="lobby-intro">${isHost
    ? '空位可以留给家里人，也可以直接开始，让 AI 邻居补齐。开局后座位就固定啦。'
    : '东家开局后，牌局就会开始。现在可以点空位换个顺手的位置。'}</p>
        <div class="invite-box">
          <div class="invite-head">
            <span class="invite-label">就这一桌 · 喊家里人来坐</span>
            <span class="invite-count">${occupied} / 4 已入座</span>
          </div>
          <button type="button" class="invite-share" data-action="share-invite">
            <span class="invite-share-icon">${ICON.share}</span>
            <span class="invite-share-copy"><b>发送邀请链接</b><small>家里人点开就能入座</small></span>
            ${ICON.arrow}
          </button>
          <span class="invite-hint">发到家庭群即可，大家都进同一桌</span>
        </div>
        <div class="lobby-controls">
          ${isHost
    ? `<button type="button" class="button button--primary button--wide" data-action="start-game">
          <span>${occupied === 4 ? '开始牌局' : '开始牌局 · AI 补位'}</span>${ICON.arrow}
        </button>`
    : `<div class="waiting-host"><span class="waiting-dots"><i></i><i></i><i></i></span>等东家开局</div>`}
          <button type="button" class="text-button text-button--quiet" data-action="ask-leave">离开此桌</button>
        </div>
      </section>
      <section class="seating-panel" aria-label="座位">
        <div class="seating-heading">
          <div>
            <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>四方桌</p>
            <h2>${occupied} / 4 已入座</h2>
          </div>
          <span class="seating-mark" aria-hidden="true">坐</span>
        </div>
        <div class="seat-grid">
          ${seats.map((seat, index) => lobbySeatCard(seat, index, hostSeat, you?.seat)).join('')}
        </div>
        <p class="seating-tip">${you ? '点击空位可以换座位 · 开局后不可换座' : '选择空位入座'}</p>
        <div class="mini-rule-strip">
          <span>只能自摸</span><span>赖子限一张</span><span>不能吃</span><span>AI 局不记账</span>
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <span>家里人共用一桌 · 四个座位</span>
      <span>牛牛棋牌室 · 无登录牌局</span>
    </footer>
  </div>`;
}

function lobbySeatCard(seat, index, hostSeat, viewerSeat) {
  const wind = windForLobbySeat(index, hostSeat);
  if (!seat) {
    return `<button type="button" class="seat-card seat-card--empty" data-action="take-seat" data-seat="${index}" aria-label="${wind}位空座，点击入座">
      <span class="seat-wind">${wind}</span>
      <span class="empty-seat-mark">${ICON.plus}</span>
      <strong>空位</strong>
      <small>${viewerSeat === null ? '入座' : '移到这里'}</small>
    </button>`;
  }
  const isYou = seat.seat === viewerSeat;
  const isHost = index === hostSeat;
  const character = getCharacter(seat.avatar);
  return `<div class="seat-card seat-card--filled${isYou ? ' is-you' : ''}${isHost ? ' is-host' : ''}">
    <span class="seat-wind">${wind}</span>
    <span class="seat-avatar">${avatarHTML(seat.avatar, { className: 'seat-avatar-svg' })}</span>
    <div class="seat-person">
      <strong>${escapeHTML(seat.name)}${isYou ? '<span class="you-mark">你</span>' : ''}</strong>
      <span>${isHost ? '东家' : character.animal}${seat.connected === false ? ' · 暂离' : ''} · ${fundsText(seat.score)}</span>
    </div>
    ${isHost ? '<span class="host-mark">东</span>' : ''}
  </div>`;
}

function getCombinedPlayers(game) {
  const room = state.room;
  return game.players.map((player) => {
    const seatInfo = room?.seats?.[player.seat];
    return {
      ...player,
      isHost: Boolean(seatInfo?.isHost),
      connected: seatInfo ? seatInfo.connected !== false : true,
      auto: Boolean(seatInfo?.auto),
    };
  });
}

function playerAt(players, seat) {
  return players.find((player) => player.seat === seat);
}

function renderGame() {
  if (!state.room?.game) return renderLoading();
  const room = state.room;
  const game = room.game;
  if (game.phase === 'opening') {
    const breakOrder = openingWallBreakOrder(game);
    if (breakOrder !== null) rememberPlayWallBreak(room, game, breakOrder);
    return renderOpening(room, game);
  }
  const you = game.you;
  const players = getCombinedPlayers(game);
  const viewerSeat = you.seat;
  const topSeat = (viewerSeat + 2) % 4;
  const rightSeat = (viewerSeat + 1) % 4;
  const leftSeat = (viewerSeat + 3) % 4;
  const topPlayer = playerAt(players, topSeat);
  const rightPlayer = playerAt(players, rightSeat);
  const leftPlayer = playerAt(players, leftSeat);
  const selfPlayer = playerAt(players, viewerSeat);
  const actions = you.actions;
  const isMyTurn = game.phase === 'discard' && game.turnSeat === viewerSeat;
  const selectedTile = you.hand.find((tile) => tile.id === state.selectedTileId);

  return `<div class="screen game-screen">
    ${renderGameHeader(room, game, viewerSeat)}
    <div class="game-table-shell">
      <div class="game-table-rim">
        <span class="table-screw table-screw--tl" aria-hidden="true"></span>
        <span class="table-screw table-screw--tr" aria-hidden="true"></span>
        <span class="table-screw table-screw--bl" aria-hidden="true"></span>
        <span class="table-screw table-screw--br" aria-hidden="true"></span>
        <div class="game-table-felt">
          <main class="game-stage">
            ${offlineBanner()}
            ${renderTopOpponent(topPlayer, game)}
            <div class="stage-middle">
              ${renderPlayWall(game)}
              <div class="river-board">
                ${renderRiverLane(topPlayer, 'top', game, viewerSeat)}
                ${renderRiverLane(leftPlayer, 'left', game, viewerSeat)}
                ${renderRiverLane(rightPlayer, 'right', game, viewerSeat)}
                ${renderRiverLane(selfPlayer, 'self', game, viewerSeat)}
              </div>
            </div>
            ${renderSideOpponent(leftPlayer, 'left', game)}
            ${renderSideOpponent(rightPlayer, 'right', game)}
            ${renderPendingNotice(game, players, viewerSeat)}
          </main>
        </div>
        ${renderPlayPod(topPlayer, 'top', game)}
        ${renderPlayPod(leftPlayer, 'left', game)}
        ${renderPlayPod(rightPlayer, 'right', game)}
        <footer class="self-dock">
          <div class="dock-top">
            ${renderSelfIdentity(selfPlayer, game, you)}
            ${renderDockActions(room, game, actions, selectedTile, isMyTurn)}
          </div>
          ${renderSelfMelds(you, game, selfPlayer)}
          ${renderHand(you, game, actions, isMyTurn, selectedTile)}
        </footer>
      </div>
    </div>
    ${state.showResult ? renderResult(room, game, players) : ''}
  </div>`;
}

const OPENING_WALL_SIDES = { top: 14, right: 13, bottom: 14, left: 13 };
const OPENING_WALL_TOTAL_STACKS = 54;
let playWallBreak = { roundNumber: null, seat: null, order: null };

function playWallStoreKey(room) {
  return room?.code ? `heyuan-play-wall:${room.code}` : null;
}

function rememberedPlayWallBreak(room, game) {
  const key = playWallStoreKey(room);
  if (!key) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (!saved || Number(saved.roundNumber) !== game.roundNumber) return null;
    if (game.you && saved.seat !== game.you.seat) return null;
    const order = Number(saved.order);
    if (!Number.isInteger(order) || order < 0 || order >= OPENING_WALL_TOTAL_STACKS) return null;
    return order;
  } catch {
    return null;
  }
}

function rememberPlayWallBreak(room, game, order) {
  const seat = game.you?.seat ?? null;
  playWallBreak = { roundNumber: game.roundNumber, seat, order };
  const key = playWallStoreKey(room);
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({
      roundNumber: game.roundNumber,
      seat,
      order,
    }));
  } catch {
    // 忽略隐私模式等存储不可用的情况
  }
}

function playWallBreakFromServer(game) {
  const breakInfo = game?.wallBreak;
  if (!breakInfo?.dice) return null;
  const side = openingBreakSide(breakInfo, game.dealerSeat, game.you.seat);
  if (!side) return null;
  return (OPENING_WALL_CLOCKWISE_START[side] + breakInfo.dice) % OPENING_WALL_TOTAL_STACKS;
}
const OPENING_WALL_CLOCKWISE_START = (() => {
  const starts = {};
  let offset = 0;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    starts[side] = offset;
    offset += OPENING_WALL_SIDES[side];
  }
  return starts;
})();

function openingWallOrder(side, index) {
  if (side === 'bottom') {
    return OPENING_WALL_CLOCKWISE_START.bottom + (OPENING_WALL_SIDES.bottom - 1 - index);
  }
  if (side === 'left') {
    return OPENING_WALL_CLOCKWISE_START.left + (OPENING_WALL_SIDES.left - 1 - index);
  }
  return OPENING_WALL_CLOCKWISE_START[side] + index;
}

function openingWallTakenCount(wallLeft) {
  const visible = Math.min(
    OPENING_WALL_TOTAL_STACKS,
    Math.max(0, Math.ceil(wallLeft / 2)),
  );
  return OPENING_WALL_TOTAL_STACKS - visible;
}

function openingWallBreakOrder(game) {
  const opening = game?.opening;
  if (!opening?.dice) return null;
  const side = openingBreakSide(opening, game.dealerSeat, game.you.seat);
  if (!side) return null;
  return (OPENING_WALL_CLOCKWISE_START[side] + opening.dice) % OPENING_WALL_TOTAL_STACKS;
}

function isOpeningWallStackTaken(order, breakOrder, removed) {
  if (breakOrder === null || removed <= 0) return false;
  const distance = (order - breakOrder + OPENING_WALL_TOTAL_STACKS) % OPENING_WALL_TOTAL_STACKS;
  return distance < removed;
}

function openingPosition(seat, viewerSeat) {
  return ['bottom', 'right', 'top', 'left'][(seat - viewerSeat + 4) % 4];
}

function openingBreakSide(opening, dealerSeat, viewerSeat) {
  const offset = { opposite: 2, right: 1, left: 3 }[opening.direction];
  if (offset === undefined) return null;
  return openingPosition((dealerSeat + offset) % 4, viewerSeat);
}

function openingStats(game) {
  const opening = game?.opening;
  if (!opening) return null;
  const now = serverNow();
  const events = Array.isArray(opening.dealEvents) ? opening.dealEvents : [];
  const counts = [0, 0, 0, 0];
  let revealed = 0;
  for (const event of events) {
    if (event.at > now) break;
    revealed += 1;
    counts[event.seat] = event.count;
  }
  const started = Boolean(opening.rolledAt);
  const rolling = started && now < opening.diceSettleAt;
  const indicatorRevealed = Boolean(opening.indicatorAt) && now >= opening.indicatorAt;
  const sorted = Boolean(opening.sortAt) && now >= opening.sortAt;
  const allDealt = events.length > 0 && revealed === events.length;
  const wallBase = opening.wallStart ?? (events.length + game.wallLeft);
  const wallLeft = (started
    ? Math.max(game.wallLeft, wallBase - revealed)
    : game.wallLeft) + (indicatorRevealed ? 0 : 1);
  return {
    now,
    events,
    counts,
    revealed,
    started,
    rolling,
    indicatorRevealed,
    sorted,
    allDealt,
    wallLeft,
    progress: events.length ? (revealed / events.length) * 100 : 0,
  };
}

function renderOpening(room, game) {
  const opening = game.opening;
  const viewerSeat = game.you.seat;
  const dealerSeat = game.dealerSeat;
  const players = getCombinedPlayers(game);
  const dealer = playerAt(players, dealerSeat);
  const dealerSeatInfo = room.seats?.[dealerSeat];
  const dealerAuto = Boolean(
    dealer?.isBot
    || dealer?.auto
    || dealerSeatInfo?.auto
    || dealerSeatInfo?.connected === false,
  );
  const isDealer = viewerSeat === dealerSeat;
  const stats = openingStats(game);
  const rolling = stats.rolling || (!stats.started && state.diceRolling);
  const waiting = opening.stage === 'waiting' && !rolling;
  const dealing = opening.stage === 'dealing';
  const diceValue = opening.dice || 5;
  const canRoll = Boolean(opening.canRoll) && state.online && !state.actionInFlight;
  const podSeats = ['bottom', 'right', 'top', 'left']
    .map((position, offset) => [position, (viewerSeat + offset) % 4]);

  let readout;
  if (rolling) {
    readout = `<p class="machine-title">骰子落桌…</p>
      <p class="machine-sub">${isDealer ? '你' : escapeHTML(dealer?.name || '庄家')} 掷骰定开牌位置</p>`;
  } else if (waiting && isDealer) {
    readout = `<p class="machine-title">该你掷骰子</p>
      <p class="machine-sub">1·3·5 对面 · 2·6 右手边 · 4 左边</p>
      <button type="button" class="machine-roll" data-action="roll-dice"${canRoll ? '' : ' disabled'}>
        ${ICON.dice}<span>掷骰子</span>
      </button>`;
  } else if (waiting) {
    readout = `<p class="machine-title">等${escapeHTML(dealer?.name || '庄家')}掷骰</p>
      <p class="machine-sub">1·3·5 对面 · 2·6 右手边 · 4 左边</p>
      <span class="machine-wait"><span class="waiting-dots"><i></i><i></i><i></i></span>${dealerAuto ? '马上自动开牌' : '开牌后自动发牌'}</span>`;
  } else if (dealing) {
    const title = stats.indicatorRevealed
      ? `翻出${tileLabel(game.indicator)} · <b>${game.laizi.label}</b>作赖子`
      : `<b>${opening.dice}</b> 点 · ${opening.directionLabel}开牌`;
    const sub = stats.sorted
      ? '手牌已经理好，准备出牌'
      : stats.indicatorRevealed
        ? '看看手里的赖子，准备出牌'
        : stats.allDealt
          ? '庄家翻开牌尾，定下赖子'
          : `从${opening.directionLabel}数 ${opening.count} 墩起牌`;
    const caption = stats.sorted
      ? '理牌完成'
      : stats.allDealt
        ? '翻开牌尾'
        : '发牌中 · 每人 13 张';
    readout = `<p class="machine-title" data-opening-title>${title}</p>
      <p class="machine-sub" data-opening-sub>${sub}</p>
      <div class="deal-progress" data-opening-progress><span style="width:${stats.progress.toFixed(2)}%"></span></div>
      <p class="machine-deal-caption" data-opening-caption><span class="deal-pulse"></span>${caption}</p>
      <div class="machine-counter"><span>余牌</span><b data-opening-wall>${stats.wallLeft}</b><span>张</span></div>`;
  } else {
    readout = '<p class="machine-title">正在摆牌…</p>';
  }

  const dieClasses = [
    'die-cube',
    `cube-v${diceValue}`,
    rolling ? 'is-rolling' : '',
    stats.started && !rolling ? 'is-settled' : '',
    !stats.started && !rolling ? 'is-idle' : '',
  ].filter(Boolean).join(' ');
  const breakSide = stats.started
    ? openingBreakSide(opening, dealerSeat, viewerSeat)
    : null;

  return `<div class="screen game-screen opening-screen">
    ${renderGameHeader(room, game, viewerSeat)}
    <main class="opening-stage">
      ${offlineBanner()}
      <div class="opening-machine${dealing ? ' is-dealing' : ''}${rolling ? ' is-rolling' : ''}">
        <div class="machine-rim">
          <span class="rim-screw rim-screw--tl" aria-hidden="true"></span>
          <span class="rim-screw rim-screw--tr" aria-hidden="true"></span>
          <span class="rim-screw rim-screw--bl" aria-hidden="true"></span>
          <span class="rim-screw rim-screw--br" aria-hidden="true"></span>
          <div class="machine-felt">
            <span class="machine-mark" aria-hidden="true">牛</span>
            <div class="machine-wall-ring" aria-hidden="true">
              ${Object.keys(OPENING_WALL_SIDES).map((side) => renderOpeningWall(side, stats, breakSide, game)).join('')}
            </div>
            ${renderOpeningHands(game, players, stats, viewerSeat)}
            ${renderOpeningIndicator(game, stats)}
            <div class="machine-console">
              <p class="machine-round">第 ${game.roundNumber} 局 · ${escapeHTML(dealer?.name || '庄家')}坐庄</p>
              <div class="dice-slot">
                <span class="dice-shadow" aria-hidden="true"></span>
                <div class="die-scene">
                  <div class="${dieClasses}" data-opening-die role="img" aria-label="${stats.started && !rolling ? `骰子 ${diceValue} 点` : '骰子'}">
                    ${[1, 2, 3, 4, 5, 6].map((face) => `<span class="cube-face cube-face--${face}"><span class="die-pips${[1, 4].includes(face) ? ' die-pips--red' : ''}">${renderDieFace(face)}</span></span>`).join('')}
                    <span class="die-core" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map((face) => `<span class="core-face core-face--${face}"></span>`).join('')}</span>
                  </div>
                </div>
              </div>
              <div class="machine-readout">${readout}</div>
            </div>
          </div>
          ${renderOpeningSelfHand(game, players, stats, viewerSeat)}
        </div>
        ${podSeats.map(([position, seat]) => renderOpeningPod(position, playerAt(players, seat), {
          dealerSeat,
          viewerSeat,
        })).join('')}
      </div>
    </main>
  </div>`;
}

function renderOpeningPod(position, player, options) {
  if (!player) return '';
  const { dealerSeat, viewerSeat } = options;
  const isDealer = player.seat === dealerSeat;
  const isYou = player.seat === viewerSeat;
  return `<div class="machine-pod machine-pod--${position}${isDealer ? ' is-dealer' : ''}${isYou ? ' is-you' : ''}" data-opening-pod="${player.seat}">
    <span class="pod-avatar">${avatarHTML(player.avatar, { className: 'pod-avatar-svg' })}</span>
    <span class="pod-copy">
      <b><span class="seat-name">${escapeHTML(player.name)}</span>${isYou ? '<i class="you-mark">你</i>' : ''}</b>
      <small class="pod-score">${fundsText(player.score)}</small>
    </span>
    ${isDealer ? '<span class="pod-dealer">庄</span>' : ''}
  </div>`;
}

const DIE_PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function renderDieFace(value) {
  const active = new Set(DIE_PIPS[value] || DIE_PIPS[5]);
  return Array.from({ length: 9 }, (_, index) => (
    `<i class="die-pip${active.has(index) ? ' is-on' : ''}"></i>`
  )).join('');
}

function renderOpeningHands(game, players, stats, viewerSeat) {
  return ['right', 'top', 'left'].map((position, offset) => {
    const seat = (viewerSeat + offset + 1) % 4;
    const player = playerAt(players, seat);
    if (!player) return '';
    const side = position === 'left' || position === 'right';
    const count = stats.sorted ? player.handCount : (stats.counts[seat] || 0);
    const content = Array.from({ length: Math.min(count, 14) }, () => (
      renderBack({ size: side ? 'opening-side' : 'opening' })
    )).join('');
    return `<div class="opening-hand opening-hand--${position}" data-opening-hand="${seat}" aria-label="${escapeHTML(player.name)}的手牌">
      ${content}
    </div>`;
  }).join('');
}

function renderOpeningSelfHand(game, players, stats, viewerSeat) {
  const viewer = game.you;
  if (!playerAt(players, viewerSeat)) return '';
  const revealCount = stats.sorted ? viewer.hand.length : (stats.counts[viewerSeat] || 0);
  const tiles = stats.sorted
    ? viewer.hand
    : (game.opening.myDeal || []).slice(0, revealCount);
  const laiziKey = stats.indicatorRevealed ? game.laizi?.key : null;
  const content = tiles.map((tile) => renderTile(tile, {
    size: 'opening',
    tileId: tile.id,
    laiziKey,
  })).join('');
  return `<div class="opening-hand opening-hand--bottom is-self" data-opening-hand="${viewerSeat}" aria-label="你的手牌">
    ${content}
  </div>`;
}

function renderOpeningIndicator(game, stats) {
  const shown = stats.allDealt || stats.indicatorRevealed;
  return `<div class="indicator-slot${shown ? ' is-shown' : ''}${stats.indicatorRevealed ? ' is-revealed' : ''}" data-opening-indicator aria-hidden="${shown ? 'false' : 'true'}">
    <div class="indicator-tile">
      <span class="indicator-face indicator-face--back">${renderBack({ size: 'indicator' })}</span>
      <span class="indicator-face indicator-face--front">${renderTile(game.indicator, { size: 'indicator' })}</span>
    </div>
    <span class="indicator-caption" data-indicator-caption>牌尾 · ${stats.indicatorRevealed ? '定赖' : '待翻'}</span>
  </div>`;
}

function renderOpeningWall(side, stats, breakSide, game) {
  const total = OPENING_WALL_SIDES[side];
  const active = Boolean(breakSide === side && stats.started && !stats.indicatorRevealed);
  const breakOrder = openingWallBreakOrder(game) ?? playWallBreakFromServer(game) ?? 0;
  const removed = openingWallTakenCount(stats.wallLeft);
  const stacks = [];
  for (let index = 0; index < total; index += 1) {
    const order = openingWallOrder(side, index);
    const taken = isOpeningWallStackTaken(order, breakOrder, removed);
    stacks.push(`<span class="wall-stack${taken ? ' is-taken' : ''}" data-wall-order="${order}"></span>`);
  }
  return `<div class="machine-wall machine-wall--${side}${active ? ' is-active' : ''}" aria-hidden="true">
    ${stacks.join('')}
  </div>`;
}

function renderPlayWall(game) {
  const stats = { wallLeft: game.wallLeft, started: false };
  const markup = Object.keys(OPENING_WALL_SIDES)
    .map((side) => renderOpeningWall(side, stats, null, game));
  return `<div class="game-wall" aria-hidden="true">
    <div class="machine-wall-ring">${markup.join('')}</div>
  </div>`;
}

function scheduleOpeningAnimation() {
  const room = state.room;
  const game = room?.game;
  if (!game || game.phase !== 'opening') return;
  const opening = game.opening;
  const key = openingKey(room);
  if (!key || opening.stage !== 'dealing') return;
  const stats = openingStats(game);
  const now = serverNow();

  if (now < opening.diceSettleAt) {
    scheduleOpeningStep(opening.diceSettleAt - now + 20, () => {
      if (openingStillActive(key)) render();
    });
  }

  stats.events.forEach((event, index) => {
    if (event.at <= now) return;
    scheduleOpeningStep(event.at - now, () => revealOpeningEvent(key, event, index));
  });

  if (!opening.indicatorAt) return;
  const lastDrawAt = stats.events.length
    ? stats.events[stats.events.length - 1].at
    : opening.diceSettleAt;
  if (lastDrawAt && now < lastDrawAt + 80) {
    scheduleOpeningStep(Math.max(0, lastDrawAt + 80 - now), () => showOpeningIndicator(key));
  }
  if (now < opening.indicatorAt) {
    scheduleOpeningStep(opening.indicatorAt - now, () => flipOpeningIndicator(key));
  }
  if (now < opening.sortAt) {
    scheduleOpeningStep(opening.sortAt - now, () => runOpeningSort(key));
  }
}

function openingStillActive(key) {
  return Boolean(key) && currentOpeningKey() === key && state.room?.game?.phase === 'opening';
}

function revealOpeningEvent(key, event, index) {
  if (!openingStillActive(key)) return;
  const room = state.room;
  const game = room.game;
  const opening = game.opening;
  const viewerSeat = game.you.seat;
  const container = appRoot.querySelector(`[data-opening-hand="${event.seat}"]`);
  if (!container) return;

  if (event.seat === viewerSeat) {
    const tile = opening.myDeal?.[event.tileIndex];
    if (tile && !container.querySelector(`[data-tile-id="${tile.id}"]`)) {
      const laiziKey = opening.indicatorAt && serverNow() >= opening.indicatorAt
        ? game.laizi?.key
        : null;
      container.insertAdjacentHTML('beforeend', renderTile(tile, {
        size: 'opening',
        tileId: tile.id,
        laiziKey,
      }));
      container.lastElementChild?.classList.add('is-dealt');
    }
  } else {
    const position = openingPosition(event.seat, viewerSeat);
    const side = position === 'left' || position === 'right';
    container.insertAdjacentHTML('beforeend', renderBack({
      size: side ? 'opening-side' : 'opening',
      className: 'is-dealt',
    }));
  }

  updateOpeningWall(openingStats(game).wallLeft);
  const progress = document.querySelector('[data-opening-progress] span');
  if (progress) {
    const percent = opening.dealEvents.length
      ? ((index + 1) / opening.dealEvents.length) * 100
      : 100;
    progress.style.width = `${percent.toFixed(2)}%`;
  }
  if (index + 1 === opening.dealEvents.length) {
    const sub = document.querySelector('[data-opening-sub]');
    if (sub) sub.textContent = '庄家翻开牌尾，定下赖子';
    const caption = document.querySelector('[data-opening-caption]');
    if (caption) caption.innerHTML = '<span class="deal-pulse"></span>翻开牌尾';
  }
  if (index % 4 === 0) audio.play('draw');
}

function updateOpeningWall(wallLeft) {
  document.querySelectorAll('[data-opening-wall]').forEach((element) => {
    element.textContent = String(wallLeft);
  });
  const game = state.room?.game;
  const breakOrder = openingWallBreakOrder(game);
  const removed = openingWallTakenCount(wallLeft);
  document.querySelectorAll('[data-wall-order]').forEach((stack) => {
    const order = Number(stack.dataset.wallOrder);
    stack.classList.toggle('is-taken', isOpeningWallStackTaken(order, breakOrder, removed));
  });
}

function showOpeningIndicator(key) {
  if (!openingStillActive(key)) return;
  const slot = document.querySelector('[data-opening-indicator]');
  if (!slot) return;
  slot.classList.add('is-shown');
  slot.setAttribute('aria-hidden', 'false');
}

function flipOpeningIndicator(key) {
  if (!openingStillActive(key)) return;
  const game = state.room.game;
  updateOpeningWall(openingStats(game).wallLeft);
  const slot = document.querySelector('[data-opening-indicator]');
  if (slot) {
    slot.classList.add('is-shown', 'is-revealed');
    slot.setAttribute('aria-hidden', 'false');
    const caption = slot.querySelector('[data-indicator-caption]');
    if (caption) caption.textContent = '牌尾 · 定赖';
  }
  const chip = document.querySelector('[data-opening-laizi]');
  if (chip) {
    chip.classList.remove('is-concealed');
    chip.title = `翻出${tileLabel(game.indicator)}，${game.laizi.label}作赖子`;
  }
  const title = document.querySelector('[data-opening-title]');
  if (title) {
    title.innerHTML = `翻出${tileLabel(game.indicator)} · <b>${game.laizi.label}</b>作赖子`;
  }
  const sub = document.querySelector('[data-opening-sub]');
  if (sub) sub.textContent = '看看手里的赖子，准备出牌';
  const caption = document.querySelector('[data-opening-caption]');
  if (caption) caption.innerHTML = '<span class="deal-pulse"></span>翻开牌尾';
  markOpeningLaizi(game);
  audio.play('select');
}

function markOpeningLaizi(game) {
  if (!game?.laizi) return;
  const container = appRoot.querySelector(`[data-opening-hand="${game.you.seat}"]`);
  if (!container) return;
  const label = `${tileLabel(game.laizi)}，赖子`;
  container.querySelectorAll(`[data-tile-key="${game.laizi.key}"]`).forEach((tile) => {
    tile.classList.add('is-laizi');
    tile.title = label;
    tile.setAttribute('aria-label', label);
    if (!tile.querySelector('.laizi-flag')) {
      tile.insertAdjacentHTML('beforeend', '<span class="laizi-flag">赖</span>');
    }
  });
}

function runOpeningSort(key) {
  if (!openingStillActive(key)) return;
  const game = state.room.game;
  const viewerSeat = game.you.seat;
  const container = appRoot.querySelector(`[data-opening-hand="${viewerSeat}"]`);
  if (!container) return;
  const elements = new Map(
    [...container.children]
      .filter((element) => element.dataset.tileId)
      .map((element) => [element.dataset.tileId, element]),
  );
  const currentOrder = [...container.children]
    .map((element) => element.dataset.tileId)
    .filter(Boolean);
  const sortedOrder = game.you.hand.map((tile) => tile.id);
  if (sortedOrder.join('|') !== currentOrder.join('|')) {
    const firstRects = new Map(
      [...elements.entries()].map(([id, element]) => [id, element.getBoundingClientRect()]),
    );
    sortedOrder.forEach((id) => {
      const element = elements.get(id);
      if (element) container.appendChild(element);
    });
    elements.forEach((element, id) => {
      const first = firstRects.get(id);
      if (!first) return;
      const last = element.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      element.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 620, easing: 'cubic-bezier(0.22, 0.9, 0.28, 1)' },
      );
    });
  }
  container.classList.add('is-sorting');
  const sub = document.querySelector('[data-opening-sub]');
  if (sub) sub.textContent = '按花色理牌中…';
  audio.play('draw');
  scheduleOpeningStep(700, () => {
    if (!openingStillActive(key)) return;
    const caption = document.querySelector('[data-opening-caption]');
    if (caption) caption.innerHTML = '<span class="deal-pulse"></span>理牌完成';
    const currentSub = document.querySelector('[data-opening-sub]');
    if (currentSub) currentSub.textContent = '手牌已经理好，准备出牌';
  });
}

function orientationOverlay() {
  if (!isMobileDevice() || !isPortrait()) return '';
  const auto = supportsAutoLandscape();
  return `<div class="rotate-overlay" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
    <div class="rotate-card">
      <div class="rotate-glyph" aria-hidden="true"><span>${ICON.rotate}</span></div>
      <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>横屏牌桌</p>
      <h2 id="rotate-title">把手机横过来</h2>
      <p>${auto
    ? '横屏之后，手牌、牌河和操作按钮都会更顺手。支持自动横屏的手机可以直接进入。'
    : '把手机横过来就会切换到横屏布局，牌桌会固定大小，避免误触。'}</p>
      ${auto ? '<button type="button" class="button button--primary button--wide" data-action="enter-landscape">进入横屏</button>' : ''}
      <p class="rotate-required">请先横放手机再继续；若画面未旋转，请关闭系统的竖排方向锁定。</p>
    </div>
  </div>`;
}

function renderGameHeader(room, game, viewerSeat) {
  const opening = game.phase === 'opening' ? game.opening : null;
  const stats = opening ? openingStats(game) : null;
  const laiziRevealed = !opening || stats.indicatorRevealed;
  const wallLeft = stats ? stats.wallLeft : game.wallLeft;
  const laiziTitle = laiziRevealed
    ? `翻出${tileLabel(game.indicator)}，${game.laizi.label}作赖子`
    : '牌尾翻出什么，下一张就是赖子';
  return `<header class="game-header">
    <div class="game-header-left">
      <button type="button" class="icon-button icon-button--dark" data-action="ask-leave" aria-label="离开对局">${ICON.back}</button>
      <div class="game-status-chips">
      ${opening ? '' : `<div class="chip chip--tail" title="牌尾翻出${tileLabel(game.indicator)}，第四张已亮明">
        ${renderTile(game.indicator, { size: 'chip' })}
        <span class="chip-label">尾牌 <b>${tileLabel(game.indicator)}</b></span>
      </div>`}
      <div class="chip chip--laizi${laiziRevealed ? '' : ' is-concealed'}"${opening ? ' data-opening-laizi' : ''} title="${laiziTitle}">
        <span class="laizi-state laizi-state--veiled">
          ${renderBack({ size: 'chip' })}
          <span class="chip-label">赖子 <b>待翻</b></span>
        </span>
        <span class="laizi-state laizi-state--open">
          ${renderTile(game.laizi, { size: 'chip', laiziKey: game.laizi.key })}
          <span class="chip-label">赖子 <b>${game.laizi.label}</b></span>
        </span>
      </div>
      <div class="chip chip--wall"><span>余牌</span><b${opening ? ' data-opening-wall' : ''}>${wallLeft}</b></div>
      </div>
    </div>
    <div class="game-header-right">
      <span class="wind-reminder">你坐 ${game.players[viewerSeat]?.wind || ''} 位</span>
      ${rulesButton()}
      ${soundButton(true)}
      <button type="button" class="icon-button icon-button--dark" data-action="open-menu" aria-label="牌桌菜单">${ICON.menu}</button>
    </div>
  </header>`;
}

function renderTopOpponent(player, game) {
  if (!player) return '';
  const isTurn = game.phase !== 'ended' && game.turnSeat === player.seat;
  return `<div class="opponent opponent--top${isTurn ? ' is-turn' : ''}">
    <div class="opponent-hand-backs">${renderHandBacks(player.handCount, 'horizontal')}</div>
    <div class="opponent-melds">${renderMeldStrip(player, 'horizontal', game)}</div>
    <span class="turn-pin">出牌中</span>
  </div>`;
}

// Seat cards live on the rim (outside the felt) and counter-rotate, so they face the viewer flat.
function renderPlayPod(player, position, game) {
  if (!player) return '';
  const isTurn = game.phase !== 'ended' && game.turnSeat === player.seat;
  return `<div class="machine-pod machine-pod--${position}${player.isDealer ? ' is-dealer' : ''}${isTurn ? ' is-turn' : ''}" data-seat="${player.seat}">
    <span class="pod-avatar">${avatarHTML(player.avatar, { className: 'pod-avatar-svg' })}</span>
    <span class="pod-copy">
      <b><span class="seat-name">${escapeHTML(player.name)}</span><i class="wind-tag">${player.wind}</i>${player.isHost && position === 'top' ? '<i class="host-tag">东家</i>' : ''}</b>
      <small class="pod-score">${fundsText(player.score)}</small>
    </span>
    ${player.isDealer ? '<span class="pod-dealer">庄</span>' : ''}
    ${player.auto && !player.isBot ? '<span class="auto-tag">托</span>' : ''}
  </div>`;
}

function renderSideOpponent(player, side, game) {
  if (!player) return '';
  const isTurn = game.phase !== 'ended' && game.turnSeat === player.seat;
  return `<div class="opponent opponent--side opponent--${side}${isTurn ? ' is-turn' : ''}">
    <div class="opponent-hand-backs opponent-hand-backs--vertical">${renderHandBacks(player.handCount, 'vertical')}</div>
    <div class="opponent-melds">${renderMeldStrip(player, 'vertical', game)}</div>
    <span class="turn-pin">出牌中</span>
  </div>`;
}

function renderHandBacks(count, direction) {
  const total = Math.max(0, Math.min(14, count));
  return Array.from({ length: total }, () => (
    renderBack({ size: direction === 'vertical' ? 'back-side' : 'back-mini' })
  )).join('');
}

function chengdiaoTilesOf(player) {
  return (player?.discards || []).filter((tile) => tile.chengdiao);
}

function renderChengdiaoMeld(tiles, options = {}) {
  if (!tiles.length) return '';
  const size = options.size || 'meld';
  const label = `惩调 ×${tiles.length}`;
  return `<span class="meld meld--chengdiao meld--size-${size}" title="${label}" aria-label="${label}">${tiles.map((tile) => renderTile(tile, {
    size,
    laiziKey: options.laiziKey,
  })).join('')}</span>`;
}

function renderMeldStrip(player, orientation, game) {
  const melds = player.melds || [];
  const chengdiao = chengdiaoTilesOf(player);
  if (melds.length === 0 && chengdiao.length === 0) return '';
  return `<div class="meld-strip meld-strip--${orientation}">
    ${renderChengdiaoMeld(chengdiao, { laiziKey: game.laizi.key })}
    ${melds.map((meld) => renderMeld(meld, {
      size: 'meld',
      viewerSeat: game.you.seat,
      laiziKey: game.laizi.key,
    })).join('')}
  </div>`;
}

function renderRiverLane(player, position, game, viewerSeat) {
  if (!player) return '';
  const isSelf = player.seat === viewerSeat;
  const isTurn = game.phase !== 'ended' && game.turnSeat === player.seat && game.phase === 'discard';
  const lastDiscard = game.lastDiscard;
  const highlightLast = lastDiscard && lastDiscard.seat === player.seat;
  const discards = (player.discards || []).filter((tile) => !tile.chengdiao);
  return `<section class="river-lane river-lane--${position}${isSelf ? ' is-self' : ''}${isTurn ? ' is-turn' : ''}" aria-label="${isSelf ? '你' : escapeHTML(player.name)}的牌河">
    <div class="river-tiles">
      ${discards.length
    ? discards.map((tile, index) => {
      let row = 0;
      let column = index;
      while (column >= 4 + row * 2) {
        column -= 4 + row * 2;
        row += 1;
      }
      return `<span class="river-slot" style="--river-column:${column};--river-row:${row};--river-columns:${4 + row * 2}">${renderTile(tile, {
      size: 'river',
      laiziKey: game.laizi.key,
      highlight: highlightLast && lastDiscard.tile.id === tile.id,
    })}</span>`;
    }).join('')
    : ''}
    </div>
  </section>`;
}

function renderPendingNotice(game, players, viewerSeat) {
  if (game.phase !== 'claim' || !game.pending) return '';
  const from = game.players.find((player) => player.seat === game.pending.fromSeat);
  const waiting = (game.pending.waitingSeats || [])
    .filter((seat) => seat !== viewerSeat)
    .map((seat) => game.players[seat]?.name)
    .filter(Boolean);
  const youWaiting = game.pending.waitingSeats?.includes(viewerSeat);
  if (!waiting.length && !youWaiting) return '';
  const text = youWaiting && waiting.length
    ? `等你与${waiting.join('、')}应对 ${from?.name || ''} 的 ${tileLabel(game.pending.tile)}`
    : youWaiting
      ? `该你应对 ${from?.name || ''} 的 ${tileLabel(game.pending.tile)}`
      : `等${waiting.join('、')}应对 ${from?.name || ''} 的 ${tileLabel(game.pending.tile)}`;
  return `<div class="pending-notice"><span class="pending-pulse"></span>${escapeHTML(text)}<span class="pending-countdown" data-deadline="${game.pending.deadline}">10s</span></div>`;
}

function renderSelfIdentity(player, game, you) {
  if (!player) return '';
  const isTurn = game.phase === 'discard' && game.turnSeat === player.seat;
  return `<div class="self-identity${isTurn ? ' is-turn' : ''}" data-seat="${player.seat}">
    <span class="self-avatar">${avatarHTML(player.avatar, { className: 'self-avatar-svg' })}</span>
    <span class="self-copy">
      <strong>${escapeHTML(player.name)}<span class="you-mark">你</span></strong>
      <small>${player.wind}位 · ${fundsText(player.score)}${player.isDealer ? ' · 庄家' : ''}</small>
    </span>
    <span class="self-badges">
      ${you.wildCount > 1 ? `<span class="badge badge--warning">赖子 ${you.wildCount} 张 · 胡不了</span>` : ''}
      ${you.wildCount === 1 ? '<span class="badge badge--soft">手中有赖</span>' : ''}
      ${you.chengdiaoCount > 0 ? `<span class="badge badge--soft">惩调 ×${2 ** you.chengdiaoCount}</span>` : ''}
      ${player.auto && !player.isBot ? '<span class="badge">托管中</span>' : ''}
    </span>
  </div>`;
}

function renderTurnClock(game, { quiet = false } = {}) {
  if (game.phase !== 'discard' || !game.turnDeadline) return '';
  const duration = game.turnLimitMs || TURN_LIMIT;
  const seconds = Math.max(0, Math.ceil((game.turnDeadline - serverNow()) / 1000));
  return `<span class="turn-clock countdown-pill${quiet ? ' turn-clock--quiet' : ''}" data-deadline="${game.turnDeadline}" data-duration="${duration}" data-turn-clock aria-label="出牌倒计时 ${seconds} 秒">
    <span class="countdown-value">${seconds}</span><span class="countdown-unit">秒</span>
  </span>`;
}

function renderDockActions(room, game, actions, selectedTile, isMyTurn) {
  if (game.phase === 'ended') {
    return `<div class="dock-actions dock-actions--ended">
      ${game.result ? '<button type="button" class="button button--small button--ink" data-action="reopen-result">本局结算</button>' : ''}
    </div>`;
  }
  if (!state.online) {
    return '<div class="dock-actions"><span class="action-status">正在重新连接…</span></div>';
  }

  if (actions?.kind === 'claim') {
    return `<div class="dock-actions dock-actions--claim">
      <span class="countdown-pill" data-deadline="${actions.deadline}">
        <span class="countdown-value">10</span><span class="countdown-unit">秒</span>
      </span>
      ${actions.canPeng && !actions.canGang ? '<button type="button" class="action-button" data-action="claim" data-choice="peng">碰</button>' : ''}
      ${actions.canGang ? '<button type="button" class="action-button action-button--jade" data-action="claim" data-choice="gang">杠</button>' : ''}
      <button type="button" class="action-button action-button--ghost" data-action="claim" data-choice="pass">过</button>
    </div>`;
  }

  if (actions?.kind === 'self' && isMyTurn) {
    const discardLabel = selectedTile ? tileLabel(selectedTile) : '';
    const selectedLaizi = Boolean(selectedTile && selectedTile.key === game.laizi.key);
    const canChengSelected = Boolean(selectedLaizi && actions.canChengdiao);
    return `<div class="dock-actions dock-actions--self">
      ${renderTurnClock(game)}
      ${actions.canWin ? '<button type="button" class="action-button action-button--hu" data-action="declare-win">胡</button>' : ''}
      ${canChengSelected ? '<button type="button" class="action-button action-button--cheng" data-action="cheng-selected">惩调</button>' : ''}
      ${actions.gangs?.length ? `<button type="button" class="action-button action-button--jade" data-action="open-gangs">${actions.gangs.every((gang) => gang.kind === 'huihui') ? '回回' : '杠'}${actions.gangs.length > 1 ? ` ${actions.gangs.length}` : ''}</button>` : ''}
      ${selectedTile
    ? (selectedLaizi
      ? `<span class="action-hint">${canChengSelected ? '赖子不能当普通牌打出，点「惩调」打到牌河并摸牌尾' : '赖子不能打出，先留在手里'}</span>`
      : `<button type="button" class="action-button action-button--discard" data-action="discard-selected">打出 <small>${discardLabel}</small></button>`)
    : `<span class="action-hint">点一张牌，再点一次打出</span>`}
      <span class="turn-warning" data-turn-warning hidden aria-live="polite"></span>
    </div>`;
  }

  if (game.phase === 'claim') {
    const deadline = game.pending?.deadline;
    return `<div class="dock-actions dock-actions--waiting">
      <span class="action-status">${renderWaitingText(game)}</span>
      ${deadline ? `<span class="countdown-pill countdown-pill--quiet" data-deadline="${deadline}"><span class="countdown-value">10</span><span class="countdown-unit">秒</span></span>` : ''}
    </div>`;
  }

  if (game.phase === 'discard') {
    const turnPlayer = game.players[game.turnSeat];
    const status = isMyTurn ? '轮到你出牌' : `等 ${turnPlayer?.name || ''} 出牌`;
    return `<div class="dock-actions dock-actions--waiting">
      <span class="action-status">${escapeHTML(status)}</span>
      ${isMyTurn ? '' : renderTurnClock(game, { quiet: true })}
      ${isMyTurn ? '<span class="action-hint">超时自动出牌</span>' : ''}
    </div>`;
  }
  return '<div class="dock-actions"></div>';
}

function renderWaitingText(game) {
  const waiting = game.pending?.waitingSeats || [];
  const names = waiting
    .map((seat) => game.players[seat]?.name)
    .filter(Boolean);
  if (!names.length) return '正在收牌…';
  return `等 ${escapeHTML(names.join('、'))} 应对`;
}

function renderSelfMelds(you, game, selfPlayer) {
  const melds = you.melds || [];
  const chengdiao = chengdiaoTilesOf(selfPlayer);
  if (melds.length === 0 && chengdiao.length === 0) return '';
  return `<div class="self-meld-row">
    <span class="self-meld-label">面子</span>
    ${renderChengdiaoMeld(chengdiao, { size: 'meld-self', laiziKey: game.laizi.key })}
    ${melds.map((meld) => renderMeld(meld, {
    size: 'meld-self',
    viewerSeat: you.seat,
    laiziKey: game.laizi.key,
  })).join('')}
  </div>`;
}

function renderHand(you, game, actions, isMyTurn, selectedTile) {
  const drawnId = actions?.kind === 'self' ? actions.drawnTileId : null;
  const ordered = [...you.hand];
  if (drawnId) {
    const index = ordered.findIndex((tile) => tile.id === drawnId);
    if (index >= 0) ordered.push(...ordered.splice(index, 1));
  }
  const canInteract = Boolean(isMyTurn && actions?.kind === 'self' && state.online && game.phase !== 'ended');
  return `<div class="hand-zone">
    <div class="hand${canInteract ? ' is-interactive' : ''}" data-hand-seat="${you.seat}">
      ${ordered.map((tile) => renderTile(tile, {
    size: 'hand',
    laiziKey: game.laizi.key,
    selected: tile.id === state.selectedTileId,
    drawn: tile.id === drawnId,
    tileId: tile.id,
    interactive: canInteract,
  })).join('')}
    </div>
    ${canInteract ? `<span class="hand-tip">${selectedTile
    ? '再点一次也可以打出'
    : '点选一张要打出的牌'}</span>` : ''}
  </div>`;
}

function resultScoreColumns(result) {
  const gangEvents = (Array.isArray(result.scoreEvents) ? result.scoreEvents : [])
    .filter((event) => event.type === 'gang');
  const hasWin = result.type === 'win' && result.winnerSeat !== null && result.winnerSeat !== undefined;
  const huBySeat = new Map();
  const gangBySeat = new Map();

  if (hasWin) {
    const payments = Array.isArray(result.payments) ? result.payments : [];
    for (const payment of payments) {
      huBySeat.set(payment.seat, (huBySeat.get(payment.seat) || 0) - (payment.amount || 0));
    }
    const total = payments.length
      ? payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
      : (result.total ?? 0);
    huBySeat.set(result.winnerSeat, (huBySeat.get(result.winnerSeat) || 0) + total);
  }

  for (const event of gangEvents) {
    const total = event.total ?? (event.amount || 0) * (event.payers?.length || 0);
    gangBySeat.set(event.seat, (gangBySeat.get(event.seat) || 0) + total);
    for (const payer of event.payers || []) {
      gangBySeat.set(payer, (gangBySeat.get(payer) || 0) - (event.amount || 0));
    }
  }

  return { hasWin, hasGang: gangEvents.length > 0, huBySeat, gangBySeat };
}

function renderResult(room, game, players) {
  const result = game.result;
  const winner = result.type === 'win' ? playerAt(players, result.winnerSeat) : null;
  const reveal = winner && result.reveal
    ? result.reveal.find((entry) => entry.seat === result.winnerSeat)
    : null;
  const isHost = room.you?.isHost;
  const winnerCharacter = winner ? getCharacter(winner.avatar) : null;
  const { hasWin, hasGang, huBySeat, gangBySeat } = resultScoreColumns(result);
  const detailColumns = (hasWin ? 1 : 0) + (hasGang ? 1 : 0);
  const hasBots = players.some((player) => player.isBot);
  const settlementNote = hasBots
    ? '有 AI 参战，本局只作牌桌记录，不改变角色资金。'
    : '本局结果已存入四家的角色资金。';

  return `<div class="result-overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
    <div class="result-card">
      <button type="button" class="icon-button result-close" data-action="dismiss-result" aria-label="收起结算">${ICON.close}</button>
      <header class="result-header">
        <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>第 ${game.roundNumber} 局 · 结算</p>
        ${winner ? `<div class="result-winner">
          <span class="result-avatar">${avatarHTML(winner.avatar, { className: 'result-avatar-svg' })}</span>
          <div>
            <h2 id="result-title">${escapeHTML(winner.name)} 自摸（${result.soft ? '软的' : '黑的'}）</h2>
            <p>${winnerCharacter?.animal || ''} · ${winner.wind}位${winner.isDealer ? ' · 庄家' : ''}</p>
          </div>
        </div>` : `<div class="result-winner result-winner--draw">
          <span class="draw-seal">荒</span>
          <div><h2 id="result-title">本局荒庄</h2><p>牌墙已摸完，四家未胡</p></div>
        </div>`}
      </header>
      ${reveal ? `<div class="result-hand-block">
        <div class="result-hand">
          ${(reveal.melds || []).map((meld) => renderMeld(meld, {
    size: 'result-meld',
    viewerSeat: game.you.seat,
    laiziKey: game.laizi.key,
  })).join('')}
          ${(reveal.hand || []).map((tile) => renderTile(tile, {
    size: 'result',
    laiziKey: game.laizi.key,
  })).join('')}
        </div>
      </div>` : ''}
      <div class="result-scores" data-cols="${detailColumns}">
        <div class="result-score-head">
          <span>四家资金</span>
          ${hasWin ? '<span>胡牌</span>' : ''}
          ${hasGang ? '<span>杠分</span>' : ''}
          <span>本局</span>
          <span>总计</span>
        </div>
        ${players.map((player) => {
    const delta = result.deltas?.[player.seat] ?? 0;
    const hu = huBySeat.get(player.seat) ?? 0;
    const gang = gangBySeat.get(player.seat) ?? 0;
    const detailCell = (value) => `<span class="result-score-detail${value > 0 ? ' positive' : value < 0 ? ' negative' : ''}">${value ? formatScore(value) : '—'}</span>`;
    return `<div class="result-score-row${player.seat === result.winnerSeat ? ' is-winner' : ''}">
      <span class="result-score-person">
        <span class="tiny-avatar">${avatarHTML(player.avatar, { className: 'tiny-avatar-svg' })}</span>
        <span>${escapeHTML(player.name)}${player.seat === room.viewerSeat ? '<i>你</i>' : ''}</span>
      </span>
      ${hasWin ? detailCell(hu) : ''}
      ${hasGang ? detailCell(gang) : ''}
      <b class="result-score-delta${delta > 0 ? ' positive' : delta < 0 ? ' negative' : ''}">${formatScore(delta)}</b>
      <em class="result-score-total">${player.score}</em>
    </div>`;
  }).join('')}
      </div>
      <div class="result-actions">
        <button type="button" class="button button--ghost" data-action="dismiss-result">看看牌桌</button>
        ${isHost
    ? `<button type="button" class="button button--primary" data-action="next-round"><span>再来一局</span>${ICON.arrow}</button>`
    : '<button type="button" class="button button--disabled" disabled>等东家开下一局</button>'}
      </div>
      <p class="result-foot">${settlementNote}${isHost ? ' 胡牌者下局坐庄，荒庄连庄。' : ' 东家点开下一局后，这里会自动开始。'}</p>
    </div>
  </div>`;
}

function renderModal() {
  if (!state.modal) {
    modalRoot.innerHTML = '';
    document.body.classList.remove('has-modal');
    return;
  }
  const type = state.modal.type;
  if (type === 'rules') {
    modalRoot.innerHTML = renderRulesModal();
  } else if (type === 'menu') {
    modalRoot.innerHTML = renderMenuModal();
  } else if (type === 'gang') {
    modalRoot.innerHTML = renderGangModal();
  } else if (type === 'confirm-leave') {
    modalRoot.innerHTML = renderLeaveConfirm();
  } else if (type === 'share') {
    modalRoot.innerHTML = renderShareModal();
  } else if (type === 'fullscreen-guide') {
    modalRoot.innerHTML = renderFullscreenGuide();
  }
  document.body.classList.add('has-modal');
  requestAnimationFrame(() => {
    const focusTarget = modalRoot.querySelector('[data-autofocus]');
    focusTarget?.focus();
  });
}

function modalShell(content, options = {}) {
  return `<div class="modal-backdrop" data-action="${options.locked ? '' : 'close-modal'}">
    <div class="modal${options.wide ? ' modal--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel>
      <button type="button" class="icon-button modal-close" data-action="close-modal" aria-label="关闭">${ICON.close}</button>
      ${content}
    </div>
  </div>`;
}

function renderRulesModal() {
  return modalShell(`<div class="modal-body">
    <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>本桌规矩</p>
    <h2 id="modal-title">湖北麻将 · 108 张</h2>
    <p class="modal-lead">每人开局 1000 元家庭资金，只作家里记分，不涉及任何真实钱款。</p>
    <div class="rule-grid">
      <section class="rule-section">
        <h3><span>一</span>牌与胡法</h3>
        <p>只用万、条、筒三门，各 1–9 每张 4 张，共 108 张。没有字牌。胡牌就是最纯粹的「四副面子 + 一对将」。</p>
      </section>
      <section class="rule-section">
        <h3><span>二</span>只能自摸</h3>
        <p>别人点炮不算，必须自己摸到胡牌。没有点炮胡，但别人自摸时三家都要照付。</p>
      </section>
      <section class="rule-section">
        <h3><span>三</span>能碰不能吃</h3>
        <p>可以碰、可以杠，不能吃上家。顺子全靠自己摸牌，以及赖子来补。碰下的三张牌如果又摸到第四张，可以叫「回回」，三家各付 10 元，并扣下一张摆在面子旁。</p>
        <p>牌尾翻出的那张牌已经亮明，杠它时第四张由尾牌补足：暗杠手里有三张即可，别人打出时明杠手里有两张即可，杠后不再补牌。</p>
      </section>
      <section class="rule-section">
        <h3><span>四</span>赖子</h3>
        <p>开局翻一张牌，同花色下一张的 4 张牌为赖子（如翻出五万，六万作赖；九之后回头一）。赖子可以当任意一张牌用，但不能参与碰、杠，也不能打出。</p>
        <p class="rule-emphasis">胡牌时手上最多只能有一张赖子。赖子不能碰、不能杠，也不能当普通弃牌打出；轮到自己摸牌后，点手里的赖子即可惩调：把赖子打到牌河并标记「惩」，再从牌尾摸一张，本局输赢 ×2。可以连续惩，每次打出一张赖子，倍数叠加为 ×4、×8、×16。多出来的赖子也只能这样打出去。</p>
      </section>
      <section class="rule-section">
        <h3><span>五</span>掷骰开牌</h3>
        <p>每局由庄家掷一枚骰子。1、3、5 点从对面数，2、6 点从庄家右手边数，4 点从左手边数；点数是几，就从那一侧数几墩，从那里切开牌墙起牌。</p>
      </section>
    </div>
    <h3 class="modal-subtitle">算账</h3>
    <div class="score-table">
      <div class="score-table-row score-table-head"><span>胡牌 / 动作</span><span>每位</span><span>说明</span></div>
      <div class="score-table-row"><span>合滴自摸</span><b>20 元</b><span>不用赖子或赖子作本牌，共收 60 元</span></div>
      <div class="score-table-row"><span>软滴自摸</span><b>10 元</b><span>赖子变作其他牌，共收 30 元</span></div>
      <div class="score-table-row"><span>暗杠</span><b>20 元</b><span>三家各付，共收 60 元</span></div>
      <div class="score-table-row"><span>回回</span><b>10 元</b><span>碰牌后摸到第四张，三家各付，共收 30 元</span></div>
      <div class="score-table-row"><span>明杠</span><b>10 元</b><span>由被杠的那一家付</span></div>
      <div class="score-table-row"><span>尾牌杠</span><b>10/20 元</b><span>尾牌算第四张，暗杠三张、明杠两张，不补牌</span></div>
      <div class="score-table-row"><span>惩调</span><b>×2 起</b><span>每次打出一张赖子并从牌尾摸一张，倍数连续叠加</span></div>
    </div>
    <div class="rule-callout">
      <span class="rule-callout-mark">惩调</span>
      <p><b>惩调只用于赖子。</b>轮到你摸牌后，点手里的赖子并按提示确认，把它打到牌河（标记「惩」），再从牌墙最末（牌尾）摸一张。每次惩调都会让本局倍数翻倍：第一次 ×2，之后 ×4、×8、×16……只要手里还有赖子、牌尾还有牌，就可以连续惩。手里没有赖子时不能惩调。</p>
      <p><b>结算时倍数是相乘的：</b>例如胡家 ×4、付款家 ×2，该家就按 ×8 付；付款家没惩调则只乘胡家的倍数。杠分和回回分本身不参与翻倍。</p>
      <p>杠或回回后从牌尾补牌本身不算惩调，但补牌后可以惩调；若本局已经惩调过，之后自摸按累计倍数结算。</p>
    </div>
    <div class="drawer-notes">
      <p><b>资金：</b>每位角色初始 1000 元，四个座位都是家里人时，本局结果会存进各自角色；有 AI 参战的牌局只作牌桌记录，不改变角色资金。</p>
      <p><b>荒庄：</b>牌墙摸完仍无人胡牌，本局无胡牌分，已经拿到的杠分和回回分保留。</p>
      <p><b>座位：</b>四人一桌；空位由 AI 补位。胡牌者下一局坐庄，荒庄则庄家连庄。</p>
      <p><b>操作：</b>轮到你时，点选一张牌，再点一次这张牌即可打出，也可以点「打出」按钮。别人打牌后，可以碰或杠；应对有 10 秒倒计时。赖子不能当普通牌打出，也不能碰、杠；点选赖子后会出现「惩调」按钮，确认后把赖子打到牌河（标记惩）并从牌尾摸一张，可以连续惩，倍数累计 ×2/×4/×8…</p>
    </div>
  </div>`);
}

function renderMenuModal() {
  const room = state.room;
  const game = room?.game;
  const lead = !game
    ? '牌局还在等人入座。'
    : game.phase === 'opening'
      ? `第 ${game.roundNumber} 局，等庄家掷骰开牌。`
      : `第 ${game.roundNumber} 局，正在打牌。`;
  return modalShell(`<div class="modal-body">
    <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>牌桌菜单</p>
    <h2 id="modal-title">合院 · ${escapeHTML(room?.code || '')}</h2>
    <p class="modal-lead">${lead}</p>
    <div class="menu-list">
      <button type="button" class="menu-item" data-action="open-rules">${ICON.rules}<span><b>玩法与算分</b><small>再对一遍本桌规矩</small></span>${ICON.arrow}</button>
      ${isIOSDevice() && !isStandaloneApp()
    ? `<button type="button" class="menu-item" data-action="ios-fullscreen">${ICON.rotate}<span><b>全屏游玩</b><small>添加到主屏幕，去掉 Safari 标签栏</small></span>${ICON.arrow}</button>`
    : ''}
      <button type="button" class="menu-item" data-action="toggle-bgm">${audio.bgmEnabled ? ICON.musicOn : ICON.musicOff}<span><b>背景音乐 · ${audio.bgmEnabled ? '开' : '关'}</b><small>牌桌上的五声音阶小调</small></span>${ICON.arrow}</button>
      <button type="button" class="menu-item" data-action="toggle-sfx">${audio.sfxEnabled ? ICON.soundOn : ICON.soundOff}<span><b>音效与报牌 · ${audio.sfxEnabled ? '开' : '关'}</b><small>牌落桌，湖北话念牌名</small></span>${ICON.arrow}</button>
      <button type="button" class="menu-item" data-action="share-invite">${ICON.share}<span><b>邀请家里人</b><small>发送棋牌室链接，直接来这一桌</small></span>${ICON.arrow}</button>
      <button type="button" class="menu-item menu-item--danger" data-action="ask-leave">${ICON.logout}<span><b>离开${room?.game ? '牌局' : '此桌'}</b><small>${room?.game ? '手牌会交给 AI 托管' : '释放你的座位'}</small></span>${ICON.arrow}</button>
    </div>
  </div>`);
}

function renderGangModal() {
  const actions = state.room?.game?.you?.actions;
  const gangs = actions?.gangs || [];
  const onlyHuihui = gangs.length > 0 && gangs.every((gang) => gang.kind === 'huihui');
  const onlyTail = gangs.length > 0 && gangs.every((gang) => gang.kind === 'tail');
  const hasTail = gangs.some((gang) => gang.kind === 'tail');
  const lead = onlyHuihui
    ? '碰牌后摸到第四张，可以回回：三家各付 10 元，面子扣下一张，再从牌尾补一张。'
    : onlyTail
      ? '尾牌暗杠三家各付 20 元，翻出的尾牌算第四张，杠后不补牌，直接出牌。'
      : hasTail
        ? '尾牌暗杠每家付 20 分且不补牌；其余杠或回回后从牌尾补一张。补牌本身不算惩调。'
        : '杠或回回后从牌尾补一张牌。补牌本身不算惩调，但补完可以惩调；若本局已惩调，之后按累计倍数结算。';
  const copy = {
    concealed: { name: '暗杠', note: '手里四张齐全', points: '+60' },
    tail: { name: '尾牌暗杠', note: '手里三张 · 尾牌补第四张', points: '+60' },
    huihui: { name: '回回', note: '碰牌后摸到第四张', points: '+30' },
  };
  return modalShell(`<div class="modal-body">
    <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>${onlyHuihui ? '回回' : '开杠'}</p>
    <h2 id="modal-title">${onlyHuihui ? '要不要回回？' : '选一组杠牌'}</h2>
    <p class="modal-lead">${lead}</p>
    <div class="gang-options">
      ${gangs.map((gang, index) => {
        const item = copy[gang.kind] || { name: '杠牌', note: '', points: '' };
        return `<button type="button" class="gang-option" data-action="choose-gang" data-gang-kind="${gang.kind}" data-gang-key="${gang.key}" data-meld-index="${gang.meldIndex ?? ''}" ${index === 0 ? 'data-autofocus' : ''}>
        <span class="gang-tile">${renderTile(gang.tiles[0], { size: 'gang', laiziKey: state.room.game.laizi.key })}</span>
        <span class="gang-copy"><b>${item.name}</b><small>${item.note}</small></span>
        <span class="gang-points">${item.points} 元</span>
      </button>`;
      }).join('')}
    </div>
  </div>`);
}

function renderLeaveConfirm() {
  const inGame = Boolean(state.room?.game && state.room.game.phase !== 'ended');
  return modalShell(`<div class="modal-body confirm-body">
    <span class="confirm-glyph">${ICON.logout}</span>
    <h2 id="modal-title">${inGame ? '离开这一局？' : '离开这张牌桌？'}</h2>
    <p class="modal-lead">${inGame
    ? '离开后，你的手牌会由 AI 续打，这一局不能再回来。若东家离开，东家会移交给下一位在线的人。'
    : '座位会空出来，其他家里人还能继续入座。'}</p>
    <div class="confirm-actions">
      <button type="button" class="button button--ghost" data-action="close-modal" data-autofocus>继续留在桌上</button>
      <button type="button" class="button button--danger" data-action="confirm-leave">确认离开</button>
    </div>
  </div>`);
}

function renderShareModal() {
  const share = state.modal?.type === 'share' ? state.modal : {};
  const url = share.url || '';
  const wechat = share.wechat ?? isWeChatBrowser();
  return modalShell(`<div class="modal-body">
    <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>邀请家里人</p>
    <h2 id="modal-title">把牌桌发到微信</h2>
    <p class="modal-lead">${share.copied === false
    ? '复制没有成功。长按下面的链接复制下来，再打开微信粘贴发送。'
    : wechat
      ? '邀请链接已经复制。粘贴到微信聊天发送，或点右上角 ···，选「发送给朋友」。'
      : '邀请链接已经复制，正在尝试打开微信。进入家庭群粘贴发送即可；若未跳转，请点「打开微信」或手动打开。'}</p>
    <div class="share-link-field">
      <span>邀请文案与链接</span>
      <textarea class="share-link-input" rows="4" readonly aria-label="邀请文案与链接">${escapeHTML(share.text || url)}</textarea>
    </div>
    <div class="confirm-actions">
      <button type="button" class="button button--ghost" data-action="close-modal" data-autofocus>知道了</button>
      <button type="button" class="button button--primary" data-action="copy-invite">再复制一次</button>
      ${!wechat && share.copied === true ? '<a class="button button--primary" href="weixin://">打开微信</a>' : ''}
    </div>
    <p class="share-tip">网页无法直接选择微信好友；打开微信后需自行粘贴发送。浏览器可能拦截跳转，不会自动发送消息。</p>
  </div>`);
}

function renderFullscreenGuide() {
  const wechat = isWeChatBrowser();
  return modalShell(`<div class="modal-body">
    <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>全屏游玩</p>
    <h2 id="modal-title">把牌桌放到主屏幕</h2>
    <p class="modal-lead">Safari 不能隐藏标签栏和地址栏。把牌桌添加到主屏幕后，从桌面图标打开会以独立窗口运行，横屏时就是整屏牌桌。</p>
    ${wechat ? '<div class="rule-callout"><span class="rule-callout-mark">先出微信</span><p>现在在微信里，先点右上角 ···，选「在 Safari 中打开」，再按下面的步骤添加。</p></div>' : ''}
    <ol class="fullscreen-steps">
      <li><b>点 Safari 的分享按钮</b><span>就是工具栏上的方框加向上箭头。</span></li>
      <li><b>选「添加到主屏幕」</b><span>名称保持「牛牛棋牌」，点右上角「添加」。</span></li>
      <li><b>回桌面点「牛牛棋牌」图标</b><span>以后都从这里进，横屏就不会再有浏览器标签页。</span></li>
    </ol>
    <div class="rule-callout"><span class="rule-callout-mark">注意</span><p>主屏幕窗口和 Safari 是两套独立页面，当前这局带不过去。建议先打完这一局，再从桌面窗口回到这桌入座。</p></div>
    <div class="confirm-actions">
      <button type="button" class="button button--ghost" data-action="close-modal" data-autofocus>知道了</button>
    </div>
  </div>`);
}

function updateDocumentTitle() {
  if (state.screen === 'home') {
    if (state.invite) {
      const inviter = state.invite.from || '家里人';
      document.title = `${inviter}邀你来打牌 · 牛牛棋牌室`;
    } else {
      document.title = '牛牛棋牌室';
    }
    return;
  }
  if (state.screen === 'room') {
    document.title = '家里人的一桌牌 · 牛牛棋牌室';
    return;
  }
  if (state.screen === 'game') {
    const game = state.room?.game;
    if (!game) {
      document.title = '牛牛棋牌室';
      return;
    }
    if (game.phase === 'ended') {
      document.title = '本局结束 · 牛牛棋牌室';
    } else if (game.phase === 'opening') {
      document.title = game.you?.seat === game.dealerSeat && game.opening?.stage === 'waiting'
        ? '该你掷骰子 · 牛牛棋牌室'
        : '开局掷骰 · 牛牛棋牌室';
    } else if (game.you?.actions?.kind === 'claim') {
      document.title = '该你应对 · 牛牛棋牌室';
    } else if (game.phase === 'discard' && game.turnSeat === game.you?.seat) {
      document.title = '轮到你出牌 · 牛牛棋牌室';
    } else {
      document.title = '牌局进行中 · 牛牛棋牌室';
    }
  }
}

function tickCountdowns() {
  const now = serverNow();
  document.querySelectorAll('[data-deadline]').forEach((element) => {
    const deadline = Number(element.dataset.deadline);
    if (!Number.isFinite(deadline)) return;
    const remaining = Math.max(0, deadline - now);
    const seconds = Math.ceil(remaining / 1000);
    if (element.classList.contains('pending-countdown')) {
      element.textContent = `${seconds}s`;
      return;
    }
    if (!element.classList.contains('countdown-pill')) return;
    const value = element.querySelector('.countdown-value');
    if (value) value.textContent = String(seconds);
    if (element.classList.contains('turn-clock')) {
      const duration = Number(element.dataset.duration) || TURN_LIMIT;
      element.style.setProperty('--countdown', `${Math.min(100, (remaining / duration) * 100)}%`);
      const urgent = remaining <= 10000;
      element.classList.toggle('is-urgent', urgent);
      const warning = element.closest('.dock-actions')?.querySelector('[data-turn-warning]');
      if (warning) {
        const wasHidden = warning.hidden;
        warning.hidden = !urgent;
        if (urgent) warning.textContent = `${seconds} 秒后自动打出一张`;
        if (wasHidden !== warning.hidden) syncDockHeight();
        if (!warning.hidden && turnWarningDeadline !== element.dataset.deadline) {
          turnWarningDeadline = element.dataset.deadline;
          audio.play('select');
        }
      }
      return;
    }
    element.style.setProperty('--countdown', `${Math.min(100, (remaining / CLAIM_WINDOW) * 100)}%`);
  });
}

window.setInterval(tickCountdowns, 120);

function handleOrientationChange() {
  render();
}

window.addEventListener('orientationchange', handleOrientationChange);
window.addEventListener('resize', () => {
  if (state.screen === 'game') {
    syncTableSize();
    syncDockHeight();
  }
});
const orientationQuery = window.matchMedia?.('(orientation: portrait)');
if (orientationQuery) {
  if (orientationQuery.addEventListener) orientationQuery.addEventListener('change', handleOrientationChange);
  else orientationQuery.addListener?.(handleOrientationChange);
}

function openRules() {
  state.modal = { type: 'rules' };
  renderModal();
}

function handleHandTile(tileId) {
  if (!state.online) {
    showToast('网络断开，正在重连', 'error');
    return;
  }
  const game = state.room?.game;
  if (!game || game.phase !== 'discard' || game.turnSeat !== game.you?.seat) {
    showToast('现在还没轮到你出牌', 'info');
    return;
  }
  const actions = game.you.actions;
  if (!actions || actions.kind !== 'self') return;
  if (game.phase === 'ended') return;
  if (state.selectedTileId === tileId) {
    requestDiscard(tileId);
    return;
  }
  state.selectedTileId = tileId;
  audio.unlock();
  audio.play('select');
  render();
}

function requestDiscard(tileId) {
  const game = state.room?.game;
  const tile = game?.you?.hand?.find((item) => item.id === tileId);
  if (!game || !tile) return;
  if (tile.key === game.laizi.key) {
    declareChengdiao(tileId);
    return;
  }
  discardTile(tileId);
}

async function discardTile(tileId) {
  if (!tileId || state.actionInFlight) return;
  const previousSelection = state.selectedTileId;
  state.selectedTileId = null;
  render();
  const response = await request('game:action', {
    action: { type: 'discard', tileId },
  });
  if (!response.ok) {
    state.selectedTileId = null;
    render();
    if (!response.error) state.selectedTileId = previousSelection;
  }
}

async function sendClaim(choice) {
  const response = await request('game:action', {
    action: { type: 'claim', choice },
  });
  if (!response.ok) render();
}

async function rollDice() {
  if (state.diceRolling || !state.room?.game?.opening?.canRoll) return;
  state.diceRolling = true;
  render();
  const response = await request('game:action', { action: { type: 'roll' } });
  if (!response.ok) {
    state.diceRolling = false;
    render();
  }
}

async function declareWin() {
  const response = await request('game:action', { action: { type: 'win' } });
  if (!response.ok) render();
}

async function declareChengdiao(tileId) {
  if (!tileId || state.actionInFlight) return;
  state.selectedTileId = null;
  const response = await request('game:action', {
    action: { type: 'chengdiao', tileId },
  });
  if (!response.ok) render();
}

async function chooseGang(kind, key, meldIndex) {
  closeModal();
  const action = { type: 'gang', kind, key };
  if (kind === 'huihui') action.meldIndex = Number(meldIndex);
  const response = await request('game:action', { action });
  if (!response.ok) render();
}

function openGangs() {
  const actions = state.room?.game?.you?.actions;
  if (!actions || actions.kind !== 'self' || !actions.gangs?.length) return;
  if (actions.gangs.length === 1) {
    const gang = actions.gangs[0];
    chooseGang(gang.kind, gang.key, gang.meldIndex);
    return;
  }
  state.modal = { type: 'gang' };
  renderModal();
}

async function leaveRoom() {
  closeModal();
  const response = await request('room:leave', {});
  if (!response.ok) {
    if (response.error && response.error !== 'offline') {
      // Keep the player in the room when the server could not release the seat.
    }
    return;
  }
  resetToHome();
}

function resetToHome() {
  sessionStorage.removeItem(ROOM_STORAGE);
  state.room = null;
  state.screen = 'home';
  state.selectedTileId = null;
  state.showResult = false;
  state.dismissedResult = null;
  state.modal = null;
  state.orientationDismissed = false;
  state.diceRolling = false;
  clearOpeningTimers();
  exitLandscapeMode();
  renderModal();
  render();
  loadBalances(true);
}

function markIdentityRemembered() {
  state.identityRemembered = true;
  state.identityEditing = false;
  state.identitySaved = { avatar: state.profile.avatar, name: state.profile.name };
  saveProfile();
}

function editIdentity() {
  if (!state.identityRemembered) return;
  state.identitySaved = { avatar: state.profile.avatar, name: state.profile.name };
  state.identityEditing = true;
  render();
}

function cancelIdentityEdit() {
  if (!state.identityEditing) return;
  state.profile = { ...state.identitySaved };
  state.identityEditing = false;
  render();
}

function confirmIdentityEdit() {
  if (!state.identityEditing) return;
  markIdentityRemembered();
  render();
  showToast(`这台设备以后都记得你是${effectiveName()}`, 'success');
}

async function createRoom() {
  if (state.actionInFlight) return;
  markIdentityRemembered();
  const response = await request('room:join', {
    profile: {
      name: effectiveName(),
      avatar: state.profile.avatar,
    },
  });
  if (response.ok) {
    sessionStorage.setItem(ROOM_STORAGE, response.code);
    audio.play('join');
  } else {
    render();
  }
}

function leaveInvite() {
  clearInviteParam();
  state.invite = null;
  state.screen = 'home';
  state.room = null;
  render();
}

async function shareInvite() {
  const code = state.room?.code;
  if (!code) return;
  const inviter = effectiveName();
  const url = buildInviteUrl(code, inviter);
  const text = `${inviter}邀请你加入麻将对局，一起摸两圈！点击链接，马上入座：\n${url}`;
  const copied = await copyText(text);
  const wechat = isWeChatBrowser();
  state.modal = { type: 'share', url, text, copied, wechat };
  renderModal();
  showToast(
    copied ? '邀请链接已复制' : '链接已备好，长按可复制',
    copied ? 'success' : 'info',
  );
  if (copied && !wechat) {
    try {
      window.location.href = 'weixin://';
    } catch (error) {
      // Keep the copied link and manual launch option when navigation is blocked.
    }
  }
}

async function copyInviteLink() {
  if (!state.room?.code) return;
  const url = state.modal?.type === 'share' && state.modal.url
    ? state.modal.url
    : buildInviteUrl(state.room.code, effectiveName());
  const text = state.modal?.type === 'share' && state.modal.text
    ? state.modal.text
    : `${effectiveName()}邀请你加入麻将对局，一起摸两圈！点击链接，马上入座：\n${url}`;
  const copied = await copyText(text);
  if (copied && state.modal?.type === 'share') {
    state.modal.copied = true;
    renderModal();
  }
  showToast(
    copied ? '邀请链接已复制' : '复制没有成功，请长按链接选择复制',
    copied ? 'success' : 'info',
  );
}

async function requestLandscapeMode() {
  if (!isMobileDevice()) return false;
  if (!supportsAutoLandscape()) {
    state.orientationDismissed = true;
    render();
    showToast('把手机横过来，就能用横屏牌桌了', 'info');
    return false;
  }
  const root = document.documentElement;
  let locked = false;
  try {
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch (error) {
    // Fullscreen can be denied; the rotation prompt stays available.
  }
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('landscape');
      locked = true;
    }
  } catch (error) {
    // iOS and WeChat webviews do not support orientation locking.
  }
  if (!locked) {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (error) {
      // Ignore; leaving fullscreen is best effort.
    }
    if (isPortrait()) showToast('这台设备不能自动旋转，把手机横过来就好', 'info');
  }
  state.orientationDismissed = false;
  render();
  return locked;
}

async function exitLandscapeMode() {
  try {
    screen.orientation?.unlock?.();
  } catch (error) {
    // Orientation unlock is not supported everywhere.
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch (error) {
    // The browser may already have left fullscreen.
  }
}

function selectAvatar(avatar) {
  if (!CHARACTERS.some((character) => character.id === avatar)) return;
  state.profile.avatar = avatar;
  render();
}

function toggleSound() {
  const enabled = audio.toggleAll();
  showToast(enabled ? '声音已开启' : '声音已关闭', 'info');
  if (enabled) audio.play('select');
  render();
  if (state.modal?.type === 'menu') renderModal();
}

function toggleBgm() {
  const enabled = audio.toggleBgm();
  showToast(enabled ? '背景音乐已开启' : '背景音乐已关闭', 'info');
  render();
  if (state.modal?.type === 'menu') renderModal();
}

function toggleSfx() {
  const enabled = audio.toggleSfx();
  showToast(enabled ? '音效已开启' : '音效已关闭', 'info');
  if (enabled) audio.play('select');
  render();
  if (state.modal?.type === 'menu') renderModal();
}

async function takeSeat(seat) {
  if (!state.online) {
    showToast('网络还没连上', 'error');
    return;
  }
  await request('room:seat', { seat: Number(seat) });
}

async function startGame() {
  // Rotation stays manual via the rotate prompt instead of forcing fullscreen and an
  // orientation lock, so iPhone Safari keeps its native browser behaviour.
  const response = await request('room:start', {});
  if (response.ok) render();
}

async function nextRound() {
  const response = await request('room:nextRound', {});
  if (response.ok) {
    state.showResult = false;
    state.dismissedResult = null;
    render();
  }
}

const tapGuard = { multiTouch: false, moved: false, startX: 0, startY: 0, suppressUntil: 0 };

document.addEventListener('touchstart', (event) => {
  if (tapGuard.multiTouch) return;
  if (event.touches.length > 1) {
    tapGuard.multiTouch = true;
    return;
  }
  const touch = event.touches[0];
  if (!touch) return;
  tapGuard.startX = touch.clientX;
  tapGuard.startY = touch.clientY;
  tapGuard.moved = false;
}, { passive: true, capture: true });

document.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1) {
    event.preventDefault();
    tapGuard.multiTouch = true;
    return;
  }
  if (tapGuard.multiTouch) return;
  const touch = event.touches[0];
  if (!touch) return;
  if (Math.hypot(touch.clientX - tapGuard.startX, touch.clientY - tapGuard.startY) > 10) {
    tapGuard.moved = true;
  }
}, { passive: false, capture: true });

// iOS Safari ignores user-scalable=no, so its proprietary gesture events need
// explicit blocking; the multi-touch touchmove handler above covers other engines.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}

function endTapGuard(event) {
  if (event.touches.length) return;
  const wasGesture = tapGuard.multiTouch || tapGuard.moved;
  tapGuard.multiTouch = false;
  tapGuard.moved = false;
  if (wasGesture) tapGuard.suppressUntil = performance.now() + 450;
}

document.addEventListener('touchend', endTapGuard, { passive: true, capture: true });
document.addEventListener('touchcancel', endTapGuard, { passive: true, capture: true });

document.addEventListener('click', (event) => {
  if (performance.now() < tapGuard.suppressUntil) return;
  audio.unlock();
  if (!event.target.closest('.danmaku-control')) {
    const options = appRoot.querySelector('.danmaku-options');
    if (options) options.hidden = true;
    appRoot.querySelector('.danmaku-trigger')?.setAttribute('aria-expanded', 'false');
  }
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) {
    const tile = event.target.closest('[data-tile-id]');
    if (tile && tile.closest('.hand')) handleHandTile(tile.dataset.tileId);
    return;
  }
  const action = actionTarget.dataset.action;
  switch (action) {
    case 'dismiss-home-screen-hint':
      state.homeScreenHintDismissed = true;
      appRoot.querySelector('.home-screen-hint')?.remove();
      break;
    case 'select-avatar':
      selectAvatar(actionTarget.dataset.avatar);
      break;
    case 'edit-identity':
      editIdentity();
      break;
    case 'cancel-identity-edit':
      cancelIdentityEdit();
      break;
    case 'leave-invite':
      leaveInvite();
      break;
    case 'toggle-sound':
      toggleSound();
      break;
    case 'toggle-bgm':
      toggleBgm();
      break;
    case 'toggle-sfx':
      toggleSfx();
      break;
    case 'open-danmaku': {
      const options = appRoot.querySelector('.danmaku-options');
      if (options) {
        options.hidden = !options.hidden;
        actionTarget.setAttribute('aria-expanded', String(!options.hidden));
      }
      break;
    }
    case 'send-danmaku': {
      const phrase = actionTarget.dataset.phrase;
      appRoot.querySelector('.danmaku-options').hidden = true;
      appRoot.querySelector('.danmaku-trigger')?.setAttribute('aria-expanded', 'false');
      request('room:danmaku', { phrase }).catch((error) => showToast(error.message));
      break;
    }
    case 'open-rules':
      state.modal = { type: 'rules' };
      renderModal();
      break;
    case 'open-menu':
      state.modal = { type: 'menu' };
      renderModal();
      break;
    case 'ios-fullscreen':
      state.modal = { type: 'fullscreen-guide' };
      renderModal();
      break;
    case 'close-modal':
      if (actionTarget.classList.contains('modal-backdrop') && event.target !== actionTarget) break;
      closeModal();
      break;
    case 'share-invite':
      if (state.modal?.type === 'menu') closeModal();
      shareInvite();
      break;
    case 'copy-invite':
      copyInviteLink();
      break;
    case 'enter-landscape':
      requestLandscapeMode();
      break;
    case 'dismiss-rotate':
      state.orientationDismissed = true;
      render();
      break;
    case 'take-seat':
      takeSeat(actionTarget.dataset.seat);
      break;
    case 'start-game':
      startGame();
      break;
    case 'ask-leave':
      state.modal = { type: 'confirm-leave' };
      renderModal();
      break;
    case 'confirm-leave':
      leaveRoom();
      break;
    case 'claim':
      sendClaim(actionTarget.dataset.choice);
      break;
    case 'declare-win':
      declareWin();
      break;
    case 'roll-dice':
      rollDice();
      break;
    case 'cheng-selected':
      declareChengdiao(state.selectedTileId);
      break;
    case 'open-gangs':
      openGangs();
      break;
    case 'choose-gang':
      chooseGang(
        actionTarget.dataset.gangKind,
        actionTarget.dataset.gangKey,
        actionTarget.dataset.meldIndex,
      );
      break;
    case 'discard-selected':
      requestDiscard(state.selectedTileId);
      break;
    case 'dismiss-result':
      state.showResult = false;
      if (state.room?.game?.result) {
        state.dismissedResult = `${state.room.code}:${state.room.game.roundNumber}`;
      }
      render();
      break;
    case 'reopen-result':
      state.showResult = true;
      render();
      break;
    case 'next-round':
      nextRound();
      break;
    default:
      break;
  }
  if (actionTarget.closest('.hand') && actionTarget.dataset.tileId) {
    handleHandTile(actionTarget.dataset.tileId);
  }
});

document.addEventListener('input', (event) => {
  const input = event.target;
  if (input.dataset.input === 'name') {
    state.profile.name = input.value.slice(0, 12);
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'create-form') {
    createRoom();

  } else if (event.target.id === 'identity-form') {
    confirmIdentityEdit();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (state.modal) {
      closeModal();
      return;
    }
    if (state.selectedTileId) {
      state.selectedTileId = null;
      render();
    }
  }
});

modalRoot.addEventListener('click', (event) => {
  if (performance.now() < tapGuard.suppressUntil) return;
  if (event.target.classList.contains('modal-backdrop')) closeModal();
});

render();
renderModal();

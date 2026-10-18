import { CHARACTERS, getCharacter, avatarHTML } from './characters.js?v=20261018-17';
import { renderTile, renderBack, renderMeld, tileLabel } from './tiles.js?v=20261018-17';
import { audio } from './sound.js?v=20261018-17';

const ROOM_STORAGE = 'heyuan.room';
const CLIENT_STORAGE = 'heyuan.client';
const PROFILE_STORAGE = 'heyuan.profile';
const PROFILE_COOKIE = 'heyuan_identity';
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
const WINDS = ['东', '南', '西', '北'];
const CLAIM_WINDOW = 10000;

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

function readInviteFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = String(params.get('room') || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) return null;
    return { code, from: cleanInviteName(params.get('from')) };
  } catch (error) {
    return null;
  }
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
  invite: readInviteFromUrl(),
  room: null,
  selectedTileId: null,
  modal: null,
  showResult: false,
  dismissedResult: null,
  actionInFlight: false,
  lastGameLogId: null,
  lastDiscardKey: null,
  titleTurn: false,
  orientationDismissed: false,
  diceRolling: false,
  serverOffset: 0,
};

let openingTimers = [];

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

function isPortrait() {
  return window.matchMedia?.('(orientation: portrait)').matches
    ?? window.innerHeight >= window.innerWidth;
}

function buildInviteUrl(code, from) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
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
    <span class="brand-seal" aria-hidden="true">合</span>
    <span class="brand-copy">
      <strong>合院棋牌室</strong>
      <small>${small ? '湖北麻将 · 108 张' : '家里人的一桌牌'}</small>
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
  const seenDiscardKey = state.lastDiscardKey;
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
    if (state.dismissedResult !== resultKey) state.showResult = true;
  } else {
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
      playLogFeedback(newLogs, previousRound !== room.game.roundNumber, room);
    }
    const discard = room.game.lastDiscard;
    const discardKey = discard
      ? `${room.game.roundNumber}:${discard.seat}:${discard.tile.id}`
      : null;
    const freshDiscard = discard
      && discardKey !== seenDiscardKey
      && previousCode === room.code;
    if (freshDiscard) {
      const discarding = room.seats?.find((entry) => entry?.seat === discard.seat);
      audio.announceDiscard(discard.tile, getCharacter(discarding?.avatar));
    }
    if (discardKey) state.lastDiscardKey = discardKey;
    if (room.game.log.length) state.lastGameLogId = room.game.log[room.game.log.length - 1].id;
  } else {
    state.lastDiscardKey = null;
  }

  render();
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

  const priority = { hu: 6, gang: 5, huihui: 4, chengdiao: 3, peng: 2, start: 2, discard: 1, drawEnd: 0 };
  usable.sort((a, b) => (priority[a.kind] || 0) - (priority[b.kind] || 0));
  const chosen = usable[usable.length - 1];
  if (chosen.kind === 'hu') audio.play('hu');
  else if (chosen.kind === 'gang') audio.play('gang');
  else if (chosen.kind === 'huihui') audio.play('gang');
  else if (chosen.kind === 'chengdiao') audio.play('select');
  else if (chosen.kind === 'peng') audio.play('peng');
  else if (chosen.kind === 'start') audio.play('start');

  if (['hu', 'gang', 'huihui', 'peng', 'chengdiao'].includes(chosen.kind)) {
    const actor = room?.seats?.find((entry) => entry?.seat === chosen.seat);
    audio.announceAction(chosen.kind, getCharacter(actor?.avatar));
  }

  const shouldFlash = usable.filter((entry) => ['peng', 'gang', 'huihui', 'chengdiao', 'start', 'drawEnd'].includes(entry.kind));
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
  state.lastDiscardKey = null;
  state.orientationDismissed = false;
  state.diceRolling = false;
  clearOpeningTimers();
  exitLandscapeMode();
  render();
  showToast(payload?.reason === 'idle' ? '房间很久没人，已经收桌了' : '这个牌局已经结束', 'info');
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
    render();
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

socket.on('room:state', handleServerState);
socket.on('room:closed', handleRoomClosed);
socket.on('server:error', (payload) => {
  showToast(payload?.error || '连接出现问题，请刷新页面', 'error');
});

async function bootIntoRoom() {
  const savedCode = sessionStorage.getItem(ROOM_STORAGE);
  if (state.invite) {
    if (savedCode && savedCode !== state.invite.code) {
      await request('room:leave', {}, { silent: true });
      sessionStorage.removeItem(ROOM_STORAGE);
    }
    state.room = null;
    state.screen = 'home';
    render();
    return;
  }
  if (!savedCode) {
    state.screen = state.hasConnected ? 'home' : 'loading';
    render();
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
    showToast('上次的牌局已经结束，重新开一桌吧', 'info');
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
  document.body.dataset.screen = state.screen;
  document.body.classList.toggle('has-offline', !state.online);
  updateDocumentTitle();
  tickCountdowns();
  scheduleOpeningAnimation();
}

function renderLoading() {
  return `<div class="screen loading-screen">
    <div class="loading-brand">
      <span class="brand-seal brand-seal--large">合</span>
      <h1>合院棋牌室</h1>
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
      <em>${customName ? `${character.name} · 属${character.animal}` : `生肖 · ${character.animal}`}</em>
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
    ? '不是你？点「换角色」重新挑一次'
    : mode === 'edit'
      ? '换好之后，下次打开就直接用新角色入座'
      : '这台设备会记住你 · 仅记积分';
  const formId = mode === 'edit' ? 'identity-form' : context === 'invite' ? 'invite-form' : 'create-form';
  const submitLabel = mode === 'edit'
    ? '记住这个角色'
    : context === 'invite' ? `加入房间 ${escapeHTML(code)}` : '开一桌';
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
  if (state.invite) return renderInviteHome();
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
          <p class="hero-intro">不用注册，不必登录。挑一个角色，把邀请链接发进家里群，四个人坐下就能开局。人不齐也不要紧，空位交给 AI 邻居。</p>
          <div class="hero-scene" aria-hidden="true">
            <div class="hero-table">
              <span class="hero-table-line"></span>
              <div class="hero-fan">
                ${renderTile({ suit: 'wan', rank: 5, key: 'wan-5' }, { size: 'hero' })}
                ${renderTile({ suit: 'tong', rank: 8, key: 'tong-8' }, { size: 'hero' })}
                ${renderTile({ suit: 'tiao', rank: 3, key: 'tiao-3' }, { size: 'hero' })}
              </div>
              <span class="hero-stamp">合院<br>小局</span>
              <span class="hero-table-caption">四方桌 · 家人闲坐</span>
            </div>
          </div>
          <div class="hero-facts">
            <div><strong>108</strong><span>张序数牌</span></div>
            <div><strong>4</strong><span>个家中席位</span></div>
            <div><strong>只</strong><span>自摸得胡</span></div>
          </div>
        </div>
        <section class="entry-panel" aria-labelledby="entry-title">
          ${identityEntryHTML('home')}
        </section>
      </main>
      <footer class="site-footer">
        <span>合院棋牌室 · 湖北 108 张</span>
        <span>给家里人的一桌牌</span>
      </footer>
    </div>`;
}

function renderInviteHome() {
  const invite = state.invite;
  const inviter = invite.from;
  return `<div class="screen home-screen invite-home">
    ${offlineBanner()}
    <div class="home-ornaments" aria-hidden="true">
      <div class="home-ornament home-ornament--one"></div>
      <div class="home-ornament home-ornament--two"></div>
    </div>
    <header class="site-header">
      <div class="header-lead">
        <button class="icon-button" type="button" data-action="leave-invite" aria-label="返回主页" title="返回主页">${ICON.back}</button>
        ${brandHTML()}
      </div>
      <div class="header-tools">
        ${rulesButton()}
        ${soundButton()}
      </div>
    </header>
    <main class="invite-main">
      <div class="invite-home-heading">
        <p class="eyebrow"><span class="eyebrow-line"></span>家里人喊你来打牌</p>
        <h1>${inviter ? `${escapeHTML(inviter)} 喊你` : '喊你一起'}<em>来坐一桌。</em></h1>
      </div>
      <section class="entry-panel entry-panel--invite" aria-labelledby="entry-title">
        <div class="invite-callout">
          <span class="invite-callout-seal" aria-hidden="true">合</span>
          <span class="invite-callout-copy">
            <strong>${inviter ? `${escapeHTML(inviter)} 邀你入座` : '家里人邀你入座'}</strong>
            <small>房间 <b>${escapeHTML(invite.code)}</b> · 点开链接就能坐</small>
          </span>
        </div>
        ${identityEntryHTML('invite', invite.code)}
      </section>
    </main>
    <footer class="site-footer">
      <span>合院棋牌室 · 湖北 108 张</span>
      <span>给家里人的一桌牌</span>
    </footer>
  </div>`;
}

function characterCard(character) {
  const selected = character.id === state.profile.avatar;
  return `<button type="button" class="character-card${selected ? ' is-selected' : ''}" data-action="select-avatar" data-avatar="${character.id}" role="option" aria-selected="${selected}" aria-label="${character.name}，属${character.animal}">
    <span class="character-portrait">${avatarHTML(character.id, { className: 'character-avatar' })}</span>
    <span class="character-name">${character.name}<small>${character.animal}</small></span>
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
      <div class="lobby-room-chip"><span>房间</span><b>${escapeHTML(room.code)}</b></div>
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
            <span class="invite-label">房间 ${escapeHTML(room.code)} · 把这桌告诉家里人</span>
            <span class="invite-count">${occupied} / 4 已入座</span>
          </div>
          <button type="button" class="invite-share" data-action="share-invite">
            <span class="invite-share-icon">${ICON.share}</span>
            <span class="invite-share-copy"><b>发送邀请链接</b><small>家里人点开就能入座</small></span>
            ${ICON.arrow}
          </button>
          <span class="invite-hint">发到家庭群即可，不用再报房间号</span>
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
          <span>只能自摸</span><span>赖子限一张</span><span>不能吃</span>
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <span>房间 ${escapeHTML(room.code)}</span>
      <span>合院棋牌室 · 无登录牌局</span>
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
      <span>${isHost ? '东家' : character.animal}${seat.connected === false ? ' · 暂离' : ''}</span>
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
  if (game.phase === 'opening') return renderOpening(room, game);
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
              ${renderSideOpponent(leftPlayer, 'left', game)}
              <div class="river-board">
                ${renderRiverLane(topPlayer, 'top', game, viewerSeat)}
                <div class="river-middle">
                  ${renderRiverLane(leftPlayer, 'left', game, viewerSeat)}
                  ${renderRiverLane(rightPlayer, 'right', game, viewerSeat)}
                </div>
                ${renderRiverLane(selfPlayer, 'self', game, viewerSeat)}
              </div>
              ${renderSideOpponent(rightPlayer, 'right', game)}
            </div>
            ${renderPendingNotice(game, players, viewerSeat)}
          </main>
          <footer class="self-dock">
            <div class="dock-top">
              ${renderSelfIdentity(selfPlayer, game, you)}
              ${renderDockActions(room, game, actions, selectedTile, isMyTurn)}
            </div>
            ${renderSelfMelds(you, game)}
            ${renderHand(you, game, actions, isMyTurn, selectedTile)}
          </footer>
        </div>
      </div>
    </div>
    ${orientationOverlay()}
    ${state.showResult ? renderResult(room, game, players) : ''}
  </div>`;
}

const OPENING_WALL_SIDES = { top: 14, right: 13, bottom: 14, left: 13 };
const OPENING_WALL_TOTAL_STACKS = 54;
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
  const wallLeft = started
    ? Math.max(game.wallLeft, wallBase - revealed)
    : game.wallLeft;
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
        ${podSeats.map(([position, seat]) => renderOpeningPod(position, playerAt(players, seat), {
          dealerSeat,
          viewerSeat,
          stats,
          rolling,
        })).join('')}
        <div class="machine-rim">
          <span class="rim-screw rim-screw--tl" aria-hidden="true"></span>
          <span class="rim-screw rim-screw--tr" aria-hidden="true"></span>
          <span class="rim-screw rim-screw--bl" aria-hidden="true"></span>
          <span class="rim-screw rim-screw--br" aria-hidden="true"></span>
          <div class="machine-felt">
            <span class="machine-mark" aria-hidden="true">合</span>
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
        </div>
      </div>
    </main>
    ${orientationOverlay()}
  </div>`;
}

function renderOpeningPod(position, player, options) {
  if (!player) return '';
  const { dealerSeat, viewerSeat, stats, rolling } = options;
  const isDealer = player.seat === dealerSeat;
  const isYou = player.seat === viewerSeat;
  let status;
  if (!stats.started) {
    status = `${player.wind}位 · ${isDealer ? '待掷骰' : '等开牌'}`;
  } else if (rolling) {
    status = `${player.wind}位 · 掷骰中`;
  } else {
    const count = stats.sorted ? player.handCount : (stats.counts[player.seat] || 0);
    status = `${player.wind}位 · ${count} 张`;
  }
  return `<div class="machine-pod machine-pod--${position}${isDealer ? ' is-dealer' : ''}${isYou ? ' is-you' : ''}" data-opening-pod="${player.seat}">
    <span class="pod-avatar">${avatarHTML(player.avatar, { className: 'pod-avatar-svg' })}</span>
    <span class="pod-copy">
      <b>${escapeHTML(player.name)}${isYou ? '<i class="you-mark">你</i>' : ''}</b>
      <small data-pod-status>${status}</small>
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
  const viewer = game.you;
  return ['bottom', 'right', 'top', 'left'].map((position, offset) => {
    const seat = (viewerSeat + offset) % 4;
    const player = playerAt(players, seat);
    if (!player) return '';
    const side = position === 'left' || position === 'right';
    let content = '';
    if (seat === viewerSeat) {
      const revealCount = stats.sorted ? viewer.hand.length : (stats.counts[seat] || 0);
      const tiles = stats.sorted
        ? viewer.hand
        : (game.opening.myDeal || []).slice(0, revealCount);
      const laiziKey = stats.indicatorRevealed ? game.laizi?.key : null;
      content = tiles.map((tile) => renderTile(tile, {
        size: 'opening',
        tileId: tile.id,
        laiziKey,
      })).join('');
    } else {
      const count = stats.sorted ? player.handCount : (stats.counts[seat] || 0);
      content = Array.from({ length: Math.min(count, 14) }, () => (
        renderBack({ size: side ? 'opening-side' : 'opening' })
      )).join('');
    }
    return `<div class="opening-hand opening-hand--${position}${seat === viewerSeat ? ' is-self' : ''}" data-opening-hand="${seat}" aria-label="${seat === viewerSeat ? '你的手牌' : `${escapeHTML(player.name)}的手牌`}">
      ${content}
    </div>`;
  }).join('');
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
  const breakOrder = openingWallBreakOrder(game);
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

  const status = document.querySelector(`[data-opening-pod="${event.seat}"] [data-pod-status]`);
  if (status) {
    const wind = game.players[event.seat]?.wind || '';
    status.textContent = `${wind}位 · ${event.count} 张`;
  }

  const wallLeft = Math.max(game.wallLeft, (opening.wallStart || 0) - (index + 1));
  updateOpeningWall(wallLeft);
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
  if (state.orientationDismissed || !isMobileDevice() || !isPortrait()) return '';
  return `<div class="rotate-overlay" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
    <div class="rotate-card">
      <div class="rotate-glyph" aria-hidden="true"><span>${ICON.rotate}</span></div>
      <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>横屏牌桌</p>
      <h2 id="rotate-title">把手机横过来</h2>
      <p>横屏之后，手牌、牌河和操作按钮都会更顺手。支持自动横屏的手机可以直接进入。</p>
      <button type="button" class="button button--primary button--wide" data-action="enter-landscape">进入横屏</button>
      <button type="button" class="text-button text-button--quiet" data-action="dismiss-rotate">先用竖屏</button>
    </div>
  </div>`;
}

function renderGameHeader(room, game, viewerSeat) {
  const roundText = `第 ${game.roundNumber} 局`;
  const opening = game.phase === 'opening' ? game.opening : null;
  const stats = opening ? openingStats(game) : null;
  const laiziRevealed = !opening || stats.indicatorRevealed;
  const wallLeft = stats ? stats.wallLeft : game.wallLeft;
  const laiziTitle = laiziRevealed
    ? `翻出${tileLabel(game.indicator)}，${game.laizi.label}作赖子`
    : '牌尾翻出什么，下一张就是赖子';
  return `<header class="game-header">
    <div class="game-header-left">
      <button type="button" class="icon-button icon-button--dark" data-action="open-menu" aria-label="牌桌菜单">${ICON.back}</button>
      <div class="game-brand">
        <span class="game-brand-seal">合</span>
        <span><b>房间 ${escapeHTML(room.code)}</b><small>${roundText} · 湖北 108 张</small></span>
      </div>
    </div>
    <div class="game-status-chips">
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
    <div class="opponent-identity">
      <span class="opponent-avatar">${avatarHTML(player.avatar, { className: 'opponent-avatar-svg' })}</span>
      <span class="opponent-copy">
        <strong>${escapeHTML(player.name)}<span class="wind-tag">${player.wind}</span>${player.isDealer ? '<span class="dealer-tag">庄</span>' : ''}${player.isHost ? '<span class="host-tag">东家</span>' : ''}</strong>
        <small>${formatScore(player.score)} 分 · ${player.handCount} 张${player.auto && !player.isBot ? ' · 托管' : ''}</small>
      </span>
      <span class="turn-pin">出牌中</span>
    </div>
    <div class="opponent-hand-backs">${renderHandBacks(player.handCount, 'horizontal')}</div>
    ${renderMeldStrip(player, 'horizontal', game)}
  </div>`;
}

function renderSideOpponent(player, side, game) {
  if (!player) return '';
  const isTurn = game.phase !== 'ended' && game.turnSeat === player.seat;
  return `<div class="opponent opponent--side opponent--${side}${isTurn ? ' is-turn' : ''}">
    <span class="opponent-avatar">${avatarHTML(player.avatar, { className: 'opponent-avatar-svg' })}</span>
    <div class="side-person">
      <strong>${escapeHTML(player.name)}</strong>
      <span><i class="wind-tag">${player.wind}</i>${player.isDealer ? '<i class="dealer-tag">庄</i>' : ''}</span>
      <small class="side-score">${formatScore(player.score)}</small>
      ${player.auto && !player.isBot ? '<span class="auto-tag">托</span>' : ''}
    </div>
    <div class="opponent-hand-backs opponent-hand-backs--vertical">${renderHandBacks(player.handCount, 'vertical')}</div>
    ${renderMeldStrip(player, 'vertical', game)}
    <span class="turn-pin">出牌中</span>
  </div>`;
}

function renderHandBacks(count, direction) {
  const total = Math.max(0, Math.min(14, count));
  return Array.from({ length: total }, () => (
    renderBack({ size: direction === 'vertical' ? 'back-side' : 'back-mini' })
  )).join('');
}

function renderMeldStrip(player, orientation, game) {
  if (!player.melds || player.melds.length === 0) return '';
  return `<div class="meld-strip meld-strip--${orientation}">
    ${player.melds.map((meld) => renderMeld(meld, {
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
  return `<section class="river-lane river-lane--${position}${isSelf ? ' is-self' : ''}${isTurn ? ' is-turn' : ''}">
    <header class="river-head">
      <span class="wind-badge">${player.wind}</span>
      <span class="river-name">${isSelf ? '你' : escapeHTML(player.name)}</span>
      ${player.isDealer ? '<span class="river-dealer">庄</span>' : ''}
      <span class="river-turn-label">出牌中</span>
    </header>
    <div class="river-tiles">
      ${player.discards?.length
    ? player.discards.map((tile) => renderTile(tile, {
      size: 'river',
      laiziKey: game.laizi.key,
      highlight: highlightLast && lastDiscard.tile.id === tile.id,
    })).join('')
    : '<span class="river-empty">尚未出牌</span>'}
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
  return `<div class="self-identity${isTurn ? ' is-turn' : ''}">
    <span class="self-avatar">${avatarHTML(player.avatar, { className: 'self-avatar-svg' })}</span>
    <span class="self-copy">
      <strong>${escapeHTML(player.name)}<span class="you-mark">你</span></strong>
      <small>${player.wind}位 · ${formatScore(player.score)} 分${player.isDealer ? ' · 庄家' : ''}</small>
    </span>
    <span class="self-badges">
      ${you.wildCount > 1 ? `<span class="badge badge--warning">赖子 ${you.wildCount} 张 · 胡不了</span>` : ''}
      ${you.wildCount === 1 ? '<span class="badge badge--soft">手中有赖</span>' : ''}
      ${you.chengdiaoUsed ? '<span class="badge badge--soft">本局已惩调</span>' : ''}
      ${player.auto && !player.isBot ? '<span class="badge">托管中</span>' : ''}
    </span>
  </div>`;
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
      ${actions.canPeng ? '<button type="button" class="action-button" data-action="claim" data-choice="peng">碰</button>' : ''}
      ${actions.canGang ? '<button type="button" class="action-button action-button--jade" data-action="claim" data-choice="gang">杠</button>' : ''}
      <button type="button" class="action-button action-button--ghost" data-action="claim" data-choice="pass">过</button>
    </div>`;
  }

  if (actions?.kind === 'self' && isMyTurn) {
    const discardLabel = selectedTile ? tileLabel(selectedTile) : '';
    return `<div class="dock-actions dock-actions--self">
      ${actions.canWin ? '<button type="button" class="action-button action-button--hu" data-action="declare-win">胡</button>' : ''}
      ${actions.canChengdiao ? '<button type="button" class="action-button action-button--cheng" data-action="ask-chengdiao">惩调</button>' : ''}
      ${actions.gangs?.length ? `<button type="button" class="action-button action-button--jade" data-action="open-gangs">${actions.gangs.every((gang) => gang.kind === 'huihui') ? '回回' : '杠'}${actions.gangs.length > 1 ? ` ${actions.gangs.length}` : ''}</button>` : ''}
      ${selectedTile
    ? `<button type="button" class="action-button action-button--discard" data-action="discard-selected">打出 <small>${discardLabel}</small></button>`
    : '<span class="action-hint">点一张牌，再点一次打出</span>'}
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
    return `<div class="dock-actions dock-actions--waiting"><span class="action-status">${escapeHTML(status)}</span></div>`;
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

function renderSelfMelds(you, game) {
  if (!you.melds?.length) return '';
  return `<div class="self-meld-row">
    <span class="self-meld-label">面子</span>
    ${you.melds.map((meld) => renderMeld(meld, {
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
    ${canInteract ? `<span class="hand-tip">${selectedTile ? '再点一次也可以打出' : '点选一张要打出的牌'}</span>` : ''}
  </div>`;
}

function renderResult(room, game, players) {
  const result = game.result;
  const winner = result.type === 'win' ? playerAt(players, result.winnerSeat) : null;
  const reveal = winner && result.reveal
    ? result.reveal.find((entry) => entry.seat === result.winnerSeat)
    : null;
  const isHost = room.you?.isHost;
  const winnerCharacter = winner ? getCharacter(winner.avatar) : null;
  const payments = Array.isArray(result.payments) ? result.payments : [];
  const winnerChengdiao = Boolean(result.winnerChengdiao ?? result.multiplier > 1);
  const doubledPayers = payments
    .filter((payment) => payment.payerChengdiao)
    .map((payment) => playerAt(players, payment.seat)?.name)
    .filter(Boolean);

  return `<div class="result-overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
    <div class="result-card">
      <button type="button" class="icon-button result-close" data-action="dismiss-result" aria-label="收起结算">${ICON.close}</button>
      <header class="result-header">
        <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>第 ${game.roundNumber} 局 · 结算</p>
        ${winner ? `<div class="result-winner">
          <span class="result-avatar">${avatarHTML(winner.avatar, { className: 'result-avatar-svg' })}</span>
          <div>
            <h2 id="result-title">${escapeHTML(winner.name)} 自摸</h2>
            <p>${winnerCharacter?.animal || ''} · ${winner.wind}位${winner.isDealer ? ' · 庄家' : ''}</p>
          </div>
        </div>` : `<div class="result-winner result-winner--draw">
          <span class="draw-seal">荒</span>
          <div><h2 id="result-title">本局荒庄</h2><p>牌墙已摸完，四家未胡</p></div>
        </div>`}
      </header>
      ${winner ? `<div class="result-tags">
        <span class="result-tag">${result.soft ? '软胡自摸' : '素胡自摸'}</span>
        <span class="result-tag">${result.soft ? '手中一张赖子' : '不带赖子'}</span>
        <span class="result-tag result-tag--money">本局收 ${result.total ?? result.perPlayer * 3} 分</span>
        ${winnerChengdiao ? '<span class="result-tag result-tag--red">惩调 ×2</span>' : ''}
        ${doubledPayers.length ? `<span class="result-tag result-tag--red">${escapeHTML(doubledPayers.join('、'))} 惩调付双倍</span>` : ''}
      </div>` : '<p class="result-draw-note">杠分已经结清，牌局照常记录。</p>'}
      ${reveal ? `<div class="result-hand-block">
        <span class="result-section-label">胡牌牌面</span>
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
      <div class="result-scores">
        <div class="result-score-head"><span>四家分数</span><span>本局 / 总计</span></div>
        ${players.map((player) => {
    const delta = result.deltas?.[player.seat] ?? 0;
    return `<div class="result-score-row${player.seat === result.winnerSeat ? ' is-winner' : ''}">
      <span class="result-score-person">
        <span class="tiny-avatar">${avatarHTML(player.avatar, { className: 'tiny-avatar-svg' })}</span>
        <span>${escapeHTML(player.name)}${player.seat === room.viewerSeat ? '<i>你</i>' : ''}</span>
      </span>
      <span class="result-score-values">
        <b class="${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">${formatScore(delta)}</b>
        <em>${formatScore(player.score)}</em>
      </span>
    </div>`;
  }).join('')}
      </div>
      <div class="result-actions">
        <button type="button" class="button button--ghost" data-action="dismiss-result">看看牌桌</button>
        ${isHost
    ? `<button type="button" class="button button--primary" data-action="next-round"><span>再来一局</span>${ICON.arrow}</button>`
    : '<button type="button" class="button button--disabled" disabled>等东家开下一局</button>'}
      </div>
      <p class="result-foot">${isHost ? '胡牌者下局坐庄，荒庄连庄。' : '东家点开下一局后，这里会自动开始。'}</p>
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
  } else if (type === 'chengdiao') {
    modalRoot.innerHTML = renderChengdiaoModal();
  } else if (type === 'confirm-leave') {
    modalRoot.innerHTML = renderLeaveConfirm();
  } else if (type === 'share') {
    modalRoot.innerHTML = renderShareModal();
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
    <p class="modal-lead">规矩先说好，牌才打得轻松。这里只记积分，不涉及任何现金。</p>
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
        <p>可以碰、可以杠，不能吃上家。顺子全靠自己摸牌，以及赖子来补。碰下的三张牌如果又摸到第四张，可以叫「回回」，三家各付 10 分，并扣下一张摆在面子旁。</p>
      </section>
      <section class="rule-section">
        <h3><span>四</span>赖子</h3>
        <p>开局翻一张牌，同花色下一张的 4 张牌为赖子（如翻出五万，六万作赖；九之后回头一）。赖子可以当任意一张牌用，但不能参与碰、杠，打出后也无人能碰杠。</p>
        <p class="rule-emphasis">胡牌时手上最多只能有一张赖子。赖子多于一张，只能先打掉多余的。</p>
      </section>
      <section class="rule-section">
        <h3><span>五</span>掷骰开牌</h3>
        <p>每局由庄家掷一枚骰子。1、3、5 点从对面数，2、6 点从庄家右手边数，4 点从左手边数；点数是几，就从那一侧数几墩，从那里切开牌墙起牌。</p>
      </section>
    </div>
    <h3 class="modal-subtitle">算账</h3>
    <div class="score-table">
      <div class="score-table-row score-table-head"><span>胡牌 / 动作</span><span>每位</span><span>说明</span></div>
      <div class="score-table-row"><span>素胡自摸</span><b>20 分</b><span>不带赖子，共收 60 分</span></div>
      <div class="score-table-row"><span>软胡自摸</span><b>10 分</b><span>用一张赖子，共收 30 分</span></div>
      <div class="score-table-row"><span>暗杠</span><b>20 分</b><span>三家各付，共收 60 分</span></div>
      <div class="score-table-row"><span>回回</span><b>10 分</b><span>碰牌后摸到第四张，三家各付，共收 30 分</span></div>
      <div class="score-table-row"><span>明杠</span><b>10 分</b><span>由被杠的那一家付</span></div>
      <div class="score-table-row"><span>惩调</span><b>×2</b><span>本局输赢翻倍，每局每人一次</span></div>
    </div>
    <div class="rule-callout">
      <span class="rule-callout-mark">惩调</span>
      <p><b>听牌后</b>轮到你摸牌时，可以点「惩调」：把刚摸的这张牌与牌墙最末（牌尾）换一张。<b>本局你的输赢都 ×2</b>：你自摸时每家付双倍，别人自摸时你也付双倍。每局每人只能惩调一次。</p>
      <p>杠或回回后从牌尾补牌本身不算惩调，要翻倍仍需在听牌时主动惩调；若本局已经惩调，之后补牌自摸也照常按双倍结算，杠分和回回分本身不参与翻倍。软胡或窄听去惩调，风险大、收益低。</p>
    </div>
    <div class="drawer-notes">
      <p><b>荒庄：</b>牌墙摸完仍无人胡牌，本局无胡牌分，已经拿到的杠分和回回分保留。</p>
      <p><b>座位：</b>四人一桌；空位由 AI 补位。胡牌者下一局坐庄，荒庄则庄家连庄。</p>
      <p><b>操作：</b>轮到你时，点选一张牌，再点一次即可打出。别人打牌后，可以碰或杠；应对有 10 秒倒计时。听牌后出现「惩调」按钮，可以赌一次牌尾，本局输赢翻倍。</p>
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
      <button type="button" class="menu-item" data-action="toggle-bgm">${audio.bgmEnabled ? ICON.musicOn : ICON.musicOff}<span><b>背景音乐 · ${audio.bgmEnabled ? '开' : '关'}</b><small>牌桌上的五声音阶小调</small></span>${ICON.arrow}</button>
      <button type="button" class="menu-item" data-action="toggle-sfx">${audio.sfxEnabled ? ICON.soundOn : ICON.soundOff}<span><b>音效与报牌 · ${audio.sfxEnabled ? '开' : '关'}</b><small>牌落桌，湖北话念牌名</small></span>${ICON.arrow}</button>
      <button type="button" class="menu-item" data-action="share-invite">${ICON.share}<span><b>邀请家里人</b><small>发送房间 ${escapeHTML(room?.code || '')} 的邀请链接</small></span>${ICON.arrow}</button>
      <button type="button" class="menu-item menu-item--danger" data-action="ask-leave">${ICON.logout}<span><b>离开${room?.game ? '牌局' : '此桌'}</b><small>${room?.game ? '手牌会交给 AI 托管' : '释放你的座位'}</small></span>${ICON.arrow}</button>
    </div>
  </div>`);
}

function renderGangModal() {
  const actions = state.room?.game?.you?.actions;
  const gangs = actions?.gangs || [];
  const onlyHuihui = gangs.length > 0 && gangs.every((gang) => gang.kind === 'huihui');
  return modalShell(`<div class="modal-body">
    <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>${onlyHuihui ? '回回' : '开杠'}</p>
    <h2 id="modal-title">${onlyHuihui ? '要不要回回？' : '选一组杠牌'}</h2>
    <p class="modal-lead">${onlyHuihui ? '碰牌后摸到第四张，可以回回：三家各付 10 分，面子扣下一张，再从牌尾补一张。' : '杠或回回后从牌尾补一张牌。补牌本身不算惩调；若本局已惩调，仍按双倍结算。'}</p>
    <div class="gang-options">
      ${gangs.map((gang, index) => `<button type="button" class="gang-option" data-action="choose-gang" data-gang-kind="${gang.kind}" data-gang-key="${gang.key}" data-meld-index="${gang.meldIndex ?? ''}" ${index === 0 ? 'data-autofocus' : ''}>
        <span class="gang-tile">${renderTile(gang.tiles[0], { size: 'gang', laiziKey: state.room.game.laizi.key })}</span>
        <span class="gang-copy"><b>${gang.kind === 'concealed' ? '暗杠' : '回回'}</b><small>${gang.kind === 'concealed' ? '手里四张齐全' : '碰牌后摸到第四张'}</small></span>
        <span class="gang-points">${gang.kind === 'concealed' ? '+60' : '+30'} 分</span>
      </button>`).join('')}
    </div>
  </div>`);
}

function renderChengdiaoModal() {
  return modalShell(`<div class="modal-body">
    <p class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span>惩调</p>
    <h2 id="modal-title">要不要换牌尾那张？</h2>
    <p class="modal-lead">你已听牌。确认后，刚摸的这张牌会换成牌墙最末（牌尾）的一张。<b>本局你的输赢都 ×2</b>：之后自摸每家付双倍，别人自摸你也付双倍。</p>
    <div class="rule-callout">
      <span class="rule-callout-mark">提醒</span>
      <p>素胡翻倍是 40/家，软胡翻倍是 20/家；如果别人先自摸，你也要付双倍。换来的牌没胡也能继续打，本局之后自摸仍然翻倍；每局只能惩调一次，宽面听时更值得试。</p>
    </div>
    <div class="confirm-actions">
      <button type="button" class="button button--ghost" data-action="close-modal" data-autofocus>先不惩调</button>
      <button type="button" class="button button--primary" data-action="confirm-chengdiao">确认惩调</button>
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
    ? '复制没有成功。长按下面的链接复制下来，再发给家里人。'
    : wechat
      ? '邀请链接已经复制。点右上角 ···，选「发送给朋友」，家里人点开就直接入座。'
      : '邀请链接已经复制。打开微信，粘贴到家庭群，家里人点开就直接入座。'}</p>
    <div class="share-link-field">
      <span>邀请链接</span>
      <input class="share-link-input" type="text" readonly value="${escapeHTML(url)}" aria-label="邀请链接">
    </div>
    <div class="confirm-actions">
      <button type="button" class="button button--ghost" data-action="close-modal" data-autofocus>知道了</button>
      <button type="button" class="button button--primary" data-action="copy-invite">再复制一次</button>
    </div>
    <p class="share-tip">微信里也可以直接点右上角 ··· → 发送给朋友，当前这桌的链接会自动带上。</p>
  </div>`);
}

function updateDocumentTitle() {
  if (state.screen === 'home') {
    if (state.invite) {
      const inviter = state.invite.from || '家里人';
      document.title = `${inviter}邀你来打牌 · 合院棋牌室`;
    } else {
      document.title = '合院棋牌室 · 湖北麻将 108 张';
    }
    return;
  }
  if (state.screen === 'room') {
    document.title = `房间 ${state.room?.code || ''} · 合院棋牌室`;
    return;
  }
  if (state.screen === 'game') {
    const game = state.room?.game;
    if (!game) {
      document.title = '合院棋牌室';
      return;
    }
    if (game.phase === 'ended') {
      document.title = '本局结束 · 合院棋牌室';
    } else if (game.phase === 'opening') {
      document.title = game.you?.seat === game.dealerSeat && game.opening?.stage === 'waiting'
        ? '该你掷骰子 · 合院棋牌室'
        : '开局掷骰 · 合院棋牌室';
    } else if (game.you?.actions?.kind === 'claim') {
      document.title = '该你应对 · 合院棋牌室';
    } else if (game.phase === 'discard' && game.turnSeat === game.you?.seat) {
      document.title = '轮到你出牌 · 合院棋牌室';
    } else {
      document.title = '牌局进行中 · 合院棋牌室';
    }
  }
}

function tickCountdowns() {
  const now = Date.now();
  document.querySelectorAll('[data-deadline]').forEach((element) => {
    const deadline = Number(element.dataset.deadline);
    if (!Number.isFinite(deadline)) return;
    const remaining = Math.max(0, deadline - now);
    const seconds = Math.ceil(remaining / 1000);
    if (element.classList.contains('pending-countdown')) {
      element.textContent = `${seconds}s`;
    } else if (element.classList.contains('countdown-pill')) {
      const value = element.querySelector('.countdown-value');
      if (value) value.textContent = String(seconds);
      element.style.setProperty('--countdown', `${Math.min(100, (remaining / CLAIM_WINDOW) * 100)}%`);
    }
  });
}

window.setInterval(tickCountdowns, 120);

function handleOrientationChange() {
  if (state.screen === 'game' || state.screen === 'room') render();
}

window.addEventListener('orientationchange', handleOrientationChange);
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
    discardTile(tileId);
    return;
  }
  state.selectedTileId = tileId;
  audio.unlock();
  audio.play('select');
  render();
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

async function declareChengdiao() {
  const response = await request('game:action', { action: { type: 'chengdiao' } });
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
  state.lastDiscardKey = null;
  state.orientationDismissed = false;
  state.diceRolling = false;
  clearOpeningTimers();
  exitLandscapeMode();
  renderModal();
  render();
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
  const response = await request('room:create', {
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

async function joinRoom() {
  if (state.actionInFlight) return;
  const code = state.invite?.code;
  if (!code) {
    showToast('邀请链接不完整，请让家里人重新发一次', 'error');
    return;
  }
  markIdentityRemembered();
  const response = await request('room:join', {
    code,
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
  state.lastDiscardKey = null;
  render();
}

async function shareInvite() {
  const code = state.room?.code;
  if (!code) return;
  const inviter = effectiveName();
  const url = buildInviteUrl(code, inviter);
  const shareData = {
    title: `合院棋牌室 · 房间 ${code}`,
    text: `${inviter} 邀你来「合院棋牌室」打湖北麻将，房间 ${code}。点开链接直接入座。`,
    url,
  };
  if (navigator.share && isMobileDevice() && !isWeChatBrowser()) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  const copied = await copyText(url);
  state.modal = { type: 'share', url, copied, wechat: isWeChatBrowser() };
  renderModal();
  showToast(
    copied ? '邀请链接已复制' : '链接已备好，长按可复制',
    copied ? 'success' : 'info',
  );
}

async function copyInviteLink() {
  if (!state.room?.code) return;
  const url = state.modal?.type === 'share' && state.modal.url
    ? state.modal.url
    : buildInviteUrl(state.room.code, effectiveName());
  const copied = await copyText(url);
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
  const rotate = isMobileDevice() && isPortrait();
  if (rotate) requestLandscapeMode();
  const response = await request('room:start', {});
  if (!response.ok && rotate) exitLandscapeMode();
  else if (response.ok) render();
}

async function nextRound() {
  const response = await request('room:nextRound', {});
  if (response.ok) {
    state.showResult = false;
    state.dismissedResult = null;
    render();
  }
}

document.addEventListener('click', (event) => {
  audio.unlock();
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) {
    const tile = event.target.closest('[data-tile-id]');
    if (tile && tile.closest('.hand')) handleHandTile(tile.dataset.tileId);
    return;
  }
  const action = actionTarget.dataset.action;
  switch (action) {
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
    case 'open-rules':
      state.modal = { type: 'rules' };
      renderModal();
      break;
    case 'open-menu':
      state.modal = { type: 'menu' };
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
    case 'ask-chengdiao':
      state.modal = { type: 'chengdiao' };
      renderModal();
      break;
    case 'confirm-chengdiao':
      closeModal();
      declareChengdiao();
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
      discardTile(state.selectedTileId);
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
  } else if (event.target.id === 'invite-form') {
    joinRoom();
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
  if (event.target.classList.contains('modal-backdrop')) closeModal();
});

render();
renderModal();

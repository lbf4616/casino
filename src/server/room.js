'use strict';

const { Game, GameError } = require('./game');
const bot = require('./bot');

const AVATARS = ['horse', 'monkey', 'snake', 'rabbit', 'pig', 'ox'];
const AVATAR_NAMES = {
  horse: '妈妈',
  monkey: '爸爸',
  snake: '姐姐',
  rabbit: '姐夫',
  pig: '博凡',
  ox: '欣宇',
};
const BOT_PROFILES = [
  { name: '青禾', avatar: 'snake' },
  { name: '金桂', avatar: 'pig' },
  { name: '墨竹', avatar: 'horse' },
  { name: '白露', avatar: 'rabbit' },
  { name: '远山', avatar: 'monkey' },
  { name: '小满', avatar: 'ox' },
];
const CLAIM_RESPONSE_DELAY = [420, 820];
const OPENING_AUTO_ROLL_DELAY = [850, 1350];
const TURN_DELAY = [650, 1250];
const ROOM_IDLE_MS = 30 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class RoomError extends Error {}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanProfile(profile) {
  const avatar = AVATARS.includes(profile?.avatar) ? profile.avatar : AVATARS[0];
  const name = cleanText(profile?.name, 12) || AVATAR_NAMES[avatar];
  return { name, avatar };
}

function randomBetween([min, max]) {
  return min + Math.floor(Math.random() * (max - min));
}

class Room {
  constructor(manager, code, clientId, profile, socketId) {
    this.manager = manager;
    this.code = code;
    this.seats = [null, null, null, null];
    this.hostSeat = 0;
    this.game = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.botTimer = null;
    this.claimTimer = null;
    this.scheduleToken = 0;
    this.closed = false;
    this.seats[0] = {
      seat: 0,
      clientId,
      name: profile.name,
      avatar: profile.avatar,
      isBot: false,
      connected: true,
      auto: false,
      socketId,
      score: 0,
    };
  }

  touch() {
    this.lastActivity = Date.now();
  }

  seatOfClient(clientId) {
    return this.seats.findIndex((player) => player && !player.isBot && player.clientId === clientId);
  }

  humanSeats() {
    return this.seats.filter((player) => player && !player.isBot);
  }

  connectedHumans() {
    return this.seats.filter((player) => player && !player.isBot && player.connected);
  }

  addHuman(clientId, profile, socketId) {
    if (this.game) throw new RoomError('牌局已经开始，不能再入座');
    const empty = this.seats.findIndex((player) => !player);
    if (empty < 0) throw new RoomError('这一桌已经坐满了');
    this.seats[empty] = {
      seat: empty,
      clientId,
      name: profile.name,
      avatar: profile.avatar,
      isBot: false,
      connected: true,
      auto: false,
      socketId,
      score: 0,
    };
    this.touch();
    this.broadcast();
    return empty;
  }

  attach(clientId, socketId) {
    const seat = this.seatOfClient(clientId);
    if (seat < 0) throw new RoomError('你的座位已经不在房间里了');
    const player = this.seats[seat];
    player.socketId = socketId;
    player.connected = true;
    player.auto = false;
    this.touch();
    this.ensureHost();
    this.broadcast();
    this.schedule();
    return seat;
  }

  markDisconnected(socketId) {
    const player = this.seats.find((entry) => entry && entry.socketId === socketId);
    if (!player) return;
    player.socketId = null;
    player.connected = false;
    player.auto = true;
    this.touch();
    this.ensureHost();
    this.broadcast();
    this.schedule();
  }

  ensureHost() {
    const current = this.seats[this.hostSeat];
    if (current && !current.isBot && current.connected && current.clientId) return;
    const replacement = this.seats.find(
      (player) => player && !player.isBot && player.connected && player.clientId,
    );
    if (replacement) this.hostSeat = replacement.seat;
  }

  moveSeat(clientId, target) {
    if (this.game) throw new RoomError('牌局开始后不能再换座位');
    const currentSeat = this.seatOfClient(clientId);
    if (currentSeat < 0) throw new RoomError('你不在这一桌');
    const targetSeat = Number(target);
    if (!Number.isInteger(targetSeat) || targetSeat < 0 || targetSeat > 3) {
      throw new RoomError('座位不存在');
    }
    if (targetSeat === currentSeat) return;
    if (this.seats[targetSeat]) throw new RoomError('这个位置已经有人了');
    const player = this.seats[currentSeat];
    this.seats[currentSeat] = null;
    player.seat = targetSeat;
    this.seats[targetSeat] = player;
    if (this.hostSeat === currentSeat) this.hostSeat = targetSeat;
    this.touch();
    this.broadcast();
  }

  fillBots() {
    const usedNames = new Set(this.seats.filter(Boolean).map((player) => player.name));
    for (let seat = 0; seat < 4; seat += 1) {
      if (this.seats[seat]) continue;
      const profile = BOT_PROFILES.find((candidate) => !usedNames.has(candidate.name))
        || BOT_PROFILES[seat % BOT_PROFILES.length];
      const botProfile = {
        name: `${profile.name}${usedNames.has(profile.name) ? '二号' : ''}`.slice(0, 12),
        avatar: profile.avatar,
      };
      usedNames.add(botProfile.name);
      this.seats[seat] = {
        seat,
        clientId: null,
        name: botProfile.name,
        avatar: botProfile.avatar,
        isBot: true,
        connected: true,
        auto: true,
        socketId: null,
        score: 0,
      };
    }
  }

  startGame(clientId) {
    if (this.game) throw new RoomError('牌局已经开始');
    if (this.hostSeat !== this.seatOfClient(clientId)) throw new RoomError('只有东家可以开局');
    this.fillBots();
    const actors = this.seats.map((player) => ({
      name: player.name,
      avatar: player.avatar,
      isBot: player.isBot,
    }));
    const scores = this.seats.map(() => 0);
    this.game = new Game({
      actors,
      scores,
      dealerSeat: this.hostSeat,
      roundNumber: 1,
    });
    this.touch();
    this.broadcast();
    this.schedule();
  }

  startNextRound(clientId) {
    if (!this.game) throw new RoomError('牌局还没有开始');
    if (this.game.phase !== 'ended') throw new RoomError('本局还没有结束');
    if (this.hostSeat !== this.seatOfClient(clientId)) throw new RoomError('只有东家可以开下一局');
    const scores = [...this.game.scores];
    for (let i = 0; i < 4; i += 1) {
      if (this.seats[i]) this.seats[i].score = scores[i];
    }
    const dealerSeat = this.game.nextDealerSeat;
    const actors = this.seats.map((player) => ({
      name: player.name,
      avatar: player.avatar,
      isBot: player.isBot,
    }));
    this.game = new Game({
      actors,
      scores,
      dealerSeat,
      roundNumber: this.game.roundNumber + 1,
    });
    this.touch();
    this.broadcast();
    this.schedule();
  }

  performAction(clientId, action) {
    if (!this.game) throw new RoomError('牌局还没有开始');
    const seat = this.seatOfClient(clientId);
    if (seat < 0) throw new RoomError('你不在这一桌');
    this.game.act(seat, action);
    this.touch();
    if (this.game.phase === 'ended') {
      for (let i = 0; i < 4; i += 1) {
        if (this.seats[i]) this.seats[i].score = this.game.scores[i];
      }
    }
    this.broadcast();
    this.schedule();
  }

  leave(clientId) {
    const seat = this.seatOfClient(clientId);
    if (seat < 0) return;
    const player = this.seats[seat];
    this.touch();
    if (!this.game) {
      this.seats[seat] = null;
      this.ensureHost();
      this.broadcast();
      this.schedule();
      if (this.humanSeats().length === 0) this.close('empty');
      return;
    }

    player.clientId = null;
    player.connected = false;
    player.auto = true;
    player.socketId = null;
    this.ensureHost();
    this.broadcast();
    this.schedule();
    const canReturn = this.seats.some((entry) => entry && !entry.isBot && entry.clientId);
    if (!canReturn) this.close('empty');
  }

  isAutoSeat(seat) {
    const player = this.seats[seat];
    return Boolean(player && (player.isBot || player.auto || !player.connected));
  }

  broadcast() {
    if (this.closed) return;
    for (const player of this.seats) {
      if (!player || player.isBot || !player.connected || !player.socketId) continue;
      const socket = this.manager.io.sockets.sockets.get(player.socketId);
      if (!socket) continue;
      socket.emit('room:state', this.publicView(player.seat));
    }
  }

  publicView(viewerSeat) {
    const you = this.seats[viewerSeat];
    const seats = this.seats.map((player, seat) => {
      if (!player) return null;
      const score = this.game ? this.game.scores[seat] : player.score;
      return {
        seat,
        name: player.name,
        avatar: player.avatar,
        isBot: player.isBot,
        connected: player.isBot ? true : player.connected,
        auto: player.isBot ? false : Boolean(player.auto),
        isHost: seat === this.hostSeat,
        score,
      };
    });
    return {
      code: this.code,
      hostSeat: this.hostSeat,
      viewerSeat,
      phase: this.game ? this.game.phase : 'lobby',
      roundNumber: this.game ? this.game.roundNumber : null,
      seats,
      you: you ? { seat: viewerSeat, isHost: this.hostSeat === viewerSeat } : null,
      game: this.game ? this.game.viewFor(viewerSeat) : null,
      serverTime: Date.now(),
    };
  }

  schedule() {
    if (this.closed) return;
    const token = (this.scheduleToken += 1);
    clearTimeout(this.botTimer);
    clearTimeout(this.claimTimer);
    this.botTimer = null;
    this.claimTimer = null;
    if (!this.game || this.game.phase === 'ended') return;

    if (this.game.phase === 'opening') {
      const opening = this.game.opening;
      if (opening.stage === 'waiting') {
        const dealerSeat = this.game.dealerSeat;
        if (!this.isAutoSeat(dealerSeat)) return;
        this.botTimer = setTimeout(() => {
          if (this.closed || token !== this.scheduleToken) return;
          if (!this.game || this.game.phase !== 'opening' || this.game.opening.stage !== 'waiting') return;
          try {
            this.game.rollDice(dealerSeat);
          } catch (error) {
            this.schedule();
            return;
          }
          this.touch();
          this.broadcast();
          this.schedule();
        }, randomBetween(OPENING_AUTO_ROLL_DELAY));
        return;
      }
      if (opening.stage === 'dealing') {
        const wait = Math.max(0, opening.finishAt - Date.now());
        this.botTimer = setTimeout(() => {
          if (this.closed || token !== this.scheduleToken) return;
          if (!this.game || this.game.phase !== 'opening') return;
          if (!this.game.finishOpening()) return;
          this.touch();
          this.broadcast();
          this.schedule();
        }, wait + 30);
      }
      return;
    }

    if (this.game.phase === 'claim' && this.game.pending) {
      const wait = Math.max(0, this.game.pending.deadline - Date.now());
      this.claimTimer = setTimeout(() => {
        if (this.closed || token !== this.scheduleToken) return;
        if (!this.game || this.game.phase !== 'claim') return;
        this.game.timeoutClaims();
        this.broadcast();
        this.schedule();
      }, wait + 25);

      const pendingSeat = Object.keys(this.game.pending.options)
        .map(Number)
        .find((seat) => (
          !this.game.pending.responses[seat]
          && this.isAutoSeat(seat)
        ));
      if (pendingSeat === undefined) return;

      this.botTimer = setTimeout(() => {
        if (this.closed || token !== this.scheduleToken) return;
        if (!this.game || this.game.phase !== 'claim' || !this.game.pending) return;
        if (this.game.pending.responses[pendingSeat]) {
          this.schedule();
          return;
        }
        let action = null;
        try {
          action = bot.decide(this.game, pendingSeat);
        } catch (error) {
          action = { type: 'claim', choice: 'pass' };
        }
        try {
          this.game.respondClaim(pendingSeat, action?.choice || 'pass');
        } catch (error) {
          this.schedule();
          return;
        }
        this.touch();
        if (this.game.phase === 'ended') {
          for (let i = 0; i < 4; i += 1) {
            if (this.seats[i]) this.seats[i].score = this.game.scores[i];
          }
        }
        this.broadcast();
        this.schedule();
      }, randomBetween(CLAIM_RESPONSE_DELAY));
      return;
    }

    if (this.game.phase === 'discard') {
      const seat = this.game.turnSeat;
      if (!this.isAutoSeat(seat)) return;
      this.botTimer = setTimeout(() => {
        if (this.closed || token !== this.scheduleToken) return;
        if (!this.game || this.game.phase !== 'discard' || this.game.turnSeat !== seat) return;
        let action = null;
        try {
          action = bot.decide(this.game, seat);
        } catch (error) {
          action = null;
        }
        if (!action) {
          const player = this.game.playerAt(seat);
          if (player && player.hand.length > 0) {
            action = { type: 'discard', tileId: player.hand[0].id };
          }
        }
        if (!action) return;
        try {
          this.game.act(seat, action);
        } catch (error) {
          const player = this.game.playerAt(seat);
          if (player && this.game.phase === 'discard' && this.game.turnSeat === seat) {
            try {
              this.game.discard(seat, player.hand[0].id);
            } catch (ignored) {
              // Stale timer; the new state will schedule its own action.
            }
          }
        }
        this.touch();
        if (this.game && this.game.phase === 'ended') {
          for (let i = 0; i < 4; i += 1) {
            if (this.seats[i]) this.seats[i].score = this.game.scores[i];
          }
        }
        this.broadcast();
        this.schedule();
      }, randomBetween(TURN_DELAY));
    }
  }

  close(reason) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.botTimer);
    clearTimeout(this.claimTimer);
    this.manager.removeRoom(this, reason);
  }
}

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.clientRooms = new Map();
    this.sweeper = setInterval(() => this.sweep(), 60 * 1000);
    this.sweeper.unref?.();
  }

  generateCode() {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      let code = '';
      for (let i = 0; i < 4; i += 1) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('房间号生成失败，请重试');
  }

  getRoomForClient(clientId) {
    const code = this.clientRooms.get(clientId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) {
      this.clientRooms.delete(clientId);
      return null;
    }
    return room;
  }

  createRoom(clientId, profileInput, socket) {
    const existing = this.getRoomForClient(clientId);
    if (existing) throw new RoomError('你已经在一个牌局里了');
    const profile = cleanProfile(profileInput);
    const code = this.generateCode();
    const room = new Room(this, code, clientId, profile, socket.id);
    this.rooms.set(code, room);
    this.clientRooms.set(clientId, code);
    room.broadcast();
    room.schedule();
    return room;
  }

  joinRoom(clientId, codeInput, profileInput, socket) {
    const code = cleanText(codeInput, 4).toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) throw new RoomError('请输入四位房间号');
    const existing = this.getRoomForClient(clientId);
    if (existing && existing.code === code) {
      existing.attach(clientId, socket.id);
      return existing;
    }
    if (existing) throw new RoomError('你已经在一个牌局里了');
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('没有找到这个房间');
    if (room.game) throw new RoomError('牌局已经开始，这一桌不再接新玩家');
    const profile = cleanProfile(profileInput);
    room.addHuman(clientId, profile, socket.id);
    this.clientRooms.set(clientId, code);
    room.schedule();
    return room;
  }

  resume(clientId, codeInput, socket) {
    let room = null;
    if (codeInput) room = this.rooms.get(cleanText(codeInput, 4).toUpperCase());
    if (!room) room = this.getRoomForClient(clientId);
    if (!room) throw new RoomError('房间已经关闭了');
    if (room.seatOfClient(clientId) < 0) throw new RoomError('你的座位已经释放了');
    this.clientRooms.set(clientId, room.code);
    room.attach(clientId, socket.id);
    return room;
  }

  leave(clientId) {
    const room = this.getRoomForClient(clientId);
    if (!room) return null;
    this.clientRooms.delete(clientId);
    room.leave(clientId);
    return room;
  }

  disconnect(socket, clientId) {
    const room = this.getRoomForClient(clientId);
    if (!room) return;
    room.markDisconnected(socket.id);
  }

  removeRoom(room, reason) {
    if (this.rooms.get(room.code) !== room) return;
    this.rooms.delete(room.code);
    for (const player of room.seats) {
      if (player?.clientId) this.clientRooms.delete(player.clientId);
      if (player?.socketId) {
        const socket = this.io.sockets.sockets.get(player.socketId);
        socket?.emit('room:closed', { reason });
      }
    }
  }

  sweep() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (room.humanSeats().length === 0) {
        room.close('empty');
        continue;
      }
      const anyConnected = room.seats.some(
        (player) => player && !player.isBot && player.connected,
      );
      if (!anyConnected && now - room.lastActivity > ROOM_IDLE_MS) {
        room.close('idle');
      }
    }
  }
}

module.exports = {
  RoomManager,
  RoomError,
  AVATARS,
  cleanProfile,
};

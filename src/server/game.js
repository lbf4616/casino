'use strict';

const {
  buildWall,
  sortTiles,
  tileLabel,
  nextKey,
  SUIT_LABEL,
  RANK_LABEL,
} = require('../shared/tiles');
const { evaluateWin, countWilds } = require('../shared/win');

const WINDS = ['东', '南', '西', '北'];
const CLAIM_WINDOW_MS = 10000;
const TURN_LIMIT_MS = 30000;
const OPENING_DICE_MS = 1700;
const OPENING_TILE_MS = 100;
const OPENING_ROUND_GAP_MS = 220;
const OPENING_DEALER_PICK_MS = 300;
const OPENING_LAST_DRAW_MS = 260;
const OPENING_INDICATOR_DELAY_MS = 240;
const OPENING_INDICATOR_MS = 760;
const OPENING_SORT_MS = 900;
const OPENING_HOLD_MS = 450;
const DICE_DIRECTION = {
  1: 'opposite',
  2: 'right',
  3: 'opposite',
  4: 'left',
  5: 'opposite',
  6: 'right',
};
const DIRECTION_LABEL = {
  opposite: '对面',
  right: '右手边',
  left: '左边',
};
const DIRECTION_SEAT_OFFSET = {
  right: 1,
  opposite: 2,
  left: 3,
};
const GANG_POINTS = {
  concealed: 20,
  exposed: 10,
  huihui: 10,
};

let logSequence = 1;

function publicTile(tile) {
  return { id: tile.id, suit: tile.suit, rank: tile.rank, key: tile.key };
}

function tileFace(key) {
  const [suit, rankText] = key.split('-');
  const rank = Number(rankText);
  return {
    key,
    suit,
    rank,
    label: `${RANK_LABEL[rank]}${SUIT_LABEL[suit]}`,
  };
}

class GameError extends Error {}

class Game {
  constructor({ actors, scores, dealerSeat = 0, roundNumber = 1, rng = Math.random }) {
    if (!Array.isArray(actors) || actors.length !== 4) {
      throw new GameError('牌局需要四位玩家');
    }
    this.roundNumber = roundNumber;
    this.dealerSeat = dealerSeat;
    this.scores = [...scores];
    this.initialScores = [...scores];
    this.rng = rng;
    this.players = actors.map((actor, seat) => ({
      seat,
      name: actor.name,
      avatar: actor.avatar,
      isBot: Boolean(actor.isBot),
      hand: [],
      melds: [],
      discards: [],
      chengdiaoCount: 0,
    }));

    this.wall = buildWall(rng);
    this.indicator = this.wall.pop();
    this.laiziKey = nextKey(this.indicator.key);
    this.laizi = tileFace(this.laiziKey);
    this.log = [];
    this.logSeq = logSequence++;
    this.logEntrySeq = 0;
    this.phase = 'opening';
    this.turnSeat = dealerSeat;
    this.turnDeadline = null;
    this.pending = null;
    this.result = null;
    this.lastDiscard = null;
    this.lastDrawnId = null;
    this.hasDrawnThisTurn = false;
    this.lastDrawFromTail = false;
    this.scoreEvents = [];
    this.nextDealerSeat = dealerSeat;
    this.opening = {
      dealerSeat,
      stage: 'waiting',
      dice: null,
      direction: null,
      directionLabel: null,
      count: null,
      rolledAt: null,
      diceSettleAt: null,
      dealStartAt: null,
      indicatorAt: null,
      sortAt: null,
      finishAt: null,
      wallStart: null,
      dealerDrawId: null,
      dealEvents: [],
      dealOrder: [[], [], [], []],
    };

    this.addLog(
      'start',
      `第 ${roundNumber} 局，${this.players[dealerSeat].name} 坐庄。庄家掷骰子定开牌位置。`,
    );
  }

  addLog(kind, text, seat = null, tile = null, scoreChanges = null) {
    const changes = scoreChanges || (['gang', 'huihui'].includes(kind) ? this.lastScoreChanges : null);
    this.lastScoreChanges = null;
    this.log.push({
      id: `${this.logSeq}-${++this.logEntrySeq}`,
      kind,
      text,
      seat,
      ...(tile ? { tile } : {}),
      ...(changes ? { scoreChanges: changes } : {}),
      at: Date.now(),
    });
    if (this.log.length > 80) this.log.shift();
  }

  rollDice(seat) {
    if (this.phase !== 'opening') throw new GameError('现在不能掷骰子');
    if (seat !== this.dealerSeat) throw new GameError('只有庄家能掷骰子');
    if (this.opening.stage !== 'waiting') throw new GameError('骰子已经掷过了');

    const dice = 1 + Math.floor(this.rng() * 6);
    const direction = DICE_DIRECTION[dice];
    const directionLabel = DIRECTION_LABEL[direction];
    const now = Date.now();
    this.opening = {
      ...this.opening,
      stage: 'dealing',
      dice,
      direction,
      directionLabel,
      count: dice,
      rolledAt: now,
      diceSettleAt: now + OPENING_DICE_MS,
      finishAt: null,
    };
    this.rotateWallForBreak(direction, dice);
    this.dealOpeningHands(now);
    this.addLog(
      'start',
      `庄家${this.players[this.dealerSeat].name}掷出 ${dice} 点，从${directionLabel}数 ${dice} 墩开牌。翻出${tileLabel(this.indicator)}，${this.laizi.label}作赖子。`,
    );
    return this.opening;
  }

  rotateWallForBreak(direction, count) {
    if (!this.wall.length) return;
    const sideLength = Math.floor(this.wall.length / 4);
    const sideOffset = DIRECTION_SEAT_OFFSET[direction];
    const breakIndex = (sideOffset * sideLength + count * 2) % this.wall.length;
    if (!breakIndex) return;
    this.wall = [...this.wall.slice(breakIndex), ...this.wall.slice(0, breakIndex)];
  }

  dealOpeningHands(rolledAt) {
    const dealerSeat = this.dealerSeat;
    const dealStartAt = rolledAt + OPENING_DICE_MS;
    const wallStart = this.wall.length;
    const drawOrder = [[], [], [], []];
    const dealEvents = [];
    let at = dealStartAt;

    const draw = (seat) => {
      const tile = this.wall.shift();
      this.players[seat].hand.push(tile);
      drawOrder[seat].push(tile);
      dealEvents.push({
        seat,
        at,
        tileIndex: drawOrder[seat].length - 1,
        count: this.players[seat].hand.length,
      });
    };

    for (let round = 0; round < 3; round += 1) {
      for (let offset = 0; offset < 4; offset += 1) {
        const seat = (dealerSeat + offset) % 4;
        for (let index = 0; index < 4; index += 1) {
          draw(seat);
          at += OPENING_TILE_MS;
        }
      }
      if (round < 2) at += OPENING_ROUND_GAP_MS;
    }
    for (let index = 0; index < 2; index += 1) {
      draw(dealerSeat);
      at += OPENING_DEALER_PICK_MS;
    }
    for (let offset = 1; offset < 4; offset += 1) {
      draw((dealerSeat + offset) % 4);
      at += OPENING_LAST_DRAW_MS;
    }

    const dealerDraw = drawOrder[dealerSeat][drawOrder[dealerSeat].length - 1];
    for (const player of this.players) player.hand = sortTiles(player.hand);
    const indicatorAt = at + OPENING_INDICATOR_DELAY_MS;
    const sortAt = indicatorAt + OPENING_INDICATOR_MS;

    this.opening.dealOrder = drawOrder;
    this.opening.dealEvents = dealEvents;
    this.opening.wallStart = wallStart;
    this.opening.dealStartAt = dealStartAt;
    this.opening.indicatorAt = indicatorAt;
    this.opening.sortAt = sortAt;
    this.opening.finishAt = sortAt + OPENING_SORT_MS + OPENING_HOLD_MS;
    this.opening.dealerDrawId = dealerDraw.id;
    this.lastDrawnId = dealerDraw.id;
    this.hasDrawnThisTurn = true;
    this.lastDrawFromTail = false;
  }

  finishOpening() {
    if (this.phase !== 'opening' || this.opening.stage !== 'dealing') return false;
    this.opening.stage = 'done';
    this.phase = 'discard';
    this.turnSeat = this.dealerSeat;
    this.turnDeadline = Date.now() + TURN_LIMIT_MS;
    return true;
  }

  getWind(seat) {
    return WINDS[(seat - this.dealerSeat + 4) % 4];
  }

  playerAt(seat) {
    return this.players[seat];
  }

  alive() {
    return this.phase !== 'ended';
  }

  getNaturalCount(player, key) {
    return player.hand.filter((tile) => tile.key === key).length;
  }

  getWildCount(player) {
    return countWilds(player.hand, this.laiziKey);
  }

  canPlayerWin(seat) {
    const player = this.players[seat];
    return evaluateWin(player.hand, player.melds.length, this.laiziKey).win;
  }

  canDeclareWin(seat) {
    return (
      this.phase === 'discard'
      && this.turnSeat === seat
      && this.hasDrawnThisTurn
      && this.canPlayerWin(seat)
    );
  }

  canDeclareChengdiao(seat) {
    const player = this.players[seat];
    return (
      this.phase === 'discard'
      && this.turnSeat === seat
      && this.hasDrawnThisTurn
      && this.wall.length > 0
      && !this.canPlayerWin(seat)
      && this.getWildCount(player) > 0
    );
  }

  declareChengdiao(seat, tileId) {
    if (!this.canDeclareChengdiao(seat)) throw new GameError('现在不能惩调');
    const player = this.players[seat];
    const swapTile = player.hand.find(
      (tile) => tile.key === this.laiziKey && (!tileId || tile.id === tileId),
    );
    if (!swapTile) throw new GameError('惩调只能换赖子');
    const [removed] = player.hand.splice(player.hand.indexOf(swapTile), 1);
    player.discards.push({ ...removed, chengdiao: true });
    const tailTile = this.wall.pop();
    player.hand.push(tailTile);
    player.hand = sortTiles(player.hand);
    player.chengdiaoCount += 1;
    this.hasDrawnThisTurn = true;
    this.lastDrawnId = tailTile.id;
    this.lastDrawFromTail = true;
    this.lastDiscard = { seat, tile: publicTile(removed), chengdiao: true };
    const multiplier = 2 ** player.chengdiaoCount;
    this.addLog(
      'chengdiao',
      `${player.name} 惩调，打出赖子并从牌尾摸一张，本局输赢 ×${multiplier}`,
      seat,
      publicTile(removed),
    );
  }

  getGangOptions(seat) {
    if (this.phase !== 'discard' || this.turnSeat !== seat) return [];
    const player = this.players[seat];
    const canDrawReplacement = this.wall.length > 0;
    const options = [];
    const counted = new Set();
    for (const tile of player.hand) {
      if (tile.key === this.laiziKey || counted.has(tile.key)) continue;
      const count = this.getNaturalCount(player, tile.key);
      if (count === 4 && canDrawReplacement) {
        options.push({
          kind: 'concealed',
          key: tile.key,
          label: tileLabel(tile),
          tiles: [publicTile(tile)],
        });
      }
      // 尾牌已经翻出一张，手里剩三张即可凑成四张暗杠，且不需要补牌。
      if (tile.key === this.indicator.key && count === 3) {
        options.push({
          kind: 'tail',
          key: tile.key,
          label: tileLabel(tile),
          tiles: [publicTile(tile)],
        });
      }
      counted.add(tile.key);
    }
    if (canDrawReplacement) {
      player.melds.forEach((meld, meldIndex) => {
        if (meld.type !== 'peng' || meld.key === this.laiziKey) return;
        if (this.getNaturalCount(player, meld.key) > 0) {
          options.push({
            kind: 'huihui',
            key: meld.key,
            meldIndex,
            label: tileLabel(meld.tiles[0]),
            tiles: [publicTile(meld.tiles[0])],
          });
        }
      });
    }
    return options;
  }

  getActions(seat) {
    if (this.phase === 'ended') return null;
    if (this.phase === 'claim' && this.pending) {
      const options = this.pending.options[seat];
      if (options && !this.pending.responses[seat]) {
        return {
          kind: 'claim',
          canPeng: Boolean(options.peng),
          canGang: Boolean(options.gang),
          tile: publicTile(this.pending.tile),
          fromSeat: this.pending.fromSeat,
          deadline: this.pending.deadline,
        };
      }
      return null;
    }
    if (this.phase === 'discard' && this.turnSeat === seat) {
      return {
        kind: 'self',
        canDiscard: true,
        canWin: this.canDeclareWin(seat),
        canChengdiao: this.canDeclareChengdiao(seat),
        chengdiaoCount: this.players[seat].chengdiaoCount,
        gangs: this.getGangOptions(seat),
        drawnTileId: this.hasDrawnThisTurn ? this.lastDrawnId : null,
        fromTail: this.lastDrawFromTail,
      };
    }
    return null;
  }

  discard(seat, tileId) {
    if (this.phase !== 'discard') throw new GameError('现在不能出牌');
    if (this.turnSeat !== seat) throw new GameError('还没轮到你出牌');
    const player = this.players[seat];
    const index = player.hand.findIndex((tile) => tile.id === tileId);
    if (index < 0) throw new GameError('这张牌不在手中');
    if (player.hand[index].key === this.laiziKey) throw new GameError('赖子不能打出，只能惩调');

    const [tile] = player.hand.splice(index, 1);
    player.discards.push(tile);
    this.lastDiscard = { seat, tile: publicTile(tile) };
    this.hasDrawnThisTurn = false;
    this.lastDrawnId = null;
    this.lastDrawFromTail = false;
    this.turnDeadline = null;
    this.addLog('discard', `${player.name} 打出 ${tileLabel(tile)}`, seat, publicTile(tile));

    const options = this.buildClaimOptions(tile, seat);
    if (Object.keys(options).length > 0) {
      this.phase = 'claim';
      this.pending = {
        tile,
        fromSeat: seat,
        options,
        responses: {},
        createdAt: Date.now(),
        deadline: Date.now() + CLAIM_WINDOW_MS,
      };
      return;
    }
    this.advanceAfterDiscard(seat);
  }

  autoDiscard(seat) {
    if (this.phase !== 'discard' || this.turnSeat !== seat) return false;
    const player = this.players[seat];
    if (!player || player.hand.length === 0) return false;
    const drawn = this.lastDrawnId
      ? player.hand.find((tile) => tile.id === this.lastDrawnId)
      : null;
    const natural = player.hand.filter((tile) => tile.key !== this.laiziKey);
    const tile = (drawn && drawn.key !== this.laiziKey)
      ? drawn
      : natural[natural.length - 1] || player.hand[player.hand.length - 1];
    this.addLog('timeout', `${player.name} 超时未出牌，自动打出 ${tileLabel(tile)}`, seat);
    this.discard(seat, tile.id);
    return true;
  }

  buildClaimOptions(tile, fromSeat) {
    const options = {};
    if (tile.key === this.laiziKey) return options;
    for (const player of this.players) {
      if (player.seat === fromSeat) continue;
      const count = this.getNaturalCount(player, tile.key);
      if (count >= 2) {
        const isTailTile = tile.key === this.indicator.key;
        options[player.seat] = {
          peng: true,
          // 尾牌明杠只要手里两张：翻出的那张补第四张，且杠后不补牌。
          gang: isTailTile || (count >= 3 && this.wall.length > 0),
        };
      }
    }
    return options;
  }

  allClaimResponsesIn() {
    if (!this.pending) return false;
    return Object.keys(this.pending.options).every((seat) => Boolean(this.pending.responses[seat]));
  }

  respondClaim(seat, choice) {
    if (this.phase !== 'claim' || !this.pending) throw new GameError('现在没有可应对的牌');
    const options = this.pending.options[seat];
    if (!options) throw new GameError('这张牌你不能碰杠');
    if (this.pending.responses[seat]) throw new GameError('你已经选择过了');
    if (!['peng', 'gang', 'pass'].includes(choice)) throw new GameError('无效选择');
    if (choice === 'peng' && !options.peng) throw new GameError('不能碰这张牌');
    if (choice === 'gang' && !options.gang) throw new GameError('不能杠这张牌');

    this.pending.responses[seat] = choice;
    if (choice === 'pass') {
      this.addLog('pass', `${this.players[seat].name} 不要`);
    }
    if (this.allClaimResponsesIn()) {
      this.resolveClaims(false);
    }
  }

  timeoutClaims() {
    if (this.phase !== 'claim' || !this.pending) return false;
    for (const seat of Object.keys(this.pending.options)) {
      if (!this.pending.responses[seat]) {
        this.pending.responses[seat] = 'pass';
      }
    }
    this.resolveClaims(true);
    return true;
  }

  resolveClaims(timedOut) {
    if (!this.pending) return;
    const pending = this.pending;
    const candidates = [];
    for (const [seatText, choice] of Object.entries(pending.responses)) {
      if (choice === 'pass') continue;
      const seat = Number(seatText);
      const priority = choice === 'gang' ? 2 : 1;
      const distance = (seat - pending.fromSeat + 4) % 4;
      candidates.push({ seat, choice, priority, distance });
    }
    candidates.sort((a, b) => b.priority - a.priority || a.distance - b.distance);

    const winner = candidates[0];
    this.pending = null;

    if (!winner) {
      if (timedOut) this.addLog('pass', '应对时间结束，继续摸牌');
      this.phase = 'discard';
      this.advanceAfterDiscard(pending.fromSeat);
      return;
    }

    const fromPlayer = this.players[pending.fromSeat];
    const claimIndex = fromPlayer.discards.findIndex((tile) => tile.id === pending.tile.id);
    if (claimIndex >= 0) fromPlayer.discards.splice(claimIndex, 1);

    const player = this.players[winner.seat];
    this.phase = 'discard';
    this.lastDiscard = null;
    this.turnSeat = winner.seat;
    this.hasDrawnThisTurn = false;
    this.lastDrawnId = null;
    this.lastDrawFromTail = false;
    this.turnDeadline = Date.now() + TURN_LIMIT_MS;

    if (winner.choice === 'peng') {
      this.takeTiles(player, pending.tile.key, 2);
      const claimed = this.takeClaimedTile(pending.tile, 2);
      player.melds.push({
        id: `meld-${this.logSeq}-${Date.now()}`,
        type: 'peng',
        key: pending.tile.key,
        tiles: claimed,
        fromSeat: pending.fromSeat,
      });
      this.addLog(
        'peng',
        `${player.name} 碰了${fromPlayer.name}的${tileLabel(pending.tile)}`,
        player.seat,
      );
      return;
    }

    if (winner.choice === 'gang') {
      const tailGang = pending.tile.key === this.indicator.key;
      this.takeTiles(player, pending.tile.key, tailGang ? 2 : 3);
      const claimed = this.takeClaimedTile(pending.tile, tailGang ? 2 : 3);
      if (tailGang) claimed.push({ ...publicTile(this.indicator) });
      player.melds.push({
        id: `meld-${this.logSeq}-${Date.now()}`,
        type: tailGang ? 'tailgang' : 'minggang',
        key: pending.tile.key,
        concealed: false,
        tiles: tailGang ? sortTiles(claimed) : claimed,
        fromSeat: pending.fromSeat,
      });
      this.payGang(
        winner.seat,
        [pending.fromSeat],
        GANG_POINTS.exposed,
        tailGang ? '尾牌明杠' : '明杠',
      );
      this.addLog(
        'gang',
        `${player.name} ${tailGang ? '尾牌明杠' : '明杠'}${fromPlayer.name}的${tileLabel(pending.tile)}，${fromPlayer.name}付10分`,
        player.seat,
      );
      if (!tailGang) this.drawFromTail(winner.seat);
    }
  }

  takeTiles(player, key, count) {
    let remaining = count;
    for (let i = player.hand.length - 1; i >= 0 && remaining > 0; i -= 1) {
      if (player.hand[i].key === key) {
        player.hand.splice(i, 1);
        remaining -= 1;
      }
    }
    if (remaining !== 0) throw new GameError('手牌数量异常');
  }

  takeClaimedTile(tile, naturalCount) {
    const tiles = [];
    for (let i = 0; i < naturalCount; i += 1) {
      tiles.push({
        id: `${tile.key}-in-meld-${Date.now()}-${i}`,
        suit: tile.suit,
        rank: tile.rank,
        key: tile.key,
      });
    }
    tiles.push({ ...publicTile(tile) });
    return sortTiles(tiles);
  }

  advanceAfterDiscard(fromSeat) {
    if (this.phase === 'ended') return;
    const nextSeat = (fromSeat + 1) % 4;
    this.drawFor(nextSeat, false);
  }

  drawFor(seat, fromTail) {
    if (this.phase === 'ended') return;
    if (this.wall.length === 0) {
      this.endDraw();
      return;
    }
    const tile = fromTail ? this.wall.pop() : this.wall.shift();
    const player = this.players[seat];
    player.hand.push(tile);
    player.hand = sortTiles(player.hand);
    this.turnSeat = seat;
    this.phase = 'discard';
    this.turnDeadline = Date.now() + TURN_LIMIT_MS;
    this.hasDrawnThisTurn = true;
    this.lastDrawnId = tile.id;
    this.lastDrawFromTail = fromTail;
    this.lastDiscard = null;
    if (!fromTail) {
      this.addLog('draw', `${player.name} 摸牌`);
    }
  }

  drawFromTail(seat) {
    this.drawFor(seat, true);
  }

  payGang(winnerSeat, payerSeats, amount, label) {
    let received = 0;
    const scoreChanges = payerSeats.map((seat) => ({ seat, delta: -amount }));
    for (const payer of payerSeats) {
      this.scores[payer] -= amount;
      received += amount;
    }
    this.scores[winnerSeat] += received;
    scoreChanges.push({ seat: winnerSeat, delta: received });
    this.lastScoreChanges = scoreChanges;
    this.scoreEvents.push({
      type: 'gang',
      label,
      seat: winnerSeat,
      payers: payerSeats,
      amount,
      total: received,
    });
    return received;
  }

  declareGang(seat, payload) {
    if (this.phase !== 'discard' || this.turnSeat !== seat) throw new GameError('还没轮到你');
    const player = this.players[seat];
    const options = this.getGangOptions(seat);
    const match = options.find((option) => (
      option.kind === payload.kind
      && option.key === payload.key
      && (payload.kind !== 'huihui' || Number(payload.meldIndex) === option.meldIndex)
    ));
    if (!match) throw new GameError('不能这样杠牌');

    const others = [0, 1, 2, 3].filter((other) => other !== seat);

    if (match.kind === 'concealed') {
      this.takeTiles(player, match.key, 4);
      const face = tileFace(match.key);
      const tiles = [0, 1, 2, 3].map((i) => ({
        id: `${match.key}-concealed-${Date.now()}-${i}`,
        suit: face.suit,
        rank: face.rank,
        key: face.key,
      }));
      player.melds.push({
        id: `meld-${this.logSeq}-${Date.now()}`,
        type: 'angang',
        key: match.key,
        tiles,
        concealed: true,
      });
      this.payGang(seat, others, GANG_POINTS.concealed, '暗杠');
      this.addLog('gang', `${player.name} 暗杠，三家各付20分`, seat);
    } else if (match.kind === 'tail') {
      this.takeTiles(player, match.key, 3);
      const face = tileFace(match.key);
      const tiles = [0, 1, 2].map((i) => ({
        id: `${match.key}-tail-${Date.now()}-${i}`,
        suit: face.suit,
        rank: face.rank,
        key: face.key,
      }));
      tiles.push({ ...publicTile(this.indicator) });
      player.melds.push({
        id: `meld-${this.logSeq}-${Date.now()}`,
        type: 'tailgang',
        key: match.key,
        tiles: sortTiles(tiles),
        concealed: true,
      });
      this.payGang(seat, others, GANG_POINTS.concealed, '尾牌暗杠');
      this.addLog('gang', `${player.name} 尾牌暗杠，三家各付20分`, seat);
      player.hand = sortTiles(player.hand);
      this.hasDrawnThisTurn = false;
      this.lastDrawnId = null;
      this.lastDrawFromTail = false;
      this.turnDeadline = Date.now() + TURN_LIMIT_MS;
      return;
    } else {
      const meld = player.melds[match.meldIndex];
      const index = player.hand.findIndex((tile) => tile.key === match.key);
      if (index < 0 || !meld || meld.type !== 'peng') throw new GameError('杠牌状态异常');
      const [tile] = player.hand.splice(index, 1);
      meld.type = 'huihui';
      meld.tiles.push(tile);
      meld.tiles = sortTiles(meld.tiles);
      this.payGang(seat, others, GANG_POINTS.huihui, '回回');
      this.addLog('huihui', `${player.name} 回回，三家各付10分`, seat);
    }

    player.hand = sortTiles(player.hand);
    this.hasDrawnThisTurn = false;
    this.lastDrawnId = null;
    if (this.wall.length === 0) {
      this.endDraw();
      return;
    }
    this.drawFor(seat, true);
    this.lastDrawFromTail = true;
  }

  declareWin(seat) {
    if (this.phase !== 'discard' || this.turnSeat !== seat) throw new GameError('还没轮到你');
    if (!this.hasDrawnThisTurn) throw new GameError('只能自摸胡牌');
    const player = this.players[seat];
    const evaluation = evaluateWin(player.hand, player.melds.length, this.laiziKey);
    if (!evaluation.win) throw new GameError('这副牌还没有胡');
    if (evaluation.wildCount > 1) throw new GameError('手上赖子超过一张，不能胡');

    const soft = evaluation.soft;
    const base = soft ? 10 : 20;
    const winnerChengdiaoCount = player.chengdiaoCount;
    const winnerChengdiao = winnerChengdiaoCount > 0;
    const winnerMultiplier = 2 ** winnerChengdiaoCount;
    const others = [0, 1, 2, 3].filter((other) => other !== seat);
    const payments = others.map((other) => {
      const payerChengdiaoCount = this.players[other].chengdiaoCount;
      const payerMultiplier = 2 ** payerChengdiaoCount;
      const multiplier = winnerMultiplier * payerMultiplier;
      return {
        seat: other,
        amount: base * multiplier,
        payerChengdiao: payerChengdiaoCount > 0,
        payerChengdiaoCount,
        payerMultiplier,
        multiplier,
      };
    });
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    for (const payment of payments) {
      this.scores[payment.seat] -= payment.amount;
      this.scores[seat] += payment.amount;
    }

    const multiplier = winnerMultiplier;
    const perPlayer = base * multiplier;
    const title = soft ? '软滴自摸' : '合滴自摸';
    this.phase = 'ended';
    this.pending = null;
    this.result = {
      type: 'win',
      winnerSeat: seat,
      title,
      soft,
      wildCount: evaluation.wildCount,
      base,
      multiplier,
      perPlayer,
      total,
      payments,
      winnerChengdiao,
      winnerChengdiaoCount,
      winnerMultiplier,
      chengdiaoSeats: this.players
        .filter((entry) => entry.chengdiaoCount > 0)
        .map((entry) => entry.seat),
      reason: winnerChengdiao ? `惩调×${winnerMultiplier}` : '自摸',
      scoreEvents: [...this.scoreEvents],
      deltas: this.scores.map((score, index) => score - this.initialScores[index]),
      reveal: this.revealHands(),
    };
    this.nextDealerSeat = seat;
    const chengdiaoPayers = payments.filter((payment) => payment.payerChengdiao);
    const notes = [];
    if (winnerChengdiao) notes.push(`惩调×${winnerMultiplier}`);
    if (chengdiaoPayers.length > 0) {
      notes.push(chengdiaoPayers
        .map((payment) => `${this.players[payment.seat].name}惩调付×${payment.multiplier}`)
        .join('、'));
    }
    this.addLog(
      'hu',
      `${player.name} ${title}${notes.length ? ` · ${notes.join('，')}` : ''}，共收${total}分`,
      seat,
    );
  }

  endDraw() {
    this.phase = 'ended';
    this.pending = null;
    this.result = {
      type: 'draw',
      winnerSeat: null,
      title: '荒庄',
      scoreEvents: [...this.scoreEvents],
      deltas: this.scores.map((score, index) => score - this.initialScores[index]),
      reveal: this.revealHands(),
    };
    this.nextDealerSeat = this.dealerSeat;
    this.addLog('drawEnd', '牌墙摸完，本局荒庄');
  }

  revealHands() {
    return this.players.map((player) => ({
      seat: player.seat,
      name: player.name,
      hand: player.hand.map(publicTile),
      melds: player.melds.map((meld) => ({
        ...meld,
        tiles: meld.tiles.map(publicTile),
      })),
    }));
  }

  act(seat, action) {
    if (!action || typeof action.type !== 'string') throw new GameError('无效操作');
    if (this.phase === 'opening') {
      if (action.type !== 'roll') throw new GameError('庄家还没掷骰子');
      return this.rollDice(seat);
    }
    if (this.phase === 'claim') {
      if (action.type !== 'claim') throw new GameError('请先应对打出的牌');
      return this.respondClaim(seat, action.choice);
    }
    if (action.type === 'discard') return this.discard(seat, action.tileId);
    if (action.type === 'win') return this.declareWin(seat);
    if (action.type === 'gang') return this.declareGang(seat, action);
    if (action.type === 'chengdiao') return this.declareChengdiao(seat, action.tileId);
    throw new GameError('无效操作');
  }

  serializeMelds(playerSeat) {
    return this.players[playerSeat].melds.map((meld) => ({
      id: meld.id,
      type: meld.type,
      concealed: Boolean(meld.concealed),
      key: meld.key,
      fromSeat: meld.fromSeat,
      tiles: meld.tiles.map(publicTile),
    }));
  }

  viewFor(seat) {
    const player = this.players[seat];
    const publicPlayers = this.players.map((entry) => ({
      seat: entry.seat,
      name: entry.name,
      avatar: entry.avatar,
      isBot: entry.isBot,
      wind: this.getWind(entry.seat),
      isDealer: entry.seat === this.dealerSeat,
      score: this.scores[entry.seat],
      handCount: entry.hand.length,
      melds: this.serializeMelds(entry.seat),
      discards: entry.discards.map((tile) => (
        tile.chengdiao ? { ...publicTile(tile), chengdiao: true } : publicTile(tile)
      )),
    }));

    const pendingPublic = this.pending
      ? {
        fromSeat: this.pending.fromSeat,
        tile: publicTile(this.pending.tile),
        deadline: this.pending.deadline,
        waitingSeats: Object.keys(this.pending.options)
          .map(Number)
          .filter((claimSeat) => !this.pending.responses[claimSeat]),
        respondedSeats: Object.entries(this.pending.responses)
          .filter(([, choice]) => choice === 'pass')
          .map(([claimSeat]) => Number(claimSeat)),
      }
      : null;

    return {
      roundNumber: this.roundNumber,
      dealerSeat: this.dealerSeat,
      turnSeat: this.turnSeat,
      phase: this.phase,
      turnDeadline: this.phase === 'discard' ? this.turnDeadline : null,
      turnLimitMs: TURN_LIMIT_MS,
      wallLeft: this.wall.length,
      indicator: publicTile(this.indicator),
      laizi: this.laizi,
      wallBreak: this.opening.dice
        ? { dice: this.opening.dice, direction: this.opening.direction }
        : null,
      opening: this.phase === 'opening' ? {
        dealerSeat: this.opening.dealerSeat,
        stage: this.opening.stage,
        dice: this.opening.dice,
        direction: this.opening.direction,
        directionLabel: this.opening.directionLabel,
        count: this.opening.count,
        rolledAt: this.opening.rolledAt,
        diceSettleAt: this.opening.diceSettleAt,
        dealStartAt: this.opening.dealStartAt,
        indicatorAt: this.opening.indicatorAt,
        sortAt: this.opening.sortAt,
        finishAt: this.opening.finishAt,
        wallStart: this.opening.wallStart,
        dealEvents: this.opening.dealEvents,
        myDeal: (this.opening.dealOrder[seat] || []).map(publicTile),
        canRoll: seat === this.dealerSeat && this.opening.stage === 'waiting',
      } : null,
      players: publicPlayers,
      you: {
        seat,
        hand: player.hand.map(publicTile),
        melds: this.serializeMelds(seat),
        wildCount: this.getWildCount(player),
        chengdiaoCount: player.chengdiaoCount,
        actions: this.getActions(seat),
        canWin: this.canDeclareWin(seat),
      },
      pending: pendingPublic,
      lastDiscard: this.lastDiscard,
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      lastDrawFromTail: this.lastDrawFromTail,
      result: this.result ? {
        type: this.result.type,
        winnerSeat: this.result.winnerSeat,
        title: this.result.title,
        soft: this.result.soft,
        wildCount: this.result.wildCount,
        base: this.result.base,
        multiplier: this.result.multiplier,
        perPlayer: this.result.perPlayer,
        total: this.result.total,
        payments: this.result.payments,
        winnerChengdiao: this.result.winnerChengdiao,
        winnerChengdiaoCount: this.result.winnerChengdiaoCount,
        winnerMultiplier: this.result.winnerMultiplier,
        chengdiaoSeats: this.result.chengdiaoSeats,
        reason: this.result.reason,
        scoreEvents: this.result.scoreEvents || [],
        deltas: this.result.deltas,
        reveal: this.result.reveal,
      } : null,
      log: this.log.slice(-24),
      nextDealerSeat: this.nextDealerSeat,
      scores: [...this.scores],
    };
  }
}

module.exports = {
  Game,
  GameError,
  CLAIM_WINDOW_MS,
  TURN_LIMIT_MS,
  OPENING_DICE_MS,
  DICE_DIRECTION,
  DIRECTION_LABEL,
  GANG_POINTS,
};

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../src/server/game');

let seq = 0;
function tile(suit, rank) {
  seq += 1;
  return { id: `test-${suit}-${rank}-${seq}`, suit, rank, key: `${suit}-${rank}` };
}
function tiles(spec) {
  return spec.flatMap(([suit, rank, count = 1]) => (
    Array.from({ length: count }, () => tile(suit, rank))
  ));
}
function actors() {
  return ['东家', '南家', '西家', '北家'].map((name, seat) => ({
    name,
    avatar: ['horse', 'monkey', 'snake', 'rabbit'][seat],
    isBot: seat !== 0,
  }));
}
function freshGame() {
  const game = new Game({ actors: actors(), scores: [0, 0, 0, 0], dealerSeat: 0 });
  game.laiziKey = 'tong-1';
  game.laizi = { key: 'tong-1', suit: 'tong', rank: 1, label: '一筒' };
  game.indicator = tile('tong', 9);
  game.players.forEach((player) => {
    player.hand = [];
    player.melds = [];
    player.discards = [];
  });
  game.wall = tiles([
    ['wan', 2, 4], ['wan', 3, 4], ['wan', 4, 4],
    ['tiao', 4, 4], ['tiao', 5, 4], ['tiao', 6, 4],
    ['tong', 6, 4], ['tong', 7, 4], ['tong', 8, 4],
    ['wan', 5], ['wan', 6], ['wan', 7], ['wan', 8], ['wan', 9],
  ]);
  game.phase = 'discard';
  game.turnSeat = 0;
  game.hasDrawnThisTurn = true;
  game.lastDrawFromTail = false;
  game.lastDiscard = null;
  game.pending = null;
  game.result = null;
  return game;
}

test('日志达到保留上限后 ID 仍唯一递增，不会重复触发旧的碰杠惩播报', () => {
  const game = freshGame();
  const ids = new Set(game.log.map((entry) => entry.id));
  for (let index = 0; index < 120; index += 1) {
    const previousId = game.log.at(-1).id;
    const kind = index === 80 ? 'peng' : index === 81 ? 'gang' : index === 82 ? 'chengdiao' : 'discard';
    const discarded = tile('wan', index % 9 + 1);
    game.addLog(kind, '报牌测试', 0, discarded);
    const latest = game.log.at(-1);
    assert.equal(ids.has(latest.id), false);
    ids.add(latest.id);
    const previousIndex = game.log.findIndex((entry) => entry.id === previousId);
    assert.ok(previousIndex >= 0);
    assert.deepEqual(game.log.slice(previousIndex + 1), [latest]);
    assert.ok(game.log.length <= 80);
    assert.deepEqual(game.viewFor(0).log.at(-1), latest);
  }
});

test('开局先等庄家掷骰子，掷完每人十三张，庄家十四张，牌墙数量正确', () => {
  const game = new Game({ actors: actors(), scores: [0, 0, 0, 0], dealerSeat: 0 });
  assert.equal(game.phase, 'opening');
  assert.equal(game.opening.stage, 'waiting');
  assert.equal(game.wall.length, 107);
  assert.equal(game.players.reduce((sum, p) => sum + p.hand.length, 0), 0);
  assert.equal(game.getActions(0), null);
  assert.throws(() => game.discard(0, null), /现在不能出牌/);

  game.rng = () => 0.49;
  game.rollDice(0);
  assert.equal(game.opening.stage, 'dealing');
  assert.equal(game.opening.dice, 3);
  assert.equal(game.opening.direction, 'opposite');
  assert.equal(game.players[0].hand.length, 14);
  assert.equal(game.players[1].hand.length, 13);
  assert.equal(game.wall.length, 54);
  assert.equal(game.wall.length + 1 + game.players.reduce((sum, p) => sum + p.hand.length, 0), 108);
  assert.equal(game.phase, 'opening');
  assert.equal(game.getActions(0), null);

  game.finishOpening();
  assert.equal(game.phase, 'discard');
  assert.equal(game.turnSeat, 0);
  assert.equal(game.getActions(0).kind, 'self');
  assert.equal(game.getActions(0).drawnTileId, game.opening.dealerDrawId);
});

test('开局发牌时间轴：庄家起手四张连摸三轮，再摸两张，其余三家各一张，最后翻牌尾', () => {
  const game = new Game({ actors: actors(), scores: [0, 0, 0, 0], dealerSeat: 0 });
  game.rng = () => 0.49;
  game.rollDice(0);
  const opening = game.opening;
  const view = game.viewFor(0);

  assert.equal(opening.wallStart, 107);
  assert.equal(opening.dealEvents.length, 53);
  assert.equal(opening.dealStartAt, opening.diceSettleAt);

  const firstFour = opening.dealEvents.slice(0, 4);
  assert.deepEqual(firstFour.map((event) => event.seat), [0, 0, 0, 0]);
  assert.deepEqual(firstFour.map((event) => event.count), [1, 2, 3, 4]);
  assert.deepEqual(firstFour.map((event) => event.tileIndex), [0, 1, 2, 3]);
  assert.equal(firstFour[0].at, opening.dealStartAt);

  const finalCounts = [0, 0, 0, 0];
  for (const event of opening.dealEvents) finalCounts[event.seat] = event.count;
  assert.deepEqual(finalCounts, [14, 13, 13, 13]);

  const dealerPicks = opening.dealEvents.slice(48, 50);
  assert.deepEqual(dealerPicks.map((event) => event.seat), [0, 0]);
  assert.deepEqual(dealerPicks.map((event) => event.count), [13, 14]);
  assert.deepEqual(
    opening.dealEvents.slice(50).map((event) => event.seat),
    [1, 2, 3],
  );
  assert.deepEqual(
    opening.dealEvents.slice(50).map((event) => event.count),
    [13, 13, 13],
  );

  for (let index = 1; index < opening.dealEvents.length; index += 1) {
    assert.ok(opening.dealEvents[index].at > opening.dealEvents[index - 1].at);
  }
  const lastEvent = opening.dealEvents[opening.dealEvents.length - 1];
  assert.ok(lastEvent.at < opening.indicatorAt);
  assert.ok(opening.indicatorAt < opening.sortAt);
  assert.ok(opening.sortAt < opening.finishAt);
  assert.equal(opening.finishAt - opening.sortAt, 1350);

  assert.equal(view.opening.dealEvents.length, 53);
  assert.equal(view.opening.myDeal.length, 14);
  assert.deepEqual(
    view.opening.myDeal.map((entry) => entry.id).sort(),
    game.players[0].hand.map((entry) => entry.id).sort(),
  );
  for (const seat of [1, 2, 3]) {
    assert.equal(game.viewFor(seat).opening.myDeal.length, 13);
  }
  assert.equal(game.viewFor(1).opening.canRoll, false);
  assert.equal(view.opening.wallStart, 107);
});

test('骰子点数决定开牌方向：1/3/5 对面，2/6 右手边，4 左边', () => {
  const expected = {
    1: 'opposite',
    2: 'right',
    3: 'opposite',
    4: 'left',
    5: 'opposite',
    6: 'right',
  };
  for (const [pips, direction] of Object.entries(expected)) {
    const game = new Game({ actors: actors(), scores: [0, 0, 0, 0], dealerSeat: 0 });
    game.rng = () => (Number(pips) - 0.5) / 6;
    game.rollDice(0);
    assert.equal(game.opening.dice, Number(pips));
    assert.equal(game.opening.direction, direction);
    assert.equal(game.opening.count, Number(pips));
  }
});

test('只有庄家能掷骰子，且只能掷一次', () => {
  const game = new Game({ actors: actors(), scores: [0, 0, 0, 0], dealerSeat: 2 });
  assert.throws(() => game.rollDice(0), /只有庄家/);
  assert.throws(() => game.act(0, { type: 'roll' }), /只有庄家/);
  game.act(2, { type: 'roll' });
  assert.throws(() => game.rollDice(2), /骰子已经掷过/);
  assert.throws(() => game.act(2, { type: 'roll' }), /骰子已经掷过/);
});


test('碰牌后由碰牌者出牌，且不能直接胡', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 1], ['wan', 4], ['wan', 5], ['wan', 6], ['wan', 7], ['wan', 8], ['wan', 9],
    ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tong', 2], ['tong', 3], ['tong', 4], ['tong', 5],
  ]);
  game.players[1].hand = tiles([
    ['wan', 1, 2], ['wan', 2], ['wan', 3], ['tiao', 2], ['tiao', 5], ['tiao', 7],
    ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 8],
  ]);
  game.players[2].hand = tiles([
    ['wan', 2], ['wan', 3], ['tiao', 1], ['tiao', 8], ['tiao', 9],
    ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 8], ['tong', 9],
  ]);
  game.players[3].hand = tiles([
    ['wan', 2], ['wan', 3], ['tiao', 1], ['tiao', 8], ['tiao', 9],
    ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 8], ['tong', 9],
  ]);
  const discard = game.players[0].hand.find((entry) => entry.key === 'wan-1');
  game.discard(0, discard.id);
  assert.equal(game.phase, 'claim');
  assert.equal(game.getActions(1).canPeng, true);
  game.respondClaim(1, 'peng');
  assert.equal(game.phase, 'discard');
  assert.equal(game.turnSeat, 1);
  assert.equal(game.players[1].melds.length, 1);
  assert.equal(game.canDeclareWin(1), false);
});

test('出牌日志保留牌面信息，供客户端播报', () => {
  const game = freshGame();
  game.players[0].hand = tiles([['tong', 1], ['wan', 2], ['wan', 3]]);
  const discard = game.players[0].hand.find((entry) => entry.key === 'wan-2');
  game.discard(0, discard.id);
  const log = game.log.findLast((entry) => entry.kind === 'discard');
  assert.equal(game.lastDiscard, null);
  assert.equal(log.seat, 0);
  assert.deepEqual(log.tile, { id: discard.id, suit: 'wan', rank: 2, key: 'wan-2' });
});

test('明杠由点杠者付十分，并从牌尾补牌', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 1], ['wan', 4], ['wan', 5], ['wan', 6], ['wan', 7], ['wan', 8], ['wan', 9],
    ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tong', 2], ['tong', 3], ['tong', 4], ['tong', 5],
  ]);
  game.players[1].hand = tiles([
    ['wan', 1, 3], ['wan', 2], ['wan', 3], ['tiao', 2], ['tiao', 5], ['tiao', 7],
    ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7],
  ]);
  game.players[2].hand = tiles([
    ['wan', 2], ['wan', 3], ['tiao', 1], ['tiao', 8], ['tiao', 9],
    ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 8], ['tong', 9], ['tong', 3], ['tong', 5],
  ]);
  game.players[3].hand = tiles([
    ['wan', 2], ['wan', 3], ['tiao', 1], ['tiao', 8], ['tiao', 9],
    ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 8], ['tong', 9], ['tong', 3], ['tong', 5],
  ]);
  const wallBefore = game.wall.length;
  const discard = game.players[0].hand.find((entry) => entry.key === 'wan-1');
  game.discard(0, discard.id);
  game.respondClaim(1, 'gang');
  assert.deepEqual(game.scores, [-10, 10, 0, 0]);
  assert.equal(game.turnSeat, 1);
  assert.equal(game.phase, 'discard');
  assert.equal(game.lastDrawFromTail, true);
  assert.equal(game.players[1].chengdiaoCount, 0);
  assert.equal(game.wall.length, wallBefore - 1);
});

test('素胡自摸三家各付二十分', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['wan', 2], ['wan', 3], ['wan', 4],
    ['tiao', 9, 2],
  ]);
  game.declareWin(0);
  assert.equal(game.phase, 'ended');
  assert.equal(game.result.soft, false);
  assert.equal(game.result.perPlayer, 20);
  assert.equal(game.result.total, 60);
  assert.deepEqual(game.scores, [60, -20, -20, -20]);
});

test('软胡自摸每家十分，牌尾补牌本身不翻倍', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['wan', 2], ['wan', 3],
    ['tiao', 9, 2],
    ['tong', 1],
  ]);
  game.lastDrawFromTail = true;
  game.declareWin(0);
  assert.equal(game.result.soft, true);
  assert.equal(game.result.base, 10);
  assert.equal(game.result.multiplier, 1);
  assert.equal(game.result.perPlayer, 10);
  assert.deepEqual(game.scores, [30, -10, -10, -10]);
});

test('惩调赖子后自摸翻倍', () => {
  const game = freshGame();
  const natural = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['tiao', 9, 2],
    ['wan', 2],
  ]);
  const [laiziA, laiziB] = tiles([['tong', 1, 2]]);
  game.players[0].hand = [...natural, laiziA, laiziB];
  const tail = tile('wan', 3);
  game.lastDrawnId = laiziB.id;
  game.hasDrawnThisTurn = true;
  game.wall[game.wall.length - 1] = tail;
  const wallBefore = game.wall.length;

  assert.equal(game.getActions(0).canChengdiao, true);
  assert.equal(game.getActions(0).chengdiaoCount, 0);
  assert.equal(game.canDeclareWin(0), false);

  game.declareChengdiao(0, laiziA.id);
  const player = game.players[0];
  assert.equal(player.chengdiaoCount, 1);
  assert.equal(player.hand.some((entry) => entry.id === laiziA.id), false);
  assert.equal(player.discards.at(-1).id, laiziA.id);
  assert.equal(player.discards.at(-1).chengdiao, true);
  assert.equal(game.lastDiscard.chengdiao, true);
  assert.equal(player.hand.filter((entry) => entry.key === 'tong-1').length, 1);
  assert.equal(player.hand.some((entry) => entry.id === tail.id), true);
  assert.equal(game.wall.length, wallBefore - 1);
  assert.equal(game.canDeclareChengdiao(0), false);
  assert.equal(player.discards.at(-1).key, game.laiziKey);

  game.declareWin(0);
  assert.equal(game.result.soft, true);
  assert.equal(game.result.multiplier, 2);
  assert.equal(game.result.perPlayer, 20);
  assert.equal(game.result.reason, '惩调×2');
  assert.deepEqual(game.scores, [60, -20, -20, -20]);
});

test('惩调后没有立即胡，本局之后自摸仍然翻倍', () => {
  const game = freshGame();
  const natural = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['tiao', 9, 2],
    ['wan', 2],
  ]);
  const [laiziA, laiziB] = tiles([['tong', 1, 2]]);
  game.players[0].hand = [...natural, laiziA, laiziB];
  const tail = tile('wan', 9);
  game.lastDrawnId = laiziB.id;
  game.hasDrawnThisTurn = true;
  game.wall[game.wall.length - 1] = tail;

  game.declareChengdiao(0, laiziA.id);
  assert.equal(game.canPlayerWin(0), false);

  const winning = tile('wan', 3);
  game.players[0].hand = [...natural, laiziB, winning];
  game.lastDrawnId = winning.id;
  game.hasDrawnThisTurn = true;
  game.declareWin(0);

  assert.equal(game.result.soft, true);
  assert.equal(game.result.winnerChengdiao, true);
  assert.equal(game.result.multiplier, 2);
  assert.equal(game.result.perPlayer, 20);
  assert.equal(game.result.total, 60);
  assert.deepEqual(game.scores, [60, -20, -20, -20]);
});

test('别人惩调后自摸，该家付双倍', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['wan', 2], ['wan', 3], ['wan', 4],
    ['tiao', 9, 2],
  ]);
  game.players[1].chengdiaoCount = 1;
  game.hasDrawnThisTurn = true;
  game.lastDrawnId = game.players[0].hand[0].id;

  game.declareWin(0);

  assert.equal(game.result.winnerChengdiao, false);
  assert.equal(game.result.multiplier, 1);
  assert.equal(game.result.total, 80);
  assert.deepEqual(game.result.payments, [
    { seat: 1, amount: 40, payerChengdiao: true, payerChengdiaoCount: 1, payerMultiplier: 2, multiplier: 2 },
    { seat: 2, amount: 20, payerChengdiao: false, payerChengdiaoCount: 0, payerMultiplier: 1, multiplier: 1 },
    { seat: 3, amount: 20, payerChengdiao: false, payerChengdiaoCount: 0, payerMultiplier: 1, multiplier: 1 },
  ]);
  assert.deepEqual(game.scores, [80, -40, -20, -20]);
});

test('胡家和付款家都惩调时倍数相乘', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['wan', 2], ['wan', 3], ['wan', 4],
    ['tiao', 9, 2],
  ]);
  game.players[0].chengdiaoCount = 1;
  game.players[1].chengdiaoCount = 1;
  game.hasDrawnThisTurn = true;
  game.lastDrawnId = game.players[0].hand[0].id;

  game.declareWin(0);

  assert.equal(game.result.multiplier, 2);
  assert.equal(game.result.total, 160);
  assert.deepEqual(game.result.payments.map((payment) => payment.amount), [80, 40, 40]);
  assert.deepEqual(game.result.payments.map((payment) => payment.multiplier), [4, 2, 2]);
  assert.deepEqual(game.scores, [160, -80, -40, -40]);
});

test('多次惩调后自摸，结算时与付款家倍数相乘', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['wan', 2], ['wan', 3], ['wan', 4],
    ['tiao', 9, 2],
  ]);
  game.players[0].chengdiaoCount = 2;
  game.players[1].chengdiaoCount = 1;
  game.players[2].chengdiaoCount = 2;
  game.hasDrawnThisTurn = true;
  game.lastDrawnId = game.players[0].hand[0].id;

  game.declareWin(0);

  assert.equal(game.result.multiplier, 4);
  assert.equal(game.result.perPlayer, 80);
  assert.equal(game.result.total, 560);
  assert.deepEqual(game.result.payments.map((payment) => payment.multiplier), [8, 16, 4]);
  assert.deepEqual(game.result.payments.map((payment) => payment.amount), [160, 320, 80]);
  assert.deepEqual(game.scores, [560, -160, -320, -80]);
});

test('手里没有赖子时不能惩调', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 1], ['wan', 4], ['wan', 7],
    ['tiao', 2], ['tiao', 5], ['tiao', 8],
    ['tong', 2], ['tong', 5], ['tong', 8],
    ['wan', 2], ['wan', 5], ['tiao', 1], ['tong', 4], ['tong', 9],
  ]);
  game.lastDrawnId = game.players[0].hand[13].id;
  game.hasDrawnThisTurn = true;
  assert.equal(game.canDeclareChengdiao(0), false);
  assert.throws(() => game.declareChengdiao(0), /不能惩调/);
});

test('不是自己摸来的牌不能直接宣布胡牌', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['wan', 2], ['wan', 3], ['wan', 4],
    ['tiao', 9, 2],
  ]);
  game.hasDrawnThisTurn = false;
  assert.throws(() => game.declareWin(0), /只能自摸/);
});

test('赖子不能打出，只能惩调', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['tong', 1], ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tong', 3], ['tong', 4], ['tong', 5],
  ]);
  const laizi = game.players[0].hand.find((entry) => entry.key === 'tong-1');
  assert.throws(() => game.discard(0, laizi.id), /赖子不能打出/);
  assert.equal(game.players[0].hand.some((entry) => entry.id === laizi.id), true);
  assert.equal(game.phase, 'discard');
});

test('惩调可以指定手里的赖子，打出后从牌尾摸一张', () => {
  const game = freshGame();
  const baseHand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 7], ['tong', 8], ['tong', 9],
    ['wan', 2], ['wan', 3], ['tiao', 9],
    ['tong', 1],
  ]);
  const drawn = tile('wan', 9);
  const tail = tile('tong', 5);
  game.players[0].hand = [...baseHand, drawn];
  game.lastDrawnId = drawn.id;
  game.hasDrawnThisTurn = true;
  game.wall[game.wall.length - 1] = tail;
  const laizi = baseHand.find((entry) => entry.key === 'tong-1');
  const wallBefore = game.wall.length;

  assert.equal(game.canDeclareChengdiao(0), true);
  assert.throws(() => game.declareChengdiao(0, drawn.id), /只能换赖子/);

  game.declareChengdiao(0, laizi.id);
  const player = game.players[0];
  assert.equal(player.chengdiaoCount, 1);
  assert.equal(player.hand.some((entry) => entry.id === laizi.id), false);
  assert.equal(player.hand.some((entry) => entry.id === drawn.id), true);
  assert.equal(player.hand.some((entry) => entry.id === tail.id), true);
  assert.equal(player.discards.at(-1).id, laizi.id);
  assert.equal(player.discards.at(-1).chengdiao, true);
  assert.equal(player.discards.at(-1).key, game.laiziKey);
  assert.equal(game.wall.length, wallBefore - 1);
  assert.equal(game.lastDrawnId, tail.id);
  assert.equal(game.lastDrawFromTail, true);
  assert.match(game.log[game.log.length - 1].text, /打出赖子并从牌尾摸一张/);
  assert.match(game.log[game.log.length - 1].text, /×2/);
});

test('惩调把赖子打到牌河，可以连续惩调，倍数叠加到 ×4', () => {
  const game = freshGame();
  const natural = tiles([
    ['wan', 1], ['wan', 4], ['wan', 7],
    ['tiao', 2], ['tiao', 5], ['tiao', 8],
    ['tong', 2], ['tong', 5], ['tong', 8],
    ['wan', 2], ['wan', 5],
  ]);
  const [laiziA, laiziB] = tiles([['tong', 1, 2]]);
  const drawn = tile('wan', 9);
  game.players[0].hand = [...natural, laiziA, laiziB, drawn];
  game.lastDrawnId = drawn.id;
  game.hasDrawnThisTurn = true;
  const tailA = tile('wan', 6);
  game.wall[game.wall.length - 1] = tailA;
  const wallBefore = game.wall.length;

  game.declareChengdiao(0, laiziA.id);
  const player = game.players[0];
  assert.equal(player.chengdiaoCount, 1);
  assert.equal(game.phase, 'discard');
  assert.equal(player.discards.at(-1).id, laiziA.id);
  assert.equal(player.discards.at(-1).chengdiao, true);
  assert.equal(game.lastDiscard.chengdiao, true);
  assert.equal(game.wall.length, wallBefore - 1);
  assert.equal(player.hand.some((entry) => entry.id === tailA.id), true);
  assert.equal(game.getActions(0).canChengdiao, true);
  assert.match(game.log[game.log.length - 1].text, /×2/);

  const tailB = tile('wan', 3);
  game.wall[game.wall.length - 1] = tailB;
  game.declareChengdiao(0, laiziB.id);
  assert.equal(player.chengdiaoCount, 2);
  assert.equal(player.discards.at(-1).id, laiziB.id);
  assert.equal(player.discards.at(-1).chengdiao, true);
  assert.equal(game.wall.length, wallBefore - 2);
  assert.equal(player.hand.some((entry) => entry.id === tailB.id), true);
  assert.match(game.log[game.log.length - 1].text, /×4/);

  const view = game.viewFor(0);
  const marked = view.players[0].discards.filter((tile) => tile.chengdiao);
  assert.deepEqual(marked.map((tile) => tile.id), [laiziA.id, laiziB.id]);
});

test('赖子不能碰、不能杠，也不能用赖子顶替碰牌', () => {
  const game = freshGame();
  const laizi = tile('tong', 1);
  game.players[1].hand = [tile('wan', 2), ...tiles([['tong', 1, 2]])];
  assert.deepEqual(game.buildClaimOptions(laizi, 0), {});
  assert.deepEqual(game.buildClaimOptions(tile('wan', 2), 0), {});

  game.players[0].hand = tiles([
    ['tong', 1, 4],
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tong', 3], ['tong', 4], ['tong', 5],
  ]);
  const gangKeys = game.getGangOptions(0).map((option) => option.key);
  assert.equal(gangKeys.includes('tong-1'), false);
});

test('赖子惩调不要求听牌，摸牌后即可打出并从牌尾摸一张', () => {
  const game = freshGame();
  const baseHand = tiles([
    ['wan', 1], ['wan', 4], ['wan', 7],
    ['tiao', 2], ['tiao', 5], ['tiao', 8],
    ['tong', 2], ['tong', 5], ['tong', 8],
    ['wan', 2], ['wan', 5], ['tiao', 1],
    ['tong', 1],
  ]);
  const drawn = tile('wan', 9);
  const tail = tile('tong', 5);
  game.players[0].hand = [...baseHand, drawn];
  game.lastDrawnId = drawn.id;
  game.hasDrawnThisTurn = true;
  game.wall[game.wall.length - 1] = tail;
  const laizi = baseHand.find((entry) => entry.key === 'tong-1');
  const wallBefore = game.wall.length;

  assert.equal(game.getActions(0).canChengdiao, true);

  game.declareChengdiao(0, laizi.id);
  const player = game.players[0];
  assert.equal(player.chengdiaoCount, 1);
  assert.equal(player.hand.some((entry) => entry.id === laizi.id), false);
  assert.equal(player.hand.some((entry) => entry.id === drawn.id), true);
  assert.equal(player.hand.some((entry) => entry.id === tail.id), true);
  assert.equal(player.discards.at(-1).id, laizi.id);
  assert.equal(player.discards.at(-1).chengdiao, true);
  assert.equal(game.wall.length, wallBefore - 1);
  assert.equal(game.lastDrawnId, tail.id);
});

test('暗杠三家各付二十分', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4, 4], ['wan', 5], ['wan', 6], ['wan', 7],
    ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tong', 3], ['tong', 4], ['tong', 5],
  ]);
  game.hasDrawnThisTurn = true;
  game.declareGang(0, { kind: 'concealed', key: 'wan-4' });
  assert.deepEqual(game.scores, [60, -20, -20, -20]);
  assert.equal(game.players[0].melds[0].type, 'angang');
  assert.equal(game.phase, 'discard');
  assert.equal(game.turnSeat, 0);
});

test('碰后摸到第四张可以回回：三家各付十分并扣一张', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 3], ['tong', 4], ['tong', 5],
    ['wan', 7], ['wan', 8],
  ]);
  game.players[0].melds = [{
    id: 'meld-peng',
    type: 'peng',
    key: 'wan-4',
    tiles: tiles([['wan', 4, 3]]),
    fromSeat: 2,
  }];
  const handBefore = game.players[0].hand.length;
  const wallBefore = game.wall.length;

  const option = game.getActions(0).gangs.find((gang) => gang.kind === 'huihui');
  assert.ok(option);
  game.declareGang(0, { kind: 'huihui', key: 'wan-4', meldIndex: 0 });

  assert.equal(game.players[0].melds[0].type, 'huihui');
  assert.equal(game.players[0].melds[0].tiles.length, 4);
  assert.deepEqual(game.scores, [30, -10, -10, -10]);
  assert.equal(game.players[0].hand.length, handBefore);
  assert.equal(game.wall.length, wallBefore - 1);
  assert.equal(game.log[game.log.length - 1].kind, 'huihui');
  assert.equal(game.log[game.log.length - 1].seat, 0);
  assert.match(game.log[game.log.length - 1].text, /回回/);
});

test('尾牌暗杠手里三张即可，三家各付二十分且不补牌', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['tong', 9, 3],
    ['wan', 4], ['wan', 5], ['wan', 6], ['wan', 7], ['wan', 8],
    ['tiao', 2], ['tiao', 3], ['tiao', 4],
    ['tong', 3], ['tong', 4], ['tong', 5],
  ]);
  const wall = game.wall;
  game.wall = [];
  const option = game.getActions(0).gangs.find((gang) => gang.kind === 'tail');
  assert.ok(option);
  assert.equal(game.getActions(0).gangs.some((gang) => gang.kind === 'concealed'), false);
  game.wall = wall;

  const handBefore = game.players[0].hand.length;
  const wallBefore = game.wall.length;
  game.declareGang(0, { kind: 'tail', key: 'tong-9' });

  assert.deepEqual(game.scores, [60, -20, -20, -20]);
  const meld = game.players[0].melds[0];
  assert.equal(meld.type, 'tailgang');
  assert.equal(meld.concealed, true);
  assert.equal(meld.tiles.length, 4);
  assert.equal(meld.tiles.filter((entry) => entry.key === 'tong-9').length, 4);
  assert.equal(meld.tiles.some((entry) => entry.id === game.indicator.id), true);
  assert.equal(game.players[0].hand.length, handBefore - 3);
  assert.equal(game.wall.length, wallBefore);
  assert.equal(game.phase, 'discard');
  assert.equal(game.turnSeat, 0);
  assert.equal(game.hasDrawnThisTurn, false);
  assert.equal(game.lastDrawFromTail, false);
  assert.match(game.log[game.log.length - 1].text, /尾牌暗杠/);
});

test('尾牌明杠手里两张即可，点杠者付十分且不补牌', () => {
  const game = freshGame();
  game.players[0].hand = tiles([
    ['tong', 9], ['wan', 4], ['wan', 5], ['wan', 6], ['wan', 7], ['wan', 8], ['wan', 9],
    ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tong', 2], ['tong', 3], ['tong', 4], ['tong', 5],
  ]);
  game.players[1].hand = tiles([
    ['tong', 9, 2], ['wan', 2], ['wan', 3], ['tiao', 2], ['tiao', 5], ['tiao', 7],
    ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 3], ['tong', 5], ['tong', 8],
  ]);
  game.players[2].hand = tiles([['wan', 2], ['wan', 3], ['tiao', 1], ['tiao', 8], ['tiao', 9], ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 8], ['tong', 3], ['tong', 5], ['tong', 6]]);
  game.players[3].hand = tiles([['wan', 2], ['wan', 3], ['tiao', 1], ['tiao', 8], ['tiao', 9], ['tong', 2], ['tong', 4], ['tong', 6], ['tong', 7], ['tong', 8], ['tong', 3], ['tong', 5], ['tong', 7]]);

  const handBefore = game.players[1].hand.length;
  const wallBefore = game.wall.length;
  const discard = game.players[0].hand.find((entry) => entry.key === 'tong-9');
  game.discard(0, discard.id);
  assert.equal(game.getActions(1).canGang, true);
  game.respondClaim(1, 'gang');

  assert.deepEqual(game.scores, [-10, 10, 0, 0]);
  const meld = game.players[1].melds[0];
  assert.equal(meld.type, 'tailgang');
  assert.equal(meld.concealed, false);
  assert.equal(meld.tiles.length, 4);
  assert.equal(meld.tiles.filter((entry) => entry.key === 'tong-9').length, 4);
  assert.equal(meld.tiles.some((entry) => entry.id === game.indicator.id), true);
  assert.equal(game.players[1].hand.length, handBefore - 2);
  assert.equal(game.wall.length, wallBefore);
  assert.equal(game.phase, 'discard');
  assert.equal(game.turnSeat, 1);
  assert.equal(game.lastDrawFromTail, false);
  assert.match(game.log[game.log.length - 1].text, /尾牌明杠/);
});

test('面子序列化带上杠牌来源，暗杠四种牌面可见', () => {
  const game = freshGame();
  game.players[0].melds = [
    { id: 'meld-minggang', type: 'minggang', key: 'wan-2', fromSeat: 2, tiles: tiles([['wan', 2, 4]]) },
    { id: 'meld-angang', type: 'angang', key: 'tong-5', concealed: true, tiles: tiles([['tong', 5, 4]]) },
  ];
  const melds = game.viewFor(1).players[0].melds;
  assert.equal(melds[0].fromSeat, 2);
  assert.equal(melds[0].tiles.length, 4);
  assert.equal(melds[1].type, 'angang');
  assert.equal(melds[1].tiles.length, 4);
  assert.equal(melds[1].tiles[0].key, 'tong-5');
});

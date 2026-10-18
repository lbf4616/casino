'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateWin, estimateShanten } = require('../src/shared/win');

let copy = 0;
function tile(suit, rank) {
  copy += 1;
  return { id: `${suit}-${rank}-${copy}`, suit, rank, key: `${suit}-${rank}` };
}

function hand(list) {
  return list.flatMap(([suit, rank, count = 1]) => (
    Array.from({ length: count }, () => tile(suit, rank))
  ));
}

test('四副面子加一对将可以胡牌', () => {
  const tiles = hand([
    ['wan', 1], ['wan', 2], ['wan', 3],
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2, 3],
    ['tong', 7, 3],
    ['tong', 9, 2],
  ]);
  assert.equal(evaluateWin(tiles, 0, 'tong-1').win, true);
});

test('没有将牌不能胡牌', () => {
  const tiles = hand([
    ['wan', 1], ['wan', 2], ['wan', 3],
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['wan', 7], ['wan', 8], ['wan', 9],
    ['tiao', 2, 3],
    ['tong', 3], ['tong', 4],
  ]);
  assert.equal(evaluateWin(tiles, 0, 'tong-1').win, false);
});

test('赖子可以补一张面子，并标记软胡', () => {
  const tiles = hand([
    ['wan', 1], ['wan', 2],
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2, 3],
    ['tiao', 6, 3],
    ['tong', 9, 2],
    ['tong', 1],
  ]);
  const result = evaluateWin(tiles, 0, 'tong-1');
  assert.equal(result.win, true);
  assert.equal(result.wildCount, 1);
  assert.equal(result.soft, true);
});

test('赖子超过一张不能胡牌', () => {
  const tiles = hand([
    ['wan', 1], ['wan', 2], ['wan', 3],
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2, 3],
    ['tong', 9, 2],
    ['tong', 1], ['tong', 1],
    ['tong', 2],
  ]);
  const result = evaluateWin(tiles, 0, 'tong-1');
  assert.equal(result.win, false);
  assert.equal(result.wildCount, 2);
});

test('有碰杠时只检查剩余手牌', () => {
  const tiles = hand([
    ['wan', 1], ['wan', 2], ['wan', 3],
    ['wan', 7], ['wan', 8], ['wan', 9],
    ['tiao', 4], ['tiao', 5], ['tiao', 6],
    ['tong', 5, 2],
  ]);
  assert.equal(evaluateWin(tiles, 1, 'wan-9').win, true);
});

test('听牌时向听数为零', () => {
  const tiles = hand([
    ['wan', 1], ['wan', 2], ['wan', 3],
    ['wan', 4], ['wan', 5], ['wan', 6],
    ['tiao', 2, 3],
    ['tong', 7, 3],
    ['tong', 9],
  ]);
  assert.equal(estimateShanten(tiles, 0, 'tong-1'), 0);
});

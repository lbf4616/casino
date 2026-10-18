'use strict';

const SUITS = ['wan', 'tiao', 'tong'];
const SUIT_LABEL = { wan: '万', tiao: '条', tong: '筒' };
const RANK_LABEL = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function tileKey(tile) {
  return `${tile.suit}-${tile.rank}`;
}

function tileLabel(tile) {
  return `${RANK_LABEL[tile.rank]}${SUIT_LABEL[tile.suit]}`;
}

function nextKey(key) {
  const [suit, rankText] = key.split('-');
  const rank = Number(rankText);
  return `${suit}-${rank === 9 ? 1 : rank + 1}`;
}

function makeTile(suit, rank, copy) {
  return {
    id: `${suit}-${rank}-${copy}`,
    suit,
    rank,
    key: `${suit}-${rank}`,
  };
}

function buildWall(rng = Math.random) {
  const wall = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      for (let copy = 0; copy < 4; copy += 1) {
        wall.push(makeTile(suit, rank, copy));
      }
    }
  }
  for (let i = wall.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

function sortTiles(tiles) {
  return [...tiles].sort((a, b) => {
    const suitDiff = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return suitDiff || a.rank - b.rank;
  });
}

function countByKey(tiles) {
  const result = new Map();
  for (const tile of tiles) {
    const key = tile.key || tileKey(tile);
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}

function tileFromKey(key, copy = 0) {
  const [suit, rankText] = key.split('-');
  return makeTile(suit, Number(rankText), copy);
}

module.exports = {
  SUITS,
  SUIT_LABEL,
  RANK_LABEL,
  RANKS,
  tileKey,
  tileLabel,
  nextKey,
  buildWall,
  sortTiles,
  countByKey,
  tileFromKey,
};

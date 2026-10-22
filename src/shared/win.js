'use strict';

const { SUITS, tileKey } = require('./tiles');

const SUIT_START = { wan: 0, tiao: 9, tong: 18 };
const INDEX_SUIT = ['wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan',
  'tiao', 'tiao', 'tiao', 'tiao', 'tiao', 'tiao', 'tiao', 'tiao', 'tiao',
  'tong', 'tong', 'tong', 'tong', 'tong', 'tong', 'tong', 'tong', 'tong'];

function tileIndex(tile) {
  return SUIT_START[tile.suit] + tile.rank - 1;
}

function tilesToCounts(tiles) {
  const counts = new Array(27).fill(0);
  for (const tile of tiles) {
    const index = tileIndex(tile);
    if (index >= 0 && index < 27) counts[index] += 1;
  }
  return counts;
}

function tileFromIndex(index, copy = 0) {
  const suit = INDEX_SUIT[index];
  const rank = (index % 9) + 1;
  return { id: `${suit}-${rank}-wild-${copy}`, suit, rank, key: `${suit}-${rank}` };
}

function canFormSets(counts, setsNeeded) {
  if (setsNeeded === 0) return counts.every((count) => count === 0);
  let first = -1;
  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] > 0) {
      first = i;
      break;
    }
  }
  if (first === -1) return false;

  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canFormSets(counts, setsNeeded - 1)) {
      counts[first] += 3;
      return true;
    }
    counts[first] += 3;
  }

  const rank = (first % 9) + 1;
  if (rank <= 7 && counts[first + 1] > 0 && counts[first + 2] > 0) {
    counts[first] -= 1;
    counts[first + 1] -= 1;
    counts[first + 2] -= 1;
    if (canFormSets(counts, setsNeeded - 1)) {
      counts[first] += 1;
      counts[first + 1] += 1;
      counts[first + 2] += 1;
      return true;
    }
    counts[first] += 1;
    counts[first + 1] += 1;
    counts[first + 2] += 1;
  }
  return false;
}

function isStandardCounts(counts, meldCount) {
  const setsNeeded = 4 - meldCount;
  if (setsNeeded < 0) return false;
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total !== setsNeeded * 3 + 2) return false;
  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;
    const ok = canFormSets(counts, setsNeeded);
    counts[i] += 2;
    if (ok) return true;
  }
  return false;
}

/**
 * 湖北 108 张规则只胡「四副面子 + 一对将」。
 * 胡牌时手中赖子不得超过一张。
 */
function evaluateWin(handTiles, meldCount, laiziKey) {
  if (!Array.isArray(handTiles) || meldCount < 0 || meldCount > 4) {
    return { win: false, wildCount: 0, soft: false };
  }
  const required = (4 - meldCount) * 3 + 2;
  if (handTiles.length !== required) {
    return { win: false, wildCount: handTiles.filter((t) => tileKey(t) === laiziKey).length, soft: false };
  }
  const wilds = handTiles.filter((t) => tileKey(t) === laiziKey);
  const wildCount = wilds.length;
  if (wildCount > 1) return { win: false, wildCount, soft: false };

  const natural = handTiles.filter((t) => tileKey(t) !== laiziKey);
  const baseCounts = tilesToCounts(natural);

  if (wildCount === 0) {
    return { win: isStandardCounts([...baseCounts], meldCount), wildCount, soft: false };
  }

  if (isStandardCounts(tilesToCounts(handTiles), meldCount)) {
    return { win: true, wildCount, soft: false };
  }

  for (let i = 0; i < 27; i += 1) {
    const counts = [...baseCounts];
    counts[i] += 1;
    if (isStandardCounts(counts, meldCount)) {
      return { win: true, wildCount, soft: true };
    }
  }
  return { win: false, wildCount, soft: false };
}

function bestBlockValue(counts, groupsLeft, memo) {
  if (groupsLeft === 0) return 0;
  const key = `${counts.join('')}|${groupsLeft}`;
  if (memo.has(key)) return memo.get(key);

  let first = -1;
  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] > 0) {
      first = i;
      break;
    }
  }
  if (first === -1) {
    memo.set(key, 0);
    return 0;
  }

  let best = 0;

  // Treat this tile as ungrouped.
  counts[first] -= 1;
  best = Math.max(best, bestBlockValue(counts, groupsLeft, memo));
  counts[first] += 1;

  // Complete triplet.
  if (counts[first] >= 3) {
    counts[first] -= 3;
    best = Math.max(best, 2 + bestBlockValue(counts, groupsLeft - 1, memo));
    counts[first] += 3;
  }

  const rank = (first % 9) + 1;

  // Complete sequence.
  if (rank <= 7 && counts[first + 1] > 0 && counts[first + 2] > 0) {
    counts[first] -= 1;
    counts[first + 1] -= 1;
    counts[first + 2] -= 1;
    best = Math.max(best, 2 + bestBlockValue(counts, groupsLeft - 1, memo));
    counts[first] += 1;
    counts[first + 1] += 1;
    counts[first + 2] += 1;
  }

  // Pair as a partial block.
  if (counts[first] >= 2) {
    counts[first] -= 2;
    best = Math.max(best, 1 + bestBlockValue(counts, groupsLeft - 1, memo));
    counts[first] += 2;
  }

  // Adjacent or gapped partial sequence.
  if (rank <= 8 && counts[first + 1] > 0) {
    counts[first] -= 1;
    counts[first + 1] -= 1;
    best = Math.max(best, 1 + bestBlockValue(counts, groupsLeft - 1, memo));
    counts[first] += 1;
    counts[first + 1] += 1;
  }
  if (rank <= 7 && counts[first + 2] > 0) {
    counts[first] -= 1;
    counts[first + 2] -= 1;
    best = Math.max(best, 1 + bestBlockValue(counts, groupsLeft - 1, memo));
    counts[first] += 1;
    counts[first + 2] += 1;
  }

  memo.set(key, best);
  return best;
}

function shantenFromCounts(counts, meldCount, memo = new Map()) {
  const groupsLeft = 4 - meldCount;
  let best = 8 - 2 * meldCount - bestBlockValue(counts, groupsLeft, memo);

  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;
    const blocks = bestBlockValue(counts, groupsLeft, memo);
    best = Math.min(best, 8 - 2 * meldCount - blocks - 1);
    counts[i] += 2;
  }
  return best;
}

/**
 * 计算向听数。仅用于 AI；13 张时 0 为听牌，-1 为已和。
 * 有且只有一张赖子时，枚举它代表的牌面取最优。
 */
function estimateShanten(handTiles, meldCount, laiziKey) {
  const wilds = handTiles.filter((tile) => tileKey(tile) === laiziKey);
  const natural = handTiles.filter((tile) => tileKey(tile) !== laiziKey);
  const counts = tilesToCounts(natural);
  const memo = new Map();

  if (wilds.length === 0) return shantenFromCounts([...counts], meldCount, memo);
  if (wilds.length > 1) {
    // 多张赖子无法胡牌，这里仍给一个粗略值供 AI 比较。
    for (const wild of wilds.slice(1)) {
      const index = tileIndex(wild);
      counts[index] += 1;
    }
    const one = [...counts];
    let best = Infinity;
    for (let i = 0; i < 27; i += 1) {
      const replaced = [...one];
      replaced[i] += 1;
      best = Math.min(best, shantenFromCounts(replaced, meldCount, memo));
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < 27; i += 1) {
    const replaced = [...counts];
    replaced[i] += 1;
    best = Math.min(best, shantenFromCounts(replaced, meldCount, memo));
  }
  return best;
}

function countWilds(tiles, laiziKey) {
  return tiles.filter((tile) => tileKey(tile) === laiziKey).length;
}

function waitTiles(handTiles, meldCount, laiziKey) {
  const result = [];
  for (let i = 0; i < 27; i += 1) {
    const candidate = tileFromIndex(i);
    const test = [...handTiles, candidate];
    if (evaluateWin(test, meldCount, laiziKey).win) result.push(candidate);
  }
  return result;
}

module.exports = {
  tileIndex,
  tilesToCounts,
  evaluateWin,
  estimateShanten,
  countWilds,
  waitTiles,
  isStandardCounts,
  SUITS,
};

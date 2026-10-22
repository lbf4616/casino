'use strict';

const { countByKey } = require('../shared/tiles');
const { estimateShanten } = require('../shared/win');

function uniqueKeys(tiles) {
  return [...new Set(tiles.map((tile) => tile.key))];
}

function handWithout(hand, key) {
  const copy = [...hand];
  const index = copy.findIndex((tile) => tile.key === key);
  if (index >= 0) copy.splice(index, 1);
  return copy;
}

function bestShantenAfterDiscard(hand, meldCount, laiziKey) {
  let best = Infinity;
  for (const key of uniqueKeys(hand)) {
    const value = estimateShanten(handWithout(hand, key), meldCount, laiziKey);
    if (value < best) best = value;
  }
  return best;
}

function chooseDiscard(game, seat) {
  const player = game.playerAt(seat);
  const laiziKey = game.laiziKey;
  const counts = countByKey(player.hand);
  const wildCount = counts.get(laiziKey) || 0;
  let candidates = uniqueKeys(player.hand);

  if (wildCount > 0) {
    const withoutWild = candidates.filter((key) => key !== laiziKey);
    if (withoutWild.length) candidates = withoutWild;
  }
  if (candidates.length === 0) candidates = uniqueKeys(player.hand);

  let bestShanten = Infinity;
  let bestCandidates = [];
  for (const key of candidates) {
    const nextHand = handWithout(player.hand, key);
    const shanten = estimateShanten(nextHand, player.melds.length, laiziKey);
    if (shanten < bestShanten) {
      bestShanten = shanten;
      bestCandidates = [key];
    } else if (shanten === bestShanten) {
      bestCandidates.push(key);
    }
  }

  const weighted = [];
  for (const key of bestCandidates) {
    const [suit, rankText] = key.split('-');
    const rank = Number(rankText);
    let weight = 1;
    if (rank === 1 || rank === 9) weight += 0.35;
    if (suit && counts.get(key) === 1) weight += 0.1;
    weighted.push({ key, weight });
  }
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let pick = Math.random() * total;
  let chosen = weighted[weighted.length - 1];
  for (const item of weighted) {
    pick -= item.weight;
    if (pick <= 0) {
      chosen = item;
      break;
    }
  }
  return player.hand.find((tile) => tile.key === chosen.key) || player.hand[0];
}

function decideSelfTurn(game, seat) {
  const actions = game.getActions(seat);
  if (!actions || actions.kind !== 'self') return null;

  if (actions.canWin) return { type: 'win' };

  const player = game.playerAt(seat);
  const wildCount = game.getWildCount(player);
  if (actions.canChengdiao && wildCount > 1) {
    const laizi = player.hand.find((tile) => tile.key === game.laiziKey);
    if (laizi) return { type: 'chengdiao', tileId: laizi.id };
  }

  const canGangNow = game.wall.length > 0 || actions.gangs.some((gang) => gang.kind === 'tail');
  if (actions.gangs.length > 0 && canGangNow && Math.random() < 0.82) {
    const gang = actions.gangs[Math.floor(Math.random() * actions.gangs.length)];
    return {
      type: 'gang',
      kind: gang.kind,
      key: gang.key,
      meldIndex: gang.meldIndex,
    };
  }

  const tile = chooseDiscard(game, seat);
  if (!tile) return null;
  return { type: 'discard', tileId: tile.id };
}

function decideClaim(game, seat) {
  const actions = game.getActions(seat);
  if (!actions || actions.kind !== 'claim') return null;

  if (actions.canGang && Math.random() < 0.9) {
    return { type: 'claim', choice: 'gang' };
  }

  if (!actions.canPeng) return { type: 'claim', choice: 'pass' };

  const player = game.playerAt(seat);
  const current = estimateShanten(player.hand, player.melds.length, game.laiziKey);
  const key = game.pending.tile.key;
  const afterPeng = handWithout(player.hand, key);
  const afterPengAgain = handWithout(afterPeng, key);
  const projected = bestShantenAfterDiscard(
    afterPengAgain,
    player.melds.length + 1,
    game.laiziKey,
  );

  if (projected < current) return { type: 'claim', choice: 'peng' };
  if (projected === current && Math.random() < 0.3) {
    return { type: 'claim', choice: 'peng' };
  }
  return { type: 'claim', choice: 'pass' };
}

function decide(game, seat) {
  if (game.phase === 'claim') return decideClaim(game, seat);
  return decideSelfTurn(game, seat);
}

module.exports = {
  decide,
  chooseDiscard,
};

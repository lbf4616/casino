// Tile artwork: zddd312/mahjong-tiles (M+ font license, see assets/tiles/ASSET-CREDITS.txt).
const SUIT_CHAR = { wan: '万', tiao: '条', tong: '筒' };
const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const TILE_ASSET_DIR = '/assets/tiles';
const SOURCE_LABEL = ['你', '右家', '对家', '左家'];
const POINT_DIRECTION = ['down', 'right', 'up', 'left'];

function normalize(tile) {
  if (tile.suit && tile.rank) return tile;
  const [suit, rankText] = tile.key.split('-');
  return { ...tile, suit, rank: Number(rankText), key: tile.key };
}

function faceURL(tile) {
  return `${TILE_ASSET_DIR}/${tile.suit}-${tile.rank}.png`;
}

export function tileLabel(tile) {
  const entry = normalize(tile);
  return `${CN_NUM[entry.rank]}${SUIT_CHAR[entry.suit]}`;
}

export function renderTile(tile, options = {}) {
  const entry = normalize(tile);
  const size = options.size || 'hand';
  const classes = ['tile', `tile--${size}`, `suit-${entry.suit}`];
  if (options.laiziKey && entry.key === options.laiziKey) classes.push('is-laizi');
  if (options.selected) classes.push('is-selected');
  if (options.highlight) classes.push('is-highlight');
  if (options.drawn) classes.push('is-drawn');
  if (options.className) classes.push(options.className);
  const label = `${tileLabel(entry)}${options.laiziKey && entry.key === options.laiziKey ? '，赖子' : ''}`;
  const attrs = [];
  attrs.push(`class="${classes.join(' ')}"`);
  attrs.push(`style="--tile-face:url('${faceURL(entry)}')"`);
  attrs.push(`data-tile-key="${entry.key}"`);
  if (options.tileId) attrs.push(`data-tile-id="${options.tileId}"`);
  attrs.push(`aria-label="${label}${options.selected ? '，已选中' : ''}"`);
  if (options.title !== false) attrs.push(`title="${label}"`);
  const flag = options.laiziKey && entry.key === options.laiziKey
    ? '<span class="laizi-flag">赖</span>'
    : '';
  if (options.interactive) {
    return `<button type="button" ${attrs.join(' ')}>${flag}</button>`;
  }
  return `<span ${attrs.join(' ')}>${flag}</span>`;
}

export function renderBack(options = {}) {
  const size = options.size || 'mini';
  const extra = options.className ? ` ${options.className}` : '';
  return `<span class="tile tile--${size} tile-back${extra}" aria-hidden="true"></span>`;
}

export function renderMeld(meld, options = {}) {
  const size = options.size || 'meld';
  const tiles = meld.tiles || [];
  const hiddenCount = meld.type === 'angang' ? 2 : (meld.type === 'huihui' || meld.type === 'bugang') ? 1 : 0;
  const face = (tile) => renderTile(tile, { size, laiziKey: options.laiziKey });
  const back = () => renderBack({ size });
  const title = meldTitle(meld, options.viewerSeat);
  let body = '';

  if (hiddenCount > 0 && tiles.length) {
    body = tiles.slice(0, tiles.length - hiddenCount).map(face).join('');
    body += Array.from({ length: hiddenCount }, back).join('');
  } else if (meld.type === 'minggang' && tiles.length) {
    const pointed = tiles[tiles.length - 1];
    const direction = pointDirection(meld, options.viewerSeat);
    body = tiles.slice(0, -1).map(face).join('');
    body += direction
      ? `<span class="meld-point meld-point--${direction}" aria-hidden="true">${face(pointed)}</span>`
      : face(pointed);
  } else {
    body = tiles.map(face).join('');
  }

  if (!body) body = Array.from({ length: 4 }, back).join('');
  return `<span class="meld meld--${meld.type} meld--size-${size}" title="${title}" aria-label="${title}">${body}</span>`;
}

function meldTitle(meld, viewerSeat) {
  if (meld.type === 'angang') return '暗杠 · 扣两张';
  if (meld.type === 'huihui' || meld.type === 'bugang') return '回回 · 扣一张';
  if (meld.type === 'minggang') {
    const offset = pointOffset(meld, viewerSeat);
    return offset == null ? '明杠' : `明杠 · 杠自${SOURCE_LABEL[offset]}`;
  }
  const labels = { peng: '碰' };
  return labels[meld.type] || '面子';
}

function pointOffset(meld, viewerSeat) {
  if (!Number.isInteger(meld.fromSeat) || !Number.isInteger(viewerSeat)) return null;
  return (meld.fromSeat - viewerSeat + 4) % 4;
}

function pointDirection(meld, viewerSeat) {
  const offset = pointOffset(meld, viewerSeat);
  return offset == null ? null : POINT_DIRECTION[offset];
}

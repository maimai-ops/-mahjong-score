// 牌の種類と定数
// 表現: "1m"〜"9m"(萬), "1p"〜"9p"(筒), "1s"〜"9s"(索), "1z"〜"7z"(字)
// 赤ドラ: "0m","0p","0s" (内部的には赤5として扱う)

const SUITS = ['m', 'p', 's', 'z'];

// 字牌の意味
const HONOR_NAMES = {
  '1z': '東', '2z': '南', '3z': '西', '4z': '北',
  '5z': '白', '6z': '発', '7z': '中'
};

// 風牌のID
const WINDS = ['1z', '2z', '3z', '4z'];
// 三元牌のID
const DRAGONS = ['5z', '6z', '7z'];

// 赤ドラを通常の5として正規化
function normalize(tile) {
  if (tile === '0m') return '5m';
  if (tile === '0p') return '5p';
  if (tile === '0s') return '5s';
  return tile;
}

function isRedFive(tile) {
  return tile === '0m' || tile === '0p' || tile === '0s';
}

function getSuit(tile) {
  return tile[tile.length - 1];
}

function getNum(tile) {
  const n = tile === '0m' || tile === '0p' || tile === '0s' ? 5 : parseInt(tile[0]);
  return n;
}

function isHonor(tile) {
  return getSuit(tile) === 'z';
}

function isTerminal(tile) {
  if (isHonor(tile)) return false;
  const n = getNum(tile);
  return n === 1 || n === 9;
}

function isTerminalOrHonor(tile) {
  return isTerminal(tile) || isHonor(tile);
}

function isSimple(tile) {
  return !isTerminalOrHonor(tile);
}

function isWind(tile) {
  return WINDS.includes(tile);
}

function isDragon(tile) {
  return DRAGONS.includes(tile);
}

// ドラ表示牌から実際のドラを返す
function doraTile(indicator) {
  const suit = getSuit(indicator);
  const n = getNum(indicator);
  if (suit === 'z') {
    // 字牌: 東→南→西→北→東、白→発→中→白
    if (n <= 4) return ((n % 4) + 1) + 'z';
    return ((n - 5 + 1) % 3 + 5) + 'z'; // 白(5)→発(6)→中(7)→白(5)サイクル
  }
  return (n === 9 ? 1 : n + 1) + suit;
}

// 手牌の牌リストから各牌の枚数をカウント
function countTiles(tiles) {
  const counts = {};
  for (const t of tiles) {
    const key = normalize(t);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// 牌の表示名
function tileName(tile) {
  if (tile === '0m') return '赤5萬';
  if (tile === '0p') return '赤5筒';
  if (tile === '0s') return '赤5索';
  const suit = getSuit(tile);
  const n = getNum(tile);
  const suitNames = { m: '萬', p: '筒', s: '索', z: '' };
  if (suit === 'z') return HONOR_NAMES[tile] || tile;
  return n + suitNames[suit];
}

// 全牌リスト（牌ピッカー用）。赤ドラ含む
const ALL_TILES = [
  ...['1m','2m','3m','4m','0m','5m','6m','7m','8m','9m'],
  ...['1p','2p','3p','4p','0p','5p','6p','7p','8p','9p'],
  ...['1s','2s','3s','4s','0s','5s','6s','7s','8s','9s'],
  ...['1z','2z','3z','4z','5z','6z','7z'],
];

// 牌の並び順（ソート用）
const TILE_ORDER = {};
ALL_TILES.forEach((t, i) => { TILE_ORDER[t] = i; });

function compareTiles(a, b) {
  return (TILE_ORDER[a] ?? 99) - (TILE_ORDER[b] ?? 99);
}

// 連続した数牌か判定（順子チェック用）
function isSequential(a, b, c) {
  const sa = getSuit(a), sb = getSuit(b), sc = getSuit(c);
  if (sa !== sb || sb !== sc || sa === 'z') return false;
  const nums = [getNum(a), getNum(b), getNum(c)].sort((x, y) => x - y);
  return nums[1] === nums[0] + 1 && nums[2] === nums[1] + 1;
}

// 同じ牌か（赤ドラも正規化して比較）
function sameTile(a, b) {
  return normalize(a) === normalize(b);
}

export {
  SUITS, HONOR_NAMES, WINDS, DRAGONS,
  normalize, isRedFive,
  getSuit, getNum,
  isHonor, isTerminal, isTerminalOrHonor, isSimple,
  isWind, isDragon,
  doraTile, countTiles,
  tileName, ALL_TILES, TILE_ORDER, compareTiles,
  isSequential, sameTile,
};

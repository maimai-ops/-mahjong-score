import { isHonor, isTerminalOrHonor, isSimple, isDragon, isWind, normalize } from './tiles.js';
import { detectWait } from './yaku.js';

// 符計算
// 平和ツモ: 固定20符
// 七対子: 固定25符
// 通常形: 基本符 + 面子符 + 雀頭符 + 待ち形符 + ツモ符 → 10符切り上げ

function calcMeldFu(meld) {
  const tile = meld.tiles[0];
  const isYaochu = isTerminalOrHonor(tile);

  if (meld.type === 'seq') return 0;

  if (meld.type === 'pair') {
    // 雀頭符: 役牌（三元牌・自風・場風）は2符、それ以外は0
    return 0; // 雀頭符はcalcFu側で場風・自風を判定して加算
  }

  const base = isYaochu ? 4 : 2; // 么九牌か否か（標準: 么九=4, 中張=2）
  const closedMult = meld.closed ? 2 : 1;

  if (meld.type === 'tri') return base * closedMult;
  if (meld.type === 'quad') return base * 4 * closedMult; // 槓子は刻子の4倍
  return 0;
}

function calcFu(decomp, context) {
  const { winTile, isTsumo, seatWind, roundWind } = context;

  // 七対子: 固定25符
  if (decomp.type === 'chiitoitsu') {
    return { fu: 25, breakdown: [{ label: '七対子', fu: 25 }] };
  }

  // 国士: 符計算なし（役満）
  if (decomp.type === 'kokushi') {
    return { fu: 0, breakdown: [] };
  }

  const breakdown = [];
  let total = 0;

  // 基本符: 30（ロン門前）or 20（その他）
  const open = (decomp.openMelds || []).length > 0;
  const isMenzenRon = !open && !isTsumo;
  const baseFu = isMenzenRon ? 30 : 20;
  breakdown.push({ label: '基本符', fu: baseFu });
  total += baseFu;

  // 面子符（鳴き含む全面子）
  const normWinTile = normalize(winTile);
  const allMelds = [...decomp.melds, ...decomp.openMelds];
  for (const m of allMelds) {
    // 双碰ロンの場合、和了牌を含む刻子は明刻扱い（第3枚目が和了牌のため）
    let meld = m;
    if (!isTsumo && m.type === 'tri' && m.closed && m.tiles[0] === normWinTile) {
      meld = { ...m, closed: false };
    }
    const f = calcMeldFu(meld);
    if (f > 0) {
      breakdown.push({ label: meldLabel(meld), fu: f });
      total += f;
    }
  }

  // 雀頭符: 役牌（三元牌・自風・場風）なら2符
  const headTile = decomp.pair.tiles[0];
  let headFu = 0;
  if (isDragon(headTile)) headFu = 2;
  else if (headTile === seatWind) headFu += 2;
  else if (headTile === roundWind) headFu += 2;
  // 自風=場風の場合は4符（連風牌）
  if (headTile === seatWind && headTile === roundWind) headFu = 4;
  if (headFu > 0) {
    breakdown.push({ label: '雀頭(' + fuTileName(headTile) + ')', fu: headFu });
    total += headFu;
  }

  // 待ち形符
  const wait = detectWait(decomp, winTile);
  let waitFu = 0;
  if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki') waitFu = 2;
  if (waitFu > 0) {
    const waitNames = { kanchan: '嵌張', penchan: '辺張', tanki: '単騎' };
    breakdown.push({ label: '待ち(' + waitNames[wait] + ')', fu: waitFu });
    total += waitFu;
  }

  // ツモ符（門前ツモ以外も加算、ただし平和ツモは0符で後処理）
  if (isTsumo) {
    breakdown.push({ label: 'ツモ', fu: 2 });
    total += 2;
  }

  // 10符切り上げ
  const fu = Math.ceil(total / 10) * 10;

  // 平和ツモは20符固定（ツモ符と基本符の計算を上書き）
  // ※平和の成立チェックはengineで行い、ここでは計算結果をそのまま返す

  return { fu, rawTotal: total, breakdown };
}

function meldLabel(meld) {
  const tile = meld.tiles[0];
  const kind = meld.type === 'tri' ? '刻子' : '槓子';
  const open = meld.closed ? '暗' : '明';
  return open + kind + '(' + fuTileName(tile) + ')';
}

function fuTileName(tile) {
  const honorNames = { '1z':'東','2z':'南','3z':'西','4z':'北','5z':'白','6z':'発','7z':'中' };
  if (isHonor(tile)) return honorNames[tile] || tile;
  return tile;
}

export { calcFu };

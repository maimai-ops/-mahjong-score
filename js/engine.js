import { normalize, isSimple } from './tiles.js';
import { decompose } from './decompose.js';
import { detectYaku, countDora, doraTileFromIndicator } from './yaku.js';
import { calcFu } from './fu.js';
import { calcScore } from './score.js';

// メインAPI
// hand: { closedTiles: string[], openMelds: MeldDef[] }
// context: { winTile, isTsumo, isDealer, seatWind, roundWind, riichi,
//            isIppatsu, doraIndicators, uraDoraIndicators,
//            specialSituation, honba, isTenhou, isChihou,
//            allowKuitan, allowKiriageMangan }
function calculate(hand, context) {
  const {
    winTile,
    isTsumo,
    isDealer,
    riichi = 'none',
    doraIndicators = [],
    uraDoraIndicators = [],
    honba = 0,
    allowKuitan = true,
    allowKiriageMangan = false,
  } = context;

  const patterns = decompose(hand.closedTiles, hand.openMelds || []);

  if (patterns.length === 0) {
    return { isValid: false, reason: '和了形ではありません' };
  }

  const allRawTiles = [
    ...hand.closedTiles,
    ...(hand.openMelds || []).flatMap(m => m.tiles),
  ];

  let best = null;

  for (const decomp of patterns) {
    const yakuList = detectYaku(decomp, { ...context, allowKuitan });
    const hasYaku = yakuList.some(y => !y.isYakuman) ||
                    yakuList.some(y => y.isYakuman);

    if (yakuList.length === 0) continue; // 役なし

    // ドラ計算（役の有無に関わらず翻数に加算）
    const doraCount = calcDoraCount(allRawTiles, doraIndicators, uraDoraIndicators, riichi);

    const isYakuman = yakuList.some(y => y.isYakuman);
    let han = yakuList.reduce((sum, y) => sum + y.han, 0);
    if (!isYakuman) han += doraCount;

    let fu = 0;
    let fuBreakdown = [];
    if (!isYakuman) {
      const fuResult = calcFu(decomp, context);
      fu = fuResult.fu;
      fuBreakdown = fuResult.breakdown;

      // 平和ツモは20符固定（ツモ符なし）
      const hasPinfu = yakuList.some(y => y.key === 'pinfu');
      if (hasPinfu && isTsumo) {
        fu = 20;
        fuBreakdown = fuBreakdown.filter(b => b.label !== 'ツモ');
      }
    }

    const scoreResult = calcScore({ han, fu, isDealer, isTsumo, isYakuman, honba, allowKiriageMangan });
    if (!scoreResult) continue;

    if (!best || scoreResult.total > best.scoreResult.total) {
      best = { decomp, yakuList, han, fu, fuBreakdown, doraCount, scoreResult, isYakuman };
    }
  }

  if (!best) {
    return { isValid: false, reason: '役がありません' };
  }

  const { yakuList, han, fu, fuBreakdown, doraCount, scoreResult, isYakuman } = best;

  return {
    isValid: true,
    han,
    fu,
    fuBreakdown,
    yakuList,
    doraCount,
    limitName: scoreResult.limitName,
    total: scoreResult.total,
    payment: scoreResult.payment,
    isYakuman,
  };
}

function calcDoraCount(allRawTiles, doraIndicators, uraDoraIndicators, riichi) {
  let count = 0;
  const indicators = [...doraIndicators];
  if (riichi !== 'none') indicators.push(...uraDoraIndicators);

  for (const ind of indicators) {
    const dora = doraTileFromIndicator(ind);
    for (const t of allRawTiles) {
      if (normalize(t) === dora) count++;
    }
  }
  for (const t of allRawTiles) {
    if (t === '0m' || t === '0p' || t === '0s') count++;
  }
  return count;
}

// 入力バリデーション
function validateHand(closedTiles, openMelds = []) {
  const errors = [];

  const total = closedTiles.length + openMelds.reduce((s, m) => s + m.tiles.length, 0);
  if (total !== 14) errors.push(`牌の合計が${total}枚です（14枚必要）`);

  const counts = {};
  const allTiles = [...closedTiles, ...openMelds.flatMap(m => m.tiles)];
  for (const t of allTiles) {
    const k = normalize(t);
    counts[k] = (counts[k] || 0) + 1;
    // 赤ドラ区別
    if (t === '0m' || t === '0p' || t === '0s') {
      const redKey = 'red_' + t;
      counts[redKey] = (counts[redKey] || 0) + 1;
      if (counts[redKey] > 1) errors.push(`赤ドラ(${t})が2枚以上あります`);
    }
  }
  for (const [k, v] of Object.entries(counts)) {
    if (k.startsWith('red_')) continue;
    if (v > 4) errors.push(`${k}が${v}枚あります（最大4枚）`);
  }

  return errors;
}

export { calculate, validateHand };

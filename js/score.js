// 翻数・符 → 点数テーブルと支払い計算

// 子のロン点数表（han → fu → 点数）
// 満貫以上は別途
// 基本点 = 符 × 2^(翻+2)
// 子ロン=基本点×4, 親ロン=基本点×6, 子ツモ=[基本点×1, 基本点×2], 親ツモ=基本点×2 (各100切上)
const RON_CHILD = {
  1: { 20:700, 30:1000, 40:1300, 50:1600, 60:2000, 70:2300, 80:2600, 90:2900, 100:3200, 110:3600 },
  2: { 20:1300, 25:1600, 30:2000, 40:2600, 50:3200, 60:3900, 70:4500, 80:5200, 90:5800, 100:6400, 110:7100 },
  3: { 20:2600, 25:3200, 30:3900, 40:5200, 50:6400, 60:7700 },
  4: { 20:5200, 25:6400, 30:7700 },
};

const RON_DEALER = {
  1: { 20:1000, 30:1500, 40:2000, 50:2400, 60:2900, 70:3400, 80:3900, 90:4400, 100:4800, 110:5300 },
  2: { 20:2000, 25:2400, 30:2900, 40:3900, 50:4800, 60:5800, 70:6800, 80:7700, 90:8700, 100:9600, 110:10600 },
  3: { 20:3900, 25:4800, 30:5800, 40:7700, 50:9600, 60:11600 },
  4: { 20:7700, 25:9600, 30:11600 },
};

// 子のツモ [子支払い, 親支払い]
const TSUMO_CHILD = {
  1: { 20:[200,400], 30:[300,500], 40:[400,700], 50:[400,800], 60:[500,1000], 70:[600,1200], 80:[700,1300], 90:[800,1500], 100:[800,1600], 110:[900,1800] },
  2: { 20:[400,700], 25:[400,800], 30:[500,1000], 40:[700,1300], 50:[800,1600], 60:[1000,2000], 70:[1200,2300], 80:[1300,2600], 90:[1500,2900], 100:[1600,3200], 110:[1800,3600] },
  3: { 20:[700,1300], 25:[800,1600], 30:[1000,2000], 40:[1300,2600], 50:[1600,3200], 60:[2000,3900] },
  4: { 20:[1300,2600], 25:[1600,3200], 30:[2000,3900] },
};

// 親のツモ（各子支払い）
const TSUMO_DEALER = {
  1: { 20:400, 30:500, 40:700, 50:800, 60:1000, 70:1200, 80:1300, 90:1500, 100:1600, 110:1800 },
  2: { 20:700, 25:800, 30:1000, 40:1300, 50:1600, 60:2000, 70:2300, 80:2600, 90:2900, 100:3200, 110:3600 },
  3: { 20:1300, 25:1600, 30:2000, 40:2600, 50:3200, 60:3900 },
  4: { 20:2600, 25:3200, 30:3900 },
};

// 満貫以上の点数
const LIMIT_SCORES = {
  mangan:     { dealer: 12000, child: 8000,  dealerTsumo: 4000, childTsumo: [2000, 4000] },
  haneman:    { dealer: 18000, child: 12000, dealerTsumo: 6000, childTsumo: [3000, 6000] },
  baiman:     { dealer: 24000, child: 16000, dealerTsumo: 8000, childTsumo: [4000, 8000] },
  sanbaiman:  { dealer: 36000, child: 24000, dealerTsumo: 12000, childTsumo: [6000, 12000] },
  yakuman:    { dealer: 48000, child: 32000, dealerTsumo: 16000, childTsumo: [8000, 16000] },
  doubleyakuman: { dealer: 96000, child: 64000, dealerTsumo: 32000, childTsumo: [16000, 32000] },
};

const LIMIT_NAMES = {
  mangan: '満貫', haneman: '跳満', baiman: '倍満',
  sanbaiman: '三倍満', yakuman: '役満', doubleyakuman: 'ダブル役満',
};

// 翻数からlimitを判定
function getLimitLevel(han, fu, isYakuman) {
  if (isYakuman) {
    if (han >= 26) return 'doubleyakuman';
    return 'yakuman';
  }
  if (han >= 13) return 'yakuman';
  if (han >= 11) return 'sanbaiman';
  if (han >= 8)  return 'baiman';
  if (han >= 6)  return 'haneman';
  if (han >= 5)  return 'mangan';
  // 切り上げ満貫（オプション）は engine 側で処理
  // 4翻30符以上、3翻70符以上は満貫
  if (han === 4 && fu >= 30) return 'mangan';
  if (han === 3 && fu >= 70) return 'mangan';
  return null;
}

// メイン: 点数と支払いを計算
function calcScore({ han, fu, isDealer, isTsumo, isYakuman = false, honba = 0, allowKiriageMangan = false }) {
  const honbaBonus = honba * 300; // 本場ボーナス（ロン: 300点、ツモ: 100点×3人）

  const limit = getLimitLevel(han, fu, isYakuman);

  if (limit) {
    const s = LIMIT_SCORES[limit];
    const limitName = LIMIT_NAMES[limit];

    if (isTsumo) {
      if (isDealer) {
        const perChild = s.dealerTsumo + honba * 100;
        return {
          total: perChild * 3,
          payment: { dealer: null, child: perChild, allChild: perChild },
          limitName,
          han, fu: null,
        };
      } else {
        const [fromChild, fromDealer] = s.childTsumo.map(v => v + honba * 100);
        return {
          total: fromDealer + fromChild * 2,
          payment: { dealer: fromDealer, child: fromChild },
          limitName,
          han, fu: null,
        };
      }
    } else {
      const base = isDealer ? s.dealer : s.child;
      return {
        total: base + honbaBonus,
        payment: { ron: base + honbaBonus },
        limitName,
        han, fu: null,
      };
    }
  }

  // 通常点数表参照
  const table = isTsumo
    ? (isDealer ? TSUMO_DEALER : TSUMO_CHILD)
    : (isDealer ? RON_DEALER   : RON_CHILD);

  const hanTable = table[han];
  if (!hanTable) return null; // 表にない組み合わせ

  // 切り上げ満貫チェック
  if (allowKiriageMangan && hanTable[fu] === undefined) {
    // 点数表の最大値以上なら満貫
    return calcScore({ han, fu, isDealer, isTsumo, isYakuman: false, honba, allowKiriageMangan: false,
      _forceMangan: true });
  }

  const baseScore = hanTable[fu];
  if (baseScore === undefined) return null;

  if (isTsumo) {
    if (isDealer) {
      const perChild = baseScore + honba * 100;
      return {
        total: perChild * 3,
        payment: { dealer: null, child: perChild, allChild: perChild },
        limitName: null, han, fu,
      };
    } else {
      const [fromChild, fromDealer] = baseScore.map(v => v + honba * 100);
      return {
        total: fromDealer + fromChild * 2,
        payment: { dealer: fromDealer, child: fromChild },
        limitName: null, han, fu,
      };
    }
  } else {
    return {
      total: baseScore + honbaBonus,
      payment: { ron: baseScore + honbaBonus },
      limitName: null, han, fu,
    };
  }
}

export { calcScore, getLimitLevel, LIMIT_SCORES, LIMIT_NAMES };

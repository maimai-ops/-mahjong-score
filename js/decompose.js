import { normalize, getSuit, getNum, isHonor, isSequential } from './tiles.js';

// 面子の種類
// { type: 'seq'|'tri'|'quad'|'pair', tiles: [...], closed: bool }
// seq=順子, tri=刻子, quad=槓子, pair=雀頭

// 手牌を正規化済み枚数マップに変換
function toCountMap(tiles) {
  const map = {};
  for (const t of tiles) {
    const k = normalize(t);
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

// 枚数マップの全キーをソートして返す
function sortedKeys(map) {
  return Object.keys(map).filter(k => map[k] > 0).sort((a, b) => {
    const sa = getSuit(a), sb = getSuit(b);
    if (sa !== sb) return 'mpsz'.indexOf(sa) - 'mpsz'.indexOf(sb);
    return getNum(a) - getNum(b);
  });
}

// 通常形の全分解を列挙する（再帰）
// map: 残り牌の枚数マップ
// melds: 確定した面子リスト
// results: 結果の面子リスト配列
function decomposeNormal(map, melds, results) {
  const keys = sortedKeys(map);
  if (keys.length === 0) {
    results.push([...melds]);
    return;
  }

  const first = keys[0];
  const suit = getSuit(first);
  const num = getNum(first);

  // 刻子として取る
  if (map[first] >= 3) {
    map[first] -= 3;
    if (map[first] === 0) delete map[first];
    melds.push({ type: 'tri', tiles: [first, first, first], closed: true });
    decomposeNormal(map, melds, results);
    melds.pop();
    map[first] = (map[first] || 0) + 3;
  }

  // 順子として取る（字牌は不可）
  if (suit !== 'z' && num <= 7) {
    const t2 = (num + 1) + suit;
    const t3 = (num + 2) + suit;
    if ((map[t2] || 0) >= 1 && (map[t3] || 0) >= 1) {
      map[first] -= 1; if (map[first] === 0) delete map[first];
      map[t2] -= 1;    if (map[t2] === 0) delete map[t2];
      map[t3] -= 1;    if (map[t3] === 0) delete map[t3];
      melds.push({ type: 'seq', tiles: [first, t2, t3], closed: true });
      decomposeNormal(map, melds, results);
      melds.pop();
      map[first] = (map[first] || 0) + 1;
      map[t2]    = (map[t2]    || 0) + 1;
      map[t3]    = (map[t3]    || 0) + 1;
    }
  }
}

// 通常形: 雀頭を選んで残りを面子分解
function decomposeStandard(tiles) {
  const map = toCountMap(tiles);
  const keys = sortedKeys(map);
  const results = [];

  for (const head of keys) {
    if (map[head] < 2) continue;
    map[head] -= 2;
    if (map[head] === 0) delete map[head];
    const melds = [];
    const subResults = [];
    decomposeNormal({ ...map }, melds, subResults);
    for (const meldSet of subResults) {
      results.push({
        type: 'standard',
        pair: { type: 'pair', tiles: [head, head] },
        melds: meldSet,
      });
    }
    map[head] = (map[head] || 0) + 2;
  }

  return results;
}

// 七対子形チェック
function decomposeChiitoitsu(tiles) {
  const map = toCountMap(tiles);
  const keys = Object.keys(map);
  if (keys.length !== 7) return null;
  for (const k of keys) {
    if (map[k] !== 2) return null;
  }
  return {
    type: 'chiitoitsu',
    pairs: keys.map(k => ({ type: 'pair', tiles: [k, k] })),
  };
}

// 国士無双形チェック
const KOKUSHI_TILES = ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];

function decomposeKokushi(tiles) {
  const map = toCountMap(tiles);
  let pairTile = null;
  for (const k of KOKUSHI_TILES) {
    const cnt = map[k] || 0;
    if (cnt === 0) return null;
    if (cnt === 2) {
      if (pairTile) return null; // 対子が2つ以上
      pairTile = k;
    }
    if (cnt > 2) return null;
  }
  // 余分な牌がないか確認
  for (const k of Object.keys(map)) {
    if (!KOKUSHI_TILES.includes(k)) return null;
  }
  if (!pairTile) return null;
  return { type: 'kokushi', pairTile };
}

// 鳴き面子を呼び出し元から受け取る形式に変換
// openMelds: [{ type:'pon'|'chi'|'minkan'|'ankan'|'kakan', tiles:[...] }]
function normalizeOpenMelds(openMelds) {
  return openMelds.map(m => {
    const normTiles = m.tiles.map(normalize);
    let type;
    if (m.type === 'chi') type = 'seq';
    else if (m.type === 'pon') type = 'tri';
    else type = 'quad'; // minkan/ankan/kakan
    const closed = m.type === 'ankan';
    return { type, tiles: normTiles, closed, original: m.type };
  });
}

// メインAPI: 手牌全体を分解して全パターンを返す
// closedTiles: 非公開牌（和了牌含む）の配列
// openMelds: 鳴き面子の配列
// winTile: 和了牌
// isTsumo: ツモかどうか
function decompose(closedTiles, openMelds = []) {
  const normOpen = normalizeOpenMelds(openMelds);
  const normClosed = closedTiles.map(normalize);

  // 国士無双（鳴きなし専用）
  if (openMelds.length === 0) {
    const kokushi = decomposeKokushi(normClosed);
    if (kokushi) return [{ ...kokushi, openMelds: normOpen }];
  }

  const results = [];

  // 七対子（鳴きなし専用）— 通常形とも比較するため early return しない
  if (openMelds.length === 0) {
    const chiitoi = decomposeChiitoitsu(normClosed);
    if (chiitoi) results.push({ ...chiitoi, openMelds: normOpen });
  }

  // 通常形（七対子と共存可能：高点法で最良を選ぶ）
  const patterns = decomposeStandard(normClosed);
  results.push(...patterns.map(p => ({ ...p, openMelds: normOpen })));

  return results;
}

// バリデーション: 手牌が和了形かどうか（分解結果が1つ以上あるか）
function isValidHand(closedTiles, openMelds = []) {
  return decompose(closedTiles, openMelds).length > 0;
}

export { decompose, isValidHand, KOKUSHI_TILES };

import {
  normalize, getSuit, getNum,
  isHonor, isTerminal, isTerminalOrHonor, isSimple,
  isWind, isDragon, WINDS, DRAGONS,
} from './tiles.js';

// 役定義: { name, closedHan, openHan, isYakuman }
// openHan: null = 門前限定
const YAKU_DEF = {
  riichi:        { name: 'リーチ',             closedHan: 1, openHan: null },
  doubleRiichi:  { name: 'ダブルリーチ',       closedHan: 2, openHan: null },
  ippatsu:       { name: '一発',               closedHan: 1, openHan: null },
  tsumo:         { name: '門前清自摸和',        closedHan: 1, openHan: null },
  tanyao:        { name: 'タンヤオ',            closedHan: 1, openHan: 1 },
  pinfu:         { name: '平和',               closedHan: 1, openHan: null },
  iipeiko:       { name: '一盃口',             closedHan: 1, openHan: null },
  yakuhaiHaku:   { name: '役牌(白)',           closedHan: 1, openHan: 1 },
  yakuhaiHatsu:  { name: '役牌(発)',           closedHan: 1, openHan: 1 },
  yakuhaiChun:   { name: '役牌(中)',           closedHan: 1, openHan: 1 },
  yakuhaiSeat:   { name: '役牌(自風)',         closedHan: 1, openHan: 1 },
  yakuhaiRound:  { name: '役牌(場風)',         closedHan: 1, openHan: 1 },
  haitei:        { name: '海底摸月',           closedHan: 1, openHan: 1 },
  houtei:        { name: '河底撈魚',           closedHan: 1, openHan: 1 },
  rinshan:       { name: '嶺上開花',           closedHan: 1, openHan: 1 },
  chankan:       { name: '槍槓',               closedHan: 1, openHan: 1 },
  chiitoitsu:    { name: '七対子',             closedHan: 2, openHan: null },
  sanshoku:      { name: '三色同順',           closedHan: 2, openHan: 1 },
  sanshokuDoukou:{ name: '三色同刻',           closedHan: 2, openHan: 2 },
  ittsu:         { name: '一気通貫',           closedHan: 2, openHan: 1 },
  chanta:        { name: '混全帯么九',         closedHan: 2, openHan: 1 },
  toitoi:        { name: '対々和',             closedHan: 2, openHan: 2 },
  sanAnkou:      { name: '三暗刻',             closedHan: 2, openHan: 2 },
  sanKantsu:     { name: '三槓子',             closedHan: 2, openHan: 2 },
  shousangen:    { name: '小三元',             closedHan: 2, openHan: 2 },
  honroutou:     { name: '混老頭',             closedHan: 2, openHan: 2 },
  ryanpeikou:    { name: '二盃口',             closedHan: 3, openHan: null },
  junchan:       { name: '純全帯么九',         closedHan: 3, openHan: 2 },
  honitsu:       { name: '混一色',             closedHan: 3, openHan: 2 },
  chinitsu:      { name: '清一色',             closedHan: 6, openHan: 5 },
  // 役満
  tenhou:        { name: '天和',               closedHan: 13, openHan: null, isYakuman: true },
  chihou:        { name: '地和',               closedHan: 13, openHan: null, isYakuman: true },
  kokushi:       { name: '国士無双',           closedHan: 13, openHan: null, isYakuman: true },
  kokushiJusan:  { name: '国士無双十三面',     closedHan: 26, openHan: null, isYakuman: true },
  suuAnkou:      { name: '四暗刻',             closedHan: 13, openHan: null, isYakuman: true },
  suuAnkouTanki: { name: '四暗刻単騎',        closedHan: 26, openHan: null, isYakuman: true },
  daisangen:     { name: '大三元',             closedHan: 13, openHan: 13, isYakuman: true },
  shousuushi:    { name: '小四喜',             closedHan: 13, openHan: 13, isYakuman: true },
  daisuushi:     { name: '大四喜',             closedHan: 26, openHan: 26, isYakuman: true },
  tsuuiisou:     { name: '字一色',             closedHan: 13, openHan: 13, isYakuman: true },
  ryuuiisou:     { name: '緑一色',             closedHan: 13, openHan: 13, isYakuman: true },
  chinroutou:    { name: '清老頭',             closedHan: 13, openHan: 13, isYakuman: true },
  chuurenpoutou: { name: '九蓮宝燈',           closedHan: 13, openHan: null, isYakuman: true },
  chuurenKyuumen:{ name: '純正九蓮宝燈',      closedHan: 26, openHan: null, isYakuman: true },
  suuKantsu:     { name: '四槓子',             closedHan: 13, openHan: 13, isYakuman: true },
};

// 全面子（鳴き含む）を返す
function allMelds(decomp) {
  if (decomp.type === 'standard') return [...decomp.melds, ...decomp.openMelds];
  return decomp.openMelds || [];
}

// 全牌（雀頭含む）を返す
function allTiles(decomp) {
  const tiles = [];
  if (decomp.type === 'standard') {
    tiles.push(...decomp.pair.tiles);
    for (const m of decomp.melds) tiles.push(...m.tiles);
  } else if (decomp.type === 'chiitoitsu') {
    for (const p of decomp.pairs) tiles.push(...p.tiles);
  } else if (decomp.type === 'kokushi') {
    // 国士は全幺九牌
    return ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];
  }
  for (const m of (decomp.openMelds || [])) tiles.push(...m.tiles);
  return tiles;
}

// ロン和了時に暗刻と見なせるかの判定（ロンは和了牌で面子が完成するが、
// その面子は明刻扱い。ただし七対子・国士の場合は別途扱う）
function closedTriCount(decomp, winTile, isTsumo) {
  if (decomp.type !== 'standard') return 0;
  const normWin = normalize(winTile);
  let count = 0;
  for (const m of decomp.melds) {
    if (m.type !== 'tri') continue;
    // ロンで和了牌が含まれる刻子は明刻扱い
    if (!isTsumo && m.tiles[0] === normWin) continue;
    count++;
  }
  return count;
}

// 待ち形の判定
// 'ryanmen'=両面, 'shanpon'=双碰, 'kanchan'=嵌張, 'penchan'=辺張, 'tanki'=単騎
function detectWait(decomp, winTile) {
  if (decomp.type === 'chiitoitsu') return 'tanki';
  if (decomp.type === 'kokushi') return 'kokushi';
  if (decomp.type !== 'standard') return null;

  const normWin = normalize(winTile);

  // 雀頭が和了牌 → 単騎
  if (decomp.pair.tiles[0] === normWin) return 'tanki';

  // 和了牌が含まれる面子を探す
  for (const m of decomp.melds) {
    if (!m.tiles.includes(normWin)) continue;
    if (m.type === 'tri') return 'shanpon'; // 対子→刻子完成 = 双碰
    if (m.type === 'seq') {
      const nums = m.tiles.map(getNum).sort((a, b) => a - b);
      const winNum = getNum(normWin);
      const suit = getSuit(normWin);
      if (winNum === nums[0] || winNum === nums[2]) {
        // 辺張: 1-2+3 or 7+8-9
        if ((nums[0] === 1 && winNum === 3) || (nums[2] === 9 && winNum === 7)) return 'penchan';
        return 'ryanmen';
      }
      return 'kanchan'; // 中間牌
    }
  }
  return null;
}

// 役判定メイン
function detectYaku(decomp, context) {
  const {
    winTile, isTsumo, isDealer,
    seatWind, roundWind,
    riichi, isIppatsu,
    specialSituation,
    isTenhou, isChihou,
    allowKuitan = true,
  } = context;

  const open = (decomp.openMelds || []).length > 0;
  const melds = allMelds(decomp);
  const tiles = allTiles(decomp);

  const result = [];

  function add(key, han) {
    const def = YAKU_DEF[key];
    result.push({ key, name: def.name, han, isYakuman: !!def.isYakuman });
  }

  // ---- 役満チェック（先に判定して通常役は無視）----

  // 天和・地和
  if (isTenhou) { add('tenhou', 13); return result; }
  if (isChihou) { add('chihou', 13); return result; }

  // 国士無双
  if (decomp.type === 'kokushi') {
    const normWin = normalize(winTile);
    const kokushiTiles = ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'];
    // 13面待ちか: 13種全部持っていて和了牌がいずれか
    const counts = {};
    tiles.forEach(t => { counts[t] = (counts[t]||0)+1; });
    const hasDup = kokushiTiles.some(t => (counts[t]||0) >= 2);
    add(hasDup ? 'kokushiJusan' : 'kokushi', hasDup ? 26 : 13);
    return result;
  }

  // 四暗刻
  if (decomp.type === 'standard' && !open) {
    const wait = detectWait(decomp, winTile);
    const allClosed = decomp.melds.every(m => m.type === 'tri' || m.type === 'quad');
    if (allClosed && decomp.melds.filter(m=>m.type==='tri'||m.type==='quad').length === 4) {
      add(wait === 'tanki' ? 'suuAnkouTanki' : 'suuAnkou', wait === 'tanki' ? 26 : 13);
      return result;
    }
  }

  // 大三元
  const dragonTris = DRAGONS.filter(d =>
    melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0] === d)
  );
  if (dragonTris.length === 3) { add('daisangen', 13); return result; }

  // 字一色
  if (tiles.every(t => isHonor(t))) { add('tsuuiisou', 13); return result; }

  // 緑一色 (2s,3s,4s,6s,8s,発のみ)
  const GREEN = new Set(['2s','3s','4s','6s','8s','6z']);
  if (tiles.every(t => GREEN.has(t))) { add('ryuuiisou', 13); return result; }

  // 清老頭
  if (tiles.every(t => isTerminal(t) || isHonor(t)) && tiles.every(t => !isHonor(t))) {
    add('chinroutou', 13); return result;
  }
  // ↑修正: 清老頭は端牌のみ（字牌なし）
  if (tiles.every(t => isTerminal(t))) { add('chinroutou', 13); return result; }

  // 小四喜・大四喜
  const windTris = WINDS.filter(w =>
    melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0] === w)
  );
  const windPair = decomp.type === 'standard' && WINDS.includes(decomp.pair.tiles[0]);
  if (windTris.length === 4) { add('daisuushi', 26); return result; }
  if (windTris.length === 3 && windPair) { add('shousuushi', 13); return result; }

  // 四槓子
  const kanCount = melds.filter(m => m.type === 'quad').length;
  if (kanCount === 4) { add('suuKantsu', 13); return result; }

  // 九蓮宝燈
  if (!open) {
    const suit = getSuit(tiles[0]);
    if (suit !== 'z' && tiles.every(t => getSuit(t) === suit)) {
      const counts = {};
      tiles.forEach(t => { const n = getNum(t); counts[n] = (counts[n]||0)+1; });
      if ([1,9].every(n => (counts[n]||0) >= 3) &&
          [2,3,4,5,6,7,8].every(n => (counts[n]||0) >= 1)) {
        // 純正九蓮: 和了牌が1〜9のいずれか（9面待ち）
        const normWin = normalize(winTile);
        const winSuit = getSuit(normWin);
        const isNineSided = winSuit === suit &&
          [1,2,3,4,5,6,7,8,9].some(n => {
            const testCounts = {...counts};
            testCounts[n] = (testCounts[n]||0) - 1;
            return [1,9].every(nn => (testCounts[nn]||0) >= 3) &&
              [2,3,4,5,6,7,8].every(nn => (testCounts[nn]||0) >= 1);
          });
        add(isNineSided ? 'chuurenKyuumen' : 'chuurenpoutou', isNineSided ? 26 : 13);
        return result;
      }
    }
  }

  // ---- 通常役 ----

  // リーチ系
  if (riichi === 'double') { add('doubleRiichi', 2); }
  else if (riichi === 'riichi') { add('riichi', 1); }
  if (isIppatsu && riichi !== 'none') add('ippatsu', 1);

  // 門前ツモ
  if (isTsumo && !open) add('tsumo', 1);

  // 特殊状況
  if (specialSituation === 'haitei' && isTsumo) add('haitei', 1);
  if (specialSituation === 'houtei' && !isTsumo) add('houtei', 1);
  if (specialSituation === 'rinshan') add('rinshan', 1);
  if (specialSituation === 'chankan') add('chankan', 1);

  // 七対子（鳴き不可）
  if (decomp.type === 'chiitoitsu') {
    add('chiitoitsu', 2);
    // タンヤオ
    if (tiles.every(isSimple)) add('tanyao', 1);
    // 混一色
    const suits = [...new Set(tiles.map(getSuit))];
    const nonZ = suits.filter(s => s !== 'z');
    if (nonZ.length === 1 && suits.includes('z')) add('honitsu', open ? 2 : 3);
    if (nonZ.length === 1 && !suits.includes('z')) add('chinitsu', open ? 5 : 6);
    return result;
  }

  // 以下は通常形（standard）のみ
  if (decomp.type !== 'standard') return result;

  const wait = detectWait(decomp, winTile);

  // タンヤオ
  const hasTanyao = tiles.every(isSimple);
  if (hasTanyao && (allowKuitan || !open)) add('tanyao', 1);

  // 平和（門前・両面待ち・役牌以外の雀頭。ツモでも成立）
  if (!open) {
    const pairTile = decomp.pair.tiles[0];
    const pairIsYakuhai = isDragon(pairTile) ||
      pairTile === seatWind || pairTile === roundWind;
    const allSeq = decomp.melds.every(m => m.type === 'seq');
    if (allSeq && !pairIsYakuhai && wait === 'ryanmen') add('pinfu', 1);
  }

  // 一盃口（門前限定）
  if (!open) {
    const seqs = decomp.melds.filter(m => m.type === 'seq').map(m => m.tiles.join(','));
    const uniqueSeqs = new Set(seqs);
    if (seqs.length - uniqueSeqs.size >= 1) add('iipeiko', 1);
  }

  // 二盃口（一盃口と排他）
  if (!open) {
    const seqs = decomp.melds.filter(m => m.type === 'seq').map(m => m.tiles.join(','));
    const freq = {};
    seqs.forEach(s => { freq[s] = (freq[s]||0)+1; });
    const pairs = Object.values(freq).filter(v => v >= 2).length;
    if (pairs >= 2) {
      // 二盃口: 一盃口を取り消して二盃口を追加
      const idx = result.findIndex(r => r.key === 'iipeiko');
      if (idx >= 0) result.splice(idx, 1);
      add('ryanpeikou', 3);
    }
  }

  // 役牌
  if (melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0]==='5z')) add('yakuhaiHaku', 1);
  if (melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0]==='6z')) add('yakuhaiHatsu', 1);
  if (melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0]==='7z')) add('yakuhaiChun', 1);
  if (seatWind && melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0]===seatWind)) add('yakuhaiSeat', 1);
  if (roundWind && melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0]===roundWind)) add('yakuhaiRound', 1);

  // 小三元（役牌と複合する）
  const dragonTriCount = DRAGONS.filter(d =>
    melds.some(m => (m.type==='tri'||m.type==='quad') && m.tiles[0] === d)
  ).length;
  const dragonPair = DRAGONS.includes(decomp.pair.tiles[0]);
  if (dragonTriCount === 2 && dragonPair) add('shousangen', 2);

  // 対々和
  if (melds.every(m => m.type==='tri'||m.type==='quad') && decomp.melds.length > 0) add('toitoi', 2);

  // 三暗刻
  const closedTri = closedTriCount(decomp, winTile, isTsumo);
  if (closedTri >= 3) add('sanAnkou', 2);

  // 三槓子
  if (kanCount >= 3) add('sanKantsu', 2);

  // 混老頭
  if (tiles.every(isTerminalOrHonor)) {
    // 対々和か七対子でないと実質成立しないが役自体は独立
    add('honroutou', 2);
  }

  // 三色同順
  const seqsByNum = {};
  melds.filter(m=>m.type==='seq').forEach(m => {
    const minNum = Math.min(...m.tiles.map(getNum));
    const suit = getSuit(m.tiles[0]);
    if (!seqsByNum[minNum]) seqsByNum[minNum] = new Set();
    seqsByNum[minNum].add(suit);
  });
  for (const num of Object.keys(seqsByNum)) {
    if (['m','p','s'].every(s => seqsByNum[num].has(s))) {
      add('sanshoku', open ? 1 : 2);
      break;
    }
  }

  // 三色同刻
  const trisByNum = {};
  melds.filter(m=>m.type==='tri'||m.type==='quad').forEach(m => {
    if (isHonor(m.tiles[0])) return;
    const n = getNum(m.tiles[0]);
    const s = getSuit(m.tiles[0]);
    if (!trisByNum[n]) trisByNum[n] = new Set();
    trisByNum[n].add(s);
  });
  for (const num of Object.keys(trisByNum)) {
    if (['m','p','s'].every(s => trisByNum[num].has(s))) {
      add('sanshokuDoukou', 2);
      break;
    }
  }

  // 一気通貫
  for (const suit of ['m','p','s']) {
    const seqNums = new Set(
      melds.filter(m=>m.type==='seq' && getSuit(m.tiles[0])===suit)
           .map(m => Math.min(...m.tiles.map(getNum)))
    );
    if (seqNums.has(1) && seqNums.has(4) && seqNums.has(7)) {
      add('ittsu', open ? 1 : 2);
      break;
    }
  }

  // 混全帯么九（全面子に么九牌）
  const allMeldsArr = [...decomp.melds, decomp.pair, ...decomp.openMelds];
  const hasSeq = melds.some(m => m.type === 'seq');
  const allHaveYaochuInMeld = allMeldsArr.every(m =>
    m.tiles.some(isTerminalOrHonor)
  );
  if (allHaveYaochuInMeld && hasSeq && !tiles.every(isTerminalOrHonor)) {
    // 純全帯么九チェック（字牌なし）
    if (tiles.every(t => !isHonor(t))) {
      add('junchan', open ? 2 : 3);
    } else {
      add('chanta', open ? 1 : 2);
    }
  }

  // 混一色・清一色
  const tileSuits = [...new Set(tiles.map(getSuit))];
  const nonZSuits = tileSuits.filter(s => s !== 'z');
  if (nonZSuits.length === 1) {
    if (tileSuits.includes('z')) {
      add('honitsu', open ? 2 : 3);
    } else {
      add('chinitsu', open ? 5 : 6);
    }
  }

  return result;
}

// ドラ計算
function countDora(allTilesRaw, doraIndicators, uraDoraIndicators, riichi) {
  let count = 0;
  const indicators = [...doraIndicators];
  if (riichi !== 'none') indicators.push(...uraDoraIndicators);

  for (const ind of indicators) {
    const dora = doraTileFromIndicator(ind);
    for (const t of allTilesRaw) {
      if (normalize(t) === dora) count++;
    }
  }
  // 赤ドラ
  for (const t of allTilesRaw) {
    if (t === '0m' || t === '0p' || t === '0s') count++;
  }
  return count;
}

function doraTileFromIndicator(indicator) {
  const suit = getSuit(indicator);
  const n = getNum(indicator);
  if (suit === 'z') {
    if (n <= 4) return ((n % 4) + 1) + 'z';
    return ((n - 5 + 1) % 3 + 5) + 'z'; // 白(5)→発(6)→中(7)→白(5)サイクル
  }
  return (n === 9 ? 1 : n + 1) + suit;
}

export { detectYaku, detectWait, countDora, doraTileFromIndicator, YAKU_DEF };

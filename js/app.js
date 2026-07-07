import { ALL_TILES, tileName, normalize, getSuit, isHonor, isDragon, isWind, compareTiles } from './tiles.js';
import { calculate, validateHand } from './engine.js';

// ---- 状態 ----
const state = {
  // 手牌入力
  closedTiles: Array(14).fill(null),
  openMelds: [],

  // 質問回答
  winTile: null,
  isTsumo: null,
  isDealer: null,
  seatWind: null,
  roundWind: null,
  riichi: 'none',
  isIppatsu: false,
  doraIndicators: [],
  uraDoraIndicators: [],
  hasOpenMelds: null,
  specialSituation: 'none',
  honba: 0,

  // 牌ピッカーコールバック
  pickerCallback: null,
};

// ---- 画面管理 ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ---- 牌のUnicode絵文字マッピング ----
const TILE_UNICODE = {
  '1m':'🀇','2m':'🀈','3m':'🀉','4m':'🀊','5m':'🀋','6m':'🀌','7m':'🀍','8m':'🀎','9m':'🀏',
  '1p':'🀙','2p':'🀚','3p':'🀛','4p':'🀜','5p':'🀝','6p':'🀞','7p':'🀟','8p':'🀠','9p':'🀡',
  '1s':'🀐','2s':'🀑','3s':'🀒','4s':'🀓','5s':'🀔','6s':'🀕','7s':'🀖','8s':'🀗','9s':'🀘',
  '1z':'🀀','2z':'🀁','3z':'🀂','4z':'🀃',
  '5z':'🀆','6z':'🀅','7z':'🀄',
  // 赤ドラは通常の5と同じ絵文字（赤バッジで区別）
  '0m':'🀋','0p':'🀝','0s':'🀔',
};

function tileClass(tile) {
  if (!tile) return 'tile empty';
  if (tile === '0m' || tile === '0p' || tile === '0s') return 'tile red-dora';
  return 'tile';
}

function makeTileEl(tile, onClick, extra = '') {
  const el = document.createElement('div');
  el.className = tileClass(tile) + (extra ? ' ' + extra : '');
  if (!tile) {
    el.textContent = '+';
  } else {
    el.textContent = TILE_UNICODE[tile] || tile;
    if (tile === '0m' || tile === '0p' || tile === '0s') {
      const badge = document.createElement('span');
      badge.className = 'red-badge';
      badge.textContent = '赤';
      el.appendChild(badge);
    }
  }
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

// ---- 画面1: 手牌入力 ----
function renderHandInput() {
  const grid = document.getElementById('hand-grid');
  grid.innerHTML = '';

  // 14枚スロット（鳴きがある場合は減らす）
  const meldTileCount = state.openMelds.reduce((s, m) => s + m.tiles.length, 0);
  const closedSlots = 14 - meldTileCount;

  // closedTilesを必要な枚数に調整
  while (state.closedTiles.length < closedSlots) state.closedTiles.push(null);
  while (state.closedTiles.length > closedSlots) state.closedTiles.pop();

  state.closedTiles.forEach((tile, i) => {
    // 入力済み牌: タップで削除 / 空スロット: クリック不可（パレットから追加）
    const el = makeTileEl(tile, tile ? () => {
      state.closedTiles[i] = null;
      // 和了牌として選択中の牌が手牌から全て消えた場合はリセット
      if (state.winTile && !state.closedTiles.some(t => t && normalize(t) === normalize(state.winTile))) {
        state.winTile = null;
      }
      renderHandInput();
    } : null);
    grid.appendChild(el);
  });

  renderMelds();
  updateHandError();
  renderInlinePalette();
}

function renderMelds() {
  const list = document.getElementById('meld-list');
  list.innerHTML = '';
  state.openMelds.forEach((meld, idx) => {
    const item = document.createElement('div');
    item.className = 'meld-item';
    const badge = document.createElement('span');
    badge.className = 'meld-type-badge';
    badge.textContent = { pon:'ポン', chi:'チー', minkan:'明槓', ankan:'暗槓', kakan:'加槓' }[meld.type] || meld.type;
    item.appendChild(badge);
    const tilesEl = document.createElement('div');
    tilesEl.className = 'meld-tiles';
    meld.tiles.forEach(t => tilesEl.appendChild(makeTileEl(t)));
    item.appendChild(tilesEl);
    const rmBtn = document.createElement('button');
    rmBtn.className = 'meld-remove-btn';
    rmBtn.textContent = '削除';
    rmBtn.addEventListener('click', () => {
      state.openMelds.splice(idx, 1);
      renderHandInput();
    });
    item.appendChild(rmBtn);
    list.appendChild(item);
  });
}

function updateHandError() {
  const filled = state.closedTiles.filter(Boolean);
  const meldTiles = state.openMelds.flatMap(m => m.tiles);
  const all = [...filled, ...meldTiles];
  const errs = all.length === 14 ? validateHand(filled, state.openMelds) : [];
  const errEl = document.getElementById('hand-error');
  errEl.textContent = errs[0] || '';
  const btn = document.getElementById('to-questions-btn');
  btn.disabled = filled.length !== state.closedTiles.length || errs.length > 0;
}

// ---- インラインパレット ----
let inlineSuit = 'm';

function renderInlinePalette() {
  const grid = document.getElementById('inline-palette-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const handFull = !state.closedTiles.includes(null);
  const allUsed = [...state.closedTiles.filter(Boolean), ...state.openMelds.flatMap(m => m.tiles)];

  // 正規化済み枚数カウント
  const normCount = {};
  allUsed.forEach(t => { const k = normalize(t); normCount[k] = (normCount[k] || 0) + 1; });
  // 赤ドラは個別カウント（各1枚限定）
  const redUsed = { '0m': 0, '0p': 0, '0s': 0 };
  allUsed.forEach(t => { if (redUsed[t] !== undefined) redUsed[t]++; });

  ALL_TILES.filter(t => getSuit(t) === inlineSuit).forEach(t => {
    const isRed = t === '0m' || t === '0p' || t === '0s';
    const used = isRed ? redUsed[t] : (normCount[normalize(t)] || 0);
    const limit = isRed ? 1 : 4;
    // 赤五牌は通常五牌の合計4枚上限も確認
    const unavailable = handFull || used >= limit || (isRed && (normCount[normalize(t)] || 0) >= 4);

    const el = makeTileEl(t, unavailable ? null : () => {
      const idx = state.closedTiles.indexOf(null);
      if (idx !== -1) { state.closedTiles[idx] = t; renderHandInput(); }
    });
    if (unavailable) el.classList.add('unavailable');
    grid.appendChild(el);
  });
}

// ---- 牌ピッカー（ドラ・鳴き選択用モーダル）----
let pickerSuit = 'm';

function openPicker(callback, title = '牌を選んでください') {
  state.pickerCallback = callback;
  document.getElementById('picker-title').textContent = title;
  document.getElementById('tile-picker-overlay').classList.add('open');
  renderPickerGrid();
}

function closePicker() {
  document.getElementById('tile-picker-overlay').classList.remove('open');
  state.pickerCallback = null;
}

function renderPickerGrid() {
  const grid = document.getElementById('picker-grid');
  grid.innerHTML = '';
  const suitTiles = ALL_TILES.filter(t => getSuit(t) === pickerSuit);
  suitTiles.forEach(t => {
    const el = makeTileEl(t, () => {
      if (state.pickerCallback) state.pickerCallback(t);
      closePicker();
    });
    grid.appendChild(el);
  });
}

// ---- 鳴きフォーム ----
let newMeldType = 'pon';
let newMeldTiles = [];

function initMeldForm() {
  newMeldType = 'pon';
  newMeldTiles = [];
  renderMeldForm();
}

function renderMeldForm() {
  document.querySelectorAll('.meld-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === newMeldType);
  });
  const slots = document.getElementById('meld-tile-slots');
  slots.innerHTML = '';
  const count = newMeldType === 'chi' ? 3 : newMeldType === 'pon' ? 3 : 4;
  for (let i = 0; i < count; i++) {
    const tile = newMeldTiles[i] || null;
    const el = makeTileEl(tile, () => {
      openPicker(t => {
        newMeldTiles[i] = t;
        renderMeldForm();
      });
    });
    slots.appendChild(el);
  }
  const addBtn = document.getElementById('add-meld-btn');
  addBtn.disabled = newMeldTiles.filter(Boolean).length < count;
}

// ---- 質問フロー ----
const QUESTIONS = [
  'win-tile',
  'tsumo-ron',
  'seat',
  'riichi',
  'dora',
  'melds',
  'special',
];

let currentQ = 0;

function startQuestions() {
  currentQ = 0;
  showQuestion();
  showScreen('screen-questions');
}

function showQuestion() {
  const qId = QUESTIONS[currentQ];
  document.querySelectorAll('.q-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('q-' + qId);
  if (panel) panel.classList.add('active');

  // プログレスバー
  const pct = ((currentQ) / QUESTIONS.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('step-label').textContent = `${currentQ + 1} / ${QUESTIONS.length}`;

  if (qId === 'win-tile') renderWinTileQ();
  if (qId === 'dora') renderDoraQ();
  if (qId === 'melds') renderMeldsQ();

  updateNextBtn();
}

function nextQuestion() {
  if (currentQ < QUESTIONS.length - 1) {
    currentQ++;
    showQuestion();
  } else {
    doCalculate();
  }
}

function prevQuestion() {
  if (currentQ > 0) { currentQ--; showQuestion(); }
  else showScreen('screen-input');
}

function updateNextBtn() {
  const qId = QUESTIONS[currentQ];
  const btn = document.getElementById('q-next-btn');
  btn.textContent = currentQ === QUESTIONS.length - 1 ? '計算する' : '次へ';
  let ok = false;
  if (qId === 'win-tile') ok = !!state.winTile;
  else if (qId === 'tsumo-ron') ok = state.isTsumo !== null;
  else if (qId === 'seat') ok = state.isDealer !== null && !!state.seatWind && !!state.roundWind;
  else if (qId === 'riichi') ok = true; // デフォルトあり
  else if (qId === 'dora') ok = true;
  else if (qId === 'melds') ok = state.hasOpenMelds !== null;
  else if (qId === 'special') ok = true;
  btn.disabled = !ok;
}

// Q1: 和了牌
function renderWinTileQ() {
  const area = document.getElementById('win-tile-area');
  area.innerHTML = '';
  const tiles = state.closedTiles.filter(Boolean);
  const seen = new Set();
  tiles.forEach(t => {
    const key = normalize(t);
    if (seen.has(key)) return;
    seen.add(key);
    const el = makeTileEl(t, () => {
      state.winTile = t;
      renderWinTileQ();
      updateNextBtn();
    }, state.winTile && normalize(state.winTile) === key ? 'selected' : '');
    area.appendChild(el);
  });
}

// Q5: ドラ表示牌
function renderDoraQ() {
  renderDoraSlots('dora-slots', state.doraIndicators, () => {
    openPicker(t => { state.doraIndicators.push(t); renderDoraQ(); }, 'ドラ表示牌を選択');
  });
  renderDoraSlots('ura-dora-slots', state.uraDoraIndicators, () => {
    openPicker(t => { state.uraDoraIndicators.push(t); renderDoraQ(); }, '裏ドラ表示牌を選択');
  });
  const uraSection = document.getElementById('ura-dora-section');
  uraSection.style.display = state.riichi !== 'none' ? 'block' : 'none';
}

function renderDoraSlots(containerId, indicators, onAdd) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  indicators.forEach((t, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'dora-indicator-slot';
    wrap.appendChild(makeTileEl(t));
    const rm = document.createElement('button');
    rm.className = 'dora-remove';
    rm.textContent = '×';
    rm.addEventListener('click', () => { indicators.splice(i, 1); renderDoraQ(); });
    wrap.appendChild(rm);
    el.appendChild(wrap);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'add-dora-btn';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', onAdd);
  el.appendChild(addBtn);
}

// Q6: 鳴き
function renderMeldsQ() {
  const area = document.getElementById('melds-confirm-area');
  area.innerHTML = '';
  if (state.openMelds.length > 0) {
    area.innerHTML = '<p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">手牌入力時に登録した鳴き面子:</p>';
    state.openMelds.forEach(m => {
      const item = document.createElement('div');
      item.className = 'meld-item';
      const badge = document.createElement('span');
      badge.className = 'meld-type-badge';
      badge.textContent = { pon:'ポン', chi:'チー', minkan:'明槓', ankan:'暗槓', kakan:'加槓' }[m.type];
      item.appendChild(badge);
      const tilesEl = document.createElement('div');
      tilesEl.className = 'meld-tiles';
      m.tiles.forEach(t => tilesEl.appendChild(makeTileEl(t)));
      item.appendChild(tilesEl);
      area.appendChild(item);
    });
  }
}

// ---- 計算実行 ----
function doCalculate() {
  const hand = {
    closedTiles: state.closedTiles.filter(Boolean),
    openMelds: state.openMelds,
  };
  const context = {
    winTile: state.winTile,
    isTsumo: state.isTsumo,
    isDealer: state.isDealer,
    seatWind: state.seatWind,
    roundWind: state.roundWind,
    riichi: state.riichi,
    isIppatsu: state.isIppatsu,
    doraIndicators: state.doraIndicators,
    uraDoraIndicators: state.uraDoraIndicators,
    specialSituation: state.specialSituation,
    honba: state.honba,
    allowKuitan: true,
  };

  const result = calculate(hand, context);
  renderResult(result);
  showScreen('screen-result');
}

// ---- 結果画面 ----
const YAKU_DESC = {
  riichi:        'リーチ宣言をして和了した。宣言後の手牌変更は原則不可。',
  doubleRiichi:  '第一打牌でリーチ宣言。通常リーチより価値が高い。',
  ippatsu:       'リーチ後、一巡以内かつ鳴きなしで和了。',
  tsumo:         '門前でツモ和了。全員から点数を受け取る。',
  tanyao:        '2〜8の数牌のみで構成。么九牌（1・9・字牌）が含まれない。',
  pinfu:         '全面子が順子、雀頭が役牌でなく、両面待ちで和了。',
  iipeiko:       '同じ順子が2組。門前限定。',
  yakuhaiHaku:   '白の刻子または槓子。',
  yakuhaiHatsu:  '発の刻子または槓子。',
  yakuhaiChun:   '中の刻子または槓子。',
  yakuhaiSeat:   '自分の自風牌の刻子または槓子。',
  yakuhaiRound:  '場風牌の刻子または槓子。',
  haitei:        '最後のツモ牌で和了。',
  houtei:        '最後の捨て牌でロン和了。',
  rinshan:       '槓をした後の嶺上牌で和了。',
  chankan:       '他家の加槓に槍をして和了。',
  chiitoitsu:    '7種類の対子のみで構成。符は25符固定。',
  sanshoku:      '萬・筒・索で同じ数の順子を揃える。',
  sanshokuDoukou:'萬・筒・索で同じ数の刻子を揃える。',
  ittsu:         '同じ色で1〜3、4〜6、7〜9の順子を揃える。',
  chanta:        '全ての面子と雀頭に么九牌が含まれ、順子も含む。',
  toitoi:        '全面子が刻子または槓子。',
  sanAnkou:      '暗刻が3組以上。',
  sanKantsu:     '槓子が3組以上。',
  shousangen:    '三元牌のうち2種が刻子、1種が雀頭。',
  honroutou:     '全牌が么九牌（1・9・字牌）のみ。',
  ryanpeikou:    '一盃口が2組。門前限定。',
  junchan:       '全面子と雀頭に1・9の数牌が含まれ、字牌はない。',
  honitsu:       '1色の数牌と字牌のみ。',
  chinitsu:      '1色の数牌のみ。字牌を含まない。',
  tenhou:        '親の第一ツモで和了。',
  chihou:        '子の第一ツモで和了（第一打牌前に鳴きなし）。',
  kokushi:       '全種の么九牌（13種）と、そのうち1種の対子。',
  kokushiJusan:  '国士無双の13面待ち。ダブル役満。',
  suuAnkou:      '4面子すべてが暗刻。',
  suuAnkouTanki: '四暗刻の単騎待ち。ダブル役満。',
  daisangen:     '三元牌（白発中）すべてが刻子。',
  shousuushi:    '四風牌のうち3種が刻子、1種が雀頭。',
  daisuushi:     '四風牌すべてが刻子。ダブル役満。',
  tsuuiisou:     '全牌が字牌のみ。',
  ryuuiisou:     '2・3・4・6・8索と発のみで構成。',
  chinroutou:    '全牌が1・9の数牌のみ。',
  chuurenpoutou: '1色で1112345678999の基本型に1枚加えた形。',
  chuurenKyuumen:'九蓮宝燈の9面待ち。ダブル役満。',
  suuKantsu:     '4面子すべてが槓子。',
};

function renderResult(result) {
  const container = document.getElementById('result-container');
  container.innerHTML = '';

  if (!result.isValid) {
    container.innerHTML = `<div class="error-msg">和了できません: ${result.reason}</div>`;
    return;
  }

  // 点数カード
  const scoreCard = document.createElement('div');
  scoreCard.className = 'result-score';
  if (result.limitName) {
    scoreCard.innerHTML += `<div class="result-limit">${result.limitName}</div>`;
  }
  scoreCard.innerHTML += `<div class="result-points">${result.total.toLocaleString()}点</div>`;
  if (!result.isYakuman && result.fu) {
    scoreCard.innerHTML += `<div class="result-hanfu">${result.han}翻 ${result.fu}符</div>`;
  } else if (result.isYakuman) {
    scoreCard.innerHTML += `<div class="result-hanfu">役満</div>`;
  }
  container.appendChild(scoreCard);

  // Xシェアボタン
  const scoreText = result.limitName
    ? `${result.limitName} ${result.total.toLocaleString()}点`
    : `${result.han}翻${result.fu}符 ${result.total.toLocaleString()}点`;
  const yakuNames = result.yakuList.map(y => y.name).join('・');
  const tweetText = encodeURIComponent(`【麻雀点数計算】${scoreText}！\n${yakuNames}\n`);
  const tweetUrl = encodeURIComponent('https://maimai-ops.github.io/-mahjong-score/');
  const shareLink = document.createElement('a');
  shareLink.className = 'share-btn-x';
  shareLink.href = `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`;
  shareLink.target = '_blank';
  shareLink.rel = 'noopener noreferrer';
  shareLink.textContent = '𝕏 でシェア';
  container.appendChild(shareLink);

  // 支払い内訳
  if (result.payment) {
    const payCard = document.createElement('div');
    payCard.className = 'result-payment';
    payCard.innerHTML = '<h3>支払い内訳</h3>';
    const p = result.payment;
    if (p.ron !== undefined) {
      payCard.innerHTML += `<div class="payment-row"><span>放銃者</span><span class="payment-amount">${p.ron.toLocaleString()}点</span></div>`;
    }
    if (p.allChild !== undefined) {
      payCard.innerHTML += `<div class="payment-row"><span>各自（ツモ）</span><span class="payment-amount">${p.allChild.toLocaleString()}点</span></div>`;
    } else if (p.dealer !== undefined && p.child !== undefined) {
      payCard.innerHTML += `<div class="payment-row"><span>親（ツモ）</span><span class="payment-amount">${p.dealer.toLocaleString()}点</span></div>`;
      payCard.innerHTML += `<div class="payment-row"><span>子（ツモ）</span><span class="payment-amount">${p.child.toLocaleString()}点</span></div>`;
    }
    container.appendChild(payCard);
  }

  // 役一覧
  const yakuCard = document.createElement('div');
  yakuCard.className = 'yaku-list';
  yakuCard.innerHTML = '<h3>成立役</h3>';
  result.yakuList.forEach(y => {
    const item = document.createElement('div');
    item.className = 'yaku-item';
    item.innerHTML = `<span class="yaku-name">${y.name}</span><span class="yaku-han">${y.isYakuman ? '役満' : y.han + '翻'}</span>`;
    const detail = document.createElement('div');
    detail.className = 'yaku-detail';
    detail.textContent = YAKU_DESC[y.key] || '';
    item.addEventListener('click', () => detail.classList.toggle('open'));
    item.appendChild(detail);
    yakuCard.appendChild(item);
  });
  if (result.doraCount > 0) {
    yakuCard.innerHTML += `<div class="payment-row"><span>ドラ合計</span><span class="yaku-han">${result.doraCount}翻</span></div>`;
  }
  container.appendChild(yakuCard);

  // 符内訳
  if (!result.isYakuman && result.fuBreakdown && result.fuBreakdown.length > 0) {
    const fuCard = document.createElement('div');
    fuCard.className = 'fu-breakdown';
    let open = false;
    const header = document.createElement('h3');
    header.innerHTML = '符内訳 <span style="color:var(--text-muted);font-size:11px;">▼ タップで展開</span>';
    header.addEventListener('click', () => {
      open = !open;
      fuBody.style.display = open ? 'block' : 'none';
    });
    fuCard.appendChild(header);
    const fuBody = document.createElement('div');
    fuBody.style.display = 'none';
    result.fuBreakdown.forEach(b => {
      fuBody.innerHTML += `<div class="fu-row"><span>${b.label}</span><span class="fu-amount">${b.fu}符</span></div>`;
    });
    fuBody.innerHTML += `<div class="fu-row" style="font-weight:bold"><span>合計（切り上げ）</span><span class="fu-amount">${result.fu}符</span></div>`;
    fuCard.appendChild(fuBody);
    container.appendChild(fuCard);
  }
}

// ---- イベントバインド ----
function init() {
  // 手牌入力画面
  renderHandInput();

  document.getElementById('to-questions-btn').addEventListener('click', startQuestions);

  // インラインパレットのスーツタブ
  document.querySelectorAll('.inline-suit-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      inlineSuit = btn.dataset.isuit;
      document.querySelectorAll('.inline-suit-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.isuit === inlineSuit));
      renderInlinePalette();
    });
  });

  // 牌ピッカー（ドラ・鳴き用モーダル）
  document.getElementById('picker-close').addEventListener('click', closePicker);
  document.getElementById('tile-picker-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('tile-picker-overlay')) closePicker();
  });
  document.querySelectorAll('.suit-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      pickerSuit = btn.dataset.suit;
      document.querySelectorAll('.suit-tab').forEach(b => b.classList.toggle('active', b.dataset.suit === pickerSuit));
      renderPickerGrid();
    });
  });

  // 鳴きフォーム
  document.querySelectorAll('.meld-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      newMeldType = btn.dataset.type;
      newMeldTiles = [];
      renderMeldForm();
    });
  });
  document.getElementById('add-meld-btn').addEventListener('click', () => {
    const count = newMeldType === 'pon' ? 3 : newMeldType === 'chi' ? 3 : 4;
    const tiles = newMeldTiles.slice(0, count);
    if (tiles.filter(Boolean).length === count) {
      state.openMelds.push({ type: newMeldType, tiles });
      newMeldTiles = [];
      initMeldForm();
      renderHandInput();
    }
  });
  initMeldForm();

  // 質問フロー
  document.getElementById('q-back-btn').addEventListener('click', prevQuestion);
  document.getElementById('q-next-btn').addEventListener('click', nextQuestion);

  // Q2: ツモ/ロン
  document.querySelectorAll('[data-tsumo]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.isTsumo = btn.dataset.tsumo === 'true';
      document.querySelectorAll('[data-tsumo]').forEach(b => b.classList.toggle('selected', b.dataset.tsumo === btn.dataset.tsumo));
      updateNextBtn();
    });
  });

  // Q3: 親/子・自風・場風
  document.querySelectorAll('[data-dealer]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.isDealer = btn.dataset.dealer === 'true';
      document.querySelectorAll('[data-dealer]').forEach(b => b.classList.toggle('selected', b.dataset.dealer === btn.dataset.dealer));
      updateNextBtn();
    });
  });
  document.querySelectorAll('[data-seat]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.seatWind = btn.dataset.seat;
      document.querySelectorAll('[data-seat]').forEach(b => b.classList.toggle('selected', b.dataset.seat === btn.dataset.seat));
      updateNextBtn();
    });
  });
  document.querySelectorAll('[data-round]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.roundWind = btn.dataset.round;
      document.querySelectorAll('[data-round]').forEach(b => b.classList.toggle('selected', b.dataset.round === btn.dataset.round));
      updateNextBtn();
    });
  });

  // Q4: リーチ・一発
  document.querySelectorAll('[data-riichi]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.riichi = btn.dataset.riichi;
      document.querySelectorAll('[data-riichi]').forEach(b => b.classList.toggle('selected', b.dataset.riichi === btn.dataset.riichi));
      // 裏ドラ表示制御
      const uraSection = document.getElementById('ura-dora-section');
      if (uraSection) uraSection.style.display = state.riichi !== 'none' ? 'block' : 'none';
    });
  });
  document.querySelectorAll('[data-ippatsu]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.isIppatsu = btn.dataset.ippatsu === 'true';
      document.querySelectorAll('[data-ippatsu]').forEach(b => b.classList.toggle('selected', b.dataset.ippatsu === btn.dataset.ippatsu));
    });
  });

  // Q6: 鳴き有無
  document.querySelectorAll('[data-has-melds]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.hasOpenMelds = btn.dataset.hasMelds === 'true';
      document.querySelectorAll('[data-has-melds]').forEach(b => b.classList.toggle('selected', b.dataset.hasMelds === btn.dataset.hasMelds));
      updateNextBtn();
    });
  });

  // Q7: 特殊状況
  document.querySelectorAll('[data-special]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.specialSituation = btn.dataset.special;
      document.querySelectorAll('[data-special]').forEach(b => b.classList.toggle('selected', b.dataset.special === btn.dataset.special));
    });
  });

  // 本場入力
  document.getElementById('honba-input')?.addEventListener('input', e => {
    state.honba = parseInt(e.target.value) || 0;
  });

  // 結果 → やり直し
  document.getElementById('restart-btn').addEventListener('click', () => {
    Object.assign(state, {
      closedTiles: Array(14).fill(null),
      openMelds: [],
      winTile: null, isTsumo: null, isDealer: null,
      seatWind: null, roundWind: null, riichi: 'none',
      isIppatsu: false, doraIndicators: [], uraDoraIndicators: [],
      hasOpenMelds: null, specialSituation: 'none', honba: 0,
    });
    inlineSuit = 'm';
    document.querySelectorAll('.inline-suit-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.isuit === 'm'));
    const honbaEl = document.getElementById('honba-input');
    if (honbaEl) honbaEl.value = 0;
    renderHandInput();
    showScreen('screen-input');
  });
}

document.addEventListener('DOMContentLoaded', init);

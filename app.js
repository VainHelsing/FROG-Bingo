'use strict';

// ── Default pool (50 positive ADHD terms) ──────────────────────────────────

const DEFAULT_TERMS = [
  '分心之后成功在五分钟内转回注意力',
  '喝完了一整杯水',
  '按时吃饭',
  '完成了一件拖延已久的小事',
  '记得按时吃药',
  '把手机放到另一个房间专注工作',
  '用番茄钟完成了一个25分钟',
  '发现自己走神后主动拉回来',
  '今天没有开启新坑',
  '整理了桌面或一个抽屉',
  '及时回复了一条重要消息',
  '做了五分钟拉伸或运动',
  '写下了一个困扰已久的想法',
  '成功拒绝了一个不重要的请求',
  '睡前把明天要用的东西准备好了',
  '感到过载时主动休息了',
  '把一件大事拆成了小步骤',
  '今天提前出门了',
  '做了一件两分钟就能做完的事',
  '洗了澡',
  '手机充上了电',
  '记录了今天的支出',
  '没有在睡前刷手机超过30分钟',
  '完成了一封邮件或消息的草稿',
  '专注了超过45分钟没有查手机',
  '把垃圾或脏衣服处理掉了',
  '今天说出了我需要帮助',
  '运动了10分钟以上',
  '做了一件一直想做但一直没做的小事',
  '思维风暴时写下了所有想法',
  '出门前检查了钥匙钱包手机',
  '设置了一个提醒而不是靠记忆',
  '完成了一件超出预期的事',
  '今天和朋友或家人联系了',
  '把重要的事写进了日历',
  '好好做饭或认真吃了一顿饭',
  '睡够了7小时',
  '关掉了不必要的通知',
  '精力充沛时抓住机会完成了重要事项',
  '把犯错的自责转化成了下次的计划',
  '今天没有过度道歉',
  '对自己的一个进步感到骄傲',
  '感到焦虑时用了一个应对方法',
  '把脑子里的事清空写成了清单',
  '今天准时开始了一件事',
  '完成一件事后给自己休息时间',
  '今天允许自己做了一件纯粹娱乐的事',
  '完成了昨天没做完的一件事',
  '花时间照顾了自己的身体或情绪',
  '今天对一件事保持了好奇心',
];

// ── State ──────────────────────────────────────────────────────────────────

function blankState() {
  return {
    today: null,
    history: [],
    totalBTB: 0,
    pools: {
      default: [...DEFAULT_TERMS],
      custom: [
        { name: '自定义池 1', terms: [], unlocked: false },
        { name: '自定义池 2', terms: [], unlocked: false },
        { name: '自定义池 3', terms: [], unlocked: false },
        { name: '自定义池 4', terms: [], unlocked: false },
      ],
    },
    poolAllocations: [0, 0, 0, 0],
    poolOrder: [0, 1, 2, 3],
  };
}

let S = blankState();
let activeScreen = 'setup';
let pendingCell = null;

function load() {
  try {
    const raw = localStorage.getItem('adhd-bingo');
    if (raw) S = Object.assign(blankState(), JSON.parse(raw));
  } catch (_) {}
}

let _writeTimer = null;
function save() {
  try { localStorage.setItem('adhd-bingo', JSON.stringify(S)); } catch (_) {}
  clearTimeout(_writeTimer);
  _writeTimer = setTimeout(writeToFile, 300);
}

// ── File System Access API (Chrome/Edge) ──────────────────────────────────

let fsFileHandle = null;

function openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('adhd-bingo-meta', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej(req.error);
  });
}

async function persistHandle(handle) {
  try {
    const db = await openIDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'save');
  } catch (_) {}
}

async function retrieveHandle() {
  try {
    const db = await openIDB();
    return await new Promise(res => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('save');
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
  } catch (_) { return null; }
}

async function writeToFile() {
  if (!fsFileHandle) return;
  try {
    const w = await fsFileHandle.createWritable();
    await w.write(JSON.stringify(S, null, 2));
    await w.close();
    flashSyncSaved();
  } catch (e) {
    if (e.name === 'NotAllowedError') {
      fsFileHandle = null;
      setSyncUI('disconnected');
    }
  }
}

let _flashTimer = null;
function flashSyncSaved() {
  const el = document.getElementById('sync-status');
  if (!el || el.dataset.status !== 'connected') return;
  el.textContent = '已同步 ✓';
  clearTimeout(_flashTimer);
  _flashTimer = setTimeout(() => { if (fsFileHandle) el.textContent = '已连接'; }, 1800);
}

function setSyncUI(status) {
  const statusEl = document.getElementById('sync-status');
  const btnEl = document.getElementById('connect-file-btn');
  const restoreBtn = document.getElementById('restore-file-btn');
  if (!statusEl) return;
  statusEl.dataset.status = status;
  const cfg = {
    connected:    { text: '已连接',       color: '#34C759',       btn: '更换文件', restore: true  },
    disconnected: { text: '未连接',       color: 'var(--muted)',  btn: '连接文件', restore: false },
    'needs-auth': { text: '需要重新授权', color: '#FF9500',       btn: '重新授权', restore: false },
  }[status] ?? { text: '未连接', color: 'var(--muted)', btn: '连接文件', restore: false };
  statusEl.textContent = cfg.text;
  statusEl.style.color = cfg.color;
  if (btnEl) btnEl.textContent = cfg.btn;
  if (restoreBtn) restoreBtn.classList.toggle('hidden', !cfg.restore);
}

async function connectFileSync() {
  if (!window.showSaveFilePicker) return;
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'adhd-bingo-data.json',
      types: [{ description: 'JSON 数据', accept: { 'application/json': ['.json'] } }],
    });
    fsFileHandle = handle;
    await persistHandle(handle);
    setSyncUI('connected');
    await writeToFile();
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('File sync error:', e);
  }
}

async function restoreFromFile() {
  if (!fsFileHandle) return;
  if (!confirm('将用文件中的数据覆盖当前数据，确定吗？')) return;
  try {
    const file = await fsFileHandle.getFile();
    const data = JSON.parse(await file.text());
    S = Object.assign(blankState(), data);
    S.pools.default = (S.pools.default || []).map(t =>
      typeof t === 'string' ? { text: t, weight: 2 } : t
    );
    try { localStorage.setItem('adhd-bingo', JSON.stringify(S)); } catch (_) {}
    archiveYesterday();
    if (S.today && S.today.date === todayStr()) {
      showScreen('bingo'); renderBingo();
    } else { showScreen('bingo'); }
    renderPools();
    renderHistory();
    const el = document.getElementById('sync-status');
    if (el) { el.textContent = '已从文件恢复 ✓'; el.style.color = '#34C759'; }
    setTimeout(() => setSyncUI('connected'), 2200);
  } catch (_) {
    alert('读取文件失败，文件可能已损坏。');
  }
}

async function initFileSync() {
  if (!window.showSaveFilePicker) return;
  const row = document.getElementById('file-sync-row');
  if (row) row.classList.remove('hidden');
  setSyncUI('disconnected');

  const handle = await retrieveHandle();
  if (!handle) return;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      fsFileHandle = handle;
      setSyncUI('connected');
      writeToFile();
    } else if (perm === 'prompt') {
      fsFileHandle = handle;
      setSyncUI('needs-auth');
    }
  } catch (_) {}
}

// ── Export / Import ────────────────────────────────────────────────────────

function exportJSON() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `adhd-bingo-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      S = Object.assign(blankState(), data);
      S.pools.default = (S.pools.default || []).map(t =>
        typeof t === 'string' ? { text: t, weight: 2 } : t
      );
      save();
      archiveYesterday();
      if (S.today && S.today.date === todayStr()) {
        showScreen('bingo'); renderBingo();
      } else { showScreen('bingo'); }
      renderPools();
      renderHistory();
    } catch (_) {
      alert('导入失败，文件格式不正确。');
    }
  };
  reader.readAsText(file);
}

// ── Date utilities (always local time, not UTC) ────────────────────────────

function localDateStr(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return localDateStr(new Date());
}

// ── General utilities ──────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function allLines(n) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const row = [], col = [];
    for (let j = 0; j < n; j++) { row.push(i * n + j); col.push(j * n + i); }
    lines.push(row, col);
  }
  const d1 = [], d2 = [];
  for (let i = 0; i < n; i++) { d1.push(i * n + i); d2.push(i * n + (n - 1 - i)); }
  lines.push(d1, d2);
  return lines;
}

function findBigTaskPositions(count, n) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const candidates = shuffle(Array.from({ length: n * n }, (_, i) => i));
    const chosen = [];
    for (const pos of candidates) {
      if (chosen.length === count) break;
      const r = Math.floor(pos / n), c = pos % n;
      const ok = chosen.every(p => {
        const pr = Math.floor(p / n), pc = p % n;
        return pr !== r && pc !== c && (pr - pc) !== (r - c) && (pr + pc) !== (r + c);
      });
      if (ok) chosen.push(pos);
    }
    if (chosen.length === count) return chosen;
  }
  return shuffle(Array.from({ length: n * n }, (_, i) => i)).slice(0, count);
}

// ── Pool sampling ──────────────────────────────────────────────────────────

function termText(t) { return typeof t === 'string' ? t : t.text; }

function sampleTerms(needed) {
  const used = new Set();
  const result = [];
  const order = S.poolOrder || [0, 1, 2, 3];
  const allocs = S.poolAllocations || [0, 0, 0, 0];

  for (const idx of order) {
    const pool = S.pools.custom[idx];
    if (!pool?.unlocked || !pool.terms.length) continue;
    const count = Math.min(allocs[idx] || 0, pool.terms.length);
    if (count === 0) continue;
    const shuffled = shuffle([...pool.terms]);
    let added = 0;
    for (const raw of shuffled) {
      if (added >= count) break;
      const t = termText(raw);
      if (!used.has(t)) { result.push(t); used.add(t); added++; }
    }
  }

  for (const raw of shuffle([...S.pools.default])) {
    if (result.length >= needed) break;
    const t = termText(raw);
    if (!used.has(t)) { result.push(t); used.add(t); }
  }

  if (result.length < needed) {
    for (const raw of S.pools.default) {
      if (result.length >= needed) break;
      result.push(termText(raw));
    }
  }

  return shuffle(result);
}

// ── Board generation ───────────────────────────────────────────────────────

function generateBoard(bigTasks, n) {
  const total = n * n;
  const btPositions = findBigTaskPositions(bigTasks.length, n);
  const btSet = new Set(btPositions);
  const randomTerms = sampleTerms(total - bigTasks.length);

  const board = Array.from({ length: total }, () => ({
    text: '', weight: 2, isBigTask: false, bigTaskIdx: null, completed: false,
  }));

  btPositions.forEach((pos, i) => {
    board[pos] = { text: bigTasks[i], weight: 3, isBigTask: true, bigTaskIdx: i, completed: false };
  });

  let ri = 0;
  for (let i = 0; i < total; i++) {
    if (!btSet.has(i)) {
      board[i] = { text: randomTerms[ri++] ?? '待添加', weight: 2, isBigTask: false, bigTaskIdx: null, completed: false };
    }
  }

  return { board, btPositions };
}

// ── Completion detection ───────────────────────────────────────────────────

function completedLines(board, n) {
  const done = new Set(board.map((c, i) => c.completed ? i : -1).filter(i => i >= 0));
  return allLines(n).filter(line => line.every(i => done.has(i)));
}

function detectTier(board, n, btPositions) {
  const lines = completedLines(board, n);
  const btSet = new Set(btPositions);

  const allBTDone = btPositions.every(i => board[i].completed);
  const anyLine = lines.length > 0;
  const btBingoLines = lines.filter(l => l.some(i => btSet.has(i)));
  const allBTHaveLine = btPositions.length > 0 &&
    btPositions.every(btp => lines.some(l => l.includes(btp)));

  if (allBTHaveLine) return 4;
  if (btBingoLines.length > 0) return 3;
  if (anyLine) return 2;
  if (allBTDone) return 1;
  return 0;
}

const TIER_LABELS = ['', '完成了今天的大事 ✓', '普通 Bingo！', '大事 Bingo！', '🎉 大事全 Bingo！'];

// ── Unlock logic ───────────────────────────────────────────────────────────

function checkUnlocks() {
  if (!S.today) return;
  const { board, n, btPositions } = S.today;

  const lines = completedLines(board, n);
  const btSet = new Set(btPositions);
  const btbCount = lines.filter(l => l.some(i => btSet.has(i))).length;

  const prevBTB = S.today.btbSnapshot ?? 0;
  const newBTB = Math.max(0, btbCount - prevBTB);
  if (newBTB > 0) {
    S.today.btbSnapshot = btbCount;
    S.totalBTB = (S.totalBTB ?? 0) + newBTB;
  }

  const anyBingo = lines.length > 0;
  let unlocked = false;

  if (anyBingo && !S.pools.custom[0].unlocked) {
    doUnlock(0); unlocked = true;
  }
  [1, 2, 3].forEach((threshold, i) => {
    if ((S.totalBTB ?? 0) >= threshold && !S.pools.custom[i + 1].unlocked) {
      doUnlock(i + 1); unlocked = true;
    }
  });

  if (newBTB > 0 || unlocked) save();
}

function doUnlock(customIdx) {
  S.pools.custom[customIdx].unlocked = true;
  if (!S.poolAllocations) S.poolAllocations = [0, 0, 0, 0];
  showBanner(`🎉 ${S.pools.custom[customIdx].name} 已解锁！去词条池添加专属词条`);
}

function showBanner(msg) {
  const el = document.getElementById('unlock-banner');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showBanner._timer);
  showBanner._timer = setTimeout(() => el.classList.add('hidden'), 4000);
}

// ── History persistence ────────────────────────────────────────────────────

function recordToday() {
  if (!S.today) return;
  const tier = detectTier(S.today.board, S.today.n, S.today.btPositions);
  const idx = S.history.findIndex(h => h.date === S.today.date);
  const rec = { date: S.today.date, tier };
  if (idx >= 0) S.history[idx] = rec; else S.history.push(rec);
  save();
}

function archiveYesterday() {
  if (S.today && S.today.date !== todayStr()) {
    recordToday();
    S.today = null;
    save();
  }
}

// ── Setup screen ───────────────────────────────────────────────────────────

function initSetup() {
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('add-task-btn').addEventListener('click', () => {
    const rows = document.querySelectorAll('#task-inputs .task-row');
    if (rows.length >= 3) return;
    const idx = rows.length;
    const row = document.createElement('div');
    row.className = 'task-row';
    row.innerHTML = `
      <span class="task-num">${idx + 1}</span>
      <input type="text" class="task-input" placeholder="第${idx + 1}件大事" maxlength="16">
      <button class="remove-task-btn" aria-label="删除">×</button>`;
    row.querySelector('.remove-task-btn').addEventListener('click', () => {
      row.remove();
      renumberTasks();
      document.getElementById('add-task-btn').style.display = '';
    });
    document.getElementById('task-inputs').appendChild(row);
    if (rows.length + 1 >= 3) document.getElementById('add-task-btn').style.display = 'none';
    row.querySelector('input').focus();
  });

  document.getElementById('generate-btn').addEventListener('click', () => {
    const tasks = Array.from(document.querySelectorAll('.task-input'))
      .map(i => i.value.trim()).filter(Boolean);
    if (tasks.length === 0) { alert('请至少输入一件大事'); return; }
    const n = parseInt(document.querySelector('.size-btn.active').dataset.size);
    const { board, btPositions } = generateBoard(tasks, n);
    S.today = { date: todayStr(), n, bigTasks: tasks, board, btPositions, btbSnapshot: 0 };
    save();
    showScreen('bingo');
    renderBingo();
  });
}

function renumberTasks() {
  document.querySelectorAll('#task-inputs .task-row').forEach((row, i) => {
    row.querySelector('.task-num').textContent = i + 1;
  });
}

// ── Bingo screen rendering ─────────────────────────────────────────────────

function renderBigTasks() {
  const { bigTasks, board, btPositions } = S.today;
  const el = document.getElementById('big-tasks-list');
  el.innerHTML = '';
  bigTasks.forEach((task, i) => {
    const pos = btPositions[i];
    const done = board[pos].completed;
    const item = document.createElement('div');
    item.className = 'bt-item' + (done ? ' done' : '');
    item.innerHTML = `<div class="bt-check">${done ? '✓' : ''}</div><span class="bt-text">${task}</span>`;
    item.addEventListener('click', () => {
      board[pos].completed = !board[pos].completed;
      recordToday();
      checkUnlocks();
      renderBingo();
    });
    el.appendChild(item);
  });
}

function renderBoard() {
  const { board, n } = S.today;
  const el = document.getElementById('bingo-board');
  el.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  el.style.gridTemplateRows = `repeat(${n}, 1fr)`;
  el.innerHTML = '';

  const cLines = completedLines(board, n);
  const bingoCells = new Set(cLines.flat());

  board.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'cell';
    if (cell.isBigTask) div.classList.add('big');
    if (cell.completed && bingoCells.has(i)) div.classList.add('bingo-hi');
    else if (cell.completed) div.classList.add('done');
    div.innerHTML = `<span class="cell-txt">${cell.text}</span>`;
    div.addEventListener('click', () => {
      S.today.board[i].completed = !S.today.board[i].completed;
      recordToday();
      checkUnlocks();
      renderBingo();
    });
    el.appendChild(div);
  });
}

function renderTier() {
  const { board, n, btPositions } = S.today;
  const tier = detectTier(board, n, btPositions);
  document.getElementById('tier-fill').style.width = `${(tier / 4) * 100}%`;
  document.getElementById('tier-label').textContent = TIER_LABELS[tier] ?? '';
}

function renderBingo() {
  if (!S.today) return;
  renderBigTasks();
  renderBoard();
  renderTier();
}

// ── History screen ─────────────────────────────────────────────────────────

const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

function renderHistory() {
  // Build date → tier map using local dates
  const histMap = {};
  S.history.forEach(h => { histMap[h.date] = h.tier; });
  if (S.today) {
    const t = detectTier(S.today.board, S.today.n, S.today.btPositions);
    histMap[S.today.date] = t;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Always show exactly 13 weeks (Mon–Sun), ending with the current week
  // Start = Monday of this week, minus 12 weeks
  const todayDow = today.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const toThisMonday = todayDow === 0 ? 6 : todayDow - 1;
  const start = new Date(today);
  start.setDate(start.getDate() - toThisMonday - 12 * 7);
  const numWeeks = 13;

  // Month labels
  const monthsEl = document.getElementById('heatmap-months');
  monthsEl.innerHTML = '';
  for (let w = 0; w < numWeeks; w++) {
    const col = document.createElement('div');
    col.className = 'hm-month-col';
    let label = '';
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day.getDate() === 1) {
        label = MONTH_NAMES[day.getMonth()];
        break;
      }
    }
    col.textContent = label;
    monthsEl.appendChild(col);
  }

  // Heatmap cells
  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';

  for (let w = 0; w < numWeeks; w++) {
    const week = document.createElement('div');
    week.className = 'hm-week';
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const ds = localDateStr(date);
      const tier = histMap[ds];
      const isFuture = date > today;

      const cell = document.createElement('div');
      let cls = 'hm-cell';
      if (tier != null) cls += ` t${tier}`;
      if (isFuture) cls += ' future';
      cell.className = cls;
      cell.title = ds + (tier != null ? ` · 等级 ${tier}` : '');
      week.appendChild(cell);
    }
    grid.appendChild(week);
  }

  // Streak: consecutive days with tier > 0 going back from today
  let streak = 0;
  const cur = new Date(today);
  while (true) {
    const ds = localDateStr(cur);
    if ((histMap[ds] ?? 0) > 0) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  document.getElementById('streak-num').textContent = streak;
}

// ── Mock history generator (dev/testing) ──────────────────────────────────

function clearMockHistory() {
  S.history = S.history.filter(h => !h._mock);
  save();
  renderHistory();
}

function generateMockHistory() {
  const probs = [0.12, 0.18, 0.28, 0.28, 0.14];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = localDateStr(d);
    // Leave a few random gaps (~20% chance of no entry)
    if (Math.random() < 0.2) continue;
    let tier = 0;
    let cumulative = 0;
    const rand = Math.random();
    for (let t = 0; t < 5; t++) {
      cumulative += probs[t];
      if (rand < cumulative) { tier = t; break; }
    }
    const existing = S.history.findIndex(h => h.date === ds);
    if (existing >= 0) S.history[existing] = { date: ds, tier, _mock: true };
    else S.history.push({ date: ds, tier, _mock: true });
  }
  save();
  renderHistory();
}

// ── Pools screen ───────────────────────────────────────────────────────────

function renderPools() {
  renderRatios();
  renderPoolCards();
}

function totalRandomCells() {
  if (!S.today) return 20;
  return S.today.n ** 2 - S.today.bigTasks.length;
}

function renderRatios() {
  const container = document.getElementById('ratio-rows');
  container.innerHTML = '';
  const cells = totalRandomCells();
  const order = S.poolOrder || [0, 1, 2, 3];
  const allocs = S.poolAllocations || [0, 0, 0, 0];

  const customTotal = order.reduce((s, i) =>
    s + (S.pools.custom[i]?.unlocked ? (allocs[i] || 0) : 0), 0);
  const defaultCount = Math.max(0, cells - customTotal);

  // Default pool row (read-only)
  const defRow = document.createElement('div');
  defRow.className = 'alloc-row';
  defRow.innerHTML = `
    <span class="alloc-name">默认池</span>
    <span class="alloc-auto" id="alloc-default">${defaultCount} 个</span>`;
  container.appendChild(defRow);

  // Custom pools in poolOrder
  order.forEach(idx => {
    const pool = S.pools.custom[idx];
    if (!pool?.unlocked) return;
    const alloc = allocs[idx] || 0;

    const row = document.createElement('div');
    row.className = 'alloc-row';
    row.innerHTML = `
      <span class="alloc-name">${pool.name}</span>
      <div class="alloc-ctrl">
        <button class="alloc-btn" id="aminus-${idx}">−</button>
        <span class="alloc-num" id="anum-${idx}">${alloc}</span>
        <button class="alloc-btn" id="aplus-${idx}">＋</button>
      </div>`;

    const minusBtn = row.querySelector(`#aminus-${idx}`);
    const plusBtn  = row.querySelector(`#aplus-${idx}`);

    // Compute max for this pool
    const otherAlloc = order.reduce((s, i) =>
      (S.pools.custom[i]?.unlocked && i !== idx) ? s + (allocs[i] || 0) : s, 0);
    const maxAlloc = Math.min(pool.terms.length, Math.max(0, cells - otherAlloc));

    if (alloc <= 0) minusBtn.disabled = true;
    if (alloc >= maxAlloc) plusBtn.disabled = true;

    minusBtn.addEventListener('click', () => {
      S.poolAllocations[idx] = Math.max(0, (S.poolAllocations[idx] || 0) - 1);
      save(); renderRatios();
    });
    plusBtn.addEventListener('click', () => {
      const cur = S.poolAllocations[idx] || 0;
      const otherNow = order.reduce((s, i) =>
        (S.pools.custom[i]?.unlocked && i !== idx) ? s + (S.poolAllocations[i] || 0) : s, 0);
      const max = Math.min(pool.terms.length, Math.max(0, cells - otherNow));
      if (cur < max) { S.poolAllocations[idx] = cur + 1; save(); renderRatios(); }
    });

    container.appendChild(row);
  });
}

// ── Pool cards with drag-and-drop reordering ───────────────────────────────

let _drag = null;

function initPoolDrag() {
  document.addEventListener('pointermove', onPoolDragMove, { passive: false });
  document.addEventListener('pointerup', onPoolDragEnd);
  document.addEventListener('pointercancel', onPoolDragEnd);
}

function onPoolDragStart(e, card, ci) {
  e.preventDefault();
  const rect = card.getBoundingClientRect();
  _drag = {
    ci, card,
    startY: e.clientY,
    cardMidY: rect.top + rect.height / 2,
    cardH: rect.height,
    target: null,
  };
  card.classList.add('dragging');
}

function onPoolDragMove(e) {
  if (!_drag) return;
  e.preventDefault();

  const dy = e.clientY - _drag.startY;
  _drag.card.style.transform = `translateY(${dy}px)`;

  // Highlight the card we're hovering over
  const cards = [...document.querySelectorAll('#pools-list .pool-card[data-ci]')]
    .filter(c => c !== _drag.card);

  let target = null;
  const dragMidY = _drag.cardMidY + dy;

  cards.forEach(c => {
    c.classList.remove('drag-over');
    const r = c.getBoundingClientRect();
    if (dragMidY >= r.top && dragMidY <= r.bottom) target = c;
  });

  if (target) target.classList.add('drag-over');
  _drag.target = target;
}

function onPoolDragEnd() {
  if (!_drag) return;
  const { ci, card, target } = _drag;

  card.style.transform = '';
  card.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));

  if (target) {
    const targetCI = parseInt(target.dataset.ci);
    const order = S.poolOrder;
    const fromPos = order.indexOf(ci);
    const toPos = order.indexOf(targetCI);
    if (fromPos !== toPos) {
      order.splice(fromPos, 1);
      order.splice(toPos, 0, ci);
      save();
      renderPools();
    }
  }

  _drag = null;
}

function renderPoolCards() {
  const container = document.getElementById('pools-list');
  container.innerHTML = '';

  // Default pool first (always, read-only)
  buildPoolCard(container, {
    id: 'p0', title: '默认词条池', terms: S.pools.default,
    locked: false, readonly: true,
  });

  // Custom pools in poolOrder sequence
  (S.poolOrder || [0, 1, 2, 3]).forEach(idx => {
    const pool = S.pools.custom[idx];
    buildPoolCard(container, {
      id: `p${idx + 1}`, title: pool.name, terms: pool.terms,
      locked: !pool.unlocked, readonly: false, customIdx: idx,
    });
  });
}

function buildPoolCard(container, { id, title, terms, locked, readonly, customIdx }) {
  const card = document.createElement('div');
  card.className = 'pool-card';
  if (customIdx !== undefined) card.dataset.ci = customIdx;

  const badge = locked
    ? '<span class="pool-badge locked">🔒 未解锁</span>'
    : `<span class="pool-badge">${terms.length}/50</span>`;

  const editBtn = (!locked && !readonly)
    ? `<button class="icon-btn pool-edit-btn" aria-label="编辑" style="width:30px;height:30px;flex-shrink:0;">
         <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
           <path d="M10 1.5L12.5 4L4.5 12H2V9.5L10 1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
           <path d="M8.5 3L11 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
         </svg>
       </button>`
    : '';

  // Drag handle for custom pools (replaces ↑↓ buttons)
  const dragHandle = (customIdx !== undefined)
    ? `<span class="drag-handle" aria-label="拖动排序">⠿</span>`
    : '';

  card.innerHTML = `
    <div class="pool-head" id="ph-${id}">
      <div class="pool-head-left">${title}${badge}</div>
      <div class="pool-head-right">
        ${dragHandle}
        ${editBtn}
        <span class="pool-chevron" id="chev-${id}">▼</span>
      </div>
    </div>
    <div class="pool-body" id="pb-${id}"></div>`;

  const head = card.querySelector(`#ph-${id}`);
  const body = card.querySelector(`#pb-${id}`);
  const chev = card.querySelector(`#chev-${id}`);

  if (!locked && !readonly) {
    card.querySelector('.pool-edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      enterPoolEdit(customIdx);
    });
  }

  // Drag handle
  const handle = card.querySelector('.drag-handle');
  if (handle) {
    handle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      onPoolDragStart(e, card, customIdx);
    });
  }

  head.addEventListener('click', () => {
    body.classList.toggle('open');
    chev.classList.toggle('open');
    if (body.classList.contains('open')) populatePoolBody(body, { locked, readonly, terms, customIdx, id });
  });

  container.appendChild(card);
}

function populatePoolBody(body, { locked, readonly, terms, customIdx }) {
  body.innerHTML = '';

  if (locked) {
    const msg = customIdx === 0
      ? '完成第一次 Bingo 即可解锁'
      : `累计完成 ${customIdx} 次大事 Bingo 即可解锁`;
    body.innerHTML = `<div class="pool-locked-msg">${msg}</div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'terms-wrap';
  const preview = terms.slice(0, 12);
  preview.forEach(raw => {
    const chip = document.createElement('div');
    chip.className = 'term-chip';
    chip.textContent = termText(raw);
    wrap.appendChild(chip);
  });
  if (terms.length > 12) {
    const more = document.createElement('div');
    more.className = 'term-chip';
    more.style.color = 'var(--muted)';
    more.textContent = `+${terms.length - 12} 个`;
    wrap.appendChild(more);
  }
  body.appendChild(wrap);

  if (!readonly) {
    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px;color:var(--muted);margin-top:8px;';
    hint.textContent = '点击「编辑」按钮进入完整编辑页面';
    body.appendChild(hint);
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────

function updateBoardPlaceholder() {
  const hasBoard = !!(S.today && S.today.date === todayStr());
  document.getElementById('board-wrap').classList.toggle('hidden', !hasBoard);
  document.getElementById('board-empty').classList.toggle('hidden', hasBoard);
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const noBoard = !S.today || S.today.date !== todayStr();
  const boardPanel = document.getElementById('board-panel');

  if (name === 'bingo' && noBoard) {
    document.getElementById('screen-setup').classList.add('active');
    boardPanel.classList.add('hidden');
  } else if (name === 'bingo') {
    document.getElementById('screen-bingo').classList.add('active');
    boardPanel.classList.remove('hidden');
  } else {
    document.getElementById(`screen-${name}`).classList.add('active');
    // Mobile: hide board. Desktop: CSS forces display:flex, board-empty shows.
    boardPanel.classList.add('hidden');
  }

  updateBoardPlaceholder();
  document.querySelector(`.nav-btn[data-screen="${name}"]`)?.classList.add('active');
  activeScreen = name;
}

function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.screen;
      showScreen(s);
      if (s === 'history') renderHistory();
      if (s === 'pools') renderPools();
    });
  });
}

// ── Pool Edit + Physics ────────────────────────────────────────────────────

let editingPoolIdx = null;
let physicsEngine = null;
let physicsRafId = null;
let physicsTermBodies = [];
let editingTermBody = null;
let addWeight = 1;

function enterPoolEdit(customIdx) {
  editingPoolIdx = customIdx;
  addWeight = 1;
  document.getElementById('add-w-val').textContent = '1';

  const pool = S.pools.custom[customIdx];
  document.getElementById('edit-pool-name').value = pool.name;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-pool-edit').classList.add('active');
  document.getElementById('board-panel').classList.add('hidden');
  document.getElementById('bottom-nav').style.display = 'none';

  requestAnimationFrame(() => requestAnimationFrame(() => setupPhysics()));
}

function exitPoolEdit() {
  const name = document.getElementById('edit-pool-name').value.trim();
  if (name) S.pools.custom[editingPoolIdx].name = name;
  save();

  teardownPhysics();
  document.getElementById('bottom-nav').style.display = '';
  editingPoolIdx = null;
  showScreen('pools');
  renderPools();
}

function teardownPhysics() {
  if (physicsRafId) { cancelAnimationFrame(physicsRafId); physicsRafId = null; }
  if (physicsEngine) { Matter.Engine.clear(physicsEngine); physicsEngine = null; }
  physicsTermBodies = [];
  const canvas = document.getElementById('physics-canvas');
  canvas.removeEventListener('click', onCanvasClick);
}

function setupPhysics() {
  teardownPhysics();

  const container = document.getElementById('physics-container');
  const W = container.offsetWidth;
  const H = container.offsetHeight;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.getElementById('physics-canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  physicsEngine = Matter.Engine.create({ gravity: { y: 1.5 } });
  const world = physicsEngine.world;

  const thick = 60;
  Matter.Composite.add(world, [
    Matter.Bodies.rectangle(W / 2, H + thick / 2, W + 100, thick, { isStatic: true }),
    Matter.Bodies.rectangle(-thick / 2, H / 2, thick, H * 3, { isStatic: true }),
    Matter.Bodies.rectangle(W + thick / 2, H / 2, thick, H * 3, { isStatic: true }),
  ]);

  addBodies(S.pools.custom[editingPoolIdx].terms, W);

  let last = performance.now();
  function loop(now) {
    const delta = Math.min(now - last, 48);
    last = now;
    Matter.Engine.update(physicsEngine, delta);
    drawFrame(ctx, W, H);
    physicsRafId = requestAnimationFrame(loop);
  }
  physicsRafId = requestAnimationFrame(loop);

  canvas.addEventListener('click', onCanvasClick);
}

const WEIGHT_RADIUS = { 1: 24, 2: 36, 3: 48 };
function calcRadius(weight) {
  return WEIGHT_RADIUS[Math.min(Math.max(weight, 1), 3)] ?? 24;
}

const CIRCLE_PALETTE = [
  '#6B8CAE', '#7FAE8A', '#AE9B6B', '#9B7BAE',
  '#AE7B7B', '#6BAEAD', '#8AAE7F', '#AE8A6B',
  '#7B8BAE', '#AE6B8C', '#8BAE6B', '#6B9BAE',
];
function randomCircleColor() {
  return CIRCLE_PALETTE[Math.floor(Math.random() * CIRCLE_PALETTE.length)];
}

function addBodies(terms, W) {
  terms.forEach((term, idx) => {
    const r = calcRadius(term.weight);
    const x = r + Math.random() * Math.max(0, W - 2 * r);
    const body = Matter.Bodies.circle(x, -r - Math.random() * 120, r, {
      restitution: 0.3, friction: 0.55, frictionAir: 0.018, label: term.text,
    });
    body.termIdx = idx;
    body.termColor = randomCircleColor();
    Matter.Composite.add(physicsEngine.world, body);
    physicsTermBodies.push({ body, termIdx: idx });
  });
}

function drawFrame(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const bodies = Matter.Composite.allBodies(physicsEngine.world).filter(b => !b.isStatic);

  bodies.forEach(body => {
    const { x, y } = body.position;
    const r = body.circleRadius;
    if (y - r > H + 60) return;

    const color = body.termColor || '#8E8E93';

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.14)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    const fs = Math.max(8, Math.min(12, r * 0.33));
    ctx.font = `600 ${fs}px -apple-system,'PingFang SC',sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, body.label, r * 1.55, 3);
    const lh = fs * 1.38;
    const sy = y - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, sy + i * lh));
  });
}

function wrapText(ctx, text, maxW, maxLines) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      if (lines.length >= maxLines) return lines;
      line = ch;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function onCanvasClick(e) {
  const canvas = document.getElementById('physics-canvas');
  const rect = canvas.getBoundingClientRect();
  const W = parseFloat(canvas.style.width);
  const H = parseFloat(canvas.style.height);
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top) * (H / rect.height);
  hitTest(mx, my);
}

function hitTest(mx, my) {
  const bodies = Matter.Composite.allBodies(physicsEngine.world).filter(b => !b.isStatic);
  for (const body of bodies) {
    const dx = mx - body.position.x, dy = my - body.position.y;
    if (Math.sqrt(dx * dx + dy * dy) <= body.circleRadius) {
      openTermEditSheet(body);
      return;
    }
  }
}

function openTermEditSheet(body) {
  editingTermBody = body;
  const term = S.pools.custom[editingPoolIdx].terms[body.termIdx];
  document.getElementById('term-edit-label').value = term.text;
  document.getElementById('weight-val').textContent = term.weight;
  document.getElementById('term-edit-sheet').classList.remove('hidden');
}

function closeTermEditSheet() {
  document.getElementById('term-edit-sheet').classList.add('hidden');
  editingTermBody = null;
}

function addOneTerm(term, termIdx, W) {
  if (!physicsEngine) return;
  const r = calcRadius(term.weight);
  const x = r + Math.random() * Math.max(0, W - 2 * r);
  const body = Matter.Bodies.circle(x, -r, r, {
    restitution: 0.3, friction: 0.55, frictionAir: 0.018, label: term.text,
  });
  body.termIdx = termIdx;
  body.termColor = randomCircleColor();
  Matter.Composite.add(physicsEngine.world, body);
  physicsTermBodies.push({ body, termIdx });
}

function initPoolEdit() {
  document.getElementById('edit-back-btn').addEventListener('click', exitPoolEdit);

  document.getElementById('edit-pool-name').addEventListener('blur', () => {
    const name = document.getElementById('edit-pool-name').value.trim();
    if (name) S.pools.custom[editingPoolIdx].name = name;
  });

  document.getElementById('add-w-minus').addEventListener('click', () => {
    if (addWeight > 1) { addWeight--; document.getElementById('add-w-val').textContent = addWeight; }
  });
  document.getElementById('add-w-plus').addEventListener('click', () => {
    if (addWeight < 3) { addWeight++; document.getElementById('add-w-val').textContent = addWeight; }
  });

  document.getElementById('edit-add-btn').addEventListener('click', () => {
    const input = document.getElementById('edit-term-input');
    const text = input.value.trim();
    if (!text) return;
    const pool = S.pools.custom[editingPoolIdx];
    if (pool.terms.length >= 50) return;
    pool.terms.push({ text, weight: addWeight });
    save();
    const newIdx = pool.terms.length - 1;
    const container = document.getElementById('physics-container');
    addOneTerm(pool.terms[newIdx], newIdx, container.offsetWidth);
    input.value = '';
    addWeight = 1;
    document.getElementById('add-w-val').textContent = '1';
  });
  document.getElementById('edit-term-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('edit-add-btn').click();
  });

  document.getElementById('weight-minus').addEventListener('click', () => {
    const v = parseInt(document.getElementById('weight-val').textContent);
    if (v > 1) document.getElementById('weight-val').textContent = v - 1;
  });
  document.getElementById('weight-plus').addEventListener('click', () => {
    const v = parseInt(document.getElementById('weight-val').textContent);
    if (v < 3) document.getElementById('weight-val').textContent = v + 1;
  });
  document.getElementById('term-save-btn').addEventListener('click', () => {
    if (!editingTermBody) return;
    const w = parseInt(document.getElementById('weight-val').textContent);
    const newText = document.getElementById('term-edit-label').value.trim();
    const termIdx = editingTermBody.termIdx;
    const term = S.pools.custom[editingPoolIdx].terms[termIdx];
    term.weight = w;
    if (newText) term.text = newText;
    save();
    const oldBody = editingTermBody;
    const { x, y } = oldBody.position;
    const vel = oldBody.velocity;
    Matter.Composite.remove(physicsEngine.world, oldBody);
    const r = calcRadius(w);
    const newBody = Matter.Bodies.circle(x, y, r, {
      restitution: 0.3, friction: 0.55, frictionAir: 0.018,
      label: term.text,
    });
    newBody.termIdx = termIdx;
    newBody.termColor = oldBody.termColor || randomCircleColor();
    Matter.Body.setVelocity(newBody, vel);
    Matter.Composite.add(physicsEngine.world, newBody);
    const tbIdx = physicsTermBodies.findIndex(tb => tb.body === oldBody);
    if (tbIdx >= 0) physicsTermBodies[tbIdx] = { body: newBody, termIdx };
    closeTermEditSheet();
  });

  document.getElementById('term-delete-btn').addEventListener('click', () => {
    if (!editingTermBody) return;
    const termIdx = editingTermBody.termIdx;
    Matter.Composite.remove(physicsEngine.world, editingTermBody);
    physicsTermBodies = physicsTermBodies.filter(tb => tb.body !== editingTermBody);
    physicsTermBodies.forEach(tb => {
      if (tb.body.termIdx > termIdx) {
        tb.body.termIdx--;
        tb.termIdx = tb.body.termIdx;
      }
    });
    S.pools.custom[editingPoolIdx].terms.splice(termIdx, 1);
    save();
    closeTermEditSheet();
  });
  document.querySelector('#term-edit-sheet .modal-overlay').addEventListener('click', closeTermEditSheet);
}

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  load();
  archiveYesterday();
  initSetup();
  initNav();
  initPoolEdit();
  initPoolDrag();

  document.getElementById('mock-data-btn').addEventListener('click', generateMockHistory);
  document.getElementById('clear-mock-btn').addEventListener('click', clearMockHistory);

  // Data management
  document.getElementById('connect-file-btn').addEventListener('click', async () => {
    const status = document.getElementById('sync-status').dataset.status;
    if (status === 'needs-auth' && fsFileHandle) {
      try {
        const perm = await fsFileHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') { setSyncUI('connected'); writeToFile(); }
        else { fsFileHandle = null; connectFileSync(); }
      } catch (_) { connectFileSync(); }
    } else {
      connectFileSync();
    }
  });
  document.getElementById('restore-file-btn').addEventListener('click', restoreFromFile);
  document.getElementById('export-btn').addEventListener('click', exportJSON);
  document.getElementById('import-input').addEventListener('change', e => {
    if (e.target.files[0]) { importJSON(e.target.files[0]); e.target.value = ''; }
  });

  initFileSync();

  if (S.today && S.today.date === todayStr()) {
    showScreen('bingo');
    renderBingo();
  } else {
    showScreen('bingo');
  }
});

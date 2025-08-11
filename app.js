
/* Local-first prototype + Rewards (final fix) */
const LS_KEY = 'psq_data_v2';
const BASE_POINTS = 5;
const ACCURACY_BONUS = 3;
const REPORT_COOLDOWN_SEC = 45;
const POINTS_DAILY_CAP = 40;

const seedVenues = [
  { id: 'v1', name: 'Pickler Universe (Dallas)', address: 'Dallas, TX', courts: 12, createdAt: Date.now() },
  { id: 'v2', name: 'Brookhaven Park', address: 'Farmers Branch, TX', courts: 8, createdAt: Date.now() },
  { id: 'v3', name: 'The Grove Pickleball', address: 'Dallas, TX', courts: 6, createdAt: Date.now() }
];

const state = loadState();

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return {
    venues: seedVenues,
    reports: [],
    user: { id: uuid(), lastSubmittedAt: 0 },
    rewards: {
      points: 0,
      lastGain: 0,
      streakDays: 0,
      verifiedDays: [],
      totalReports30d: 0,
      accuracyPct: null,
      badges: [],
      pending: []
    }
  };
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

function $(sel){ return document.querySelector(sel); }
function el(tag, props={}, ...kids){
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  return e;
}
function uuid(){ return 'u'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function fromNow(ts){
  const s = Math.floor((Date.now()-ts)/1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s/60); if (m < 60) return m + "m ago";
  const h = Math.floor(m/60); return h + "h ago";
}
function ymd(ts){ const d = new Date(ts); return d.toISOString().slice(0,10); }
function todayYMD(){ return ymd(Date.now()); }

const venueSelect = $('#venueSelect');
const addVenueBtn = $('#addVenueBtn');
const newVenueForm = $('#newVenueForm');
const venueName = $('#venueName');
const venueAddress = $('#venueAddress');
const venueCourts = $('#venueCourts');
const saveVenueBtn = $('#saveVenueBtn');

const decBtn = $('#decBtn');
const incBtn = $('#incBtn');
const stackInput = $('#stackInput');
const stackType = $('#stackType');
const noteInput = $('#noteInput');
const submitReportBtn = $('#submitReportBtn');
const cooldown = $('#cooldown');
const cooldownTime = $('#cooldownTime');

const consensusEl = $('#consensus');
const confidenceEl = $('#confidence');
const lastUpdateEl = $('#lastUpdate');
const recentReportsEl = $('#recentReports');
const avgGameMinEl = $('#avgGameMin');
const ppcEl = $('#ppc');
const waitTextEl = $('#waitText');

const exportBtn = $('#exportBtn');
const clearBtn = $('#clearBtn');
const exportBox = $('#exportBox');

const rewardStrip = $('#rewardStrip');
const streakText = $('#streakText');
const accuracyText = $('#accuracyText');
const lastGainText = $('#lastGainText');
const pointsTotal = $('#pointsTotal');
const toast = $('#toast');

const rewardsModal = $('#rewardsModal');
const openRewardsBtn = $('#openRewardsBtn');
const closeRewardsBtn = $('#closeRewardsBtn');
const pointsBig = $('#pointsBig');
const levelBadge = $('#levelBadge');
const nextLevelName = $('#nextLevelName');
const progressFill = $('#progressFill');
const streakBig = $('#streakBig');
const accuracyBig = $('#accuracyBig');
const reportsMonth = $('#reportsMonth');
const badgesGrid = $('#badgesGrid');

openRewardsBtn.addEventListener('click', ()=>{
  updateRewardsUI();
  show(rewardsModal);
});

function closeOverlay(){ hide(rewardsModal); }
document.addEventListener('click', (e)=>{
  if (e.target.id === 'closeRewardsBtn' || e.target.classList.contains('overlay-close')) closeOverlay();
  if (e.target === rewardsModal) closeOverlay(); // click backdrop
});
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') closeOverlay();
});

function initVenues(){
  venueSelect.innerHTML = '';
  state.venues.forEach(v => {
    const opt = el('option', { value: v.id, textContent: `${v.name} ${v.address? '· '+v.address:''}` });
    venueSelect.appendChild(opt);
  });
  const qp = new URLSearchParams(location.search);
  const vid = qp.get('venue');
  if (vid && state.venues.find(v=>v.id===vid)) venueSelect.value = vid;
}
initVenues();
render();

addVenueBtn.addEventListener('click', ()=>{
  newVenueForm.classList.toggle('hidden');
});
saveVenueBtn.addEventListener('click', ()=>{
  const name = venueName.value.trim();
  const courts = parseInt(venueCourts.value,10) || 4;
  if (!name) return alert('Venue name required');
  const v = { id: uuid(), name, address: venueAddress.value.trim(), courts, createdAt: Date.now() };
  state.venues.push(v);
  saveState();
  initVenues();
  venueSelect.value = v.id;
  newVenueForm.classList.add('hidden');
  venueName.value = venueAddress.value = venueCourts.value = '';
  render();
});

decBtn.addEventListener('click', ()=>{
  stackInput.value = Math.max(0, (parseInt(stackInput.value,10)||0) - 1);
});
incBtn.addEventListener('click', ()=>{
  stackInput.value = (parseInt(stackInput.value,10)||0) + 1;
});

function secondsRemaining(){
  const since = (Date.now() - (state.user.lastSubmittedAt||0))/1000;
  const cooldownSec = REPORT_COOLDOWN_SEC;
  return Math.max(0, Math.ceil(cooldownSec - since));
}
function tickCooldown(){
  const rem = secondsRemaining();
  if (rem > 0){
    cooldown.classList.remove('hidden');
    cooldownTime.textContent = rem;
    submitReportBtn.disabled = true;
  } else {
    cooldown.classList.add('hidden');
    submitReportBtn.disabled = false;
  }
}
setInterval(tickCooldown, 500);
tickCooldown();

submitReportBtn.addEventListener('click', ()=>{
  const venueId = venueSelect.value;
  const count = Math.max(0, parseInt(stackInput.value,10)||0);
  const type = stackType.value;
  const note = noteInput.value.trim();
  if (!venueId) return alert('Pick a venue');
  const rpt = {
    id: uuid(),
    venueId, userId: state.user.id,
    count, type, note,
    createdAt: Date.now(),
    ua: navigator.userAgent.slice(0,120)
  };
  state.reports.push(rpt);
  state.user.lastSubmittedAt = Date.now();

  const gained = grantBasePoints(venueId);
  if (gained > 0) showToast("+"+gained+" PaddlePoints!");
  state.rewards.lastGain = gained;

  state.rewards.pending.push({ reportId: rpt.id, venueId, count, createdAt: rpt.createdAt, evaluated:false });

  saveState();
  noteInput.value='';
  render();
});

venueSelect.addEventListener('change', render);
avgGameMinEl.addEventListener('input', render);
ppcEl.addEventListener('input', render);

exportBtn.addEventListener('click', ()=>{
  exportBox.value = JSON.stringify(state, null, 2);
});
clearBtn.addEventListener('click', ()=>{
  if (confirm('This will clear local data for this prototype. Continue?')){
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
});

function grantBasePoints(venueId){
  const today = todayYMD();
  const todayReports = state.reports.filter(r=>r.venueId===venueId && ymd(r.createdAt)===today && r.userId===state.user.id);
  const already = todayReports.length > 0 ? Math.min(POINTS_DAILY_CAP, (todayReports.length-1)*BASE_POINTS) : 0;
  if (already >= POINTS_DAILY_CAP) return 0;
  const toGrant = Math.min(BASE_POINTS, POINTS_DAILY_CAP - already);
  state.rewards.points += toGrant;
  return toGrant;
}

function evaluatePendingAccuracy(){
  let gaveBonus = 0;
  const now = Date.now();
  state.rewards.pending.forEach(p => {
    if (p.evaluated) return;
    if (now - p.createdAt > 60*60*1000) p.evaluated = true;
    const cons = computeConsensus(p.venueId);
    if (cons.value == null) return;
    if (Math.abs((cons.value||0) - p.count) <= 1){
      state.rewards.points += ACCURACY_BONUS;
      state.rewards.lastGain = ACCURACY_BONUS;
      gaveBonus += ACCURACY_BONUS;
      p.evaluated = true;
      const d = ymd(p.createdAt);
      if (!state.rewards.verifiedDays.includes(d)){
        state.rewards.verifiedDays.push(d);
      }
    }
  });
  state.rewards.pending = state.rewards.pending.filter(p=>!p.evaluated && (now - p.createdAt) < 60*60*1000);
  if (gaveBonus > 0) showToast("+"+gaveBonus+" Accuracy Bonus!");
}

function computeStreakDays(){
  if (!state.rewards.verifiedDays.length) return 0;
  const days = new Set(state.rewards.verifiedDays);
  let streak = 0;
  let d = new Date();
  for (;;){
    const key = d.toISOString().slice(0,10);
    if (days.has(key)){ streak += 1; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}
function computeAccuracy(){
  const cutoff = Date.now() - 30*24*60*60*1000;
  const myReports = state.reports.filter(r=>r.userId===state.user.id && r.createdAt>=cutoff && r.type==='paddles');
  if (myReports.length === 0) return null;
  let correct = 0;
  myReports.forEach(r=>{
    const cons = computeConsensus(r.venueId);
    if (cons.value==null) return;
    if (Math.abs(cons.value - r.count) <= 1) correct++;
  });
  return Math.round((correct / myReports.length) * 100);
}
function computeReports30d(){
  const cutoff = Date.now() - 30*24*60*60*1000;
  return state.reports.filter(r=>r.userId===state.user.id && r.createdAt>=cutoff).length;
}

function levelForPoints(pts){
  if (pts >= 3000) return 'Platinum';
  if (pts >= 2000) return 'Gold';
  if (pts >= 1000) return 'Silver';
  return 'Bronze';
}
function nextLevelInfo(pts){
  if (pts < 1000) return { name:'Silver', need: 1000-pts, pct: (pts/1000)*100 };
  if (pts < 2000) return { name:'Gold', need: 2000-pts, pct: ((pts-1000)/1000)*100 };
  if (pts < 3000) return { name:'Platinum', need: 3000-pts, pct: ((pts-2000)/1000)*100 };
  return { name: 'Max', need: 0, pct: 100 };
}

function badgeList(){
  const b = [];
  const streak = state.rewards.streakDays;
  const acc = state.rewards.accuracyPct||0;
  const reports30 = state.rewards.totalReports30d||0;
  b.push({ id:'streak7', label:'🔥 7-Day Streak', earned: streak>=7 });
  b.push({ id:'streak30', label:'🔥 30-Day Streak', earned: streak>=30 });
  b.push({ id:'acc95', label:'🎯 95% Accuracy', earned: acc>=95 && reports30>=20 });
  b.push({ id:'r50', label:'🏆 50 Reports', earned: reports30>=50 });
  b.push({ id:'first', label:'🎉 First Report', earned: state.reports.some(r=>r.userId===state.user.id) });
  return b;
}

function computeConsensus(venueId){
  const horizonMin = 60;
  const cutoff = Date.now() - horizonMin*60*1000;
  const reports = state.reports.filter(r=>r.venueId===venueId && r.createdAt>=cutoff && r.type==='paddles');
  if (reports.length === 0) return { value: null, confidence: 0, lastTs: null, reports: [] };

  const halfLifeMin = 15;
  const lambda = Math.log(2)/(halfLifeMin*60*1000);
  const weighted = reports.map(r=>{
    const age = Date.now()-r.createdAt;
    const w = Math.exp(-lambda*age);
    return { ...r, w };
  }).sort((a,b)=>a.count-b.count);

  const totalW = weighted.reduce((s,r)=>s+r.w,0);
  let cum = 0, median = weighted[0].count;
  for (const r of weighted){
    cum += r.w;
    if (cum >= totalW/2){ median = r.count; break; }
  }

  const uniqUsers = new Set(weighted.map(r=>r.userId)).size;
  const counts = weighted.map(r=>r.count).sort((a,b)=>a-b);
  const q1 = counts[Math.floor((counts.length-1)*0.25)];
  const q3 = counts[Math.floor((counts.length-1)*0.75)];
  const iqr = Math.max(0, q3 - q1);
  const spreadScore = Math.max(0, 1 - Math.min(1, iqr / Math.max(1, median||1)));
  const volumeScore = Math.min(1, uniqUsers / 6);
  const recencyScore = Math.min(1, weighted.reduce((s,r)=>s+r.w,0) / 3);

  const confidence = Math.round((0.5*spreadScore + 0.3*volumeScore + 0.2*recencyScore) * 100);
  const lastTs = Math.max(...reports.map(r=>r.createdAt));
  return { value: median, confidence, lastTs, reports };
}

function formatWait(consensus, venue){
  if (consensus.value == null) return "Not enough recent reports yet.";
  const stacks = consensus.value;
  const courts = Math.max(1, venue.courts || 4);
  const avgGameMin = Math.max(5, parseInt(avgGameMinEl.value,10)||12);
  const ppc = Math.max(2, parseInt(ppcEl.value,10)||4);
  const roundsNeeded = Math.ceil(stacks / courts);
  const estMin = roundsNeeded * avgGameMin;
  const note = stacks === 0 ? "No wait — jump in!" : `${stacks} stack${stacks===1?'':'s'} across ${courts} court${courts===1?'':'s'}.`;
  return `${note} Roughly ${estMin} min for a stack to play (assumes ~${avgGameMin} min games).`;
}

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function showToast(text){
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 1600);
}

function render(){
  const venueId = venueSelect.value || (state.venues[0]?.id);
  const venue = state.venues.find(v=>v.id===venueId);
  if (!venue) return;
  evaluatePendingAccuracy();
  const result = computeConsensus(venue.id);
  consensusEl.textContent = (result.value==null ? '–' : result.value);
  confidenceEl.textContent = result.confidence ? result.confidence + '%' : '–';
  lastUpdateEl.textContent = result.lastTs ? fromNow(result.lastTs) : '–';
  waitTextEl.textContent = formatWait(result, venue);
  recentReportsEl.innerHTML = '';
  const all = [...result.reports].sort((a,b)=>b.createdAt - a.createdAt).slice(0, 12);
  all.forEach(r=>{
    const row = el('div', { className: 'report' });
    const left = el('div', {}, el('b', {}, `${r.count}`), document.createTextNode(' stacks '), r.note? el('span', {}, `· ${r.note}`):'');
    const right = el('div', {}, el('small', {}, fromNow(r.createdAt)));
    row.appendChild(left); row.appendChild(right);
    recentReportsEl.appendChild(row);
  });
  state.rewards.streakDays = computeStreakDays();
  state.rewards.accuracyPct = computeAccuracy();
  state.rewards.totalReports30d = computeReports30d();
  pointsTotal.textContent = state.rewards.points;
  streakText.textContent = `🔥 ${state.rewards.streakDays}-Day Streak`;
  accuracyText.textContent = `🎯 ${state.rewards.accuracyPct==null?'—':state.rewards.accuracyPct+'%'} Accuracy`;
  lastGainText.textContent = `+${state.rewards.lastGain||0} pts`;
  show(rewardStrip);
  const ok = document.getElementById('jsOk');
  if (ok) ok.classList.remove('hidden');
  saveState();
}

function updateRewardsUI(){
  const pts = state.rewards.points;
  pointsBig.textContent = pts;
  const level = levelForPoints(pts);
  levelBadge.textContent = level;
  levelBadge.style.background = ({
    'Bronze':'#CD7F32',
    'Silver':'#C0C0C0',
    'Gold':'#FFD700',
    'Platinum':'#E5E4E2'
  })[level] || '#CD7F32';
  streakBig.textContent = state.rewards.streakDays || 0;
  accuracyBig.textContent = state.rewards.accuracyPct==null ? '—' : state.rewards.accuracyPct+'%';
  reportsMonth.textContent = state.rewards.totalReports30d || 0;
  const next = nextLevelInfo(pts);
  nextLevelName.textContent = next.name;
  progressFill.style.width = Math.max(0, Math.min(100, next.pct)).toFixed(0) + '%';
  badgesGrid.innerHTML = '';
  badgeList().forEach(b => {
    const div = el('div', { className: 'badge ' + (b.earned?'':'locked') }, b.label);
    badgesGrid.appendChild(div);
  });
}

setInterval(render, 5000);
render();

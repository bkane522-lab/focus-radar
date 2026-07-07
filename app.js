/* ===================== DATA MODEL ===================== */
const CATS = [
  { key:'travail',    label:'Travail',    icon:'💼', color:'#2fe0c8' },
  { key:'reseaux',    label:'Réseaux',    icon:'📱', color:'#d16bd6' },
  { key:'telephone',  label:'Téléphone',  icon:'📞', color:'#4d8cff' },
  { key:'pause',      label:'Pause',      icon:'☕', color:'#e8c76a' },
  { key:'deplacement',label:'Déplacement',icon:'🚗', color:'#8b93a7' },
  { key:'lecture',    label:'Lecture',    icon:'📖', color:'#8b5cf6' },
  { key:'creatif',    label:'Créatif',    icon:'💡', color:'#8b5cf6' },
];
const MOODS = [
  { key:'epuise',   label:'Épuisé',   icon:'😣' },
  { key:'fatigue',  label:'Fatigué',  icon:'😕' },
  { key:'neutre',   label:'Neutre',   icon:'😐' },
  { key:'bien',     label:'Bien',     icon:'🙂' },
  { key:'energise', label:'Énergisé', icon:'⭐' },
];
const DISTRACT_CATS = ['reseaux','telephone'];
const FOCUS_CATS = ['travail','admin','creatif','lecture'];

const STORE_KEY = 'focusradar_entries_v1';
const INSIGHT_KEY = 'focusradar_insight_v1';

function loadEntries(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }catch(e){ return []; }
}
function saveEntries(list){ localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
let entries = loadEntries();

function addEntry(e){
  entries.unshift({ id: Date.now(), ts: Date.now(), ...e });
  saveEntries(entries);
}

function dayKey(ts){ const d = new Date(ts); return d.toISOString().slice(0,10); }
function todayKey(){ return dayKey(Date.now()); }
function entriesForDay(key){ return entries.filter(e => dayKey(e.ts) === key); }

/* ===================== NAV ===================== */
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    views.forEach(v => v.classList.add('hidden'));
    document.getElementById(tab.dataset.target).classList.remove('hidden');
    refreshCurrentView(tab.dataset.target);
  });
});

function refreshCurrentView(id){
  if(id === 'view-home') renderHome();
  if(id === 'view-journal') renderJournal();
  if(id === 'view-radar') renderRadar();
  if(id === 'view-profile') renderPlan();
}

/* ===================== QUICK ADD (Home) ===================== */
let quickCat = 'travail';
let quickMin = 15;

function buildChipRow(container, items, activeKey, onPick, keyField='key'){
  container.innerHTML = '';
  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'cat-chip' + (it[keyField] === activeKey ? ' active' : '');
    btn.innerHTML = `${it.icon} ${it.label}`;
    btn.addEventListener('click', () => onPick(it[keyField], btn, container));
    container.appendChild(btn);
  });
}

function selectChip(container, activeClass, btn){
  container.querySelectorAll('button').forEach(b => b.classList.remove(activeClass));
  btn.classList.add(activeClass);
}

const quickCatsEl = document.getElementById('quickCats');
buildChipRow(quickCatsEl, CATS, quickCat, (key, btn, cont) => {
  quickCat = key; selectChip(cont, 'active', btn);
});

document.querySelectorAll('#quickDur .dur-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#quickDur .dur-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    quickMin = parseInt(btn.dataset.min, 10);
  });
});

document.getElementById('btnQuickAdd').addEventListener('click', () => {
  addEntry({ cat: quickCat, min: quickMin, mood: 'neutre', note: '' });
  renderHome();
  const cta = document.getElementById('btnQuickAdd');
  cta.textContent = '✓ Ajouté';
  setTimeout(() => { cta.textContent = '⚡ Ajouter en 2 sec'; }, 1000);
});

/* ===================== RADAR GAUGE (Home) ===================== */
function computeScore(dayEntries){
  const focusMin = dayEntries.filter(e => FOCUS_CATS.includes(e.cat)).reduce((s,e)=>s+e.min,0);
  const distractions = dayEntries.filter(e => DISTRACT_CATS.includes(e.cat)).length;
  const deepBlocks = dayEntries.filter(e => e.cat === 'travail' && e.min >= 30).length;
  const pauses = dayEntries.filter(e => e.cat === 'pause').length;
  let score = 50 + focusMin/8 - distractions*3.5 + deepBlocks*6 + Math.min(pauses,4)*1.5;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, focusMin, distractions, deepBlocks, pauses };
}

function statusLabel(score){
  if(score >= 80) return 'Excellent';
  if(score >= 60) return 'Bon';
  if(score >= 40) return 'Moyen';
  return 'Faible';
}

function drawGauge(canvas, score){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth || 170;
  canvas.width = size*dpr; canvas.height = size*dpr;
  ctx.scale(dpr,dpr);
  const cx = size/2, cy = size/2, r = size/2 - 10;
  ctx.clearRect(0,0,size,size);

  // background ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 10;
  ctx.stroke();

  // progress arc
  const start = -Math.PI/2;
  const end = start + (Math.PI*2)*(score/100);
  const grad = ctx.createLinearGradient(0,0,size,size);
  grad.addColorStop(0, '#2fe0c8');
  grad.addColorStop(0.6, '#4d8cff');
  grad.addColorStop(1, '#8b5cf6');
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke();

  // tick marks
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  for(let i=0;i<12;i++){
    const a = (Math.PI*2/12)*i;
    const x1 = cx + Math.cos(a)*(r+7), y1 = cy + Math.sin(a)*(r+7);
    const x2 = cx + Math.cos(a)*(r+11), y2 = cy + Math.sin(a)*(r+11);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }

  // ambient dots
  const dotSeed = [0.15,0.32,0.5,0.68,0.82,0.95];
  dotSeed.forEach((f,i) => {
    const a = -Math.PI/2 + Math.PI*2*f;
    const rr = r - 22 - (i%3)*8;
    const x = cx + Math.cos(a)*rr, y = cy + Math.sin(a)*rr;
    ctx.beginPath();
    ctx.arc(x,y, i%2===0?2.2:1.4, 0, Math.PI*2);
    ctx.fillStyle = i < score/100*6 ? '#2fe0c8' : 'rgba(255,255,255,0.12)';
    ctx.fill();
  });
}

function renderHome(){
  const today = entriesForDay(todayKey());
  const yestKey = dayKey(Date.now() - 86400000);
  const yest = entriesForDay(yestKey);
  const t = computeScore(today);
  const y = computeScore(yest);

  document.getElementById('scoreValue').textContent = t.score;
  document.getElementById('scoreStatus').textContent = statusLabel(t.score);
  const delta = t.score - y.score;
  const deltaEl = document.getElementById('scoreDelta');
  deltaEl.textContent = (delta >= 0 ? '↑ +' : '↓ ') + delta + ' vs hier';
  drawGauge(document.getElementById('radarGauge'), t.score);

  const h = Math.floor(t.focusMin/60), m = t.focusMin%60;
  document.getElementById('statFocus').textContent = `${h}h ${m}m`;
  document.getElementById('statDistract').textContent = t.distractions;
  document.getElementById('statPause').textContent = t.pauses;
  document.getElementById('statDeep').textContent = t.deepBlocks;

  const focusDiff = y.focusMin ? Math.round((t.focusMin - y.focusMin)/Math.max(y.focusMin,1)*100) : (t.focusMin>0?100:0);
  document.getElementById('statFocusTrend').textContent = (focusDiff>=0?'↑ ':'↓ ') + Math.abs(focusDiff) + '%';
  const distDiff = t.distractions - y.distractions;
  document.getElementById('statDistractTrend').textContent = (distDiff<=0?'↓ ':'↑ ') + Math.abs(distDiff);
  document.getElementById('statPauseTrend').textContent = t.pauses + ' auj.';
  document.getElementById('statDeepTrend').textContent = (t.deepBlocks - y.deepBlocks >= 0 ? '↑ ' : '↓ ') + Math.abs(t.deepBlocks - y.deepBlocks);

  renderInsight(today, t);
}

/* ===================== INSIGHT (Groq via /api/insight) ===================== */
async function renderInsight(dayEntries, scoreData){
  const titleEl = document.getElementById('insightTitle');
  const bodyEl = document.getElementById('insightBody');

  if(entries.length < 3){
    titleEl.textContent = 'Pas encore assez de données';
    bodyEl.textContent = 'Ajoute quelques entrées aujourd\u2019hui pour débloquer ton premier insight IA.';
    return;
  }

  const cached = sessionStorage.getItem(INSIGHT_KEY);
  if(cached){
    const parsed = JSON.parse(cached);
    titleEl.textContent = parsed.title;
    bodyEl.textContent = parsed.body;
    return;
  }

  titleEl.textContent = 'Analyse en cours…';
  bodyEl.textContent = 'L\u2019IA regarde tes patterns des derniers jours.';

  try{
    const res = await fetch('/api/insight', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ entries: entries.slice(0,60), score: scoreData })
    });
    const data = await res.json();
    titleEl.textContent = data.title || 'Motif détecté';
    bodyEl.textContent = data.body || '';
    sessionStorage.setItem(INSIGHT_KEY, JSON.stringify({title:data.title, body:data.body}));
  }catch(e){
    // local fallback heuristic
    const byHour = {};
    dayEntries.forEach(en => {
      if(DISTRACT_CATS.includes(en.cat)){
        const h = new Date(en.ts).getHours();
        byHour[h] = (byHour[h]||0)+1;
      }
    });
    const peak = Object.entries(byHour).sort((a,b)=>b[1]-a[1])[0];
    if(peak){
      titleEl.textContent = 'Motif détecté : distractions récurrentes';
      bodyEl.textContent = `Tu es plus souvent distrait vers ${peak[0]}h. Essaie un bloc de focus juste avant cette heure.`;
    } else {
      titleEl.textContent = 'Bonne régularité';
      bodyEl.textContent = 'Peu de distractions détectées aujourd\u2019hui. Continue sur cette lancée.';
    }
  }
}
document.getElementById('btnRefreshInsight').addEventListener('click', () => {
  sessionStorage.removeItem(INSIGHT_KEY);
  const today = entriesForDay(todayKey());
  renderInsight(today, computeScore(today));
});

/* ===================== JOURNAL ===================== */
let formCat = 'travail';
let formMin = 5;
let formMood = 'neutre';

function renderDayStrip(container, activeKey){
  container.innerHTML = '';
  const labels = ['DIM','LUN','MAR','MER','JEU','VEN','SAM'];
  for(let i=6;i>=0;i--){
    const d = new Date(Date.now() - i*86400000);
    const key = dayKey(d.getTime());
    const cell = document.createElement('div');
    cell.className = 'day-cell' + (key===activeKey?' today':'');
    cell.innerHTML = `${labels[d.getDay()]}<span class="dnum">${d.getDate()}</span>`;
    container.appendChild(cell);
  }
}

const formCatsEl = document.getElementById('formCats');
buildChipRow(formCatsEl, CATS, formCat, (key, btn, cont) => { formCat = key; selectChip(cont,'active',btn); });

document.querySelectorAll('#formDur .dur-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#formDur .dur-chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    formMin = parseInt(btn.dataset.min,10);
  });
});

const formMoodEl = document.getElementById('formMood');
function buildMoodRow(){
  formMoodEl.innerHTML = '';
  MOODS.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'mood-chip' + (m.key===formMood?' active':'');
    btn.innerHTML = `${m.icon}<span>${m.label}</span>`;
    btn.addEventListener('click', () => {
      formMood = m.key;
      formMoodEl.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
    formMoodEl.appendChild(btn);
  });
}
buildMoodRow();

document.getElementById('btnSaveEntry').addEventListener('click', () => {
  const note = document.getElementById('formNote').value.trim();
  addEntry({ cat: formCat, min: formMin, mood: formMood, note });
  document.getElementById('formNote').value = '';
  sessionStorage.removeItem(INSIGHT_KEY);
  renderJournal();
});

function moodIcon(key){ return (MOODS.find(m=>m.key===key)||{}).icon || '😐'; }
function catInfo(key){ return CATS.find(c=>c.key===key) || CATS[0]; }

function renderJournal(){
  renderDayStrip(document.getElementById('dayStrip'), todayKey());
  const list = document.getElementById('entryList');
  list.innerHTML = '';
  entries.slice(0,25).forEach(e => {
    const c = catInfo(e.cat);
    const row = document.createElement('div');
    row.className = 'entry-row';
    const time = new Date(e.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    row.innerHTML = `
      <span class="e-ic">${c.icon}</span>
      <div class="e-main">
        <div class="e-cat">${c.label}</div>
        <div class="e-note">${time}${e.note ? ' · '+e.note : ''}</div>
      </div>
      <span class="e-min">${e.min} min</span>
      <span class="e-mood">${moodIcon(e.mood)}</span>
    `;
    list.appendChild(row);
  });
  if(entries.length === 0){
    list.innerHTML = '<div class="entry-row" style="justify-content:center;color:var(--text-dimmer);">Aucune entrée pour l\u2019instant</div>';
  }
}

/* ===================== RADAR IA (heatmap + patterns) ===================== */
function drawHeatmap(canvas){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 220, h = canvas.clientHeight || 175;
  canvas.width = w*dpr; canvas.height = h*dpr;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);
  const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 14;

  // grid circles
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [0.33,0.66,1].forEach(f => { ctx.beginPath(); ctx.arc(cx,cy,r*f,0,Math.PI*2); ctx.stroke(); });

  // hour buckets from distraction entries (last 14 days)
  const buckets = new Array(24).fill(0);
  const cutoff = Date.now() - 14*86400000;
  entries.filter(e => e.ts >= cutoff && DISTRACT_CATS.includes(e.cat)).forEach(e => {
    buckets[new Date(e.ts).getHours()] += 1;
  });
  const max = Math.max(1, ...buckets);

  for(let hr=0; hr<24; hr++){
    const val = buckets[hr];
    if(val === 0) continue;
    const a = -Math.PI/2 + (Math.PI*2/24)*hr;
    const rr = r * (0.35 + 0.6*(hr%5)/5); // spread rings slightly for visual variety
    const x = cx + Math.cos(a)*rr, y = cy + Math.sin(a)*rr;
    const intensity = val/max;
    const radius = 6 + intensity*16;
    const grad = ctx.createRadialGradient(x,y,0,x,y,radius);
    const color = intensity > 0.6 ? '139,92,246' : intensity > 0.3 ? '77,140,255' : '47,224,200';
    grad.addColorStop(0, `rgba(${color},0.75)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // hour labels
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '9px -apple-system, sans-serif';
  ctx.fillText('00:00', cx-14, cy-r-4);
  ctx.fillText('12:00', cx-14, cy+r+12);
  ctx.fillText('18h', cx+r-16, cy+4);
  ctx.fillText('06h', cx-r+2, cy+4);

  return buckets;
}

function drawWeekChart(canvas){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 280, h = canvas.clientHeight || 90;
  canvas.width = w*dpr; canvas.height = h*dpr;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);

  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(Date.now()-i*86400000);
    const key = dayKey(d.getTime());
    days.push({ key, label:['D','L','M','M','J','V','S'][d.getDay()], score: computeScore(entriesForDay(key)).score });
  }
  const barW = w/7 - 8;
  days.forEach((d,i) => {
    const x = i*(w/7) + 4;
    const bh = Math.max(4, (d.score/100) * (h-14));
    const y = h - bh - 12;
    const grad = ctx.createLinearGradient(0,y,0,y+bh);
    grad.addColorStop(0, '#8b5cf6'); grad.addColorStop(1, '#2fe0c8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,barW,bh,3) : ctx.rect(x,y,barW,bh);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.fillText(d.label, x+barW/2-3, h-2);
  });
  return days;
}

function renderRadar(){
  const buckets = drawHeatmap(document.getElementById('heatCanvas'));
  const days = drawWeekChart(document.getElementById('weekChart'));

  const avg = Math.round(days.reduce((s,d)=>s+d.score,0)/days.length);
  document.getElementById('weekAvg').textContent = `Moy. ${avg}`;

  const maxHr = buckets.indexOf(Math.max(...buckets));
  const hasData = Math.max(...buckets) > 0;
  document.getElementById('radWindow').textContent = hasData ? `${maxHr}h–${(maxHr+3)%24}h` : '—';
  document.getElementById('radWindowSub').textContent = hasData ? `Pic sur 14 derniers jours` : 'Pas assez de données';

  const contextCat = entries.filter(e=>DISTRACT_CATS.includes(e.cat)).length;
  document.getElementById('radContext').textContent = contextCat > 0 ? 'Téléphone / Réseaux' : '—';
  document.getElementById('radContextSub').textContent = contextCat > 0 ? `${contextCat} occurrences` : '';

  document.getElementById('radTrigger').textContent = hasData && maxHr >= 13 && maxHr <= 17 ? 'Fatigue cognitive' : (hasData ? 'Enchaînement de tâches' : '—');
  document.getElementById('radTriggerSub').textContent = hasData ? 'Basé sur l\u2019horaire des distractions' : '';

  document.getElementById('radAction').textContent = hasData ? `Bloquer ${maxHr}h–${(maxHr+1)%24}h` : '—';
  document.getElementById('radActionSub').textContent = hasData ? 'Planifie une pause active avant' : '';

  const patterns = [];
  if(hasData) patterns.push({icon:'📈', label:'Distractions en hausse'});
  const nightEntries = entries.filter(e => new Date(e.ts).getHours() >= 21);
  if(nightEntries.length) patterns.push({icon:'🌙', label:'Baisse de focus après 21h'});
  const deepDays = entries.filter(e=>e.cat==='travail' && e.min>=30).length;
  if(deepDays >= 3) patterns.push({icon:'🎯', label:'Bonne régularité deep work'});
  if(patterns.length === 0) patterns.push({icon:'✦', label:'Ajoute des entrées pour révéler des motifs'});

  const patEl = document.getElementById('radPatterns');
  patEl.innerHTML = '';
  patterns.forEach(p => {
    const d = document.createElement('div');
    d.className = 'cat-chip';
    d.innerHTML = `${p.icon} ${p.label}`;
    patEl.appendChild(d);
  });
}

/* ===================== PLAN ADAPTATIF ===================== */
const BLOCK_TEMPLATES = [
  { icon:'🧠', title:'Travail profond', sub:'Focus profond', diff:4, start:9, dur:120 },
  { icon:'▤', title:'Administratif', sub:'Tâches légères', diff:2, start:11.25, dur:60 },
  { icon:'💡', title:'Session créative', sub:'Idées & création', diff:3, start:14, dur:90 },
  { icon:'🌿', title:'Pause récupération', sub:'Recharge active', diff:1, start:16.5, dur:20 },
];

function fmtTime(hFloat){
  const h = Math.floor(hFloat);
  const m = Math.round((hFloat-h)*60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function renderPlan(){
  renderDayStrip(document.getElementById('planDayStrip'), todayKey());

  // shift creative/heavy blocks away from detected distraction peak hour
  const cutoff = Date.now() - 14*86400000;
  const buckets = new Array(24).fill(0);
  entries.filter(e => e.ts >= cutoff && DISTRACT_CATS.includes(e.cat)).forEach(e => buckets[new Date(e.ts).getHours()]++);
  const peakHour = Math.max(...buckets) > 0 ? buckets.indexOf(Math.max(...buckets)) : null;

  const list = document.getElementById('planList');
  list.innerHTML = '';
  BLOCK_TEMPLATES.forEach(b => {
    let start = b.start;
    if(peakHour !== null && Math.abs(start - peakHour) < 1 && b.diff >= 3){
      start = peakHour - 2 >= 8 ? peakHour - 2 : peakHour + 3;
    }
    const end = start + b.dur/60;
    const row = document.createElement('div');
    row.className = 'plan-row';
    const dots = Array.from({length:5}, (_,i) => `<span class="${i < b.diff ? 'on':''}"></span>`).join('');
    row.innerHTML = `
      <div class="plan-ic">${b.icon}</div>
      <div class="plan-main">
        <div class="plan-time">${fmtTime(start)} – ${fmtTime(end)}</div>
        <div class="plan-title">${b.title}</div>
        <div class="plan-sub">${b.sub}</div>
        <div class="plan-dots">${dots}</div>
      </div>
    `;
    list.appendChild(row);
  });

  const adjustText = document.getElementById('adjustText');
  if(peakHour !== null){
    adjustText.textContent = `L'IA a déplacé tes sessions de focus en dehors de ta plage de distraction habituelle (${peakHour}h–${(peakHour+3)%24}h).`;
  } else {
    adjustText.textContent = 'Ajoute quelques jours d\u2019entrées pour que l\u2019IA commence à ajuster ton plan.';
  }

  const week = [];
  for(let i=6;i>=0;i--) week.push(computeScore(entriesForDay(dayKey(Date.now()-i*86400000))).score);
  const activedays = week.filter(s => s > 50).length;
  document.getElementById('planCoherence').textContent = `${Math.round(activedays/7*100)}%`;
  const streak = (() => {
    let s = 0;
    for(let i=0;i<7;i++){ const sc = computeScore(entriesForDay(dayKey(Date.now()-i*86400000))).score; if(sc>50) s++; else break; }
    return s;
  })();
  document.getElementById('planStreak').textContent = `🔥 ${streak}j`;
  document.getElementById('planBest').textContent = peakHour !== null ? `Éviter ${peakHour}h` : '09:00–11:00';
}

document.getElementById('btnLaunchBlock').addEventListener('click', () => {
  document.querySelector('.tab[data-target="view-journal"]').click();
});

/* ===================== INIT ===================== */
renderHome();

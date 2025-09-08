/* Times Tables Trainer — script.js (frontpage-GH36)
   - Answer input stays fixed (question shown in a fixed-height band)
   - Gold/Silver/Platinum/Obsidian questions forced to a single line, auto-fit smaller
   - Answers grid single-line, smaller font
   - Titles: "Dr B TTN — {Belt}" (and Mini)
   - iPad OSK suppression; robust nav; keypad
*/

/* ====== Config ====== */
const SHEET_ENDPOINT = ""; // demo/offline
const SHEET_SECRET   = "";

const QUIZ_SECONDS_DEFAULT = 300; // 5 mins hidden timer
const QUEUE_KEY = "tttQueueV1";
const NAME_KEY  = "tttName";

/* ====== State ====== */
let modeLabel = "";
let quizSeconds = QUIZ_SECONDS_DEFAULT;

let allQuestions = [];
let userAnswers = [];
let currentIndex = 0;
let ended = false;

let timerInterval = null;
let timerDeadline = 0;
let desktopKeyHandler = null;
let submitLockedUntil = 0;

/* ====== Safety net ====== */
window.onerror = function (msg, src, line, col, err) {
  try { console.error("[fatal]", msg, "at", src + ":" + line + ":" + col, err); } catch {}
  try { setScreen("ninja-screen"); } catch {}
};

/* ====== Utils ====== */
const $ = (id)=>document.getElementById(id);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
const randInt=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;

/* ==== Fixed-position question band + auto-fit helpers ==== */

// Band heights (tweak to taste)
// Band heights (tweak to taste)
const BAND_HEIGHT_DESKTOP = 160;
const BAND_HEIGHT_TABLET  = 120;

// Tablet-ish breakpoint
function isTabletLike(){
  return window.matchMedia && matchMedia("(max-width: 834px)").matches;
}

/**
 * Ensure the question element sits inside a rigid, fixed-height band.
 * This prevents any vertical movement of the answer input below.
 */
function ensureQuestionBand(){
  const q = document.getElementById("question");
  if (!q) return null;

  // Already wrapped?
  if (q.parentElement && q.parentElement.id === "question-band") return q.parentElement;

  // Create a rigid, non-flexing band and move #question into it
  const band = document.createElement("div");
  band.id = "question-band";
  band.style.display = "flex";
  band.style.alignItems = "center";
  band.style.justifyContent = "center";
  band.style.width = "100%";
  band.style.overflow = "hidden";   // never let content affect height
  band.style.margin = "0 0 20px 0";
  band.style.flex = "0 0 auto";     // never flex or shrink

  // Insert band right before question and move question inside it
  q.parentElement.insertBefore(band, q);
  band.appendChild(q);

  // Make the question itself fully single-line & non-clipping
  q.style.margin = "0";             // kill default margins that can nudge height
  q.style.display = "inline-block"; // stable inline box
  q.style.lineHeight = "1";         // stable metrics
  q.style.whiteSpace = "nowrap";
  q.style.overflow = "hidden";
  q.style.textOverflow = "clip";

  layoutQuestionBand(); // set initial rigid height
  return band;
}

/** Set band height AND lock flex-basis to the same height (no movement) */
function layoutQuestionBand(){
  const band = document.getElementById("question-band");
  if (!band) return;
  const h = isTabletLike() ? BAND_HEIGHT_TABLET : BAND_HEIGHT_DESKTOP;
  band.style.height = h + "px";
  band.style.flexBasis = h + "px";  // double pin: height + basis
}

/**
 * Shrink font until #question fits on one line within its container.
 * startPx: starting font size in px (e.g., 110)
 * minPx:   do not shrink below this (e.g., 56 desktop / 44 tablet)
 */
function fitSingleLine(qEl, startPx, minPx){
  if (!qEl) return;
  const step = 4;
  let size = startPx;

  qEl.style.whiteSpace = "nowrap";
  qEl.style.overflow = "hidden";
  qEl.style.textOverflow = "clip";
  qEl.style.fontSize = size + "px";

  let tries = 0, maxTries = 30;
  while (qEl.scrollWidth > qEl.clientWidth && size > minPx && tries++ < maxTries){
    size -= step;
    qEl.style.fontSize = size + "px";
  }
}

// Keep a resize ref so we can unhook cleanly
let _refitOnResize = null;

/* ====== Touch detection & iPad keyboard suppression ====== */
const IS_TOUCH = ((('ontouchstart' in window) || (navigator.maxTouchPoints > 0)))
                 && window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches;

function suppressOSK(aEl, enable) {
  if (!aEl) return;
  if (enable) {
    aEl.setAttribute('readonly', '');
    aEl.setAttribute('inputmode', 'none');
    aEl._nokb = (e)=>{ try{ e.preventDefault(); }catch{} aEl.blur(); };
    aEl.addEventListener('focus', aEl._nokb, {passive:false});
    aEl.addEventListener('pointerdown', aEl._nokb, {passive:false});
  } else {
    aEl.removeAttribute('readonly');
    aEl.removeAttribute('inputmode');
    if (aEl._nokb){
      aEl.removeEventListener('focus', aEl._nokb);
      aEl.removeEventListener('pointerdown', aEl._nokb);
      aEl._nokb = null;
    }
  }
}

/* ====== Navigation ====== */
function setScreen(id) {
  const screens = ["home-screen","mini-screen","ninja-screen","quiz-screen","quiz-container"];
  let target = id;
  if (!document.getElementById(target)) {
    if (id === "quiz-screen" && document.getElementById("quiz-container")) target = "quiz-container";
    else if (id === "quiz-container" && document.getElementById("quiz-screen")) target = "quiz-screen";
  }
  for (let i=0;i<screens.length;i++){
    const s = screens[i], el = $(s);
    if (!el) continue;
    if ((target === "quiz-screen" || target === "quiz-container") && (s === "quiz-screen" || s === "quiz-container")) {
      el.style.display = "block";
    } else {
      el.style.display = (s === target ? "block" : "none");
    }
  }
  try { document.body.setAttribute("data-screen", target); } catch {}
}
function goHome(){
  const s = $("score"); if (s) s.innerHTML = "";
  const q = $("question"); if (q){ q.textContent=""; q.style.display=""; }
  const a = $("answer"); if (a){ a.value=""; a.style.display=""; suppressOSK(a, false); }
  setScreen("home-screen");
}
function goMini(){
  const nameInput = $("home-username");
  if (nameInput){
    const val = (nameInput.value || "").trim();
    if (val){ localStorage.setItem(NAME_KEY, val); }
  }
  buildTableButtons();
  setScreen("mini-screen");
}
function goNinja(){
  const nameInput = $("home-username");
  if (nameInput){
    const val = (nameInput.value || "").trim();
    if (val){ localStorage.setItem(NAME_KEY, val); }
  }
  setScreen("ninja-screen");
}
window.setScreen = setScreen;
window.goHome = goHome;
window.goMini = goMini;
window.goNinja = goNinja;

/* ====== Mini Tests ====== */
let selectedBase = 2;
function buildTableButtons(){
  const wrap = $("table-choices"); if(!wrap) return;
  let html = "";
  for (let b=2;b<=12;b++){ html += `<button class="table-btn" onclick="selectTable(${b})">${b}×</button>`; }
  wrap.innerHTML = html;
}
function selectTable(b){ selectedBase = clamp(b,2,12); }
function buildMiniQuestions(base, total){
  const out = [];
  for (let i=1;i<=10;i++) out.push({ q:`${i} × ${base}`, a:i*base });
  for (let i=1;i<=10;i++) out.push({ q:`${base} × ${i}`, a:base*i });
  for (let i=1;i<=10;i++) out.push({ q:`${base*i} ÷ ${base}`, a:i });
  const mix = [];
  for (let i=0;i<20;i++){
    const k = randInt(1,10); const t = randInt(1,3);
    if (t===1) mix.push({ q:`${k} × ${base}`, a:k*base });
    else if (t===2) mix.push({ q:`${base} × ${k}`, a:base*k });
    else mix.push({ q:`${base*k} ÷ ${base}`, a:k });
  }
  return out.concat(shuffle(mix)).slice(0,total);
}
function startQuiz(){
  modeLabel = `Mini ${selectedBase}×`;
  quizSeconds = QUIZ_SECONDS_DEFAULT;
  preflightAndStart(buildMiniQuestions(selectedBase, 50));
}
window.startQuiz = startQuiz;
window.buildTableButtons = buildTableButtons;
window.selectTable = selectTable;

/* ====== Ninja Belt question builders ====== */
function buildMixedBases(bases,total){
  const out = [];
  for (let i=0;i<total;i++){
    const base = bases[i % bases.length];
    const k = randInt(1,10); const t = randInt(1,3);
    if (t===1) out.push({ q:`${k} × ${base}`, a:k*base });
    else if (t===2) out.push({ q:`${base} × ${k}`, a:base*k });
    else out.push({ q:`${base*k} ÷ ${base}`, a:k });
  }
  return shuffle(out).slice(0,total);
}
function buildFullyMixed(total, range){
  const out = [];
  for (let n=0;n<total;n++){
    const a = randInt(range.min, range.max); const b = randInt(1,10); const t = randInt(1,3);
    if (t===1) out.push({ q:`${a} × ${b}`, a:a*b });
    else if (t===2) out.push({ q:`${b} × ${a}`, a:b*a });
    else out.push({ q:`${a*b} ÷ ${a}`, a:b });
  }
  return shuffle(out).slice(0,total);
}
/* Bronze: missing-number + direct forms */
function buildBronzeQuestions(total){
  const out = [];
  const half = Math.max(1, Math.floor(total/2));
  for (let i=0;i<half;i++){
    const A=randInt(2,12), B=randInt(1,10), C=A*B; const t=(i%4)+1;
    if (t===1) out.push({ q:`___ × ${A} = ${C}`, a:B });
    else if (t===2) out.push({ q:`${A} × ___ = ${C}`, a:B });
    else if (t===3) out.push({ q:`___ ÷ ${A} = ${B}`, a:C });
    else out.push({ q:`${C} ÷ ___ = ${B}`, a:A });
  }
  for (let i=half;i<total;i++){
    const A=randInt(2,12), B=randInt(1,10), C=A*B; const t=randInt(1,6);
    if (t===1) out.push({ q:`___ × ${A} = ${C}`, a:B });
    else if (t===2) out.push({ q:`${A} × ___ = ${C}`, a:B });
    else if (t===3) out.push({ q:`___ ÷ ${A} = ${B}`, a:C });
    else if (t===4) out.push({ q:`${C} ÷ ___ = ${B}`, a:A });
    else if (t===5) out.push({ q:`${A} × ${B}`, a:C });
    else out.push({ q:`${B} × ${A}`, a:C });
  }
  return shuffle(out).slice(0,total);
}
/* Silver: expanded ×10 with exps [0,1] */
function buildSilverQuestions(total){
  const out = [];
  const exps = [0,1];
  for (let i=0;i<total;i++){
    const A=randInt(2,12), B=randInt(1,10);
    const e1=exps[randInt(0,exps.length-1)], e2=exps[randInt(0,exps.length-1)];
    const bigA=A*(10**e1), bigB=B*(10**e2), prod=bigA*bigB; const t=randInt(1,3);
    if (t===1)      out.push({ q:`${bigA} × ${bigB}`, a:prod });
    else if (t===2) out.push({ q:`${bigB} × ${bigA}`, a:prod });
    else            out.push({ q:`${prod} ÷ ${bigA}`, a:bigB });
  }
  return shuffle(out).slice(0,total);
}
/* Gold: like Silver but missing-number forms mixed in (exps [0,1]) */
function buildGoldQuestions(total){
  const out = [];
  const exps = [0,1];
  const half = Math.max(1, Math.floor(total/2));
  for (let i=0;i<half;i++){
    const A=randInt(2,12), B=randInt(1,10);
    const e1=exps[randInt(0,exps.length-1)], e2=exps[randInt(0,exps.length-1)];
    const bigA=A*(10**e1), bigB=B*(10**e2), prod=bigA*bigB; const t=(i%4)+1;
    if (t===1)      out.push({ q:`___ × ${bigA} = ${prod}`, a:bigB });
    else if (t===2) out.push({ q:`${bigA} × ___ = ${prod}`, a:bigB });
    else if (t===3) out.push({ q:`___ ÷ ${bigA} = ${bigB}`, a:prod });
    else            out.push({ q:`${prod} ÷ ___ = ${bigB}`, a:bigA });
  }
  for (let i=half;i<total;i++){
    const A=randInt(2,12), B=randInt(1,10);
    const e1=exps[randInt(0,exps.length-1)], e2=exps[randInt(0,exps.length-1)];
    const bigA=A*(10**e1), bigB=B*(10**e2), prod=bigA*bigB; const t=randInt(1,6);
    if (t===1)      out.push({ q:`___ × ${bigA} = ${prod}`, a:bigB });
    else if (t===2) out.push({ q:`${bigA} × ___ = ${prod}`, a:bigB });
    else if (t===3) out.push({ q:`___ ÷ ${bigA} = ${bigB}`, a:prod });
    else if (t===4) out.push({ q:`${prod} ÷ ___ = ${bigB}`, a:bigA });
    else if (t===5) out.push({ q:`${bigA} × ${bigB}`, a:prod });
    else            out.push({ q:`${bigB} × ${bigA}`, a:prod });
  }
  return shuffle(out).slice(0,total);
}
/* Platinum: like Silver but exps [0,1,2] */
function buildPlatinumQuestions(total){
  const out = [];
  const exps = [0,1,2];
  for (let i=0;i<total;i++){
    const A=randInt(2,12), B=randInt(1,10);
    const e1=exps[randInt(0,exps.length-1)], e2=exps[randInt(0,exps.length-1)];
    const bigA=A*(10**e1), bigB=B*(10**e2), prod=bigA*bigB; const t=randInt(1,3);
    if (t===1)      out.push({ q:`${bigA} × ${bigB}`, a:prod });
    else if (t===2) out.push({ q:`${bigB} × ${bigA}`, a:prod });
    else            out.push({ q:`${prod} ÷ ${bigA}`, a:bigB });
  }
  return shuffle(out).slice(0,total);
}
/* Obsidian: like Gold with exps [0,1,2] */
function buildObsidianQuestions(total){
  const out = [];
  const exps = [0,1,2];
  const half = Math.max(1, Math.floor(total/2));
  for (let i=0;i<half;i++){
    const A=randInt(2,12), B=randInt(1,10);
    const e1=exps[randInt(0,exps.length-1)], e2=exps[randInt(0,exps.length-1)];
    const bigA=A*(10**e1), bigB=B*(10**e2), prod=bigA*bigB; const t=(i%4)+1;
    if (t===1)      out.push({ q:`___ × ${bigA} = ${prod}`, a:bigB });
    else if (t===2) out.push({ q:`${bigA} × ___ = ${prod}`, a:bigB });
    else if (t===3) out.push({ q:`___ ÷ ${bigA} = ${bigB}`, a:prod });
    else            out.push({ q:`${prod} ÷ ___ = ${bigB}`, a:bigA });
  }
  for (let i=half;i<total;i++){
    const A=randInt(2,12), B=randInt(1,10);
    const e1=exps[randInt(0,exps.length-1)], e2=exps[randInt(0,exps.length-1)];
    const bigA=A*(10**e1), bigB=B*(10**e2), prod=bigA*bigB; const t=randInt(1,6);
    if (t===1)      out.push({ q:`___ × ${bigA} = ${prod}`, a:bigB });
    else if (t===2) out.push({ q:`${bigA} × ___ = ${prod}`, a:bigB });
    else if (t===3) out.push({ q:`___ ÷ ${bigA} = ${bigB}`, a:prod });
    else if (t===4) out.push({ q:`${prod} ÷ ___ = ${bigB}`, a:bigA });
    else if (t===5) out.push({ q:`${bigA} × ${bigB}`, a:prod });
    else            out.push({ q:`${bigB} × ${bigA}`, a:prod });
  }
  return shuffle(out).slice(0,total);
}

/* ====== Helpers to keep UI stable & single-line ====== */
// Fixed-height band so the answer box stays in a fixed vertical spot
function setQuestionFixedBand(qEl){
  const band = (window.innerWidth <= 834) ? 100 : 140; // iPad/phone vs desktop
  qEl.style.height = band + "px";
  qEl.style.lineHeight = band + "px"; // vertically center the single line
}
// Auto-fit font size so a single line never wraps
function fitSingleLine(qEl, startPx, minPx){
  const step = 4;
  let size = startPx;
  qEl.style.fontSize = size + "px";
  qEl.style.whiteSpace = "nowrap";
  qEl.style.overflow = "hidden";      // avoid layout jump
  qEl.style.textOverflow = "clip";    // show full as we shrink
  // measure and shrink if needed
  const maxTries = 20;
  let tries = 0;
  while (qEl.scrollWidth > qEl.clientWidth && size > minPx && tries++ < maxTries){
    size -= step;
    qEl.style.fontSize = size + "px";
  }
}

/* ====== Quiz flow ====== */
function preflightAndStart(questions, opts){
  if (!Array.isArray(questions) || questions.length === 0) {
    console.error('[preflight] No questions', questions);
    setScreen('ninja-screen');
    return;
  }

  try {
    const nameInput = $("home-username");
    const nm = nameInput ? (nameInput.value||"").trim() : "";
    if (nm) localStorage.setItem(NAME_KEY, nm);
  } catch {}

  ended = false;
  currentIndex = 0;
  allQuestions = questions.slice();
  userAnswers = new Array(allQuestions.length).fill("");

  setScreen("quiz-screen");

  // Title: Dr B TTN — {modeLabel}
  const title = $("quiz-title");
  if (title) {
    const label = (modeLabel && modeLabel.trim()) ? ` — ${modeLabel.trim()}` : "";
    title.textContent = `Dr B TTN${label}`;
  }

  const qEl = $("question"); if (qEl){ qEl.style.display=""; qEl.textContent=""; }
  const aEl = $("answer");   if (aEl){
    aEl.style.display="";
    aEl.value="";
    suppressOSK(aEl, IS_TOUCH);
    try{ aEl.focus(); aEl.setSelectionRange(aEl.value.length, aEl.value.length); }catch{}
  }
  const s   = $("score");    if (s){ s.innerHTML=""; }

  createKeypad();
  showQuestion();
  startTimer(quizSeconds);
}
function getMaxLenForCurrentQuestion(){
  try {
    const q = allQuestions[currentIndex];
    const target = (q && typeof q.a !== "undefined") ? String(q.a) : "999999";
    return clamp(target.length, 1, 10);
  } catch { return 10; }
}
function syncAnswerMaxLen(){
  const a = $("answer"); if(!a) return;
  const cap = getMaxLenForCurrentQuestion();
  try{ a.setAttribute("maxlength", String(cap)); }catch{}
  if (a.value.length > cap) a.value = a.value.slice(0, cap);
}
function showQuestion(){
  if (ended) return;
  const qObj = allQuestions[currentIndex];
  const qEl = document.getElementById("question");
  const aEl = document.getElementById("answer");

  if (!qObj || typeof qObj.q !== "string") {
    console.error("[showQuestion] bad question", currentIndex, qObj);
    endQuiz();
    return;
  }

  // Ensure rigid band exists & is sized BEFORE we set text
  ensureQuestionBand();
  layoutQuestionBand();

  // Put text, then lock margins/metrics, then fit-to-line
  qEl.textContent = qObj.q;

  // (extra safety) ensure no margin/line-height creep every time:
  qEl.style.margin = "0";
  qEl.style.lineHeight = "1";

  const isLongBelt = /Silver|Gold|Platinum|Obsidian/.test(modeLabel);
  const startPx = isLongBelt ? 78 : 110;
  const minPx   = isTabletLike() ? 44 : 56;
  fitSingleLine(qEl, startPx, minPx);

  if (aEl) {
    aEl.value = "";
    try{ aEl.focus(); aEl.setSelectionRange(aEl.value.length, aEl.value.length); }catch{}
    attachKeyboard(aEl);
  }
}


function quitFromQuiz(){
  teardownQuiz(); destroyKeypad(); goHome();
}
window.quitFromQuiz = quitFromQuiz;

/* ====== Timer ====== */
function startTimer(seconds){
  clearInterval(timerInterval);
  timerDeadline = Date.now() + seconds*1000;
  timerInterval = setInterval(()=>{
    const remaining = Math.max(0, Math.ceil((timerDeadline - Date.now())/1000));
    const t = $("timer"); if (t) t.textContent = String(remaining);
    if (remaining <= 0){ clearInterval(timerInterval); endQuiz(); }
  }, 250);
}
function teardownQuiz(){
  clearInterval(timerInterval); timerInterval=null; ended=true; submitLockedUntil=0;
  if (desktopKeyHandler){ document.removeEventListener("keydown", desktopKeyHandler); desktopKeyHandler=null; }
  suppressOSK($("answer"), false);
}

/* ====== Keypad + keyboard ====== */
function createKeypad(){
  const host = $("answer-pad"); if(!host) return;
  host.innerHTML = `
    <div class="pad">
      <button class="pad-btn" data-k="7">7</button>
      <button class="pad-btn" data-k="8">8</button>
      <button class="pad-btn" data-k="9">9</button>
      <button class="pad-btn pad-clear" data-k="clear">Clear</button>

      <button class="pad-btn" data-k="4">4</button>
      <button class="pad-btn" data-k="5">5</button>
      <button class="pad-btn" data-k="6">6</button>
      <button class="pad-btn pad-enter" data-k="enter">Enter</button>

      <button class="pad-btn" data-k="1">1</button>
      <button class="pad-btn" data-k="2">2</button>
      <button class="pad-btn" data-k="3">3</button>

      <button class="pad-btn key-0" data-k="0">0</button>
      <button class="pad-btn pad-back" data-k="back">⌫</button>
    </div>`;
  host.style.display="block"; host.style.pointerEvents="auto";
  host.querySelectorAll(".pad-btn").forEach(btn=>{
    btn.addEventListener("pointerdown",(e)=>{ e.preventDefault(); handleKey(btn.getAttribute("data-k")); },{passive:false});
  });
}
function destroyKeypad(){
  const host=$("answer-pad"); if(!host) return; host.innerHTML=""; host.style.display=""; host.style.pointerEvents="";
}
function handleKey(val){
  const a=$("answer"); if(!a || ended) return;
  if (val==="clear"){ a.value=""; a.dispatchEvent(new Event("input",{bubbles:true})); return; }
  if (val==="back") { a.value = a.value.slice(0,-1); a.dispatchEvent(new Event("input",{bubbles:true})); return; }
  if (val==="enter"){ safeSubmit(); return; }
  if (/^\d$/.test(val)){
    if (a.value.length < 10){ a.value += val; a.dispatchEvent(new Event("input",{bubbles:true})); }
    try{ a.setSelectionRange(a.value.length,a.value.length); }catch{}
  }
}
function attachKeyboard(a){
  if (desktopKeyHandler){ document.removeEventListener("keydown", desktopKeyHandler); desktopKeyHandler=null; }
  desktopKeyHandler = (e)=>{
    if (IS_TOUCH) return; // on touch, use on-screen keypad only
    const quiz = $("quiz-container"); if(!quiz || quiz.style.display==="none" || ended) return;
    if (!a || a.style.display==="none") return;
    if (/^\d$/.test(e.key)){ e.preventDefault(); if (a.value.length < 10) a.value += e.key; }
    else if (e.key==="Backspace" || e.key==="Delete"){ e.preventDefault(); a.value = a.value.slice(0,-1); }
    else if (e.key==="Enter"){ e.preventDefault(); safeSubmit(); }
  };
  document.addEventListener("keydown", desktopKeyHandler);
  if (a) a.addEventListener("input", ()=>{ a.value = a.value.replace(/[^\d]/g,"").slice(0,10); });
}
function safeSubmit(){
  const now = Date.now(); if (now < submitLockedUntil) return; submitLockedUntil = now + 200;
  const a = $("answer"); if(!a || ended) return;
  const valStr = a.value.trim(); userAnswers[currentIndex] = (valStr===""?"":Number(valStr));
  currentIndex++; if (currentIndex >= allQuestions.length){ endQuiz(); return; }
  showQuestion();
}

/* ====== End & Answers ====== */
function endQuiz(){
  teardownQuiz();
  destroyKeypad();

  const qEl = document.getElementById("question"); if (qEl) qEl.style.display = "none";
  const aEl = document.getElementById("answer");   if (aEl) aEl.style.display = "none";

  // Tally score
  let correct = 0;
  for (let i=0; i<allQuestions.length; i++){
    const c = Number(allQuestions[i].a);
    const u = (userAnswers[i]==="" ? NaN : Number(userAnswers[i]));
    if (!Number.isNaN(u) && u === c) correct++;
  }

  // Name for header
  const username = (localStorage.getItem(NAME_KEY) || "").trim() || "Player";

  // Score goes at the top next to the user name
  const s = document.getElementById("score");
  if (s){
    s.innerHTML = `
      <div class="result-line" style="font-size:28px;margin:8px 0 14px;">
        <strong>${username}</strong> — Score: <strong>${correct} / ${allQuestions.length}</strong>
      </div>
      <button class="big-button" onclick="showAnswers()">Show answers</button>
    `;
  }
}

function showAnswers(){
  const s = document.getElementById("score"); if (!s) return;

  // EXACTLY 5 columns; single-line chips; smaller font
  let html = `
    <div class="answers-grid" style="
      display:grid;
      grid-template-columns: repeat(5, 1fr);
      gap:8px;
      align-items:start;
      margin-top:10px;
    ">
  `;

  for (let i=0; i<allQuestions.length; i++){
    const q = allQuestions[i] || {};
    const uRaw = userAnswers[i];
    const u = (uRaw===undefined || uRaw==="") ? "—" : String(uRaw);
    const ok = (uRaw === q.a);
    const hasBlank = (typeof q.q === "string" && q.q.indexOf("___") !== -1);

    const displayEq = hasBlank ? q.q.replace("___", `<u>${u}</u>`)
                               : `${q.q} = ${u}`;

    const baseStyle = "white-space:nowrap;font-size:16px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;padding:6px 10px;border-radius:8px;border:1px solid #ddd;background:#fff;";
    const okStyle   = "color:#2e7d32;background:#edf7ed;border-color:#c8e6c9;";
    const badStyle  = "color:#c62828;background:#fff1f1;border-color:#ffcdd2;";

    html += `<div class="answer-chip ${ok ? "correct" : "wrong"}" style="${baseStyle}${ok ? okStyle : badStyle}">${displayEq}</div>`;
  }

  html += `</div>`;

  // Put Quit button BELOW the answers
  html += `
    <div style="text-align:center;margin-top:16px;">
      <button class="big-button" onclick="quitFromQuiz()">Quit</button>
    </div>
  `;

  s.innerHTML = s.innerHTML.replace(/<button[^>]*showAnswers\([^)]*\)[^>]*>.*?<\/button>/i, ""); // remove the "Show answers" button if present
  s.innerHTML += html;
}


/* ====== Queue (stub for offline) ====== */
function getQueue(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]"); }catch{ return []; } }
function setQueue(arr){ try{ localStorage.setItem(QUEUE_KEY, JSON.stringify(arr)); }catch{} }

/* ====== Belt start functions (counts per spec) ====== */
function startWhiteBelt(){   modeLabel="White Belt";   quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([3,4],50),            {theme:"white"}); }
function startYellowBelt(){  modeLabel="Yellow Belt";  quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([4,6],50),            {theme:"yellow"}); }
function startOrangeBelt(){  modeLabel="Orange Belt";  quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([2,3,4,5,6],50),       {theme:"orange"}); }
function startGreenBelt(){   modeLabel="Green Belt";   quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([4,8],50),            {theme:"green"}); }
function startBlueBelt(){    modeLabel="Blue Belt";    quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([7,8],50),            {theme:"blue"}); }
function startPinkBelt(){    modeLabel="Pink Belt";    quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([7,9],50),            {theme:"pink"}); }
function startPurpleBelt(){  modeLabel="Purple Belt";  quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(50,{min:2,max:10}),   {theme:"purple"}); }

function startRedBelt(){     modeLabel="Red Belt";     quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(100,{min:2,max:10}),  {theme:"red"}); }
function startBlackBelt(){   modeLabel="Black Belt";   quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(100,{min:2,max:12}),  {theme:"black"}); }
function startBronzeBelt(){  modeLabel="Bronze Belt";  quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildBronzeQuestions(100),           {theme:"bronze"}); }
function startSilverBelt(){  modeLabel="Silver Belt";  quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildSilverQuestions(100),           {theme:"silver"}); }
function startGoldBelt(){    modeLabel="Gold Belt";    quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildGoldQuestions(100),             {theme:"gold"}); }
function startPlatinumBelt(){modeLabel="Platinum Belt";quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildPlatinumQuestions(100),         {theme:"platinum"}); }
function startObsidianBelt(){modeLabel="Obsidian Belt";quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildObsidianQuestions(100),         {theme:"obsidian"}); }

/* ====== Exports for onclick ====== */
window.startWhiteBelt=startWhiteBelt; window.startYellowBelt=startYellowBelt;
window.startOrangeBelt=startOrangeBelt; window.startGreenBelt=startGreenBelt;
window.startBlueBelt=startBlueBelt; window.startPinkBelt=startPinkBelt;
window.startPurpleBelt=startPurpleBelt; window.startRedBelt=startRedBelt;
window.startBlackBelt=startBlackBelt; window.startBronzeBelt=startBronzeBelt;
window.startSilverBelt=startSilverBelt; window.startGoldBelt=startGoldBelt;
window.startPlatinumBelt=startPlatinumBelt; window.startObsidianBelt=startObsidianBelt;

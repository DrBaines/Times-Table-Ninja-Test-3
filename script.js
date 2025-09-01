/* Times Tables Trainer — script.js (frontpage-GH23)
   Full app: Mini Tests, Ninja Belts, keypad + keyboard, hidden timer, offline queue
*/

/* ====== Config ====== */
const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbyIuCIgbFisSKqA0YBtC5s5ATHsHXxoqbZteJ4en7hYrf4AXmxbnMOUfeQ2ERZIERN-/exec";
const SHEET_SECRET   = "Banstead123";

const QUIZ_SECONDS_DEFAULT = 300; // 5 minutes (hidden timer)
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

/* ====== Utils ====== */
const $ = (id)=>document.getElementById(id);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
const randInt=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
function cryptoRandom(){ return String(Date.now())+"-"+Math.floor(Math.random()*1e9); }

/* Dynamic max length: base on correct answer length +2 */
function getMaxLenForCurrentQuestion(){
  try{
    const q = allQuestions[currentIndex];
    if (!q || typeof q.a === "undefined") return 4;
    const ansLen = String(q.a).length;
    return Math.max(4, ansLen + 2);
  }catch{ return 4; }
}
function syncAnswerMaxLen(){
  const a = $("answer"); if(!a) return;
  a.maxLength = getMaxLenForCurrentQuestion();
}

/* ====== Screens ====== */
function setScreen(id) {
  try {
    if (id === "quiz-container") id = "quiz-screen";
    const screens = ["home-screen","mini-screen","ninja-screen","quiz-screen"];
    screens.forEach(s=>{
      const el = document.getElementById(s);
      if (el) el.style.display = (s===id? "block" : "none");
    });
    try { window.scrollTo({top:0, behavior:"instant"}); } catch {}
    console.log("[nav] setScreen ->", id);
  } catch (err) {
    console.error("[nav] setScreen error:", err);
  }
}
window.setScreen = setScreen;

/* ====== Nav ====== */
function goHome() {
  // Clear out any leftover score/answers
  const s = $("score"); if (s) s.innerHTML = "";

  // Reset question and answer fields
  const qEl = $("question"); if (qEl) { qEl.textContent = ""; qEl.style.display=""; }
  const aEl = $("answer");   if (aEl) { aEl.value = ""; aEl.style.display=""; }

  setScreen("home-screen");
}
function goMini(){ try {
  const name = ($("home-username")?.value || "").trim();
  if (name) localStorage.setItem(NAME_KEY, name);
  const hello = $("hello-user");
  if (hello) hello.textContent = name ? `Hello, ${name}!` : "Mini Tests";
  buildTableButtons();
  setScreen("mini-screen");
} catch (e) {
  // Fallback: show mini, hide others
  const ids=["home-screen","mini-screen","ninja-screen","quiz-screen"];
  ids.forEach(s=>{ const el=document.getElementById(s); if(el) el.style.display=(s==="mini-screen"?"block":"none"); });
}}
function goNinja(){ try {
  const name = ($("home-username")?.value || "").trim();
  if (name) localStorage.setItem(NAME_KEY, name);
  setScreen("ninja-screen");
} catch (e) {
  const ids=["home-screen","mini-screen","ninja-screen","quiz-screen"];
  ids.forEach(s=>{ const el=document.getElementById(s); if(el) el.style.display=(s==="ninja-screen"?"block":"none"); });
}
}                      
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
function startQuiz(){
  modeLabel = `Mini ${selectedBase}×`;
  quizSeconds = QUIZ_SECONDS_DEFAULT;
  preflightAndStart(buildMiniQuestions(selectedBase, 50));
}
window.startQuiz = startQuiz;
window.buildTableButtons = buildTableButtons;
window.selectTable = selectTable;

/* Build exactly 50 questions as per spec */
function buildMiniQuestions(base, total){
  const out = [];
  for (let i=1;i<=10;i++) out.push({ q:`${i} × ${base}`, a:i*base });
  for (let i=1;i<=10;i++) out.push({ q:`${base} × ${i}`, a:base*i });
  for (let i=1;i<=10;i++) out.push({ q:`${base*i} ÷ ${base}`, a:i });
  const mix = [];
  for (let i=0;i<20;i++){ const k = randInt(1,10); const t = randInt(1,3);
    if (t===1) mix.push({ q:`${k} × ${base}`, a:k*base });
    else if (t===2) mix.push({ q:`${base} × ${k}`, a:base*k });
    else mix.push({ q:`${base*k} ÷ ${base}`, a:k });
  }
  return out.concat(shuffle(mix)).slice(0,total);
}

/* ====== Belts ====== */
function startWhiteBelt() { modeLabel="White Belt";  quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([3,4],20),{theme:"white"}); }
function startYellowBelt(){ modeLabel="Yellow Belt"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([4,6],20),{theme:"yellow"}); }
function startOrangeBelt(){ modeLabel="Orange Belt"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([2,3,4,5,6],20),{theme:"orange"}); }
function startGreenBelt() { modeLabel="Green Belt";  quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([4,8],20),{theme:"green"}); }
function startBlueBelt()  { modeLabel="Blue Belt";   quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([7,8],20),{theme:"blue"}); }
function startPinkBelt()  { modeLabel="Pink Belt";   quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([7,9],20),{theme:"pink"}); }
function startPurpleBelt(){ modeLabel="Purple Belt (2×–10×)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(20,{min:2,max:10}),{theme:"purple"}); }
function startRedBelt()   { modeLabel="Red Belt (2×–10×, 100 Q)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(20,{min:2,max:10}),{theme:"red"}); }
function startBlackBelt() { modeLabel="Black Belt (2×–12×, 100 Q)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(20,{min:2,max:12}),{theme:"black"}); }
function startBronzeBelt(){ modeLabel="Bronze Belt (blanks)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildBronzeQuestions(20),{theme:"bronze"}); }
function startSilverBelt(){ modeLabel="Silver Belt (×10 expanded)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildSilverQuestions(20),{theme:"silver"}); }
function startGoldBelt(){ modeLabel="Gold Belt (blanks + ×10)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildGoldQuestions(20),{theme:"gold"}); }

window.startWhiteBelt  = startWhiteBelt;
window.startYellowBelt = startYellowBelt;
window.startOrangeBelt = startOrangeBelt;
window.startGreenBelt  = startGreenBelt;
window.startBlueBelt   = startBlueBelt;
window.startPinkBelt   = startPinkBelt;
window.startPurpleBelt = startPurpleBelt;
window.startRedBelt    = startRedBelt;
window.startBlackBelt  = startBlackBelt;
window.startBronzeBelt = startBronzeBelt;
window.startSilverBelt = startSilverBelt;
window.startGoldBelt = startGoldBelt;

/* Mix helpers */
function buildMixedBases(bases,total){
  const out = [];
  for (let i=0;i<total;i++){ const base = bases[i % bases.length]; const k = randInt(1,10); const t = randInt(1,3);
    if (t===1) out.push({ q:`${k} × ${base}`, a:k*base });
    else if (t===2) out.push({ q:`${base} × ${k}`, a:base*k });
    else out.push({ q:`${base*k} ÷ ${base}`, a:k });
  }
  return shuffle(out).slice(0,total);
}
function buildFullyMixed(total, range){
  const out = [];
  for (let n=0;n<total;n++){ const a = randInt(range.min, range.max); const b = randInt(1,10); const t = randInt(1,3);
    if (t===1) out.push({ q:`${a} × ${b}`, a:a*b });
    else if (t===2) out.push({ q:`${b} × ${a}`, a:b*a });
    else out.push({ q:`${a*b} ÷ ${a}`, a:b });
  }
  return shuffle(out).slice(0,total);
}

/* Bronze: like Black, but missing numbers using ___ */
function buildBronzeQuestions(total){
  const out = [];
  const half = Math.max(1, Math.floor(total/2));
  // First half: guarantee blanks cycling patterns 1..4
  for (let i=0;i<half;i++){
    const A = randInt(2,12), B = randInt(1,10);
    const C = A*B;
    const t = (i % 4) + 1;
    if (t===1) out.push({ q:`___ × ${A} = ${C}`, a:B });
    else if (t===2) out.push({ q:`${A} × ___ = ${C}`, a:B });
    else if (t===3) out.push({ q:`___ ÷ ${A} = ${B}`, a:C });
    else if (t===4) out.push({ q:`${C} ÷ ___ = ${B}`, a:A });
  }
  // Second half: mix blanks and direct products
  for (let i=half;i<total;i++){
    const A = randInt(2,12), B = randInt(1,10);
    const C = A*B;
    const t = randInt(1,6);
    if (t===1) out.push({ q:`___ × ${A} = ${C}`, a:B });
    else if (t===2) out.push({ q:`${A} × ___ = ${C}`, a:B });
    else if (t===3) out.push({ q:`___ ÷ ${A} = ${B}`, a:C });
    else if (t===4) out.push({ q:`${C} ÷ ___ = ${B}`, a:A });
    else if (t===5) out.push({ q:`${A} × ${B}`, a:C });
    else          out.push({ q:`${B} × ${A}`, a:C });
  }
  return shuffle(out).slice(0,total);
}
  
/* Silver: like Black but expanded ×10 numbers (e.g., 20 × 300).
   Division questions should NOT show the result on the right. */
function buildSilverQuestions(total){
  const out = [];
  const exps = [0,1]; // 1, 10 only
  for (let i=0;i<total;i++){
    const A = randInt(2,12), B = randInt(1,10);
    const e1 = exps[randInt(0,exps.length-1)], e2 = exps[randInt(0,exps.length-1)];
    const bigA = A * (10 ** e1);
    const bigB = B * (10 ** e2);
    const prod = bigA * bigB;
    const t = randInt(1,3);
    if (t===1) {
      // multiplication, order 1
      out.push({ q:`${bigA} × ${bigB}`, a:prod });
    } else if (t===2) {
      // multiplication, order 2
      out.push({ q:`${bigB} × ${bigA}`, a:prod });
    } else {
      // division WITHOUT showing the result (no "= B")
      out.push({ q:`${prod} ÷ ${bigA}`, a:bigB });
    }
  }
  return shuffle(out).slice(0,total);
}

/* Gold: like Bronze (missing numbers) but using expanded ×10 numbers like Silver */
function buildGoldQuestions(total){
  const out = [];
  const half = Math.max(1, Math.floor(total/2));
  const exps = [0,1]; // 1, 10
  // First half: guarantee blanks cycling patterns 1..4
  for (let i=0;i<half;i++){
    const A = randInt(2,12), B = randInt(1,10);
    const e1 = exps[randInt(0,exps.length-1)], e2 = exps[randInt(0,exps.length-1)];
    const bigA = A * (10 ** e1);
    const bigB = B * (10 ** e2);
    const prod = bigA * bigB;
    const t = (i % 4) + 1;
    if (t===1) out.push({ q:`___ × ${bigA} = ${prod}`, a:bigB });
    else if (t===2) out.push({ q:`${bigA} × ___ = ${prod}`, a:bigB });
    else if (t===3) out.push({ q:`___ ÷ ${bigA} = ${bigB}`, a:prod });
    else if (t===4) out.push({ q:`${prod} ÷ ___ = ${bigB}`, a:bigA });
  }
  // Second half: mix blanks and direct products
  for (let i=half;i<total;i++){
    const A = randInt(2,12), B = randInt(1,10);
    const e1 = exps[randInt(0,exps.length-1)], e2 = exps[randInt(0,exps.length-1)];
    const bigA = A * (10 ** e1);
    const bigB = B * (10 ** e2);
    const prod = bigA * bigB;
    const t = randInt(1,6);
    if (t===1) out.push({ q:`___ × ${bigA} = ${prod}`, a:bigB });
    else if (t===2) out.push({ q:`${bigA} × ___ = ${prod}`, a:bigB });
    else if (t===3) out.push({ q:`___ ÷ ${bigA} = ${bigB}`, a:prod });
    else if (t===4) out.push({ q:`${prod} ÷ ___ = ${bigB}`, a:bigA });
    else if (t===5) out.push({ q:`${bigA} × ${bigB}`, a:prod });
    else          out.push({ q:`${bigB} × ${bigA}`, a:prod });
  }
  return shuffle(out).slice(0,total);
}

/* Platinum: like Silver but with exponents [0,1,2] (1, 10, 100). */
function buildPlatinumQuestions(total){
  const out = [];
  const exps = [0,1,2]; // 1, 10, 100
  for (let i=0;i<total;i++){
    const A = randInt(2,12), B = randInt(1,10);
    const e1 = exps[randInt(0,exps.length-1)], e2 = exps[randInt(0,exps.length-1)];
    const bigA = A * (10 ** e1);
    const bigB = B * (10 ** e2);
    const prod = bigA * bigB;
    const t = randInt(1,3);
    if (t===1) {
      out.push({ q:`${bigA} × ${bigB}`, a:prod });
    } else if (t===2) {
      out.push({ q:`${bigB} × ${bigA}`, a:prod });
    } else {
      // Division, no RHS answer shown
      out.push({ q:`${prod} ÷ ${bigA}`, a:bigB });
    }
  }
  return shuffle(out).slice(0,total);
}
/* ====== Quiz flow ====== */
function preflightAndStart(questions, opts = {}){
  const name = ($("home-username")?.value || "").trim();
  if (name) localStorage.setItem(NAME_KEY, name);

  ended = false;
  currentIndex = 0;
  allQuestions = (Array.isArray(questions) ? questions.slice() : []);
  userAnswers = new Array(allQuestions.length).fill("");

  // Make sure we actually show the quiz screen
  setScreen("quiz-screen");

  // Reset UI
  const qEl = $("question"); if (qEl) { qEl.style.display=""; qEl.textContent=""; }
  const aEl = $("answer");   if (aEl) { aEl.style.display=""; aEl.value=""; aEl.focus(); }
  const s   = $("score");    if (s)   { s.innerHTML=""; }

  createKeypad();
  showQuestion();
  startTimer(quizSeconds);
}
window.preflightAndStart = preflightAndStart;

function showQuestion(){
  if (ended) return;
  syncAnswerMaxLen();
  const q = allQuestions[currentIndex];
  const qEl = $("question");
  const aEl = $("answer");
  if (qEl) qEl.textContent = q ? q.q : "";
  if (aEl) { aEl.value = ""; aEl.focus(); attachKeyboard(aEl); }
}
window.showQuestion = showQuestion;

function quitFromQuiz(){
  teardownQuiz();
  destroyKeypad();
  goHome();
}
window.quitFromQuiz = quitFromQuiz;

function startTimer(seconds){
  clearInterval(timerInterval);
  timerDeadline = Date.now() + seconds*1000;
  timerInterval = setInterval(()=>{
    const remaining = Math.max(0, Math.ceil((timerDeadline - Date.now())/1000));
    const t = $("timer"); if (t) t.textContent = String(remaining);
    if (remaining <= 0){ clearInterval(timerInterval); endQuiz(); }
  }, 250);
}
window.startTimer = startTimer;

function teardownQuiz(){
  clearInterval(timerInterval); timerInterval = null;
  ended = true; submitLockedUntil = 0;
  if (desktopKeyHandler){ document.removeEventListener("keydown", desktopKeyHandler); desktopKeyHandler = null; }
}

function safeSubmit(){
  const now = Date.now();
  if (now < submitLockedUntil) return;
  submitLockedUntil = now + 200;

  const a = $("answer"); if(!a || ended) return;
  const valStr = a.value.trim();
  userAnswers[currentIndex] = (valStr === "") ? "" : Number(valStr);

  currentIndex++;
  if (currentIndex >= allQuestions.length){ endQuiz(); return; }
  showQuestion();
}
window.safeSubmit = safeSubmit;

/* ====== Keypad + Keyboard ====== */
function createKeypad(){
  const host = $("answer-pad"); if(!host) return;
  host.innerHTML = `
    <div class="pad">
      <button class="pad-btn key-7"     data-k="7">7</button>
      <button class="pad-btn key-8"     data-k="8">8</button>
      <button class="pad-btn key-9"     data-k="9">9</button>
      <button class="pad-btn pad-clear key-clear" data-k="clear">Clear</button>

      <button class="pad-btn key-4"     data-k="4">4</button>
      <button class="pad-btn key-5"     data-k="5">5</button>
      <button class="pad-btn key-6"     data-k="6">6</button>
      <button class="pad-btn pad-enter key-enter" data-k="enter">Enter</button>

      <button class="pad-btn key-1"     data-k="1">1</button>
      <button class="pad-btn key-2"     data-k="2">2</button>
      <button class="pad-btn key-3"     data-k="3">3</button>

      <button class="pad-btn key-0"     data-k="0">0</button>
      <button class="pad-btn pad-back key-back" data-k="back">⌫</button>
    </div>`;
  host.style.display = "block";
  host.style.pointerEvents = "auto";
  host.querySelectorAll(".pad-btn").forEach(btn=>{
    btn.addEventListener("pointerdown",(e)=>{ e.preventDefault(); handleKey(btn.getAttribute("data-k")); },{passive:false});
  });
}
function destroyKeypad(){
  const host = $("answer-pad"); if(!host) return;
  host.innerHTML = ""; host.style.display=""; host.style.pointerEvents="";
}

function handleKey(val){
  const a = $("answer"); if(!a || ended) return;
  if (val === "clear"){ a.value=""; a.dispatchEvent(new Event("input",{bubbles:true})); return; }
  if (val === "back") { a.value = a.value.slice(0,-1); a.dispatchEvent(new Event("input",{bubbles:true})); return; }
  if (val === "enter"){ safeSubmit(); return; }
  if (/^\d$/.test(val)){ const cap = getMaxLenForCurrentQuestion();
    if (a.value.length < cap){ a.value += val; a.dispatchEvent(new Event("input",{bubbles:true})); }
    try{ a.setSelectionRange(a.value.length,a.value.length);}catch{}
  }
}
window.handleKey = handleKey;

function attachKeyboard(a){
  if (desktopKeyHandler){ document.removeEventListener("keydown", desktopKeyHandler); desktopKeyHandler = null; }
  desktopKeyHandler = (e)=>{
    const quiz = $("quiz-container"); if(!quiz || quiz.style.display==="none" || ended) return;
    if (!a || a.style.display==="none") return;
    if (/^\d$/.test(e.key)){ e.preventDefault(); const cap = getMaxLenForCurrentQuestion();
      if (a.value.length < cap){ a.value += e.key; a.dispatchEvent(new Event("input",{bubbles:true})); }
      try{ a.setSelectionRange(a.value.length,a.value.length);}catch{}
    } else if (e.key==="Backspace" || e.key==="Delete"){ e.preventDefault(); a.value = a.value.slice(0,-1); a.dispatchEvent(new Event("input",{bubbles:true})); }
    else if (e.key==="Enter"){ e.preventDefault(); safeSubmit(); }
  };
  document.addEventListener("keydown", desktopKeyHandler);
  if (a){
    a.addEventListener("input", ()=>{ a.value = a.value.replace(/[^\d]/g,"").slice(0,getMaxLenForCurrentQuestion()); });
  }
}

/* ====== End & Answers ====== */
function endQuiz(){
  teardownQuiz();
  destroyKeypad();

  // Hide old question/answer UI so the title stays at the top only
  const qEl = $("question"); if (qEl) qEl.style.display = "none";
  const aEl = $("answer");   if (aEl) aEl.style.display = "none";

  let correct = 0;
  for (let i=0;i<allQuestions.length;i++){
    const c = Number(allQuestions[i].a);
    const u = (userAnswers[i]==="" ? NaN : Number(userAnswers[i]));
    if (!Number.isNaN(u) && u===c) correct++;
  }

  const s = $("score");
  if (s) {
    s.innerHTML = `
      <div class="result-line">
        <strong>Score =</strong> ${correct} / ${allQuestions.length}
      </div>
      <button class="big-button" onclick="showAnswers()">Show answers</button>
    `;
  }

  // Queue result for submission
  try{
    queueResult({
      secret:SHEET_SECRET,
      mode:modeLabel,
      name: (localStorage.getItem(NAME_KEY)||"").trim(),
      total:allQuestions.length,
      correct,
      ts:new Date().toISOString()
    });
    flushQueue();
  }catch(e){}
}
window.endQuiz = endQuiz;

function showAnswers(){
  const s = $("score"); if(!s) return;
  let html = `<div class="answers-grid">`;
  for (let i=0;i<allQuestions.length;i++){ const q = allQuestions[i] || {};
    const uRaw = userAnswers[i];
    const u = (uRaw === undefined || uRaw === "") ? "—" : String(uRaw);
    const correct = (uRaw === q.a);
    const hasBlank = (typeof q.q === "string" && q.q.indexOf("___") !== -1);
    let displayEq;
    if (hasBlank){
      displayEq = q.q.replace("___", `<u>${u}</u>`);
    } else {
      displayEq = `${q.q} = ${u}`;
    }
    html += `<div class="answer-chip ${correct ? "correct":"wrong"}">${displayEq}</div>`;
  }
  html += `</div>`;
  s.innerHTML = html;
}
window.showAnswers = showAnswers;

/* ====== Queue + Submit ====== */
function getQueue(){
  try{ return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]"); }catch{ return []; }
}
function setQueue(arr){
  try{ localStorage.setItem(QUEUE_KEY, JSON.stringify(arr)); }catch{}
}
function queueResult(obj){
  const q = getQueue(); q.push(Object.assign({id:cryptoRandom()}, obj)); setQueue(q);
}

async function flushQueue(){
  const q = getQueue();
  if (!q.length) return;
  const next = q[0];
  try{
    const res = await fetch(SHEET_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });
    if (res.ok){ q.shift(); setQueue(q); }
  }catch(e){ /* offline or error: keep item */ }
  if (q.length) setTimeout(flushQueue, 1500);
}
document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState==="visible") flushQueue(); });
window.addEventListener("online", flushQueue);

/* ====== Init ====== */
function initApp(){
  const saved = localStorage.getItem(NAME_KEY);
  if (saved && $("home-username")) $("home-username").value = saved;
  setScreen("home-screen");
}
window.addEventListener("DOMContentLoaded", initApp);


 
window.addEventListener("DOMContentLoaded", () => {
  const btnMini = document.getElementById("btn-mini");
  if (btnMini) btnMini.addEventListener("click", (e)=>{ try{ e.preventDefault(); }catch{} goMini(); });
  const btnNinja = document.getElementById("btn-ninja");
  if (btnNinja) btnNinja.addEventListener("click", (e)=>{ try{ e.preventDefault(); }catch{} goNinja(); });
});

// Delegated nav: any element with data-nav switches screens
window.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-nav]");
    if (!t) return;
    const target = t.getAttribute("data-nav");
    if (!target) return;
    try { e.preventDefault(); } catch {}
    try { setScreen(target); } catch (err) { 
      // Fallback direct DOM toggling
      ["home-screen","mini-screen","ninja-screen","quiz-screen"].forEach(s=>{
        const el = document.getElementById(s);
        if (el) el.style.display = (s===target? "block" : "none");
      });
    }
  }, {capture:true});
});

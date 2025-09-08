/* Times Tables Trainer — script.js (frontpage-GH19)
   - Restores keypad layout + fixed position (matches styles)
   - Dynamic answer length (+2 headroom)
   - Belt images on menu + quiz mascot (all belts incl. gold/platinum/obsidian)
   - Score line shows "Score ="
   - Bronze answers: underline filled-in missing number 
*/

const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbyIuCIgbFisSKqA0YBtC5s5ATHsHXxoqbZteJ4en7hYrf4AXmxbnMOUfeQ2ERZIERN-/exec";
const SHEET_SECRET   = "Banstead123";

const QUIZ_SECONDS_DEFAULT = 300; // 5 minutes
const BASE_MAX_ANSWER_LEN  = 4;
const EXTRA_DIGITS_ALLOWED = 2;
const QUEUE_KEY            = "tttQueueV1";
const NAME_KEY             = "tttName";

// Images used for quiz mascot (menu cards use <img> in HTML)
const BELT_IMAGES = {
  white:  "./images/belt-white.png",
  yellow: "./images/belt-yellow.png",
  orange: "./images/belt-orange.png",
  green:  "./images/belt-green.png",
  blue:   "./images/belt-blue.png",
  pink:   "./images/belt-pink.png",
  purple: "./images/belt-purple.png",
  red:    "./images/belt-red.png",
  black:  "./images/belt-black.png",
  bronze: "./images/belt-bronze.png",
  silver: "./images/belt-silver.png",
  gold:   "./images/belt-gold.png",
  platinum:"./images/belt-platinum.png",
  obsidian:"./images/belt-obsidian.png",
};

let userName = "";
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

/* ---------- utils ---------- */
const $ = (id)=>document.getElementById(id);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
const randInt=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
const cryptoRandom=()=>String(Date.now())+"-"+Math.floor(Math.random()*1e9);
function hashDJB2(s){ let h=5381; for(let i=0;i<s.length;i++){h=((h<<5)+h)+s.charCodeAt(i); h|=0;} return h>>>0; }
// --- iOS detection + soft-keyboard suppression ---
// --- iOS detection + soft-keyboard suppression ---

function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS
}
function enableIOSNoKeyboard(on){
  const a = document.getElementById("answer");
  if (!a) return;
  if (on && isIOS()){
    a.readOnly = true;                 // stops iOS soft keyboard
    a.setAttribute("inputmode","none"); // belt-and-braces
  } else {
    a.readOnly = false;
    a.setAttribute("inputmode","numeric");
  }
}


/* ---------- dynamic max length (+2 headroom) ---------- */
function getMaxLenForCurrentQuestion(){
  try{
    const q = allQuestions[currentIndex];
    if (!q || typeof q.a === "undefined") return BASE_MAX_ANSWER_LEN;
    const ansLen = String(q.a).length;
    return Math.max(BASE_MAX_ANSWER_LEN, ansLen + EXTRA_DIGITS_ALLOWED);
  }catch{ return BASE_MAX_ANSWER_LEN; }
}
function syncAnswerMaxLen(){
  const a = $("answer"); if(!a) return;
  const cap = getMaxLenForCurrentQuestion();
  try{ a.setAttribute("maxlength", String(cap)); }catch{}
  if (a.value.length > cap) a.value = a.value.slice(0, cap);
}

/* ---------- navigation ---------- */
function setScreen(id){
  ["home-screen","mini-screen","ninja-screen","quiz-container"].forEach(v=>{
    const el = $(v); if (el) el.style.display = (v===id ? "block" : "none");
  });
  document.body.setAttribute("data-screen", id);
}
function goHome(){ setScreen("home-screen"); hideMascot(); }
function goMini(){
  if (!userName) userName = (localStorage.getItem(NAME_KEY) || "").trim();
  const nameInput = $("home-username");
  if (nameInput){
    const val = nameInput.value.trim();
    if (val){ userName = val; localStorage.setItem(NAME_KEY, userName); }
  }
  const hello = $("hello-user");
  if (hello) hello.textContent = userName ? `Hello, ${userName}!` : "Hello!";
  buildTableButtons();
  setScreen("mini-screen");
  hideMascot();
}
function goNinja(){
  if (!userName) userName = (localStorage.getItem(NAME_KEY) || "").trim();
  const nameInput = $("home-username");
  if (nameInput){
    const val = nameInput.value.trim();
    if (val){ userName = val; localStorage.setItem(NAME_KEY, userName); }
  }
  setScreen("ninja-screen");
  hideMascot();
}
function quitFromQuiz(){
  teardownQuiz();
  hideMascot();
  goHome();
   enableIOSNoKeyboard(false);
}

/* ---------- mini tests ---------- */
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
  preflightAndStart(buildMiniQuestions(selectedBase, 50), {theme:""}); // no mascot
}

/* ---------- belts ---------- */
function startWhiteBelt(){ modeLabel="White Belt"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildBeltMixStructured([3,4],50),{theme:"white"}); }
function startYellowBelt(){ modeLabel="Yellow Belt"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([4,6],50),{theme:"yellow"}); }
function startOrangeBelt(){ modeLabel="Orange Belt (2x – 6x)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([2,3,4,5,6],50),{theme:"orange"}); }
function startGreenBelt(){ modeLabel="Green Belt"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([4,8],50),{theme:"green"}); }
function startBlueBelt(){ modeLabel="Blue Belt"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([7,8],50),{theme:"blue"}); }
function startPinkBelt(){ modeLabel="Pink Belt"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildMixedBases([7,9],50),{theme:"pink"}); }
function startPurpleBelt(){ modeLabel="Purple Belt (2×–10×)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(50,{min:2,max:10}),{theme:"purple"}); }
function startRedBelt(){ modeLabel="Red Belt (2×–10×, 100 Q)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(100,{min:2,max:10}),{theme:"red"}); }
function startBlackBelt(){ modeLabel="Black Belt (2×–12×, 100 Q)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildFullyMixed(100,{min:2,max:12}),{theme:"black"}); }
function startBronzeBelt(){ modeLabel="Bronze Belt (2×–12× + blanks, 100 Q)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildBronzeQuestions(100),{theme:"bronze"}); }
function startSilverBelt(){ modeLabel="Silver Belt (2×–12×, powers of 10, 100 Q)"; quizSeconds=QUIZ_SECONDS_DEFAULT; preflightAndStart(buildSilverQuestions(100),{theme:"silver"}); }
/* GH19 extra belts */
function startGoldBelt(){
  modeLabel = "Gold Belt";
  quizSeconds = QUIZ_SECONDS_DEFAULT;
  preflightAndStart(buildFullyMixed(100,{min:2,max:12}), {theme:"gold"});
}

function startPlatinumBelt(){
  modeLabel = "Platinum Belt (Missing Numbers)";
  quizSeconds = QUIZ_SECONDS_DEFAULT;
  preflightAndStart(buildBronzeQuestions(100), {theme:"platinum"});
}

function startObsidianBelt(){
  modeLabel = "Obsidian Belt (×10 Factors)";
  quizSeconds = QUIZ_SECONDS_DEFAULT;
  preflightAndStart(buildSilverQuestions(100), {theme:"obsidian"});
}

/* ---------- question builders ---------- */
function buildMiniQuestions(base, total){
  const out = [];
  for (let i=1;i<=10;i++) out.push({ q:`${i} × ${base}`, a:i*base });
  for (let i=1;i<=10;i++) out.push({ q:`${base} × ${i}`, a:base*i });
  for (let i=1;i<=10;i++) out.push({ q:`${base*i} ÷ ${base}`, a:i });
  const mix = [];
  for (let i=0;i<20;i++){
    const k = randInt(1,10);
    const t = randInt(1,3);
    if (t===1) mix.push({ q:`${k} × ${base}`, a:k*base });
    else if (t===2) mix.push({ q:`${base} × ${k}`, a:base*k });
    else mix.push({ q:`${base*k} ÷ ${base}`, a:k });
  }
  return out.concat(shuffle(mix));
}
function buildBeltMixStructured(bases,total){
  const out = [];
  for (const base of bases){
    for (let i=1;i<=10;i++) out.push({ q:`${i} × ${base}`, a:i*base });
    for (let i=1;i<=10;i++) out.push({ q:`${base} × ${i}`, a:base*i });
    for (let i=1;i<=10;i++) out.push({ q:`${base*i} ÷ ${base}`, a:i });
  }
  const need = Math.max(0, total - out.length);
  const mix = [];
  for (let i=0;i<need;i++){
    const base = bases[randInt(0,bases.length-1)];
    const k = randInt(1,10);
    const t = randInt(1,3);
    if (t===1) mix.push({ q:`${k} × ${base}`, a:k*base });
    else if (t===2) mix.push({ q:`${base} × ${k}`, a:base*k });
    else mix.push({ q:`${base*k} ÷ ${base}`, a:k });
  }
  return out.concat(shuffle(mix)).slice(0,total);
}
function buildMixedBases(bases,total){
  const out = [];
  for (let i=0;i<total;i++){
    const base = bases[i % bases.length];
    const k = randInt(1,10);
    const t = randInt(1,3);
    if (t===1) out.push({ q:`${k} × ${base}`, a:k*base });
    else if (t===2) out.push({ q:`${base} × ${k}`, a:base*k });
    else out.push({ q:`${base*k} ÷ ${base}`, a:k });
  }
  return shuffle(out);
}
function buildFullyMixed(total, range){
  const out = [];
  for (let n=0;n<total;n++){
    const a = randInt(range.min, range.max);
    const b = randInt(1,10);
    const t = randInt(1,3);
    if (t===1) out.push({ q:`${a} × ${b}`, a:a*b });
    else if (t===2) out.push({ q:`${b} × ${a}`, a:b*a });
    else out.push({ q:`${a*b} ÷ ${a}`, a:b });
  }
  return shuffle(out);
}
function buildBronzeQuestions(total){
  const out = [];
  for (let n=0;n<total;n++){
    const a = randInt(2,12);
    const b = randInt(1,10);
    const prod = a*b;
    const t = randInt(1,6);
    if (t===1){ out.push({ q:`___ × ${a} = ${prod}`, a:b }); }
    else if (t===2){ out.push({ q:`${a} × ___ = ${prod}`, a:b }); }
    else if (t===3){ out.push({ q:`___ ÷ ${a} = ${b}`, a:prod }); }
    else if (t===4){ out.push({ q:`${prod} ÷ ___ = ${b}`, a:a }); }
    else if (t===5){ out.push({ q:`${a} × ${b}`, a:prod }); }
    else { out.push({ q:`${b} × ${a}`, a:prod }); }
  }
  return shuffle(out);
}
function buildSilverQuestions(total){
  const bases = [2,3,4,5,6,7,8,9,10,11,12];
  const pow = [0,1];
  const out = [];
  for (let n=0;n<total;n++){
    const a = bases[Math.floor(Math.random()*bases.length)];
    const b = bases[Math.floor(Math.random()*bases.length)];
    const k = pow[Math.floor(Math.random()*pow.length)];
    const m = pow[Math.floor(Math.random()*pow.length)];
    const A = a * Math.pow(10, k);
    const B = b * Math.pow(10, m);
    const c = A * B;
    if (Math.random() < 0.5) out.push({ q:`${A} × ${B}`, a:c });
    else out.push({ q:`${c} ÷ ${A}`, a:B });
  }
  return shuffle(out);
}

/* ---------- quiz flow ---------- */
function preflightAndStart(questions, opts={}){
  ended = false;
  currentIndex = 0;
  allQuestions = questions.slice();
  userAnswers = new Array(allQuestions.length).fill("");

  const quiz = $("quiz-container");
  if (quiz) quiz.setAttribute("data-theme", opts.theme || "");

  setScreen("quiz-container");
  createKeypad();

  const title = $("quiz-title");
  if (title) title.textContent = modeLabel || "Quiz";

  if (opts.theme && BELT_IMAGES[opts.theme]){ showMascot(BELT_IMAGES[opts.theme], `${modeLabel} mascot`); }
  else { hideMascot(); }

  showQuestion();
  startTimer(quizSeconds);
enableIOSNoKeyboard(true);

  const a = $("answer");
  attachKeyboard(a);
}
function showQuestion(){
  const q = allQuestions[currentIndex];
  const qEl = $("question");
  const aEl = $("answer");
  if (qEl) qEl.textContent = q ? q.q : "";
  if (aEl){
    aEl.value = "";
    syncAnswerMaxLen();
    try{ aEl.focus(); aEl.setSelectionRange(aEl.value.length, aEl.value.length); }catch{}
  }
}
function handleKey(val){
  const a = $("answer"); if(!a || ended) return;
  if (val==="enter"){ safeSubmit(); return; }
  if (val==="back"){ a.value = a.value.slice(0,-1); a.dispatchEvent(new Event("input",{bubbles:true})); try{ a.setSelectionRange(a.value.length,a.value.length);}catch{} return; }
  if (val==="clear"){ a.value = ""; a.dispatchEvent(new Event("input",{bubbles:true})); return; }
  if (/^\d$/.test(val)){
    const cap = getMaxLenForCurrentQuestion();
    if (a.value.length < cap){
      a.value += val;
      a.dispatchEvent(new Event("input",{bubbles:true}));
      try{ a.setSelectionRange(a.value.length,a.value.length);}catch{}
    }
  }
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
  clearInterval(timerInterval); timerInterval = null;
  ended = true; submitLockedUntil = 0;
  if (desktopKeyHandler){ document.removeEventListener("keydown", desktopKeyHandler); desktopKeyHandler = null; }
}

/* ---------- mascot helpers ---------- */
function showMascot(src, alt){
  const m = $("quiz-mascot"); if(!m) return;
  m.src = src; m.alt = alt || "Belt mascot"; m.classList.add("visible");
}
function hideMascot(){
  const m = $("quiz-mascot"); if(!m) return;
  m.classList.remove("visible"); m.removeAttribute("src"); m.alt = "";
}

/* ---------- end & answers ---------- */
function endQuiz(){
  teardownQuiz();
  destroyKeypad();
enableIOSNoKeyboard(false);
   
  let correct = 0;
  for (let i=0;i<allQuestions.length;i++){
    const c = Number(allQuestions[i].a);
    const u = (userAnswers[i]==="" ? NaN : Number(userAnswers[i]));
    if (!Number.isNaN(u) && u===c) correct++;
  }

  const s = $("score");
  if (s){
    s.innerHTML = `
      <div class="result-line"><strong>Score =</strong> ${correct} / ${allQuestions.length}</div>
      <button class="big-button" onclick="showAnswers()">Show answers</button>
    `;
  }

  try{
    queueResult({ secret:SHEET_SECRET, mode:modeLabel, name:userName || (localStorage.getItem(NAME_KEY)||""), total:allQuestions.length, correct, ts:new Date().toISOString() });
    flushQueue();
  }catch(e){}
}
function showAnswers(){
  const s = $("score"); if(!s) return;
  let html = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;justify-items:start;max-width:1200px;margin:20px auto;">`;
  for (let i=0;i<allQuestions.length;i++){
    const q = allQuestions[i] || {};
    const uRaw = userAnswers[i];
    const u = (uRaw === undefined || uRaw === "") ? "—" : String(uRaw);
    const correct = (uRaw === q.a);
    const hasBlank = (typeof q.q === "string" && q.q.indexOf("___") !== -1);
    const display = hasBlank ? q.q.replace("___", `<u>${u}</u>`) : `${q.q} = ${u}`;
    html += `<div style="font-size:22px;font-weight:bold;color:${correct?'green':'red'};text-align:left;">${display}</div>`;
  }
  html += "</div>";
  s.insertAdjacentHTML("beforeend", html);
}

/* ---------- keypad ---------- */
function createKeypad(){
  const host = $("answer-pad"); if(!host) return;
  host.innerHTML = `
    <div class="pad">
      <button class="pad-btn key-7" data-k="7">7</button>
      <button class="pad-btn key-8" data-k="8">8</button>
      <button class="pad-btn key-9" data-k="9">9</button>
      <button class="pad-btn pad-clear key-clear" data-k="clear">Clear</button>

      <button class="pad-btn key-4" data-k="4">4</button>
      <button class="pad-btn key-5" data-k="5">5</button>
      <button class="pad-btn key-6" data-k="6">6</button>
      <button class="pad-btn pad-enter key-enter" data-k="enter">Enter</button>

      <button class="pad-btn key-1" data-k="1">1</button>
      <button class="pad-btn key-2" data-k="2">2</button>
      <button class="pad-btn key-3" data-k="3">3</button>

      <button class="pad-btn key-0 pad-wide" data-k="0">0</button>
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

/* ---------- keyboard ---------- */
function attachKeyboard(a){
  if (desktopKeyHandler) document.removeEventListener("keydown", desktopKeyHandler);
  desktopKeyHandler = (e)=>{
    const quiz = $("quiz-container"); if(!quiz || quiz.style.display==="none" || ended) return;
    if (!a || a.style.display==="none") return;
    if (/^\d$/.test(e.key)){
      e.preventDefault();
      const cap = getMaxLenForCurrentQuestion();
      if (a.value.length < cap){ a.value += e.key; a.dispatchEvent(new Event("input",{bubbles:true})); }
      try{ a.setSelectionRange(a.value.length,a.value.length);}catch{}
    } else if (e.key==="Backspace" || e.key==="Delete"){
      e.preventDefault(); a.value = a.value.slice(0,-1); a.dispatchEvent(new Event("input",{bubbles:true}));
    } else if (e.key==="Enter"){
      e.preventDefault(); safeSubmit();
    }
  };
  document.addEventListener("keydown", desktopKeyHandler);
  if (a){
    a.addEventListener("input", ()=>{
      const cap = getMaxLenForCurrentQuestion();
      if (a.value.length > cap) a.value = a.value.slice(0, cap);
    });
  }
}

/* ---------- offline queue ---------- */
function queueResult(item){
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  const body = JSON.stringify(item);
  const rec = { id: cryptoRandom(), idempotency: hashDJB2(body), body, ts: Date.now() };
  if (!q.some(r=>r.idempotency===rec.idempotency)) q.push(rec);
  while (q.length > 200) q.shift();
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
let flushing = false, backoffMs = 0;
async function flushQueue(){
  if (flushing) return;
  let q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  if (!q.length) return;
  flushing = true;
  try{
    const next = q[0];
    const blob = new Blob([next.body], { type:"application/json" });
    await fetch(SHEET_ENDPOINT, { method:"POST", mode:"no-cors", body: blob });
    q.shift();
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    backoffMs = 0;
  }catch(e){
    backoffMs = Math.min(backoffMs ? backoffMs*2 : 1000, 30000);
  }finally{ flushing = false; }
  q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  if (q.length) setTimeout(flushQueue, backoffMs || 0);
}
document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState==="visible") flushQueue(); });
window.addEventListener("online", flushQueue);

/* ---------- exports ---------- */
window.goHome = goHome; window.goMini = goMini; window.goNinja = goNinja; window.quitFromQuiz = quitFromQuiz;
window.startQuiz = startQuiz; window.buildTableButtons = buildTableButtons; window.selectTable = selectTable;
window.preflightAndStart = preflightAndStart; window.showQuestion = showQuestion; window.handleKey = handleKey;
window.safeSubmit = safeSubmit; window.startTimer = startTimer; window.endQuiz = endQuiz; window.showAnswers = showAnswers;

window.startWhiteBelt  = startWhiteBelt;  window.startYellowBelt = startYellowBelt; window.startOrangeBelt = startOrangeBelt;
window.startGreenBelt  = startGreenBelt;  window.startBlueBelt   = startBlueBelt;  window.startPinkBelt   = startPinkBelt;
window.startPurpleBelt = startPurpleBelt; window.startRedBelt    = startRedBelt;    window.startBlackBelt  = startBlackBelt;
window.startBronzeBelt = startBronzeBelt; window.startSilverBelt = startSilverBelt;
window.startGoldBelt   = startGoldBelt;   window.startPlatinumBelt = startPlatinumBelt; window.startObsidianBelt = startObsidianBelt;

/* ---------- init ---------- */
function initApp(){
  const saved = localStorage.getItem(NAME_KEY);
  if (saved && $("home-username")) $("home-username").value = saved;
  setScreen("home-screen");
   if (isIOS()) document.body.classList.add("ios");  // <- add this line
  hideMascot();function initApp(){
  const saved = localStorage.getItem(NAME_KEY);
  if (saved && document.getElementById("home-username")) document.getElementById("home-username").value = saved;
}
window.addEventListener("DOMContentLoaded", initApp);

}
window.addEventListener("DOMContentLoaded", initApp);

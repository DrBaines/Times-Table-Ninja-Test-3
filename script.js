/* Times Tables Trainer — script.js (dynamic answer length +2) 

This version adds:
- Dynamic maxlength per question based on the correct answer length (+2 extra digits allowed)
- Same behavior for on-screen keypad and hardware keyboard
- No other functional changes required

How to use:
1) Save as script.js in your repo (or rename and update index.html).
2) In index.html, bump cache buster, e.g.:
   <script src="./script.js?v=frontpage-GH4" defer></script>
*/

const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbyIuCIgbFisSKqA0YBtC5s5ATHsHXxoqbZteJ4en7hYrf4AXmxbnMOUfeQ2ERZIERN-/exec";
const SHEET_SECRET   = "Banstead123";

const QUIZ_SECONDS_DEFAULT = 300; // 5 minutes

// === Dynamic answer-length controls ===
const BASE_MAX_ANSWER_LEN  = 4; // never less than 4
const EXTRA_DIGITS_ALLOWED = 2; // allow +2 beyond the correct answer length

const QUEUE_KEY = "tttQueueV1";
const NAME_KEY  = "tttName";

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
const clamp = (n,min,max)=>Math.max(min, Math.min(max, n));
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
const randInt=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
const cryptoRandom=()=>String(Date.now())+"-"+Math.floor(Math.random()*1e9);
function hashDJB2(s){ let h=5381; for(let i=0;i<s.length;i++){h=((h<<5)+h)+s.charCodeAt(i); h|=0;} return h>>>0; }

/* ---------- dynamic max length (with +2 headroom) ---------- */
function getMaxLenForCurrentQuestion(){
  try{
    const q = allQuestions[currentIndex];
    if (!q || typeof q.a === "undefined") return BASE_MAX_ANSWER_LEN;
    const ansLen = String(q.a).length;
    return Math.max(BASE_MAX_ANSWER_LEN, ansLen + EXTRA_DIGITS_ALLOWED);
  }catch{
    return BASE_MAX_ANSWER_LEN;
  }
}
function syncAnswerMaxLen(){
  const a = $("answer");
  if (!a) return;
  const cap = getMaxLenForCurrentQuestion();
  try{ a.setAttribute("maxlength", String(cap)); }catch{}
  if (a.value.length > cap) a.value = a.value.slice(0, cap);
}

/* ---------- navigation ---------- */
function setScreen(id){
  ["home-screen","mini-screen","ninja-screen","quiz-container"].forEach(v=>{
    const el = $(v);
    if (el) el.style.display = (v===id ? "block" : "none");
  });
  document.body.setAttribute("data-screen", id);
}
function goHome(){ setScreen("home-screen"); }
function goMini(){
  if (!userName) { userName = (localStorage.getItem(NAME_KEY) || "").trim(); }
  const nameInput = $("home-username");
  if (nameInput){
    const val = nameInput.value.trim();
    if (val) { userName = val; localStorage.setItem(NAME_KEY, userName); }
  }
  const hello = $("hello-user");
  if (hello) hello.textContent = userName ? `Hello, ${userName}!` : "Hello!";
  buildTableButtons();
  setScreen("mini-screen");
}
function goNinja(){
  if (!userName) { userName = (localStorage.getItem(NAME_KEY) || "").trim(); }
  const nameInput = $("home-username");
  if (nameInput){
    const val = nameInput.value.trim();
    if (val) { userName = val; localStorage.setItem(NAME_KEY, userName); }
  }
  setScreen("ninja-screen");
}
function quitFromQuiz(){
  teardownQuiz();
  destroyKeypad(); // ensure keypad removed
  goHome();
}

/* ---------- mini tests ---------- */
let selectedBase = 2;
function buildTableButtons(){
  const wrap = $("table-choices");
  if (!wrap) return;
  let html = "";
  for (let b=2; b<=12; b++){
    html += `<button class="table-btn" onclick="selectTable(${b})">${b}×</button>`;
  }
  wrap.innerHTML = html;
}
function selectTable(b){ selectedBase = clamp(b,2,12); }
function startQuiz(){
  modeLabel = `Mini ${selectedBase}×`;
  quizSeconds = QUIZ_SECONDS_DEFAULT;
  preflightAndStart(buildMiniQuestions(selectedBase, 50));
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

/* ---------- question builders ---------- */
// ... [functions buildMiniQuestions, buildBeltMixStructured, buildMixedBases, buildFullyMixed, buildBronzeQuestions, buildSilverQuestions same as before]
// ... [quiz flow, keypad, attachKeyboard, queue logic, exports, init same as before with syncAnswerMaxLen in showQuestion()]

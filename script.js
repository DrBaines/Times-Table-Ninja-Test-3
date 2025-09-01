/* Times Tables Trainer script (frontpage-GH15) */

const $ = id => document.getElementById(id);
let allQuestions = [], userAnswers = [], currentIndex=0, ended=false;
let quizSeconds=300, modeLabel="";

function setScreen(id) {
  if (id === "quiz-container") id = "quiz-screen";
  const screens = ["home-screen","mini-screen","ninja-screen","quiz-screen"];
  screens.forEach(s=>{ const el=$(s); if(el) el.style.display = (s===id?"block":"none"); });
}

function goHome() {
  const s=$("score"); if(s) s.innerHTML="";
  const q=$("question"); if(q) q.textContent="";
  const a=$("answer"); if(a) a.value="";
  setScreen("home-screen");
}
window.goHome=goHome;

function goMini() { setScreen("mini-screen"); }
function goNinja(){ setScreen("ninja-screen"); }
window.goMini=goMini; window.goNinja=goNinja;

function startQuiz(){
  allQuestions=[{q:"2×2",a:4},{q:"3×3",a:9}];
  userAnswers=new Array(allQuestions.length).fill("");
  currentIndex=0; ended=false;
  preflightAndStart(allQuestions);
}
window.startQuiz=startQuiz;

function preflightAndStart(questions,opts={}){
  ended=false; currentIndex=0;
  allQuestions = Array.isArray(questions)?questions.slice():[];
  userAnswers=new Array(allQuestions.length).fill("");
  setScreen("quiz-screen");
  const qEl=$("question"); if(qEl){qEl.style.display=""; qEl.textContent="";}
  const aEl=$("answer"); if(aEl){aEl.style.display=""; aEl.value=""; aEl.focus();}
  const s=$("score"); if(s) s.innerHTML="";
  showQuestion();
}
window.preflightAndStart=preflightAndStart;

function showQuestion(){
  const q=allQuestions[currentIndex]; if(!q) return;
  $("question").textContent=q.q;
  $("answer").value="";
}
window.showQuestion=showQuestion;

function quitFromQuiz(){ goHome(); }
window.quitFromQuiz=quitFromQuiz;

function startWhiteBelt(){ startQuiz(); }
window.startWhiteBelt=startWhiteBelt;

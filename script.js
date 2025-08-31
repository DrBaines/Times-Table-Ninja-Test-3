/* Times Tables Trainer — script.js (frontpage-GH12)
   Updated showAnswers for Bronze questions
*/

function showAnswers(){
  const s = document.getElementById('score');
  if (!s) return;

  // Build the 5-column grid of answers
  let html = `
    <div style="
      display:grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      justify-items: start;
      max-width: 1200px;
      margin: 20px auto;
    ">
  `;

  for (let i = 0; i < allQuestions.length; i++){
    const q = allQuestions[i] || {};
    const hasBlank = typeof q.q === "string" && q.q.indexOf("___") !== -1;

    const uRaw = userAnswers[i];
    const u = (uRaw === undefined || uRaw === "") ? "—" : String(uRaw);
    const correct = (uRaw === q.a); // strict: numbers match exactly

    // For Bronze “missing number” items, replace the blank with the child’s answer (underlined)
    let displayEq;
    if (hasBlank) {
      displayEq = q.q.replace("___", `<u>${u}</u>`);
    } else {
      displayEq = `${q.q} = ${u}`;
    }

    html += `
      <div style="font-size:22px; font-weight:bold; color:${correct ? 'green' : 'red'}; text-align:left;">
        ${displayEq}
      </div>
    `;
  }

  html += "</div>";

  // Append (don’t overwrite the score line)
  s.insertAdjacentHTML('beforeend', html);
}

// ensure export
window.showAnswers = showAnswers;

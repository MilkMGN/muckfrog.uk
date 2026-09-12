async function fetchQuestions(){
  const res = await fetch('/api/questions');
  const arr = await res.json();
  const out = document.getElementById('questions');
  out.innerHTML = '';
  const token = localStorage.getItem('qa_token');
  arr.forEach(q => {
    const div = document.createElement('div');
    div.className = 'q';
    const meta = document.createElement('div'); meta.className='meta';
    meta.textContent = `${q.name} • ${new Date(q.timestamp).toLocaleString()}`;
    const qtext = document.createElement('div'); qtext.textContent = q.question;
    div.appendChild(meta); div.appendChild(qtext);
    if(q.answered){
      const a = document.createElement('div'); a.style.marginTop='0.5rem'; a.textContent = 'Answer: ' + q.answer; div.appendChild(a);
    } else if(token){
      const form = document.createElement('form'); form.className='answer-form';
      const ta = document.createElement('textarea'); ta.rows=3; ta.placeholder='Your answer';
      const b = document.createElement('button'); b.className='btn'; b.textContent='Answer';
      form.appendChild(ta); form.appendChild(b);
      form.addEventListener('submit', async (e) =>{
        e.preventDefault();
        const ans = ta.value.trim(); if(!ans) return alert('Answer required');
        const r = await fetch('/api/answer',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({id:q.id,answer:ans})});
        const j = await r.json();
        if(r.ok){ fetchQuestions(); } else alert(j.error||'Failed');
      });
      div.appendChild(form);
    }
    out.appendChild(div);
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  const askForm = document.getElementById('askForm');
  askForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('askName').value;
    const question = document.getElementById('askQuestion').value;
    const msg = document.getElementById('askMsg');
    msg.textContent = '';
    const r = await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,question})});
    const j = await r.json();
    if(r.ok){ msg.textContent = 'Question submitted — thanks! (Check back later for answers)'; askForm.reset(); }
    else msg.textContent = j.error||'Failed to submit (rate limit: 1/hour)';
  });
  fetchQuestions();
  setInterval(fetchQuestions, 30*1000);
});

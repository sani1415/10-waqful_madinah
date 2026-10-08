/* Waqful Madinah — js/teacher/exams.js: exams tab */
// ══ EXAMS ══════════════════════════════════════════════════
function goExamTab(tab,btn){
  examTab=tab;
  document.querySelectorAll('.exam-tab-btn').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active');
  document.getElementById('examListPane').style.display    = tab==='list'?'block':'none';
  document.getElementById('examCreatePane').style.display  = tab==='create'?'block':'none';
  document.getElementById('examResultsPane').style.display = tab==='results'?'block':'none';
  syncExamFab();
  if(tab==='list')    renderQuizList();
  if(tab==='create')  initCreateQuiz();
  if(tab==='results') initResultsQuizSelect();
}
function syncExamFab(){
  const fab=document.getElementById('fab');
  if(!fab) return;
  if(curTab==='settings'||curTab==='diary'||(curTab==='exams'&&examTab==='create')) fab.style.display='none';
  else fab.style.display='flex';
}

function initCreateQuiz(){
  questions=[]; curQContainer='questionList'; qSelectedIds=[];
  document.getElementById('q_title').value='';
  document.getElementById('q_subject').value='';
  document.getElementById('q_desc').value='';
  document.getElementById('q_time').value='30';
  document.getElementById('q_audio_time').value='2';
  document.getElementById('q_pass').value='60';
  document.getElementById('q_deadline').value='';
  const search=document.getElementById('qStudentSearch'); if(search) search.value='';
  renderQStudentPicker();
  document.getElementById('qStudents').innerHTML=API.Students.getAll().map(s=>`
    <div class="s-check-item"><input type="checkbox" id="qc_${s.id}" value="${s.id}" style="accent-color:#128C7E">
    <label for="qc_${s.id}" style="font-size:14px;cursor:pointer"><span style="color:#128C7E;font-weight:600;font-size:12px">${esc(API.Students.displayWaqfId(s.waqfId))}</span> · ${esc(s.name)}${s.responsibility?` <span style="font-size:11px;font-weight:700;color:#E65100;background:#FFF3E0;border-radius:5px;padding:1px 5px">${esc(s.responsibility)}</span>`:''}</label></div>`).join('');
  renderQuestions();
}
function studentOptionLabel(s){
  return `${API.Students.displayWaqfId(s.waqfId)} · ${s.name}${s.responsibility?' · '+s.responsibility:''}`;
}
function renderQStudentPicker(){
  const picker=document.getElementById('qStudentPicker');
  const chips=document.getElementById('qSelectedStudents');
  const count=document.getElementById('qSelectedCount');
  if(!picker||!chips||!count) return;
  const q=(document.getElementById('qStudentSearch')?.value||'').trim().toLowerCase();
  const all=API.Students.getAll();
  const selected=new Set(qSelectedIds);
  const available=all.filter(s=>{
    if(selected.has(s.id)) return false;
    if(!q) return true;
    const hay=[s.name,s.waqfId,API.Students.displayWaqfId(s.waqfId),s.responsibility].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  picker.innerHTML='<option value="">'+(all.length?'ছাত্র বেছে নিন...':'ছাত্র নেই')+'</option>'+available.map(s=>`<option value="${s.id}">${esc(studentOptionLabel(s))}</option>`).join('');
  const selectedRows=qSelectedIds.map(id=>all.find(s=>s.id===id)).filter(Boolean);
  count.textContent=selectedRows.length?`${selectedRows.length} জন ছাত্র নির্বাচিত`:'কোনো ছাত্র নির্বাচিত নয়';
  chips.innerHTML=selectedRows.length?selectedRows.map(s=>`
    <span class="exam-student-chip"><span>${esc(studentOptionLabel(s))}</span><button type="button" onclick="removeQuizStudent('${s.id}')" aria-label="মুছুন">×</button></span>
  `).join(''):`<div class="exam-student-empty">${all.length?(available.length?'ড্রপডাউন থেকে ছাত্র নির্বাচন করুন।':'এই খোঁজে ছাত্র মেলেনি।'):'আগে ছাত্র যোগ করুন।'}</div>`;
}
function addQuizStudent(id){
  if(!id) return;
  if(!qSelectedIds.includes(id)) qSelectedIds.push(id);
  const picker=document.getElementById('qStudentPicker'); if(picker) picker.value='';
  renderQStudentPicker();
}
function removeQuizStudent(id){ qSelectedIds=qSelectedIds.filter(x=>x!==id); renderQStudentPicker(); }
function clearQuizStudents(){ qSelectedIds=[]; renderQStudentPicker(); }
function selectAllQuizStudents(){ qSelectedIds=API.Students.getAll().map(s=>s.id); renderQStudentPicker(); }
function toggleQAll(cb){ qSelectedIds=cb&&cb.checked?API.Students.getAll().map(s=>s.id):[]; renderQStudentPicker(); }

function addQuestion(){
  questions.push({ type:'multiple_choice', text:'', options:['','','',''], correctAnswer:'', marks:1 });
  renderQuestions();
}
function renderQuestions(){
  const el=document.getElementById(curQContainer);
  updateExamOralFields();
  if(!questions.length){ el.innerHTML='<div style="text-align:center;padding:16px;color:var(--gray-400);font-size:13px">প্রশ্ন যোগ করুন।</div>'; return; }
  el.innerHTML=questions.map((q,i)=>`
    <div class="question-card">
      <button class="del-q-btn" onclick="deleteQuestion(${i})">✕</button>
      <div class="q-num">প্রশ্ন ${i+1} · <input type="number" value="${q.marks||1}" min="1" max="100" style="width:44px;border:1px solid var(--gray-300);border-radius:4px;padding:2px 4px;font-size:12px;font-family:var(--font)" onchange="qChange(${i},'marks',this.value)"> নম্বর</div>
      <select class="q-type-select" onchange="qTypeChange(${i},this.value)">
        <option value="multiple_choice" ${q.type==='multiple_choice'?'selected':''}>MCQ (বহুনির্বাচনী)</option>
        <option value="true_false"      ${q.type==='true_false'?'selected':''}>সত্য/মিথ্যা</option>
        <option value="fill_blank"      ${q.type==='fill_blank'?'selected':''}>শূন্যস্থান পূরণ</option>
        <option value="short_answer"    ${q.type==='short_answer'?'selected':''}>সংক্ষিপ্ত উত্তর</option>
        <option value="essay"           ${q.type==='essay'?'selected':''}>রচনামূলক</option>
        <option value="audio"           ${q.type==='audio'?'selected':''}>মৌখিক উত্তর</option>
        <option value="file_upload"     ${q.type==='file_upload'?'selected':''}>ফাইল আপলোড</option>
      </select>
      <textarea class="form-input" rows="2" placeholder="প্রশ্নের বিবরণ লিখুন..." style="margin-bottom:10px" onchange="qChange(${i},'text',this.value)">${esc(q.text)}</textarea>
      ${renderQuestionOptions(q,i)}
    </div>`).join('');
}
function updateExamOralFields(){
  const hasAudio=questions.some(q=>q.type==='audio');
  ['q_audio_group','ec_audio_group'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=hasAudio?'':'none';
  });
}
function renderQuestionOptions(q,i){
  if(q.type==='multiple_choice'){
    return `<div>${(q.options||[]).map((opt,oi)=>`
      <div class="q-option-row">
        <input type="radio" name="correct_${i}" value="${oi}" ${q.correctAnswer==oi?'checked':''} onchange="qChange(${i},'correctAnswer','${oi}')" title="সঠিক উত্তর">
        <input type="text" placeholder="অপশন ${oi+1}" value="${esc(opt)}" onchange="qOptChange(${i},${oi},this.value)" style="flex:1;border:1.5px solid var(--gray-300);border-radius:8px;padding:7px 10px;font-family:var(--font);font-size:13px">
        <button onclick="removeOption(${i},${oi})">✕</button>
      </div>`).join('')}
      <button class="add-option-btn" onclick="addOption(${i})">＋ অপশন যোগ করুন</button>
      <small style="color:var(--gray-400);font-size:11px">রেডিও বাটনে ক্লিক করে সঠিক উত্তর নির্বাচন করুন</small></div>`;
  }
  if(q.type==='true_false'){
    return `<div style="display:flex;gap:10px;margin-bottom:8px">
      <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="radio" name="tf_${i}" value="true"  ${q.correctAnswer==='true'?'checked':''}  onchange="qChange(${i},'correctAnswer','true')"> সত্য</label>
      <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="radio" name="tf_${i}" value="false" ${q.correctAnswer==='false'?'checked':''} onchange="qChange(${i},'correctAnswer','false')"> মিথ্যা</label>
    </div>`;
  }
  if(q.type==='fill_blank'){
    return `<input type="text" class="form-input" placeholder="সঠিক উত্তর" value="${esc(q.correctAnswer||'')}" onchange="qChange(${i},'correctAnswer',this.value)" style="margin-bottom:6px">
    <small style="color:var(--gray-400);font-size:11px">ছাত্রের উত্তর হুবহু মিলিয়ে স্বয়ংক্রিয় নম্বর দেওয়া হবে</small>`;
  }
  if(q.type==='file_upload'){
    return `<input type="text" class="form-input" placeholder="ফাইল আপলোডের নির্দেশনা" value="${esc(q.uploadInstructions||'')}" onchange="qChange(${i},'uploadInstructions',this.value)">`;
  }
  if(q.type==='audio'){
    return `<p style="font-size:12px;color:var(--gray-400);padding:4px 0">ছাত্র অডিও রেকর্ড করে জমা দেবে। এই পরীক্ষার মৌখিক সময় উপরে নির্ধারণ করুন।</p>`;
  }
  return `<p style="font-size:12px;color:var(--gray-400);padding:4px 0">জিম্মাদার নিজে নম্বর দেবেন।</p>`;
}
function qChange(i,key,val){ questions[i][key]=val; }
function qOptChange(i,oi,val){ questions[i].options[oi]=val; }
function qTypeChange(i,val){ questions[i].type=val; questions[i].correctAnswer=''; if(val==='multiple_choice'&&!questions[i].options?.length) questions[i].options=['','','','']; renderQuestions(); }
function addOption(i){ questions[i].options.push(''); renderQuestions(); }
function removeOption(i,oi){ questions[i].options.splice(oi,1); renderQuestions(); }
function deleteQuestion(i){ questions.splice(i,1); renderQuestions(); }

async function saveQuiz(){
  const title=document.getElementById('q_title').value.trim(); if(!title){ showToast('শিরোনাম লিখুন!'); return; }
  if(!questions.length){ showToast('কমপক্ষে একটি প্রশ্ন যোগ করুন!'); return; }
  if(!qSelectedIds.length){ showToast('কমপক্ষে একজন ছাত্র নির্বাচন করুন!'); return; }
  try{ await API.Exams.addQuiz({
    title, subject:document.getElementById('q_subject').value.trim(),
    desc:document.getElementById('q_desc').value.trim(),
    timeLimit:document.getElementById('q_time').value,
    audioLimitSeconds:(parseInt(document.getElementById('q_audio_time').value)||2)*60,
    passPercent:document.getElementById('q_pass').value,
    deadline:document.getElementById('q_deadline').value,
    assigneeIds:qSelectedIds.slice(),
    questions,
  }); }catch(e){ console.error(e); showToast('❌ পরীক্ষা সেভ হয়নি'); return; }
  showToast('✅ পরীক্ষা সংরক্ষিত হয়েছে!');
  goExamTab('list', document.querySelector('.exam-tab-btn'));
}

function openAddExamForChat(sid){
  examChatSid=sid; questions=[]; curQContainer='ecQList';
  const s=API.Students.getById(sid);
  document.getElementById('ecStudentName').textContent=s?(s.waqfId?API.Students.displayWaqfId(s.waqfId)+' · ':'')+s.name:'';
  ['ec_title','ec_subject','ec_desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ec_time').value='30';
  document.getElementById('ec_audio_time').value='2';
  document.getElementById('ec_pass').value='60';
  document.getElementById('ec_deadline').value='';
  renderQuestions();
  openModal('addExamFromChatModal');
}
async function saveExamFromChat(){
  const title=document.getElementById('ec_title').value.trim(); if(!title){ showToast('শিরোনাম লিখুন!'); return; }
  if(!questions.length){ showToast('কমপক্ষে একটি প্রশ্ন যোগ করুন!'); return; }
  try{ await API.Exams.addQuiz({
    title, subject:document.getElementById('ec_subject').value.trim(),
    desc:document.getElementById('ec_desc').value.trim(),
    timeLimit:document.getElementById('ec_time').value,
    audioLimitSeconds:(parseInt(document.getElementById('ec_audio_time').value)||2)*60,
    passPercent:document.getElementById('ec_pass').value,
    deadline:document.getElementById('ec_deadline').value,
    assigneeIds:[examChatSid], questions,
  }); }catch(e){ console.error(e); showToast('❌ পরীক্ষা সেভ হয়নি'); return; }
  closeModal('addExamFromChatModal');
  curQContainer='questionList'; questions=[];
  renderAll(); showToast('✅ পরীক্ষা সংরক্ষিত হয়েছে!');
}
function renderQuizList(){
  const quizzes=API.Exams.getQuizzes();
  const el=document.getElementById('quizList');
  if(!quizzes.length){ el.innerHTML='<div class="empty-state"><div class="icon">📝</div><p>কোনো পরীক্ষা নেই।<br>নতুন ট্যাবে যোগ করুন।</p></div>'; return; }
  el.innerHTML=quizzes.map(q=>{
    const subs=API.Exams.getSubmissionsForQuiz(q.id); const assigned=q.assigneeIds?.length||0;
    return `<div class="quiz-card">
      <div class="quiz-card-hd">
        <div style="width:44px;height:44px;border-radius:12px;background:#E8F5E9;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📝</div>
        <div class="quiz-card-info">
          <div class="quiz-card-title">${esc(q.title)}</div>
          <div class="quiz-card-meta">${esc(q.subject||'')} · ${q.questions?.length||0}টি প্রশ্ন · ${q.timeLimit} মিনিট</div>
        </div>
      </div>
      <div class="quiz-card-ft">
        <span class="quiz-stat">👥 ${assigned} জন নির্ধারিত</span>
        <span class="quiz-stat">✅ ${subs.length} জমা</span>
        ${q.deadline?`<span class="quiz-stat">📅 ${q.deadline}</span>`:''}
        <button onclick="deleteQuiz('${q.id}')" style="background:var(--red-lt);color:var(--red);border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">🗑 মুছুন</button>
      </div>
    </div>`;
  }).join('');
}
async function deleteQuiz(qid){ if(!confirm('এই পরীক্ষা মুছবেন?')) return; try{ await API.Exams.deleteQuiz(qid); renderQuizList(); showToast('🗑 মুছে ফেলা হয়েছে'); }catch(e){ console.error(e); showToast('❌ পরীক্ষা মোছা যায়নি'); } }

function initResultsQuizSelect(){
  const sel=document.getElementById('resultQuizSelect');
  const quizzes=API.Exams.getQuizzes();
  sel.innerHTML='<option value="">পরীক্ষা বেছে নিন...</option>'+quizzes.map(q=>`<option value="${q.id}">${esc(q.title)}</option>`).join('');
  renderResults();
}
function oralAnswersFor(quiz, sub){
  if(!quiz||!sub||!sub.answers) return [];
  return (quiz.questions||[])
    .filter(q=>q.type==='audio' && sub.answers[q.id])
    .map((q,i)=>({ q, answer:sub.answers[q.id], index:i+1 }));
}
function renderOralAnswerButtons(quiz, sub){
  const list=oralAnswersFor(quiz, sub);
  if(!list.length) return '';
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${list.map(x=>`
    <button type="button" class="btn-secondary" style="width:auto;padding:4px 9px;font-size:12px" onclick="playOralAnswer('${sub.id}','${x.q.id}')">▶ মৌখিক ${x.index}${x.answer.duration?' · '+Math.round(x.answer.duration)+'s':''}</button>
  `).join('')}</div>`;
}
async function playOralAnswer(subId, questionId){
  const sub=API.Exams.getSubmissions().find(s=>s.id===subId);
  const answer=sub&&sub.answers?sub.answers[questionId]:null;
  if(!answer){ showToast('অডিও পাওয়া যায়নি'); return; }
  try{
    const url=await API.Exams.resolveAudioUrl(answer);
    if(!url){ showToast('অডিও লিংক তৈরি হয়নি'); return; }
    const audio=new Audio(url);
    await audio.play();
  }catch(e){ console.error(e); showToast('অডিও চালু হয়নি'); }
}
function renderResults(){
  const qid=document.getElementById('resultQuizSelect').value;
  const el=document.getElementById('resultsList');
  if(!qid){ el.innerHTML='<div class="empty-state"><div class="icon">📊</div><p>পরীক্ষা বেছে নিন।</p></div>'; return; }
  const quiz=API.Exams.getQuizById(qid);
  const subs=API.Exams.getSubmissionsForQuiz(qid);
  if(!subs.length){ el.innerHTML='<div style="padding:20px;text-align:center;color:var(--gray-400);font-size:14px">এখনো কেউ দেয়নি।</div>'; return; }
  el.innerHTML=`<div class="quiz-card" style="margin-top:8px">${subs.map(s=>{
    const stu=API.Students.getById(s.studentId);
    const wid=stu?.waqfId?API.Students.displayWaqfId(stu.waqfId):'';
    return `
    <div class="result-item">
      <div style="flex:1"><div class="result-name">${wid?'<span style="color:#128C7E;font-weight:600;font-size:13px">'+esc(wid)+'</span> · ':''}${esc(s.studentName)}</div>
      <div class="result-meta">${formatDate(s.submittedAt)} ${s.needsManualGrade?'· ✏️ ম্যানুয়াল গ্রেডিং প্রয়োজন':''}</div>${renderOralAnswerButtons(quiz,s)}</div>
      ${s.needsManualGrade
        ? `<input class="marks-input" type="number" placeholder="নম্বর" value="${s.score||0}" min="0" max="${s.total}" onchange="updateScore('${s.id}',this.value,${s.total},${quiz.passPercent||60})">`
        : `<div class="result-score ${s.passed?'result-pass':'result-fail'}">${s.score}/${s.total}<br><small style="font-size:11px">${s.passed?'✅ পাস':'❌ ফেল'}</small></div>`
      }
    </div>`;
  }).join('')}</div>`;
}
async function updateScore(subId, score, total, passPercent){
  try{ await API.Exams.updateScore(subId, parseInt(score)||0); renderResults(); showToast('✅ নম্বর আপডেট'); }
  catch(e){ console.error(e); showToast('❌ নম্বর সেভ হয়নি'); }
}
async function updateChatExamScore(subId, score){
  try{ await API.Exams.updateScore(subId, parseInt(score)||0); renderChatExams(); showToast('✅ নম্বর আপডেট'); }
  catch(e){ console.error(e); showToast('❌ নম্বর সেভ হয়নি'); }
}

/* Waqful Madinah — js/student/exams.js: exams / quiz taking */
// ══ EXAMS ══════════════════════════════════════════════════
function renderExamList(){
  const quizzes=API.Exams.getQuizzesForStudent(me.id);
  const el=document.getElementById('examList');
  if(!quizzes.length){ el.innerHTML='<div class="empty-state"><div class="icon">📝</div><p>কোনো পরীক্ষা নেই।</p></div>'; return; }
  el.innerHTML=quizzes.map(q=>{
    const sub=API.Exams.getSubmission(q.id,me.id);
    const isDone=!!sub;
    return `<div class="exam-card">
      <div class="exam-card-hd">
        <div class="exam-card-icon">📝</div>
        <div class="exam-card-info">
          <div class="exam-card-title">${esc(q.title)}</div>
          <div class="exam-card-meta">${esc(q.subject||'')} · ${q.questions?.length||0}টি প্রশ্ন · ${q.timeLimit} মিনিট</div>
          ${q.deadline?`<div class="exam-card-meta">📅 শেষ তারিখ: ${q.deadline}</div>`:''}
        </div>
      </div>
      <div class="exam-card-ft">
        ${isDone
          ? (sub.needsManualGrade
            ? `<span class="exam-done-chip">✅ জমা দেওয়া হয়েছে · ফলাফল অপেক্ষায়</span>`
            : `<span class="${sub.passed?'exam-done-chip':'exam-fail-chip'}">${sub.passed?'✅':'❌'} ${sub.score}/${sub.total} নম্বর · ${sub.passed?'উত্তীর্ণ':'অনুত্তীর্ণ'}</span>`)
          : `<button class="exam-start-btn" onclick="startQuiz('${q.id}')">📝 পরীক্ষা দিন</button>`
        }
      </div>
    </div>`;
  }).join('');
}

function startQuiz(qid){
  const quiz=API.Exams.getQuizById(qid); if(!quiz){ showToast('পরীক্ষা পাওয়া যায়নি!'); return; }
  activeQuizId=qid; quizAnswers={}; quizAudioState={}; activeQuizAudioId=null;
  document.getElementById('quizViewTitle').textContent=quiz.title;
  const oralCount=(quiz.questions||[]).filter(q=>q.type==='audio').length;
  const oralMeta=oralCount?` · মৌখিক ${Math.ceil((quiz.audioLimitSeconds||120)/60)} মিনিট`:'';
  document.getElementById('quizViewMeta').textContent=`${quiz.subject||''} · ${quiz.questions?.length||0}টি প্রশ্ন${oralMeta}`;
  renderQuizBody(quiz);
  startQuizTimer(quiz.timeLimit*60);
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  var _sbn=document.getElementById('stuBottomNav'); if(_sbn) _sbn.style.display='none';
  document.querySelector('.header').style.display='none';
  document.getElementById('quizView').classList.add('open');
}
function renderQuizBody(quiz){
  const el=document.getElementById('quizBody');
  el.innerHTML=(quiz.questions||[]).map((q,i)=>`
    <div class="quiz-question-card">
      <div class="quiz-q-num">প্রশ্ন ${i+1} · ${q.marks||1} নম্বর</div>
      <div class="quiz-q-text">${esc(q.text)}</div>
      ${renderQuizAnswer(q,i)}
    </div>`).join('');
}
function renderQuizAnswer(q,i){
  if(q.type==='multiple_choice'){
    return (q.options||[]).map((opt,oi)=>`
      <label class="quiz-option" id="opt_${i}_${oi}">
        <input type="radio" name="q${i}" value="${oi}" onchange="setAnswer('${q.id}','${oi}');highlightOption(${i},${oi},${(q.options||[]).length})">
        <span style="font-size:14px">${esc(opt)}</span>
      </label>`).join('');
  }
  if(q.type==='true_false'){
    return `<label class="quiz-option"><input type="radio" name="q${i}" value="true"  onchange="setAnswer('${q.id}','true')">  <span style="font-size:14px">সত্য</span></label>
            <label class="quiz-option"><input type="radio" name="q${i}" value="false" onchange="setAnswer('${q.id}','false')"> <span style="font-size:14px">মিথ্যা</span></label>`;
  }
  if(q.type==='fill_blank'||q.type==='short_answer'){
    return `<input class="quiz-answer-input" type="text" placeholder="${q.type==='fill_blank'?'উত্তর লিখুন...':'সংক্ষিপ্ত উত্তর...'}" oninput="setAnswer('${q.id}',this.value)">`;
  }
  if(q.type==='essay'){
    return `<textarea class="quiz-answer-input" rows="4" placeholder="বিস্তারিত উত্তর লিখুন..." style="resize:vertical" oninput="setAnswer('${q.id}',this.value)"></textarea>`;
  }
  if(q.type==='file_upload'){
    return `<p style="font-size:13px;color:var(--gray-500);padding:8px 0">${esc(q.uploadInstructions||'ফাইল আপলোড করুন।')}</p>
            <input type="file" class="form-input" onchange="setAnswer('${q.id}',this.files[0]?.name||'')">`;
  }
  if(q.type==='audio'){
    const quiz=API.Exams.getQuizById(activeQuizId)||{};
    const limit=Math.max(15,Math.min(parseInt(quiz.audioLimitSeconds)||120,600));
    return `<div class="quiz-audio-box" id="qaBox_${q.id}">
      <div class="quiz-audio-row">
        <button type="button" class="quiz-audio-btn" id="qaBtn_${q.id}" onclick="toggleQuizAudio('${q.id}',${limit})">রেকর্ড শুরু</button>
        <span class="quiz-audio-status" id="qaStatus_${q.id}">সর্বোচ্চ ${Math.ceil(limit/60)} মিনিট</span>
      </div>
      <audio class="quiz-audio-player" id="qaPlayer_${q.id}" controls style="display:none"></audio>
    </div>`;
  }
  return '';
}
function highlightOption(qi,selected,count){ for(let i=0;i<count;i++){ const el=document.getElementById(`opt_${qi}_${i}`); if(el) el.classList.toggle('selected',i===selected); } }
function setAnswer(qid,val){ quizAnswers[qid]=val; }
function pickQuizAudioMime(){
  if(typeof MediaRecorder==='undefined') return '';
  const cands=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  for(const m of cands){ try{ if(MediaRecorder.isTypeSupported(m)) return m; }catch(e){} }
  return '';
}
function quizAudioStatus(qid,text,recording){
  const st=document.getElementById('qaStatus_'+qid), btn=document.getElementById('qaBtn_'+qid);
  if(st) st.textContent=text;
  if(btn){ btn.textContent=recording?'রেকর্ড বন্ধ':'আবার রেকর্ড'; btn.classList.toggle('recording',!!recording); }
}
async function toggleQuizAudio(qid,limit){
  const s=quizAudioState[qid];
  if(s&&s.recording){ await stopQuizAudio(qid); return; }
  if(activeQuizAudioId&&activeQuizAudioId!==qid){ showToast('আরেকটি রেকর্ডিং চলছে'); return; }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof MediaRecorder==='undefined'){ showToast('এই ডিভাইসে অডিও রেকর্ড সাপোর্ট নেই'); return; }
  let stream;
  try{ stream=await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e){ showToast('মাইকের অনুমতি পাওয়া যায়নি'); return; }
  const mime=pickQuizAudioMime();
  let recorder;
  try{ recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream); }
  catch(e){ stream.getTracks().forEach(t=>t.stop()); showToast('রেকর্ডার চালু হয়নি'); return; }
  const state={recorder,stream,chunks:[],recording:true,left:limit,limit,mime:recorder.mimeType||mime||'audio/webm',startedAt:Date.now()};
  quizAudioState[qid]=state; activeQuizAudioId=qid;
  recorder.ondataavailable=ev=>{ if(ev.data&&ev.data.size>0) state.chunks.push(ev.data); };
  recorder.onerror=()=>stopQuizAudio(qid,false);
  recorder.start(250);
  quizAudioStatus(qid,`বাকি ${String(Math.floor(limit/60)).padStart(2,'0')}:${String(limit%60).padStart(2,'0')}`,true);
  state.timer=setInterval(()=>{
    state.left-=1;
    const m=Math.floor(Math.max(0,state.left)/60), sec=Math.max(0,state.left)%60;
    quizAudioStatus(qid,`বাকি ${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`,true);
    if(state.left<=0) stopQuizAudio(qid);
  },1000);
}
function stopQuizAudio(qid,keep=true){
  const state=quizAudioState[qid];
  if(!state||!state.recording) return Promise.resolve();
  state.recording=false;
  clearInterval(state.timer);
  return new Promise(resolve=>{
    const finish=()=>{
      state.stream&&state.stream.getTracks().forEach(t=>t.stop());
      activeQuizAudioId=null;
      if(!keep){ quizAudioStatus(qid,'রেকর্ডিং বাতিল হয়েছে',false); resolve(); return; }
      const blob=new Blob(state.chunks,{type:state.mime||'audio/webm'});
      const duration=Math.max(1,Math.round((Date.now()-(state.startedAt||Date.now()))/1000));
      const url=URL.createObjectURL(blob);
      const player=document.getElementById('qaPlayer_'+qid);
      if(player){ player.src=url; player.style.display='block'; }
      quizAnswers[qid]={kind:'audio',blob,mimeType:blob.type||state.mime,duration,size:blob.size,recordedAt:new Date().toISOString()};
      quizAudioStatus(qid,`রেকর্ড হয়েছে · ${duration}s · ${Math.ceil(blob.size/1024)} KB`,false);
      resolve();
    };
    state.recorder.onstop=finish;
    try{ state.recorder.stop(); }catch(e){ finish(); }
  });
}
function startQuizTimer(seconds){
  quizSecondsLeft=seconds;
  clearInterval(quizTimerInterval);
  quizTimerInterval=setInterval(()=>{
    quizSecondsLeft--;
    const m=Math.floor(quizSecondsLeft/60); const s=quizSecondsLeft%60;
    const el=document.getElementById('quizTimer');
    el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    el.classList.toggle('warning',quizSecondsLeft<=60);
    if(quizSecondsLeft<=0){ clearInterval(quizTimerInterval); submitQuiz(true); }
  },1000);
}
async function submitQuiz(auto=false){
  clearInterval(quizTimerInterval);
  if(!activeQuizId) return;
  if(activeQuizAudioId) await stopQuizAudio(activeQuizAudioId);
  const answered=Object.keys(quizAnswers).length;
  const quiz=API.Exams.getQuizById(activeQuizId);
  const total=quiz?.questions?.length||0;
  if(!auto){
    const confirmMsg = answered<total
      ? `${answered}/${total}টি প্রশ্নের উত্তর দিয়েছেন। এখনই জমা দেবেন?`
      : 'পরীক্ষা জমা দেবেন?';
    const ok=await showConfirm(confirmMsg,{title:'পরীক্ষা জমা দিন',okText:'জমা দিন'});
    if(!ok) return;
  }
  let sub;
  try{ sub=await API.Exams.submitQuiz(activeQuizId,me.id,quizAnswers); }
  catch(e){ console.error(e); showToast('❌ পরীক্ষা জমা হয়নি'); return; }
  exitQuiz();
  if(sub.needsManualGrade){
    showToast('✅ পরীক্ষা জমা হয়েছে! উস্তাদ নম্বর দেবেন।',4000);
  } else {
    showToast(`${sub.passed?'✅ উত্তীর্ণ':'❌ অনুত্তীর্ণ'} · ${sub.score}/${sub.total} নম্বর`,4000);
  }
  renderExamList(); updateBadges();
}
function exitQuiz(){
  if(activeQuizAudioId) stopQuizAudio(activeQuizAudioId,false);
  clearInterval(quizTimerInterval); activeQuizId=null;
  const qv=document.getElementById('quizView');
  let finished=false;
  let tid;
  function restoreAfterQuiz(){
    if(finished) return;
    finished=true;
    clearTimeout(tid);
    qv.removeEventListener('transitionend', onQte);
    var _sbn2=document.getElementById('stuBottomNav'); if(_sbn2) _sbn2.style.display='block';
    document.querySelector('.header').style.display='flex';
    goTab('exams');
  }
  function onQte(e){
    if(e.propertyName!=='transform') return;
    restoreAfterQuiz();
  }
  if(!qv.classList.contains('open')){ restoreAfterQuiz(); return; }
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    qv.classList.remove('open');
    restoreAfterQuiz();
    return;
  }
  qv.addEventListener('transitionend', onQte);
  tid=setTimeout(restoreAfterQuiz,420);
  qv.classList.remove('open');
}

function updateExamBadge(){
  const n=API.Exams.getQuizzesForStudent(me?.id||'').filter(q=>!API.Exams.getSubmission(q.id,me?.id||'')).length;
  const b=document.getElementById('examBadge'); b.textContent=n; b.classList.toggle('show',n>0);
  syncAppBadge();
}

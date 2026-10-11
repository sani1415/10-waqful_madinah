/* Waqful Madinah — js/student/today.js: «আজ» due cards, «খাতা» tabs (বিবরণ · লক্ষ্য), «আমি» page.
   Reads existing data only: পাক্ষিক বিবরণ config, assigned quizzes, unread messages, schedule proposal. */
let _khataTab='notes';

const _SRD_IC={
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  msg:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  chevR:'<path d="m9 18 6-6-6-6"/>',
};
function srdIcon(k){ return `<svg class="rd-i" viewBox="0 0 24 24" aria-hidden="true">${_SRD_IC[k]||''}</svg>`; }
function srdBn(n){ return String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]); }
function srdJs(v){ return esc(String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'")); }
function _srdDays(from,to){ return Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/864e5); }

function _dueCard(tone,icon,title,sub,btnLabel,onclick){
  return `<div class="rd-card rd-due"><span class="rd-menu-ic ${tone}">${srdIcon(icon)}</span><div class="rd-who-t"><b>${title}</b><span class="rd-due-sub">${sub}</span></div>${btnLabel?`<button type="button" class="rd-pill" onclick="${onclick}">${btnLabel}</button>`:''}</div>`;
}

function renderTodayDue(){
  const el=document.getElementById('todayDue'); if(!el) return;
  if(!me){ el.innerHTML=''; return; }
  const today=API.today();
  const cards=[];
  const SN=API.StudentNotes;
  if(SN&&SN.getFortnightlyConfig){
    const cfg=SN.getFortnightlyConfig();
    if(cfg.enabled&&cfg.categoryId){
      const st=SN.getFortnightlyStatus(me.id);
      const left=st.lastDate?cfg.intervalDays-_srdDays(st.lastDate,today):0;
      if(left<=5){
        const q=(cfg.questions||[]).length;
        cards.push(_dueCard('tone-butter','book','পাক্ষিক বিবরণ',
          `${left>0?srdBn(left)+' দিন বাকি':'আজ জমা দিতে হবে'}${q?` · উস্তাদ ${srdBn(q)}টি প্রশ্ন দিয়েছেন`:''}`,'লিখুন',"openDailyNoteModal()"));
      }
    }
  }
  API.Exams.getQuizzesForStudent(me.id)
    .filter(q=>!API.Exams.getSubmission(q.id,me.id)&&(!q.deadline||q.deadline>=today))
    .slice(0,3).forEach(q=>{
      const when=q.deadline?(q.deadline===today?'আজ শেষ দিন':`শেষ তারিখ ${new Date(q.deadline+'T12:00:00Z').toLocaleDateString('bn-BD',{day:'numeric',month:'long'})}`):'যেকোনো সময়';
      cards.push(_dueCard('tone-rose','pen',esc(q.title||'পরীক্ষা'),`${when}${q.timeLimit?` · ${srdBn(q.timeLimit)} মিনিট`:''}`,'শুরু',`startQuiz('${srdJs(q.id)}')`));
    });
  const unread=API.Messages.unreadCount(me.id,'out')|0;
  if(unread){
    const last=(API.Messages.getThread(me.id)||[]).filter(m=>m.role==='out').slice(-1)[0];
    cards.push(_dueCard('tone-sage','msg',`উস্তাদের ${srdBn(unread)}টি নতুন রিসালা`,esc(last&&(last.text||last.fileName)||''),'খুলুন',"goTab('chat')"));
  }
  const DS=API.DailySchedule;
  const pend=DS&&DS.getForStudent?DS.getForStudent(me.id).pending:null;
  if(pend&&pend.status==='pending') cards.push(_dueCard('tone-sky','clock','সময়সূচির প্রস্তাব পাঠানো হয়েছে','উস্তাদ অনুমোদন দিলে নতুন সময়সূচি চালু হবে','',''));
  else if(pend&&pend.status==='rejected') cards.push(_dueCard('tone-sky','clock','সময়সূচির প্রস্তাব ফেরত এসেছে',esc(pend.teacherNote||'আবার দেখে পাঠান'),'দেখুন',"goAmalTab('schedule')"));
  el.innerHTML=cards.length?`<div class="rd-due-wrap"><div class="rd-sec-h"><h4>সামনে যা আছে</h4></div><div class="rd-stack">${cards.join('')}</div></div>`:'';
}

function goKhataTab(tab){
  _khataTab=tab==='goals'?'goals':'notes';
  document.querySelectorAll('[data-khata]').forEach(b=>b.classList.toggle('on',b.dataset.khata===_khataTab));
  const n=document.getElementById('khata-notes'), g=document.getElementById('khata-goals');
  if(n) n.style.display=_khataTab==='notes'?'':'none';
  if(g) g.style.display=_khataTab==='goals'?'':'none';
  if(_khataTab==='notes') renderDailyNotes(); else renderGoals();
}

function _meRow(icon,tone,title,sub,onclick,count){
  return `<button type="button" class="rd-menu-row" onclick="${onclick}"><span class="rd-menu-ic ${tone}">${srdIcon(icon)}</span><span class="rd-menu-t"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</span>${count?`<span class="rd-cnt">${srdBn(count)}</span>`:''}${srdIcon('chevR')}</button>`;
}
function renderMe(){
  const el=document.getElementById('mePane'); if(!el||!me) return;
  const exams=API.Exams.getQuizzesForStudent(me.id);
  const openExams=exams.filter(q=>!API.Exams.getSubmission(q.id,me.id)).length;
  const days=typeof waqfDaysSinceEnrollment==='function'?waqfDaysSinceEnrollment(me):null;
  const prog=API.Tasks.getListProgress(me.id);
  el.innerHTML=`
  <div class="rd-arch rd-me-hero">
    <span class="rd-av lg c1">${esc(String(me.name||'?').slice(0,1))}</span>
    <h3>${esc(me.name||'')}</h3>
    <p>${[me.waqfId?'ওয়াকফ '+srdBn(API.Students.displayWaqfId(me.waqfId)):'',me.cls||'',days!=null&&days>=0?srdBn(days)+'তম দিন':''].filter(Boolean).map(esc).join(' · ')}</p>
    <div class="rd-mini3">
      <div class="rd-mini"><b>${srdBn(Math.max(0,Math.min(100,prog.percent|0)))}%</b><span>মোট আমল</span></div>
      <div class="rd-mini"><b>${srdBn(exams.length)}</b><span>পরীক্ষা</span></div>
      <div class="rd-mini"><b>${srdBn(API.Docs.getForStudent?API.Docs.getForStudent(me.id).length:0)}</b><span>ফাইল</span></div>
    </div>
  </div>
  <div class="rd-card rd-menu" style="margin-top:14px">
    ${_meRow('pen','tone-rose','পরীক্ষা','উস্তাদের দেওয়া সব পরীক্ষা ও ফলাফল',"goTab('exams')",openExams)}
    ${_meRow('folder','tone-plum','ফাইল','উস্তাদকে পাঠানো ও উস্তাদের পাঠানো ফাইল',"goTab('docs')")}
  </div>
  <div class="rd-sec-h"><h4>অ্যাকাউন্ট</h4></div>
  <div class="rd-card rd-menu">
    ${_meRow('lock','tone-sky','প্রোফাইল ও পিন','ছবি বদলান, নতুন পিন দিন',"openStudentSelfProfile()")}
    ${_meRow('out','tone-butter','লগআউট','এই ডিভাইস থেকে বের হন',"logout()")}
  </div>
  <div class="rd-bottom-space"></div>`;
}

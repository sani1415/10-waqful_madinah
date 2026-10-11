/* Waqful Madinah — js/teacher/today.js: «আজ» — everything waiting on the teacher, in one list.
   Reads only existing data (schedule proposals, pending বিবরণ, pending files, quizzes to grade,
   unread messages, today's আমল) and reuses the existing actions. */
let _todayFilter='all';
// খোলা কার্ড ও না-পাঠানো খসড়া — রি-রেন্ডারেও (লাইভ সিঙ্ক) হারায় না
const _todayOpen=new Set();
const _todayDrafts={};

const _RD_IC={
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chevR:'<path d="m9 18 6-6-6-6"/>',
  send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
};
function rdIcon(k){ return `<svg class="rd-i" viewBox="0 0 24 24" aria-hidden="true">${_RD_IC[k]||''}</svg>`; }
function rdBn(n){ return String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]); }
/** Safe single-quoted JS string inside an HTML attribute. */
function rdJs(v){ return esc(String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'")); }
const _RD_AV=['c1','c2','c3','c4','c5','c6'];
function rdAvatar(s,size){
  const name=String(s&&s.name||'?').trim();
  let h=0; for(const ch of String(s&&s.id||name)) h=(h*31+ch.charCodeAt(0))>>>0;
  return `<span class="rd-av ${size||''} ${_RD_AV[h%_RD_AV.length]}">${esc(name.slice(0,1))}</span>`;
}
function rdWaqf(s){ return s&&s.waqfId?rdBn(API.Students.displayWaqfId(s.waqfId)):''; }

function _isReceiptNote(n){
  return /^সাপ্তাহিক আমল:/.test(String(n.title||''))||/^সাপ্তাহিক আমল জমা/.test(String(n.text||''));
}

/** All decisions waiting on the teacher, newest first. */
function getTodayItems(){
  const items=[];
  const students=API.Students.getAll();
  const byId=Object.fromEntries(students.map(s=>[s.id,s]));
  const DS=API.DailySchedule, SN=API.StudentNotes;
  students.forEach(s=>{
    if(DS&&DS.hasPendingApproval&&DS.hasPendingApproval(s.id)){
      const ds=DS.getForStudent(s.id);
      const ops=DS.diffRows?DS.diffRows(ds.rows||[],(ds.pending&&ds.pending.rows)||[]):[];
      items.push({kind:'sched',group:'approve',sid:s.id,s,ts:Date.parse(ds.pending&&ds.pending.submittedAt||'')||0,ops:ops.filter(o=>o.type!=='same').slice(0,4),emptyAll:!((ds.pending&&ds.pending.rows)||[]).length});
    }
    if(SN&&SN.getAll){
      SN.getAll(s.id).filter(n=>n.reviewStatus==='pending'&&!_isReceiptNote(n)).forEach(n=>{
        const ts=Date.parse(`${n.date||''}T${n.time||'00:00'}`)||0;
        items.push({kind:'note',group:'review',sid:s.id,s,note:n,ts});
      });
    }
  });
  API.Docs.getAll().filter(d=>d.sentBy!=='teacher'&&d.reviewStatus==='pending').forEach(d=>{
    const s=byId[d.studentId]; if(!s) return;
    items.push({kind:'doc',group:'review',sid:s.id,s,doc:d,ts:Date.parse(d.uploadedAt||'')||0});
  });
  API.Exams.getQuizzes().forEach(q=>{
    API.Exams.getSubmissionsForQuiz(q.id).filter(sub=>sub.needsManualGrade).forEach(sub=>{
      const s=byId[sub.studentId]; if(!s) return;
      items.push({kind:'grade',group:'grade',sid:s.id,s,quiz:q,sub,ts:Date.parse(sub.submittedAt||'')||0});
    });
  });
  return items.sort((a,b)=>b.ts-a.ts);
}

function _rdAgo(ts){
  if(!ts) return '';
  const min=Math.round((Date.now()-ts)/60000);
  if(min<1) return 'এইমাত্র';
  if(min<60) return `${rdBn(min)} মিনিট আগে`;
  const h=Math.round(min/60);
  if(h<24) return `${rdBn(h)} ঘণ্টা আগে`;
  const d=Math.round(h/24);
  return d===1?'গতকাল':`${rdBn(d)} দিন আগে`;
}

function _rdCard(it){
  const s=it.s, sid=rdJs(it.sid);
  const who=`<div class="rd-who">${rdAvatar(s)}<div class="rd-who-t"><b>${esc(s.name)}</b><span>${[rdWaqf(s),s.cls,_rdAgo(it.ts)].filter(Boolean).map(esc).join(' · ')}</span></div>`;
  if(it.kind==='sched'){
    const diff=it.emptyAll
      ?`<div class="rd-diff"><div class="del">পুরো সময়সূচি মুছে ফেলার প্রস্তাব</div></div>`
      :`<div class="rd-diff">${it.ops.map(o=>`<div class="${o.type==='del'?'del':'add'}"><span class="t">${esc(o.row.time||'')}</span>${esc(o.row.task||'')}</div>`).join('')}</div>`;
    return `<div class="rd-card">${who}<span class="rd-kind k-sched">${rdIcon('clock')}সময়সূচি</span></div>${diff}
      <div class="rd-acts"><button type="button" class="rd-btn ghost" onclick="teacherRejectSchedulePrompt('${sid}')">${rdIcon('undo')}ফেরত দিন</button><button type="button" class="rd-btn pri" onclick="teacherApproveSchedule('${sid}')">${rdIcon('check')}অনুমোদন</button></div></div>`;
  }
  if(it.kind==='note'){
    const n=it.note, nid=rdJs(n.id), key=_todayKey('n',n.id), open=_todayOpen.has(key);
    return `<div class="rd-card rd-expand${open?' open':''}" data-key="${key}">${who}<span class="rd-kind k-note">${rdIcon('book')}বিবরণ</span></div>
      ${n.title?`<div class="rd-card-title">${esc(n.title)}</div>`:''}<div class="rd-card-body">${esc(n.text||'')}</div>
      <div class="rd-acts"><button type="button" class="rd-btn ghost" onclick="toggleTodayCard('${key}')"><span class="rd-when-closed">পুরোটা পড়ুন ও উত্তর দিন</span><span class="rd-when-open">ছোট করুন</span></button><button type="button" class="rd-btn soft" onclick="todayMarkNoteReviewed('${sid}','${nid}')">${rdIcon('check')}পর্যালোচিত</button></div>
      <div class="rd-reply">
        <textarea id="tr-${key}" rows="3" placeholder="উত্তর লিখুন…" oninput="_todayDrafts['${key}']=this.value">${rdText(_todayDrafts[key])}</textarea>
        <div class="rd-acts"><button type="button" class="rd-btn pri" onclick="todayReplyNote('${sid}','${nid}','${key}',true)">${rdIcon('send')}উত্তর পাঠান</button></div>
      </div></div>`;
  }
  if(it.kind==='doc'){
    const d=it.doc, key=_todayKey('d',d.id), open=_todayOpen.has(key);
    return `<div class="rd-card rd-expand${open?' open':''}" data-key="${key}">${who}<span class="rd-kind k-doc">${rdIcon('file')}ফাইল</span></div>
      <div class="rd-card-title">${esc(d.fileName||'ফাইল')}</div>${d.note?`<div class="rd-card-body">${esc(d.note)}</div>`:''}
      <div class="rd-acts"><button type="button" class="rd-btn ghost" onclick="toggleTodayCard('${key}')"><span class="rd-when-closed">মন্তব্য লিখুন</span><span class="rd-when-open">ছোট করুন</span></button><button type="button" class="rd-btn soft" onclick="openDocPreview('${rdJs(d.id)}',true)">${rdIcon('eye')}খুলে দেখুন</button></div>
      <div class="rd-reply">
        <textarea id="tr-${key}" rows="3" placeholder="মন্তব্য লিখুন — ছাত্র রিসালায় পাবে" oninput="_todayDrafts['${key}']=this.value">${rdText(_todayDrafts[key])}</textarea>
        <div class="rd-acts"><button type="button" class="rd-btn pri" onclick="todayReviewDoc('${rdJs(d.id)}','${key}')">${rdIcon('check')}মন্তব্যসহ পর্যালোচিত</button></div>
      </div></div>`;
  }
  const q=it.quiz, sub=it.sub;
  return `<div class="rd-card">${who}<span class="rd-kind k-exam">${rdIcon('pen')}নম্বর</span></div>
    <div class="rd-card-title">${esc(q.title||'পরীক্ষা')}</div><div class="rd-card-body">উত্তর জমা হয়েছে · মোট ${rdBn(sub.total||0)} নম্বর</div>
    <div class="rd-acts"><button type="button" class="rd-btn soft" onclick="openChat('${sid}','exam')">${rdIcon('pen')}নম্বর দিন</button></div></div>`;
}

/** Plain-text escape for textarea content (esc() turns newlines into <br>). */
function rdText(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _todayKey(prefix,id){ return prefix+'_'+String(id).replace(/[^\w-]/g,'_'); }
function toggleTodayCard(key){
  const card=document.querySelector(`#todayList .rd-card[data-key="${key}"]`); if(!card) return;
  const open=!card.classList.contains('open');
  card.classList.toggle('open',open);
  if(open){ _todayOpen.add(key); setTimeout(()=>document.getElementById('tr-'+key)?.focus({preventScroll:true}),50); }
  else _todayOpen.delete(key);
}
async function todayReplyNote(sid,noteId,key,alsoReview){
  const ta=document.getElementById('tr-'+key); const text=(ta&&ta.value||'').trim();
  if(!text){ showToast('উত্তর লিখুন'); return; } // উত্তর পাঠালে বিবরণটি নিজে থেকেই পর্যালোচিত হয়
  const n=API.StudentNotes.getAll(sid).find(x=>x.id===noteId);
  try{
    if(text) await API.Messages.send(sid,(n&&n.title?`«${n.title}» প্রসঙ্গে:\n`:'')+text,'text');
    if(alsoReview) await API.StudentNotes.markReviewed(sid,noteId);
    delete _todayDrafts[key]; _todayOpen.delete(key);
    showToast('✅ উত্তর পাঠানো হয়েছে');
    renderAll();
  }catch(e){ console.error(e); showToast('❌ পাঠানো যায়নি'); }
}
async function todayReviewDoc(docId,key){
  const ta=document.getElementById('tr-'+key);
  try{
    await API.Docs.markReviewed(docId,(ta&&ta.value||'').trim());
    delete _todayDrafts[key]; _todayOpen.delete(key);
    showToast('✅ পর্যালোচিত — ছাত্রকে জানানো হয়েছে');
    renderAll();
  }catch(e){ console.error(e); showToast('❌ আপডেট হয়নি'); }
}
async function todayMarkNoteReviewed(sid,noteId){
  try{ await API.StudentNotes.markReviewed(sid,noteId); showToast('✅ পর্যালোচিত হিসেবে চিহ্নিত'); renderAll(); }
  catch(e){ console.error(e); showToast('❌ আপডেট হয়নি'); }
}
function _todayDecisionsHtml(items,counts){
  if(!items.length) return '';
  const shown=_todayFilter==='all'?items:items.filter(i=>i.group===_todayFilter);
  const chip=(k,l)=>`<button type="button" class="rd-chip${_todayFilter===k?' on':''}" onclick="setTodayFilter('${k}')">${l}<b>${rdBn(counts[k])}</b></button>`;
  return `<div class="rd-chips rd-chips--center rd-today-chips">${chip('all','সব')}${chip('approve','অনুমোদন')}${chip('review','পর্যালোচনা')}${chip('grade','নম্বর দিন')}</div>
  <div class="rd-stack">${shown.map(_rdCard).join('')||'<div class="rd-empty">এই ধরনের কিছু বাকি নেই।</div>'}</div>`;
}
/** ফিল্টার বদলালে শুধু নিচের কার্ডগুলো বদলায় — ওপরের অংশ, স্ক্রল ও অ্যানিমেশন স্থির থাকে */
function setTodayFilter(f){
  _todayFilter=f;
  const box=document.getElementById('todayDecisions'); if(!box){ renderToday(); return; }
  const items=getTodayItems();
  const counts={all:items.length,approve:0,review:0,grade:0}; items.forEach(i=>counts[i.group]++);
  const list=document.getElementById('todayList');
  const top=list?list.scrollTop:0;
  box.classList.add('rd-still');
  box.innerHTML=_todayDecisionsHtml(items,counts);
  if(list) list.scrollTop=top;
}
function todayRemind(sid){
  openChat(sid,'msg');
  const inp=document.getElementById('msgIn');
  if(inp&&!inp.value.trim()){ inp.value='আজকের আমলগুলো শেষ করতে ভুলো না, ইন শা আল্লাহ।'; if(typeof autoResize==='function') autoResize(inp); inp.focus(); }
}

function _todayAmal(){
  const t=API.today();
  const rows=API.Students.getAll().map(s=>({s,p:API.Tasks.getRangeProgress(s.id,t,t)})).filter(r=>r.p.total>0);
  const done=rows.filter(r=>r.p.done>=r.p.total).length;
  let d=0,tot=0; rows.forEach(r=>{ d+=r.p.done; tot+=r.p.total; });
  const behind=rows.filter(r=>r.p.done<r.p.total).sort((a,b)=>(a.p.done/a.p.total)-(b.p.done/b.p.total));
  return { pct:tot?Math.round(d/tot*100):0, withTasks:rows.length, complete:done, behind };
}

function renderToday(){
  const el=document.getElementById('todayList'); if(!el) return;
  const items=getTodayItems();
  const counts={all:items.length,approve:0,review:0,grade:0};
  items.forEach(i=>counts[i.group]++);
  const badge=document.getElementById('todayBadge');
  if(badge){ badge.textContent=items.length||''; badge.classList.toggle('show',items.length>0); }
  if(curTab!=='today') return;
  const firstPaint=!el.dataset.painted; el.dataset.painted='1';
  const keepTop=el.scrollTop;

  const students=API.Students.getAll();
  const unread=students.map(s=>({s,n:API.Messages.unreadCount(s.id,'in')|0,last:(API.Messages.getThread(s.id)||[]).slice(-1)[0]})).filter(r=>r.n>0)
    .sort((a,b)=>(b.last&&b.last._ts||0)-(a.last&&a.last._ts||0));
  const unreadTotal=unread.reduce((a,r)=>a+r.n,0);
  const amal=_todayAmal();

  el.innerHTML=`
  <div class="rd-arch rd-stat4">
    <div class="rd-mini rd-mini--main"><b>${rdBn(items.length)}</b><span>${items.length?'সিদ্ধান্ত বাকি':'সব সিদ্ধান্ত হয়ে গেছে'}</span></div>
    <button type="button" class="rd-mini" onclick="goTab('chats')"><b>${rdBn(unreadTotal)}</b><span>অপঠিত রিসালা</span></button>
    <div class="rd-mini"><b>${rdBn(amal.pct)}%</b><span>আজকের আমল</span></div>
    <div class="rd-mini"><b>${rdBn(amal.behind.length)}</b><span>জনের আমল বাকি</span></div>
  </div>
  <div id="todayDecisions">${_todayDecisionsHtml(items,counts)}</div>
  ${unread.length?`<div class="rd-sec-h"><h4>অপঠিত রিসালা</h4><button type="button" onclick="goTab('chats')">সব ছাত্র</button></div>
  <div class="rd-card rd-list">${unread.slice(0,5).map(r=>`<button type="button" class="rd-row" onclick="openChat('${rdJs(r.s.id)}')">${rdAvatar(r.s,'sm')}<div class="rd-who-t"><b>${esc(r.s.name)}</b><span>${esc(r.last&&(r.last.text||r.last.fileName)||'')}</span></div><div class="rd-row-end"><span class="rd-time">${esc(r.last&&r.last.time||'')}</span><span class="rd-cnt">${rdBn(r.n)}</span></div></button>`).join('')}</div>`:''}
  ${amal.withTasks?`<div class="rd-sec-h"><h4>আজকের আমল</h4><button type="button" onclick="goTab('tasks')">বিস্তারিত</button></div>
  <div class="rd-card">
    <div class="rd-pulse"><div class="rd-ring" style="--p:${amal.pct}"><span>${rdBn(amal.pct)}%</span></div><div><b>${rdBn(amal.withTasks)} জনের ${rdBn(amal.complete)} জন সব শেষ করেছে</b><span>ছাত্ররা টিক দিলে সাথে সাথে বদলায়</span></div></div>
    ${amal.behind.slice(0,3).map(r=>`<div class="rd-row">${rdAvatar(r.s,'sm')}<div class="rd-who-t"><b>${esc(r.s.name)}</b><span>${rdBn(r.p.total)}টির ${rdBn(r.p.done)}টি</span></div><button type="button" class="rd-pill" onclick="todayRemind('${rdJs(r.s.id)}')">মনে করিয়ে দিন</button></div>`).join('')}
  </div>`:''}
  <div class="rd-bottom-space"></div>`;
  el.classList.toggle('rd-still',!firstPaint);
  if(!firstPaint) el.scrollTop=keepTop;
}

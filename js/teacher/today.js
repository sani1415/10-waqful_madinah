/* Waqful Madinah — js/teacher/today.js: «আজ» — everything waiting on the teacher, in one list.
   Reads only existing data (schedule proposals, pending বিবরণ, pending files, quizzes to grade,
   unread messages, today's আমল) and reuses the existing actions. */
let _todayFilter='pending'; // হোমের ফিল্টার: pending (বাকি আছে) | unread | all
// খোলা কার্ড ও না-পাঠানো খসড়া — রি-রেন্ডারেও (লাইভ সিঙ্ক) হারায় না
const _todayOpen=new Set();
const _todayDrafts={};

const _RD_IC={
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chevR:'<path d="m9 18 6-6-6-6"/>',
  send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  msg:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
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

/** ছাত্রের পাতার ট্যাবে কয়টা বাকি: রিসালা (অপঠিত + সময়সূচি), অগ্রগতি (ফাইল + নম্বর), বিবরণ */
function chatTabCounts(sid,unreadMsgs){
  const c={msg:unreadMsgs||0,prog:0,note:0};
  getTodayItems().forEach(it=>{
    if(it.sid!==sid) return;
    if(it.kind==='note') c.note++;
    else if(it.kind==='sched') c.msg++;
    else c.prog++;
  });
  return c;
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

function _rdCard(it,opts){
  const s=it.s, sid=rdJs(it.sid), compact=!!(opts&&opts.compact);
  const who=compact
    ?`<div class="rd-who rd-who--mini"><span class="rd-time">${esc(_rdAgo(it.ts))}</span>`
    :`<div class="rd-who">${rdAvatar(s)}<div class="rd-who-t"><b>${esc(s.name)}</b><span>${[rdWaqf(s),s.cls,_rdAgo(it.ts)].filter(Boolean).map(esc).join(' · ')}</span></div>`;
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
// ══ হোম: «আজ» + ছাত্রতালিকা একসাথে — প্রতি ছাত্র এক রঙিন সারি ════════
// যার কিছু বাকি (রিসালা, বিবরণ, ফাইল, সময়সূচি, নম্বর) সে ওপরে। নামে চাপলেই ছাত্রের পাতা খোলে —
// ওপরে নাম, তার নিচে ট্যাব (প্রতিটিতে কয়টা বাকি), দুটোই স্ক্রলে স্থির থাকে।
const HOME_FILTERS=[['pending','অপেক্ষমান'],['unread','বার্তা'],['all','ওয়াকিফ']];

function _msgTs(m){
  if(!m) return 0;
  if(m._ts) return Number(m._ts)||0;
  const x=/^m(\d{13})/.exec(m.id||''); return x?Number(x[1]):0;
}
function _homeRows(){
  const items=getTodayItems(); const by={};
  items.forEach(it=>(by[it.sid]=by[it.sid]||[]).push(it));
  const t=API.today();
  const rows=API.Students.getAll().map(s=>{
    const thread=API.Messages.getThread(s.id)||[];
    const last=thread[thread.length-1];
    const unread=thread.filter(m=>m.role==='in'&&!m.read);
    const prog=API.Tasks.getRangeProgress(s.id,t,t);
    const dec=by[s.id]||[];
    const ts=Math.max(_msgTs(last),...dec.map(d=>d.ts||0),0);
    const behind=prog.total>0&&prog.done<prog.total;
    return {s,dec,unread,last,thread,prog,ts,behind,pending:dec.length+unread.length};
  });
  rows.sort((a,b)=>(b.pending>0)-(a.pending>0)||b.ts-a.ts);
  return {rows,items};
}
function _homeMatch(r,f){
  if(f==='pending') return r.pending>0;
  if(f==='unread') return r.unread.length>0;
  return true;
}
function _homePreview(r){
  const m=r.unread.length?r.unread[r.unread.length-1]:r.last;
  if(!m) return '';
  const txt=String(m.text||m.fileName||'').replace(/\s+/g,' ').trim();
  return (m.role==='out'?'আপনি: ':'')+txt;
}
function _homeTime(r){
  const m=r.last;
  if(m&&_msgTs(m)===r.ts&&m.time){
    const d=new Date(r.ts); const today=new Date();
    return d.toDateString()===today.toDateString()?rdBn(m.time):_rdAgo(r.ts);
  }
  return _rdAgo(r.ts);
}
function _homeRow(r){
  const sid=rdJs(r.s.id);
  const meta=[r.s.waqfId?rdBn(API.Students.displayWaqfId(r.s.waqfId)):'',API.Students.formatBatchYear(r.s.enrollmentDate)||''].filter(Boolean).join(' · ');
  const prev=_homePreview(r);
  let h=0; for(const ch of String(r.s.id)) h=(h*31+ch.charCodeAt(0))>>>0;
  return `<div class="rd-hrow tn-${h%6}${r.pending?' has-pending':''}" data-sid="${esc(r.s.id)}">
    <button type="button" class="rd-hrow-tap" onclick="openChat('${sid}')">
      ${rdAvatar(r.s)}
      <span class="rd-hrow-t"><span class="rd-hrow-top"><span class="rd-hrow-nm"><b>${esc(r.s.name)}</b>${meta?`<span class="rd-hrow-meta">${esc(meta)}</span>`:''}</span><span class="rd-hrow-end"><span class="rd-time">${esc(_homeTime(r))}</span>${r.pending?`<span class="rd-cnt rd-hrow-cnt">${rdBn(r.pending)}</span>`:''}</span></span>
        ${prev?`<span class="rd-hrow-prev">${esc(prev)}</span>`:''}</span>
    </button>
  </div>`;
}
function _homeListHtml(data){
  const rows=data.rows.filter(r=>_homeMatch(r,_todayFilter));
  const cnt={}; HOME_FILTERS.forEach(([k])=>{ cnt[k]=data.rows.filter(r=>_homeMatch(r,k)).length; });
  const empty=_todayFilter==='pending'
    ?`<div class="rd-hempty"><b>সব কাজ শেষ, আলহামদুলিল্লাহ</b><span>নতুন রিসালা বা জমা এলে এখানে দেখাবে।</span><button type="button" class="rd-pill" onclick="setTodayFilter('all')">সবাইকে দেখুন</button></div>`
    :'<div class="rd-hempty"><span>এই তালিকায় এখন কেউ নেই।</span></div>';
  return `<div class="rd-hfilters" role="tablist">${HOME_FILTERS.map(([k,l])=>`<button type="button" role="tab" aria-selected="${_todayFilter===k}" class="rd-hfilter${_todayFilter===k?' on':''}" onclick="setTodayFilter('${k}')">${l} <b>${rdBn(cnt[k])}</b></button>`).join('')}</div>
  ${rows.length?`<div class="rd-hlist">${rows.map(_homeRow).join('')}</div>`:empty}`;
}
/** ফিল্টার বদলালে শুধু তালিকা বদলায় — ওপরের অংশ, স্ক্রল ও অ্যানিমেশন স্থির থাকে */
function setTodayFilter(f){
  _todayFilter=f;
  const box=document.getElementById('todayDecisions'); if(!box){ renderToday(); return; }
  const list=document.getElementById('todayList'); const top=list?list.scrollTop:0;
  box.classList.add('rd-still');
  box.innerHTML=_homeListHtml(_homeRows());
  if(list) list.scrollTop=top;
}

function renderToday(){
  const el=document.getElementById('todayList'); if(!el) return;
  const data=_homeRows();
  const waiting=data.rows.filter(r=>r.pending>0).length;
  const badge=document.getElementById('todayBadge');
  if(badge){ badge.textContent=waiting?rdBn(waiting):''; badge.classList.toggle('show',waiting>0); }
  if(curTab!=='today') return;
  const firstPaint=!el.dataset.painted; el.dataset.painted='1';
  const keepTop=el.scrollTop;
  el.innerHTML=`<div id="todayDecisions">${_homeListHtml(data)}</div><div class="rd-bottom-space"></div>`;
  el.classList.toggle('rd-still',!firstPaint);
  if(!firstPaint) el.scrollTop=keepTop;
}

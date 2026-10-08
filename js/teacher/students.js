/* Waqful Madinah — js/teacher/students.js: students tab / বিবরণ dashboard */
// ══ STUDENTS / বিবরণ ═══════════════════════════════════════
let studentYearFilter=null; // null=সব, 1|2|3=বর্ষ
let studentPctSort=''; // '' | 'desc' | 'asc' | 'yesterday'
let biboronDetailMode='';
let biboronMenuOpen='';
let stuRowMenuId=null;
const _docFlagIc='<span class="stu-flag-ic" title="ডক বাকি" aria-label="ডক বাকি"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></svg></span>';
function setStudentYearFilter(year,btn){
  studentYearFilter=year===''||year==null?null:Number(year);
  const lbl=document.getElementById('biboronFilterLabel');
  if(lbl) lbl.textContent=studentYearFilter===1?'১ম বর্ষ':studentYearFilter===2?'২য় বর্ষ':studentYearFilter===3?'৩য় বর্ষ':'সব';
  closeBiboronMenu();
  stuRowMenuId=null;
  renderStudentList();
}
function setStudentPctSort(mode,btn){
  studentPctSort=mode==='desc'||mode==='asc'||mode==='yesterday'||mode==='today'? (mode==='today'?'yesterday':mode) :'';
  const lbl=document.getElementById('biboronSortLabel');
  if(lbl) lbl.textContent=studentPctSort==='desc'?'% বেশি':studentPctSort==='asc'?'% কম':studentPctSort==='yesterday'?'গতকাল বাকি':'সাধারণ';
  closeBiboronMenu();
  stuRowMenuId=null;
  renderStudentList();
}
function toggleBiboronMenu(type){
  const menu=document.getElementById('biboronControlMenu'); if(!menu) return;
  if(biboronMenuOpen===type){ closeBiboronMenu(); return; }
  biboronMenuOpen=type;
  menu.style.display='grid';
  menu.style.right=type==='filter'?'74px':'0';
  if(type==='filter'){
    const opts=[
      ['', 'সব'],
      [1, '১ম বর্ষ'],
      [2, '২য় বর্ষ'],
      [3, '৩য় বর্ষ'],
    ];
    menu.innerHTML=opts.map(([v,l])=>`<button type="button" class="biboron-menu-opt ${studentYearFilter===(v===''?null:Number(v))?'active':''}" onclick="setStudentYearFilter('${v}',this)">${l}</button>`).join('');
  } else {
    const opts=[
      ['', 'সাধারণ'],
      ['desc', '% বেশি'],
      ['asc', '% কম'],
      ['yesterday', 'গতকাল বাকি'],
    ];
    menu.innerHTML=opts.map(([v,l])=>`<button type="button" class="biboron-menu-opt ${studentPctSort===v?'active':''}" onclick="setStudentPctSort('${v}',this)">${l}</button>`).join('');
  }
}
function closeBiboronMenu(){
  biboronMenuOpen='';
  const menu=document.getElementById('biboronControlMenu');
  if(menu){ menu.style.display='none'; menu.innerHTML=''; }
}
function showBiboronDetail(mode){
  biboronDetailMode=['amal','msg','quiz','behind','doc','studentNote','teacherNote'].includes(mode)?mode:'';
  renderBiboronDetailPanel();
  stuRowMenuId=null;
}
function biboronTargetTab(mode,sid){
  if(mode==='msg') return 'msg';
  if(mode==='doc') return 'doc';
  if(mode==='quiz') return 'exam';
  if(mode==='amal'||mode==='behind') return 'task';
  if(mode==='studentNote'||mode==='teacherNote') return 'note';
  return 'info';
}
function openBiboronTarget(sid,mode){
  if(mode==='studentNote') chatNoteView='student';
  else if(mode==='teacherNote') chatNoteView='teacher';
  const tab=biboronTargetTab(mode,sid);
  openChat(sid,tab);
}
function toggleStuRowMenu(sid,ev){
  if(ev) ev.stopPropagation();
  stuRowMenuId=stuRowMenuId===sid?null:sid;
  renderStudentList();
}
function closeStuRowMenu(){ stuRowMenuId=null; }
function stuRowAction(action,sid,ev){
  if(ev) ev.stopPropagation();
  stuRowMenuId=null;
  if(action==='chat'){ openChat(sid,'msg'); return; }
  if(action==='task'){ openAddTask(sid); return; }
  if(action==='pin') viewPin(sid);
}
function renderBiboronSummary(){
  const el=document.getElementById('biboronSummary'); if(!el||!API.Biboron) return;
  const s=API.Biboron.getSummary();
  const msgNeed=(s.unreadMessages||0)+(s.pendingSched||0);
  el.innerHTML=`<div class="biboron-meta">গতকাল · ${esc(s.dateLabel)} · ${esc(s.progressLabel)}</div>
  <div class="summary-cards">
    ${biboronSummaryCard('orange',API.Students.getAll().length,'সকল ছাত্র','')}
    ${biboronSummaryCard('blue',`${s.dayPct!=null?s.dayPct:s.todayPct}%`,'আমল','amal')}
    ${biboronSummaryCard('green',msgNeed,'রিসালা','msg')}
    ${biboronSummaryCard('red',(s.pendingQuiz||0)+(s.manualQuiz||0),'পরীক্ষা','quiz')}
  </div>
  <div class="biboron-action-board">
    ${biboronActionCard('blue',s.behindDay!=null?s.behindDay:s.behindToday,'গতকাল বাকি','behind')}
    ${biboronActionCard('green',s.pendingDocs||0,'ডক','doc')}
    ${biboronActionCard('orange',s.studentNoteCount||0,'বিবরণ','studentNote')}
    ${biboronActionCard('red',s.teacherNoteCount||0,'নোট','teacherNote')}
  </div>`;
  renderBiboronDetailPanel();
}
function biboronSummaryCard(color,val,label,mode){
  return `<button type="button" class="summary-card ${color} biboron-summary-btn" onclick="showBiboronDetail('${mode}')"><div class="sc-val">${val}</div><div class="sc-lbl">${label}</div></button>`;
}
function biboronActionCard(color,val,label,mode){
  return `<button type="button" class="biboron-action-card ${color}" onclick="showBiboronDetail('${mode}')"><span class="biboron-action-val">${val}</span><span class="biboron-action-lbl">${label}</span></button>`;
}
function renderBiboronHint(list){
  const el=document.getElementById('biboronHint'); if(!el||!API.Biboron) return;
  const h=API.Biboron.getBatchHint(list, studentYearFilter);
  const behind=h.behindDay!=null?h.behindDay:h.behindToday;
  const filterLabel=studentYearFilter===1?'১ম বর্ষ':studentYearFilter===2?'২য় বর্ষ':studentYearFilter===3?'৩য় বর্ষ':'সব';
  const sortLabel=studentPctSort==='desc'?'% বেশি':studentPctSort==='asc'?'% কম':studentPctSort==='yesterday'?'গতকাল বাকি':'সাধারণ';
  el.classList.add('biboron-hint--tools');
  el.innerHTML=`<span class="biboron-hint-text"><strong>${esc(h.prefix)}</strong> · গড় ${h.avgPct}% · গতকাল <strong>${behind}</strong> জন বাকি</span>
    <span class="biboron-list-controls" id="studentToolbar">
      <button type="button" class="biboron-tool-btn" id="biboronFilterBtn" onclick="toggleBiboronMenu('filter')" title="ফিল্টার" aria-label="ফিল্টার"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 5h16M7 12h10M10 19h4"/></svg><span id="biboronFilterLabel">${filterLabel}</span></button>
      <button type="button" class="biboron-tool-btn" id="biboronSortBtn" onclick="toggleBiboronMenu('sort')" title="সাজান" aria-label="সাজান"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h10M4 12h16M4 17h6"/><path d="M17 6v12M14 15l3 3 3-3"/></svg><span id="biboronSortLabel">${sortLabel}</span></button>
      <span class="biboron-control-menu" id="biboronControlMenu"></span>
    </span>`;
}
function biboronStudentMeta(s,row,mode){
  const batch=API.Students.formatBatchYear(s.enrollmentDate);
  return [s.waqfId?API.Students.displayWaqfId(s.waqfId):'',batch||'',s.cls||''].filter(Boolean).join(' · ');
}
function biboronDetailRows(mode){
  const rows=API.Students.getAll().map(s=>({s,row:API.Biboron.getStudentRow(s.id)}));
  const filters={
    amal:x=>x.row.dayTotal>0,
    msg:x=>x.row.unreadMessages>0||!!x.row.pendingSchedule,
    quiz:x=>(x.row.pendingQuiz||0)+(x.row.manualQuiz||0)>0,
    behind:x=>x.row.dayTotal>0&&x.row.dayDone<x.row.dayTotal,
    doc:x=>x.row.pendingDocs>0,
    studentNote:x=>x.row.studentNoteCount>0,
    teacherNote:x=>x.row.teacherNoteCount>0,
  };
  return rows.filter(filters[mode]||(()=>false)).sort((a,b)=>{
    if(mode==='amal'||mode==='behind') return (a.row.dayDone/a.row.dayTotal||0)-(b.row.dayDone/b.row.dayTotal||0);
    if(mode==='msg'){
      const sa=(a.row.unreadMessages||0)+(a.row.pendingSchedule?1:0);
      const sb=(b.row.unreadMessages||0)+(b.row.pendingSchedule?1:0);
      if(sa!==sb) return sb-sa;
      return String(a.s.name||'').localeCompare(String(b.s.name||''),'bn');
    }
    const key={quiz:'pendingQuiz',doc:'pendingDocs',studentNote:'studentNoteCount',teacherNote:'teacherNoteCount'}[mode];
    if(key&&typeof a.row[key]==='number'&&a.row[key]!==b.row[key]) return b.row[key]-a.row[key];
    return String(a.s.name||'').localeCompare(String(b.s.name||''),'bn');
  });
}
function setBiboronListVisible(show){
  const list=document.getElementById('chatList');
  if(list) list.style.display=show?'':'none';
}
function renderBiboronDetailPanel(){
  const el=document.getElementById('biboronDetailPanel'); if(!el||!API.Biboron) return;
  if(!biboronDetailMode){
    el.style.display='none';
    el.classList.remove('open');
    el.innerHTML='';
    setBiboronListVisible(true);
    return;
  }
  const titles={amal:'আমল অবস্থা',msg:'রিসালা ও সময়সূচি',quiz:'পরীক্ষা বাকি',behind:'গতকাল বাকি',doc:'ডক বাকি',studentNote:'ছাত্রের বিবরণ',teacherNote:'জিম্মাদারের নোট'};
  const rows=biboronDetailRows(biboronDetailMode);
  setBiboronListVisible(false);
  el.style.display='flex';
  el.classList.add('open');
  el.innerHTML=`<div class="biboron-detail-head"><span class="biboron-detail-title">${titles[biboronDetailMode]||'তথ্য'}</span><button type="button" class="biboron-detail-close" onclick="showBiboronDetail('')">×</button></div>
    <div class="biboron-detail-list">${rows.length?rows.map(({s,row})=>`
      <div class="biboron-detail-row">
        <div class="biboron-detail-main">
          <div class="biboron-detail-name">${esc(s.name)}</div>
          <div class="biboron-detail-meta">${esc(biboronStudentMeta(s,row,biboronDetailMode))}</div>
        </div>
        <span class="stu360-tags">${biboronTags(row)}</span>
        <button type="button" class="biboron-detail-act" onclick="openBiboronTarget('${s.id}','${biboronDetailMode}')">দেখুন</button>
      </div>`).join(''):'<div class="biboron-detail-empty">এখন কিছু নেই।</div>'}</div>`;
}
function biboronTags(row){
  const out=[];
  const icon={
    msg:'<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.5 8.5 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"/></svg>',
    doc:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    quiz:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M9 12h6M9 16h4"/></svg>',
    note:'<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h6"/></svg>',
    task:'<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    sched:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
  };
  if(row.dayTotal>0) out.push(`<span class="stu360-pill"><span class="ic-svg">${icon.task}</span>${row.dayDone}/${row.dayTotal}</span>`);
  if(row.unreadMessages>0) out.push(`<span class="stu360-pill warn"><span class="ic-svg">${icon.msg}</span>${row.unreadMessages}</span>`);
  if(row.pendingSchedule) out.push(`<span class="stu360-pill warn"><span class="ic-svg">${icon.sched}</span>সময়সূচি</span>`);
  if(row.pendingDocs>0) out.push(`<span class="stu360-pill warn"><span class="ic-svg">${icon.doc}</span>${row.pendingDocs}</span>`);
  const q=(row.pendingQuiz||0)+(row.manualQuiz||0);
  if(q>0) out.push(`<span class="stu360-pill bad"><span class="ic-svg">${icon.quiz}</span>${q}</span>`);
  if(row.noteCount>0) out.push(`<span class="stu360-pill info"><span class="ic-svg">${icon.note}</span>${row.noteCount}</span>`);
  return out.join('');
}
function loadProgressSettingsUI(){
  const cfg=API.ProgressSettings.get();
  const en=document.querySelector('input[name="progMode"][value="enrollment"]');
  const cu=document.querySelector('input[name="progMode"][value="custom"]');
  if(en) en.checked=cfg.mode!=='custom';
  if(cu) cu.checked=cfg.mode==='custom';
  const wrap=document.getElementById('progCustomWrap');
  const inp=document.getElementById('progCustomFrom');
  if(wrap) wrap.style.display=cfg.mode==='custom'?'block':'none';
  if(inp) inp.value=cfg.customFrom||'';
}
function onProgModeChange(){
  const mode=(document.querySelector('input[name="progMode"]:checked')||{}).value||'enrollment';
  const wrap=document.getElementById('progCustomWrap');
  if(wrap) wrap.style.display=mode==='custom'?'block':'none';
}
function saveProgressSettings(){
  const mode=(document.querySelector('input[name="progMode"]:checked')||{}).value||'enrollment';
  const customFrom=(document.getElementById('progCustomFrom')||{}).value||'';
  if(mode==='custom'&&!/^\d{4}-\d{2}-\d{2}$/.test(customFrom)){
    showToast('শুরুর তারিখ দিন'); return;
  }
  API.ProgressSettings.save({ mode, customFrom });
  showToast('✅ সংরক্ষিত');
  renderBiboronSummary();
  renderStudentList();
}
function renderNoteCatSettings(){
  const el=document.getElementById('noteCatList');
  if(!el||!API.StudentNotes) return;
  const cats=API.StudentNotes.getCategories();
  if(!cats.length){ el.innerHTML='<p style="font-size:13px;color:var(--gray-500)">কোনো ক্যাটাগরি নেই</p>'; return; }
  el.innerHTML=cats.map(c=>{
    const locked=c.id==='general';
    return `<div class="note-cat-row">
      <span class="note-cat-name">${esc(c.label)}${locked?' <span style="font-size:11px;color:var(--gray-400)">(ডিফল্ট)</span>':''}</span>
      <button type="button" class="note-cat-del" ${locked?'disabled':''} onclick="deleteNoteCategory('${esc(c.id)}')">মুছুন</button>
    </div>`;
  }).join('');
}
async function addNoteCategory(){
  const inp=document.getElementById('noteCatNewIn');
  const label=(inp&&inp.value||'').trim();
  if(!label){ showToast('ক্যাটাগরির নাম লিখুন'); return; }
  if(!API.StudentNotes) return;
  try{
    await API.StudentNotes.upsertCategory({ id:API.uid('nc'), label });
    if(inp) inp.value='';
    renderNoteCatSettings();
    showToast('ক্যাটাগরি যোগ হয়েছে');
  }catch(e){
    console.error(e);
    showToast('যোগ করা যায়নি');
  }
}
async function deleteNoteCategory(id){
  if(!id||id==='general'||!API.StudentNotes) return;
  const ok=await showConfirm('এই ক্যাটাগরি মুছবেন? সংশ্লিষ্ট নোট «সাধারণ»-এ চলে যাবে।',{title:'ক্যাটাগরি মুছুন',okText:'মুছে ফেলুন',danger:true});
  if(!ok) return;
  try{
    await API.StudentNotes.deleteCategory(id);
    renderNoteCatSettings();
    showToast('ক্যাটাগরি মুছে ফেলা হয়েছে');
  }catch(e){
    console.error(e);
    showToast(e.message==='cannot_delete_default'?'ডিফল্ট মুছা যায় না':'মুছা যায়নি');
  }
}
let _fnQuestions=[];
function renderFortnightlySettings(){
  if(!API.StudentNotes) return;
  const cfg=API.StudentNotes.getFortnightlyConfig();
  _fnQuestions=cfg.questions.slice();
  const en=document.getElementById('fnEnabled'); if(en) en.checked=cfg.enabled;
  const days=document.getElementById('fnIntervalDays'); if(days) days.value=cfg.intervalDays;
  const sel=document.getElementById('fnCategorySelect');
  if(sel){
    const cats=API.StudentNotes.getCategories();
    sel.innerHTML=cats.map(c=>`<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
    if(cfg.categoryId) sel.value=cfg.categoryId;
  }
  renderFnQuestionList();
}
function renderFnQuestionList(){
  const el=document.getElementById('fnQuestionList');
  if(!el) return;
  if(!_fnQuestions.length){ el.innerHTML='<p style="font-size:13px;color:var(--gray-500)">কোনো প্রশ্ন যোগ করা হয়নি — ছাত্র শুধু একটি সাধারণ লেখা জমা দেবে।</p>'; return; }
  el.innerHTML=_fnQuestions.map((q,i)=>`<div class="note-cat-row">
    <span class="note-cat-name">${i+1}. ${esc(q.text)}</span>
    <button type="button" class="note-cat-del" onclick="removeFnQuestion(${i})">মুছুন</button>
  </div>`).join('');
}
function addFnQuestion(){
  const inp=document.getElementById('fnQuestionNewIn');
  const text=(inp&&inp.value||'').trim();
  if(!text){ showToast('প্রশ্ন লিখুন'); return; }
  _fnQuestions.push({id:API.uid('fq'),text});
  if(inp) inp.value='';
  renderFnQuestionList();
}
function removeFnQuestion(i){
  _fnQuestions.splice(i,1);
  renderFnQuestionList();
}
async function saveFortnightlySettings(){
  if(!API.StudentNotes) return;
  const enabled=(document.getElementById('fnEnabled')||{}).checked||false;
  const intervalDays=Number((document.getElementById('fnIntervalDays')||{}).value)||15;
  const categoryId=(document.getElementById('fnCategorySelect')||{}).value||'';
  if(enabled&&!categoryId){ showToast('ক্যাটাগরি নির্বাচন করুন'); return; }
  try{
    await API.StudentNotes.saveFortnightlyConfig({enabled,intervalDays,categoryId,questions:_fnQuestions});
    showToast('✅ সংরক্ষিত');
  }catch(e){
    console.error(e);
    showToast('❌ সংরক্ষণ ব্যর্থ');
  }
}
function renderStudentList(){
  let list=API.Students.getAll();
  if(studentYearFilter!=null){
    list=list.filter(s=>API.Students.getBatchYear(s.enrollmentDate)===studentYearFilter);
  }
  if(studentPctSort==='yesterday'){
    list=list.filter(s=>{
      const row=API.Biboron?API.Biboron.getStudentRow(s.id):{todayDone:0,todayTotal:0};
      const done=row.dayDone!=null?row.dayDone:row.todayDone;
      const total=row.dayTotal!=null?row.dayTotal:row.todayTotal;
      return total>0&&done<total;
    }).slice().sort((a,b)=>{
      const ra=API.Biboron.getStudentRow(a.id), rb=API.Biboron.getStudentRow(b.id);
      const daDone=ra.dayDone!=null?ra.dayDone:ra.todayDone, daTot=ra.dayTotal!=null?ra.dayTotal:ra.todayTotal;
      const dbDone=rb.dayDone!=null?rb.dayDone:rb.todayDone, dbTot=rb.dayTotal!=null?rb.dayTotal:rb.todayTotal;
      const da=(daDone/daTot)-(dbDone/dbTot);
      if(da!==0) return da;
      return String(a.name||'').localeCompare(String(b.name||''),'bn');
    });
  }else if(studentPctSort==='desc'||studentPctSort==='asc'){
    list=list.slice().map(s=>{
      const prog=API.Tasks.getListProgress(s.id);
      return { s, pct:Math.max(0,Math.min(100,prog.percent|0)) };
    }).sort((a,b)=>{
      const d=studentPctSort==='asc'?a.pct-b.pct:b.pct-a.pct;
      if(d!==0) return d;
      return String(a.s.name||'').localeCompare(String(b.s.name||''),'bn');
    }).map(x=>x.s);
  }
  renderBiboronHint(list);
  const listEl=document.getElementById('studentList');
  if(!listEl) return;
  if(!list.length){
    listEl.innerHTML=`<div class="empty-state"><div class="icon"><span class="ic-svg"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span></div><p>${studentPctSort==='yesterday'?'গতকাল সবাই সম্পন্ন!':'ছাত্র নেই।'}</p></div>`;
    return;
  }
  listEl.innerHTML=list.map(s=>{
    const batch=API.Students.formatBatchYear(s.enrollmentDate);
    const row=API.Biboron?API.Biboron.getStudentRow(s.id):{todayDone:0,todayTotal:0,flags:[]};
    const idLbl=s.waqfId?API.Students.displayWaqfId(s.waqfId):'';
    const meta=[idLbl,batch].filter(Boolean).map(x=>`<span class="stu360-chip">${esc(x)}</span>`).join('');
    const sub=s.cls||'';
    const tags=biboronTags(row);
    const subLine=(sub||tags)?`<div class="stu360-sub">${sub?`<span class="stu360-sub-text">${esc(sub)}</span>`:''}${tags}</div>`:'';
    const menuOpen=stuRowMenuId===s.id;
    const menuHtml=menuOpen?`<div class="stu-more-menu">
      <button type="button" class="stu-more-item" onclick="stuRowAction('chat','${s.id}',event)">রিসালা</button>
      <button type="button" class="stu-more-item" onclick="stuRowAction('task','${s.id}',event)">আমল</button>
      <button type="button" class="stu-more-item" onclick="stuRowAction('pin','${s.id}',event)">পিন</button>
    </div>`:'';
    return `<div class="student-item stu360-item" onclick="if(stuRowMenuId){closeStuRowMenu();renderStudentList();return;}openStudentProfile('${s.id}')">
      ${pctAvatarHtml(s.id,'s-avatar')}
      <div class="s-info">
        <div class="s-name s-name-row"><span class="s-name-text">${esc(s.name)}</span>${meta}${s.responsibility?`<span class="stu360-chip warn">${esc(s.responsibility)}</span>`:''}</div>
        ${subLine}
      </div>
      <div class="stu-more-wrap">
        <button type="button" class="stu-more-btn${menuOpen?' open':''}" onclick="toggleStuRowMenu('${s.id}',event)" title="আরও" aria-label="আরও"><span class="ic-svg"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/></svg></span></button>
        ${menuHtml}
      </div>
    </div>`;
  }).join('');
}
async function addStudent(){
  const name=document.getElementById('ns_name').value.trim();
  const p=String(document.getElementById('ns_pin').value).trim();
  if(!name){ showToast('নাম লিখুন!'); return; }
  if(!/^\d{4}$/.test(p)){ showToast('৪ সংখ্যার পিন দিন!'); return; }
  try{
    const s=await API.Students.add({
      name, pin:p,
      cls:document.getElementById('ns_cls').value.trim(),
      roll:document.getElementById('ns_roll').value.trim(),
      note:document.getElementById('ns_note').value.trim(),
      fatherName:document.getElementById('ns_father').value.trim(),
      contact:document.getElementById('ns_contact').value.trim(),
      bloodGroup:document.getElementById('ns_blood').value,
      district:document.getElementById('ns_district').value.trim(),
      upazila:document.getElementById('ns_upazila').value.trim(),
      enrollmentDate:document.getElementById('ns_enroll').value,
    });
    closeModal('addStudentModal');
    ['ns_name','ns_cls','ns_roll','ns_pin','ns_note','ns_father','ns_contact','ns_district','ns_upazila'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('ns_blood').value='';
    document.getElementById('ns_enroll').value='';
    renderAll(); showToast(`✅ ${s.name} যোগ হয়েছে · ID: ${API.Students.displayWaqfId(s.waqfId)}`);
  } catch(e){ showToast(e.message||'ত্রুটি!'); }
}
function viewPin(id){ editSid=id; const s=API.Students.getById(id); document.getElementById('pinMTitle').textContent=(s.waqfId?API.Students.displayWaqfId(s.waqfId)+' · ':'')+s.name+'-এর পিন'; document.getElementById('pinDisp').textContent=s.pin||'----'; document.getElementById('newSPin').value=''; openModal('pinModal'); }
async function updateSPin(){ const p=String(document.getElementById('newSPin').value).trim(); if(!/^\d{4}$/.test(p)){ showToast('৪ সংখ্যার পিন দিন!'); return; } try{ await API.Students.updatePin(editSid,p); document.getElementById('pinDisp').textContent=p; renderStudentList(); showToast('✅ পিন আপডেট'); } catch(e){ console.error(e); showToast('সেভ করা যায়নি'); } }
function copyPin(){ const p=document.getElementById('pinDisp').textContent; navigator.clipboard?.writeText(p).catch(()=>{}); showToast('কপি: '+p); }

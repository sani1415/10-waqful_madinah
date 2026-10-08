/* Waqful Madinah — js/student/tasks.js: আমল (tasks) tab + dashboard/calendar */
// ══ TASKS ══════════════════════════════════════════════════
const _svgIcDone='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>';
const _svgIcPend='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/></svg>';
const _svgIcLate='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg>';
const _svgChk='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function atCardHtml(task){
  const isDaily=task.type==='daily';
  const workDate=getAmalWorkDate();
  const isDoneDaily=isDaily&&API.Tasks.isCompleted(task.id,me.id,workDate);
  const st=isDaily?(isDoneDaily?'done':'pending'):task.assignees[me.id];
  const ic={done:_svgIcDone,pending:_svgIcPend,late:_svgIcLate};
  const cl={done:'done',late:'late',pending:''};
  const badge=isDaily?'দৈনিক':'এককালীন';
  const btnDaily=isDoneDaily
    ? `<button type="button" class="stu-task-check done" onclick="undoDailyDone('${task.id}')" title="পূর্বাবস্থায় ফিরুন" aria-label="পূর্বাবস্থায় ফিরুন">${_svgChk}</button>`
    : `<button type="button" class="stu-task-check empty" onclick="markDailyDone('${task.id}')" title="সম্পন্ন" aria-label="সম্পন্ন"></button>`;
  const btnOnce=st!=='done'
    ? `<button type="button" class="stu-task-check empty ${st==='late'?'late':''}" onclick="markDone('${task.id}')" title="সম্পন্ন" aria-label="সম্পন্ন"></button>`
    : `<button type="button" class="stu-task-check done" onclick="undoTaskDone('${task.id}')" title="পূর্বাবস্থায় ফিরুন" aria-label="পূর্বাবস্থায় ফিরুন">${_svgChk}</button>`;
  const sub=isDaily?'':(task.deadline?(' · '+esc(task.deadline)):'');

  return `<div class="stu-task-row ${cl[st]||''}">
    <span class="stu-task-row-ic ${st||'pending'}" aria-hidden="true">${ic[st]||_svgIcPend}</span>
    <div class="stu-task-row-mid">
      <span class="stu-task-row-title">${esc(task.title)}${sub}</span>
    </div>
    <span class="stu-task-row-pill ${isDaily?'daily':'onetime'}">${esc(badge)}</span>
    <div class="stu-task-row-act">${isDaily?btnDaily:btnOnce}</div>
  </div>`;
}
function renderTaskList(f){
  if(f) tFilter=f; const el=document.getElementById('taskList');
  const tasks=API.Tasks.getForStudent(me.id);
  const onetime=tasks.filter(t=>t.type!=='daily');
  let h='';
  if(onetime.length){
    h+='<div class="stu-onetime-section-title">এককালীন আমল</div>';
    onetime.forEach(t=>{ h+=atCardHtml(t); });
  }
  el.innerHTML=h? h+'<div style="height:20px"></div>' : '';
}
function weekDatesFor(date){
  if(window.ApiAmal&&ApiAmal.getWeekDates) return ApiAmal.getWeekDates(date||API.today());
  const base=new Date((date||API.today())+'T12:00:00Z');
  base.setUTCDate(base.getUTCDate()-((base.getUTCDay()+1)%7));
  return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setUTCDate(base.getUTCDate()+i);return d.toISOString().split('T')[0];});
}
function canEditWeeklyDate(date){
  return String(date||'')<=String(API.today());
}
function weekDateLabel(date){
  return new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{day:'numeric',timeZone:'Asia/Dhaka'});
}
function weekDayLabel(date){
  return new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{weekday:'short',timeZone:'Asia/Dhaka'});
}
function buildWeeklyDraft(){
  if(!me) return null;
  const end=getAmalWorkDate();
  const dates=Array.from({length:7},(_,i)=>{
    const d=new Date(end+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()-(6-i));
    return d.toISOString().split('T')[0];
  });
  const tasks=API.Tasks.getForStudent(me.id).filter(t=>t.type==='daily');
  const cells={};
  tasks.forEach(t=>dates.forEach(d=>{ cells[`${t.id}|${d}`]=canEditWeeklyDate(d)&&!!API.Tasks.isCompleted(t.id,me.id,d); }));
  return { dates, tasks, cells };
}
function renderWeeklyAmalEntry(){
  const el=document.getElementById('weeklyAmalEntry');
  if(!el||!me) return;
  const d=buildWeeklyDraft();
  if(!d||!d.tasks.length){ el.innerHTML=''; return; }
  let done=0,total=d.tasks.length*d.dates.length;
  d.tasks.forEach(t=>d.dates.forEach(date=>{ if(d.cells[`${t.id}|${date}`]) done++; }));
  const pct=total?Math.round(done/total*100):0;
  el.innerHTML=`<div class="weekly-amal-card">
    <div class="weekly-amal-head">
      <div><div class="weekly-amal-title">৭ দিনের আমল</div><div class="weekly-amal-sub">${esc(d.dates[0])} – ${esc(d.dates[6])} · ${done}/${total} · ${pct}%</div></div>
    </div>
    <div class="weekly-amal-grid-wrap">
      <div class="weekly-amal-grid" style="--week-cols:${d.dates.length}">
        <div class="weekly-amal-corner">আমল</div>
        ${d.dates.map(date=>`<div class="weekly-amal-day ${canEditWeeklyDate(date)?'':'future'}"><span class="weekly-amal-date">${esc(weekDateLabel(date))}</span><span class="weekly-amal-weekday">${esc(weekDayLabel(date))}</span></div>`).join('')}
        ${d.tasks.map(t=>`<div class="weekly-amal-task">${esc(t.title)}</div>${d.dates.map(date=>{
          const key=`${t.id}|${date}`;
          const on=!!d.cells[key];
          return `<button type="button" class="weekly-amal-cell ${on?'on':'off'}" onclick="toggleWeeklyAmalCell('${esc(t.id)}','${esc(date)}',this)" aria-label="${esc(t.title)} ${esc(date)} ${on?'সম্পন্ন':'অসম্পন্ন'}">${on?'✓':'✕'}</button>`;
        }).join('')}`).join('')}
      </div>
    </div>
  </div>`;
}
async function toggleWeeklyAmalCell(tid,date,btn){
  if(!me||!canEditWeeklyDate(date)) return;
  const have=!!API.Tasks.isCompleted(tid,me.id,date);
  if(btn) btn.disabled=true;
  try{
    if(have) await API.Tasks.unmarkCompleted(tid,me.id,date);
    else await API.Tasks.markCompleted(tid,me.id,{date,status:'done'});
    renderAmalDashboard();
    if(document.getElementById('amalCalPopover')?.classList.contains('open')) renderAmalCalendar();
  }catch(e){
    console.error(e);
    if(btn) btn.disabled=false;
    showToast('আমল আপডেট হয়নি');
  }
}
function fTask(f,btn){ document.querySelectorAll('#amal-panel-today .stu-filter-pill').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); renderTaskList(f); }
async function markDailyDone(tid){
  const d=getAmalWorkDate();
  try{
    if(d===API.today()) await API.Tasks.markDailyDone(tid,me.id);
    else await API.Tasks.markCompleted(tid,me.id,{date:d,status:'done'});
    renderAll();
    showToast(d===API.today()?'مَا شَاءَ اللّٰه! আজকের আমল সম্পন্ন ✅':'مَا شَاءَ اللّٰه! গতকালের আমল সম্পন্ন ✅');
  }catch(e){ console.error(e); showToast('❌ আমল সেভ হয়নি'); }
}
async function markDone(tid){ try{ await API.Tasks.markDone(tid,me.id); renderAll(); showToast('مَا شَاءَ اللّٰه! আমল সম্পন্ন ✅'); }catch(e){ console.error(e); showToast('❌ আমল সেভ হয়নি'); } }
async function undoDailyDone(tid){
  const d=getAmalWorkDate();
  const dayLbl=d===API.today()?'আজকের':'গতকালের';
  const ok=await showConfirm(dayLbl+' এই আমলটি "সম্পন্ন" থেকে পূর্বাবস্থায় ফিরিয়ে নেবেন?',{title:'আমল আনডু',okText:'পূর্বাবস্থায় ফিরুন'});
  if(!ok) return;
  try{
    if(d===API.today()) await API.Tasks.unmarkDailyDone(tid,me.id);
    else await API.Tasks.unmarkCompleted(tid,me.id,d);
    renderAll(); showToast('↩ পূর্বাবস্থায় ফেরানো হয়েছে');
  }
  catch(e){ console.error(e); showToast('❌ পূর্বাবস্থায় ফেরানো যায়নি'); }
}
async function undoTaskDone(tid){
  const ok=await showConfirm('এই আমলটি "সম্পন্ন" থেকে পূর্বাবস্থায় ফিরিয়ে নেবেন?',{title:'আমল আনডু',okText:'পূর্বাবস্থায় ফিরুন'});
  if(!ok) return;
  try{ await API.Tasks.unmarkOnce(tid,me.id); renderAll(); showToast('↩ পূর্বাবস্থায় ফেরানো হয়েছে'); }
  catch(e){ console.error(e); showToast('❌ পূর্বাবস্থায় ফেরানো যায়নি'); }
}

// ── আমল sub-tabs (ছাত্র) ─────────────────────────────────────
let _amalTab='today';
const _svgAmalCal='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
function getAmalWorkDate(){ return amalWorkDate||API.today(); }
function isAmalYesterdayMode(){ return getAmalWorkDate()!==API.today(); }
function shiftAmalWorkDate(delta){
  const d=new Date(getAmalWorkDate()+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+Number(delta||0));
  const next=d.toISOString().split('T')[0];
  amalWorkDate=next>=API.today()?null:next;
  renderAmalDashboard();
  renderTaskList();
}
function selectAmalCalendarDate(date){
  if(!date||date>API.today()) return;
  amalWorkDate=date===API.today()?null:date;
  closeAmalCalendar();
  renderAmalDashboard();
  renderTaskList();
}
function amalDashDateLabel(){
  const d=getAmalWorkDate();
  try{
    return new Date(d+'T12:00:00Z').toLocaleDateString('bn-BD',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'});
  }catch(e){ return d; }
}
function amalDashHeaderHtml(){
  return `<div class="stu-amal-dash-hd">
    <button type="button" class="stu-amal-yday-btn" onclick="shiftAmalWorkDate(-1)" title="এক দিন পেছনে" aria-label="এক দিন পেছনে"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div class="stu-amal-dash-title-wrap">
      <div class="stu-amal-dash-title">মুহাসাবা</div>
      <div class="stu-amal-dash-date">${esc(amalDashDateLabel())}</div>
    </div>
    <button type="button" class="stu-amal-cal-btn" onclick="openAmalCalendar()" title="আমল ইতিহাস" aria-label="আমল ইতিহাস ক্যালেন্ডার">${_svgAmalCal}</button>
  </div>`;
}
function goAmalTab(tab,btn){
  if(tab==='history') tab='biboron';
  _amalTab=tab;
  document.querySelectorAll('.amal-sub-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  else{
    const map={today:0,biboron:1,schedule:2};
    const tabs=document.querySelectorAll('#screen-tasks .amal-sub-tab');
    const ix=map[tab]; if(tabs[ix]) tabs[ix].classList.add('active');
  }
  document.querySelectorAll('#screen-tasks .amal-panel').forEach(p=>p.style.display='none');
  const panel=document.getElementById('amal-panel-'+tab);
  if(panel) panel.style.display='';
  closeAmalCalendar();
  if(tab==='today'){ renderAmalDashboard(); renderTaskList(); }
  else if(tab==='biboron') renderDailyNotes();
  else if(tab==='schedule') renderTaskSchedulePanel();
}
function renderAmalDashboard(){
  const el=document.getElementById('amalDashboard'); if(!el||!me) return;
  const dailyTasks=API.Tasks.getForStudent(me.id).filter(t=>t.type==='daily');
  const prog=API.Tasks.getProgressSummary(me.id);
  const R=22, C=2*Math.PI*R;
  function ringCol(pct, stroke, lbl){
    const p=Math.round(Math.min(100,Math.max(0,Number(pct)||0)));
    const off=C*(1-p/100);
    const svg=`<svg class="stu-ring-svg" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${R}" fill="none" stroke="#e8e8e8" stroke-width="5"/><circle cx="26" cy="26" r="${R}" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 26 26)" style="transition:stroke-dashoffset .35s"/></svg>`;
    return `<div class="stu-ring-col"><div class="stu-svg-ring-wrap">${svg}<span class="stu-ring-pct">${p}%</span></div><span class="stu-ring-lbl">${lbl}</span></div>`;
  }
  const hd=amalDashHeaderHtml();
  if(!dailyTasks.length){
    el.innerHTML=`<div class="stu-amal-dash-wrap"><div class="stu-amal-dash-card stu-amal-dash-card--empty">${hd}<p class="stu-amal-dash-hint">উস্তাদ দৈনিক আমল যোগ করলে এখানে অগ্রগতি দেখা যাবে।</p></div></div>`;
    const weeklyEl=document.getElementById('weeklyAmalEntry'); if(weeklyEl) weeklyEl.innerHTML='';
    return;
  }
  const all=prog.all||{percent:0};
  const wd=getAmalWorkDate();
  const yMode=isAmalYesterdayMode();
  const dayProg=yMode?API.Tasks.getRangeProgress(me.id,wd,wd):prog.today;
  const dayLbl=yMode?'নির্বাচিত':'আজ';
  el.innerHTML=`<div class="stu-amal-dash-wrap">
    <div class="stu-amal-dash-card">
      ${hd}
      <div class="stu-amal-rings">${ringCol(dayProg.percent||0,'#4CAF50',dayLbl)}${ringCol(prog.week.percent,'#43A047','সপ্তাহ')}${ringCol(prog.month.percent,'#42A5F5','মাস')}${ringCol(all.percent,'#8D6E63','শুরু থেকে')}</div>
    </div>
  </div>`;
  renderWeeklyAmalEntry();
}
function openAmalCalendar(){
  const pop=document.getElementById('amalCalPopover');
  if(!pop) return;
  pop.classList.add('open');
  pop.setAttribute('aria-hidden','false');
  renderAmalCalendar();
}
function closeAmalCalendar(){
  const pop=document.getElementById('amalCalPopover');
  if(!pop) return;
  pop.classList.remove('open');
  pop.setAttribute('aria-hidden','true');
}
function renderAmalCalendar(){
  const el=document.getElementById('amalCalendarContent'); if(!el||!me) return;
  if(!window._calYear){const t=API.today().split('-');window._calYear=Number(t[0]);window._calMonth=Number(t[1]);}
  const y=window._calYear,m=window._calMonth;
  const data=API.Tasks.getCalendarData(me.id,y,m);
  const dInM=new Date(y,m,0).getDate(),firstDay=new Date(y,m-1,1).getDay(),today=API.today();
  const pad=n=>String(n).padStart(2,'0');
  const mNames=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  let h=`<div class="cal-header">
    <button type="button" class="date-nav-btn" onclick="_calNav(-1)">◀</button>
    <span class="cal-month-title">${mNames[m-1]} ${y}</span>
    <button type="button" class="date-nav-btn" onclick="_calNav(1)">▶</button>
  </div>
  <div class="s-cal-grid">
    <div class="s-cal-day-hd">রবি</div><div class="s-cal-day-hd">সোম</div><div class="s-cal-day-hd">মঙ্গল</div>
    <div class="s-cal-day-hd">বুধ</div><div class="s-cal-day-hd">বৃহঃ</div><div class="s-cal-day-hd">শুক্র</div><div class="s-cal-day-hd">শনি</div>`;
  for(let i=0;i<firstDay;i++) h+=`<div class="s-cal-cell empty"></div>`;
  for(let d=1;d<=dInM;d++){
    const date=`${y}-${pad(m)}-${pad(d)}`, cell=data[date], isT=date===today;
    const selected=date===getAmalWorkDate();
    if(date>today){ h+=`<div class="s-cal-cell future${isT?' cal-today':''}"><span class="s-cal-date">${d}</span></div>`; continue; }
    if(!cell){ h+=`<button type="button" class="s-cal-cell selectable${isT?' cal-today':''}${selected?' selected':''}" onclick="selectAmalCalendarDate('${date}')"><span class="s-cal-date">${d}</span></button>`; continue; }
    const st=cell.status||cell, pct=typeof cell.percent==='number'?cell.percent:(st==='done'?100:st==='partial'?50:0);
    h+=`<button type="button" class="s-cal-cell selectable ${st}${isT?' cal-today':''}${selected?' selected':''}" onclick="selectAmalCalendarDate('${date}')"><span class="s-cal-date">${d}</span><span class="s-cal-pct">${pct}%</span></button>`;
  }
  h+=`</div>`;
  el.innerHTML=h;
}
function _calNav(dir){let m=window._calMonth+dir,y=window._calYear;if(m>12){m=1;y++;}if(m<1){m=12;y--;}window._calMonth=m;window._calYear=y;renderAmalCalendar();}

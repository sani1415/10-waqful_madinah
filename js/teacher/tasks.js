/* Waqful Madinah — js/teacher/tasks.js: আমল (tasks) tab */
// ══ TASKS ══════════════════════════════════════════════════
function renderTaskList(f){
  if(f) tFilter=f;
  const tasks=API.Tasks.getAll();
  const el=document.getElementById('taskList');
  if(!tasks.length){ el.innerHTML=`<div class="empty-state"><div class="icon"><span class="ic-svg"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg></span></div><p>কোনো আমল নেই।</p></div>`; return; }
  const ic={done:_svgIcDone,pending:_svgIcPend,late:_svgIcLate,partial:_svgIcPartial};
  const dailyTasks=tasks.filter(t=>t.type==='daily');
  const onetimeTasks=tasks.filter(t=>t.type==='onetime');

  function taskMatchesFilter(t){
    const st=API.Tasks.overallStatus(t);
    const isDaily=t.type==='daily';
    if(tFilter==='daily'&&!isDaily) return false;
    if(tFilter==='onetime'&&isDaily) return false;
    if(tFilter==='done'&&st!=='done') return false;
    if(tFilter==='late'&&st!=='late') return false;
    if(tFilter==='pending'&&(st!=='pending'&&st!=='partial')) return false;
    return true;
  }

  function teaTaskRowHtml(t){
    if(!taskMatchesFilter(t)) return '';
    const st=API.Tasks.overallStatus(t);
    const isDaily=t.type==='daily';
    const ids=Object.keys(t.assignees||{});
    const doneCount=isDaily
      ? ids.filter(id=>API.Tasks.isDailyDoneToday(t,id)).length
      : ids.filter(id=>t.assignees[id]==='done').length;
    const full=ids.length>0&&doneCount===ids.length;
    const rowCls='tea-task-row'+(st==='done'?' done':'')+(st==='late'?' late':'');
    const statCls='tea-task-row-stat'+(full?' full':'');
    return `<div class="${rowCls}">
      <span class="tea-task-row-ic" aria-hidden="true">${ic[st]||_svgIcPend}</span>
      <div class="tea-task-row-mid">
        <span class="tea-task-row-title">${esc(t.title)}</span>
      </div>
      <span class="stu-task-row-pill ${isDaily?'daily':'onetime'}">${isDaily?'দৈনিক':'এককালীন'}</span>
      <span class="${statCls}">${doneCount}/${ids.length}</span>
      <button type="button" class="tea-task-row-del" onclick="deleteTask('${t.id}')" title="মুছুন" aria-label="মুছুন"><span class="ic-svg">${_svgTrash}</span></button>
    </div>`;
  }

  let h='';

  if(tFilter==='all'||tFilter==='daily'){
    if(dailyTasks.length){
      const doneToday=dailyTasks.filter(t=>{ const ids=Object.keys(t.assignees||{}); const d=ids.filter(id=>API.Tasks.isDailyDoneToday(t,id)).length; return d===ids.length&&ids.length>0; }).length;
      h+=`<div class="tea-amal-notice"><span class="ic-svg" aria-hidden="true">${_svgRepeat}</span><span>দৈনিক আমল — আজ ${doneToday}/${dailyTasks.length} টি সম্পূর্ণ।</span></div>`;
      dailyTasks.forEach(t=>{ h+=teaTaskRowHtml(t); });
    }
  }
  if(tFilter==='all'||tFilter==='onetime'){
    if(onetimeTasks.length){
      h+=`<div class="tea-amal-notice tea-amal-notice--once"><span class="ic-svg" aria-hidden="true">${_svgPin}</span><span>এককালীন আমল</span></div>`;
      onetimeTasks.forEach(t=>{ h+=teaTaskRowHtml(t); });
    }
  }
  if(tFilter!=='all'&&tFilter!=='daily'&&tFilter!=='onetime'){
    const sub=tFilter==='done'?'সম্পন্ন':tFilter==='late'?'বিলম্বিত':'ফিল্টার';
    let part='';
    tasks.forEach(t=>{ const r=teaTaskRowHtml(t); if(r) part+=r; });
    if(part) h+=`<div class="tea-amal-subhd">${sub}</div>`+part;
  }

  el.innerHTML=h||`<div class="empty-state"><div class="icon"><span class="ic-svg">${_svgSearch}</span></div><p>এই ফিল্টারে কিছু নেই।</p></div>`;
}
function fTask(f,btn){ document.querySelectorAll('#amal-panel-list .stu-filter-pill').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); renderTaskList(f); }
function toggleA(){ showToast('✅ আমল সম্পন্ন করবে ছাত্র নিজে।'); }
async function deleteTask(tid){ if(!confirm('এই আমলটি মুছবেন?')) return; try{ await API.Tasks.delete(tid); renderTaskList(); updateBadge(); showToast('🗑 আমল মুছে ফেলা হয়েছে'); }catch(e){ console.error(e); showToast('❌ আমল মোছা যায়নি'); } }
function updateBadge(){
  const n=API.Tasks.pendingCount();
  const b=document.getElementById('tBadge');
  if(b){ b.textContent=n; b.classList.toggle('show',n>0); }
  const sc=API.DailySchedule&&API.DailySchedule.pendingApprovalCount?API.DailySchedule.pendingApprovalCount():0;
  const sb=document.getElementById('schedBadge');
  if(sb){ sb.textContent=sc||''; sb.classList.toggle('show',sc>0); }
  syncAppBadge();
}
function teacherAppBadgeCount(){
  const msg=API.Students.getAll().reduce((sum,s)=>sum+API.Messages.unreadCount(s.id,'in'),0);
  const task=API.Tasks.pendingCount();
  const sched=API.DailySchedule&&API.DailySchedule.pendingApprovalCount?API.DailySchedule.pendingApprovalCount():0;
  const docs=API.Docs?Math.max(API.Docs.unreadCount(),API.Docs.getAll().filter(d=>d.sentBy!=='teacher'&&d.reviewStatus==='pending').length):0;
  return Math.max(0,msg+task+sched+docs);
}
function syncAppBadge(){
  const n=teacherAppBadgeCount();
  try{
    if('setAppBadge' in navigator){
      if(n>0) navigator.setAppBadge(n);
      else if('clearAppBadge' in navigator) navigator.clearAppBadge();
    }
  }catch(e){}
  function post(sw){ if(sw) try{ sw.postMessage({type:'SET_BADGE',count:n,role:'teacher'}); }catch(e){} }
  if(navigator.serviceWorker){
    if(navigator.serviceWorker.controller) post(navigator.serviceWorker.controller);
    else navigator.serviceWorker.ready.then(reg=>post(reg&&reg.active)).catch(()=>{});
  }
}

// ── আমল sub-tabs ─────────────────────────────────────────────
let _amalTab='list';
function goAmalTab(tab,btn){
  _amalTab=tab;
  document.querySelectorAll('.amal-sub-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#screen-tasks .amal-panel').forEach(p=>p.style.display='none');
  document.getElementById('amal-panel-'+tab).style.display='';
  if(tab==='overview') renderAmalOverview();
  else if(tab==='students') renderAmalLeaderboard();
  else renderTaskList();
}
function renderAmalOverview(dateStr){
  const date=dateStr||API.today();
  const el=document.getElementById('amalOverviewContent'); if(!el) return;
  const overview=API.Tasks.getTodayOverview(date);
  const stuMap=Object.fromEntries(API.Students.getAll().map(s=>[s.id,s]));
  let totalDone=0,totalAsgn=0;
  overview.forEach(o=>{totalDone+=o.completed.length;totalAsgn+=o.completed.length+o.pending.length;});
  const pct=totalAsgn>0?Math.round(totalDone/totalAsgn*100):0;
  const prev=(()=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().split('T')[0];})();
  const next=(()=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().split('T')[0];})();
  const displayDate=new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Dhaka'});
  let h=`<div class="summary-cards">
    <div class="summary-card blue"><div class="sc-val">${pct}%</div><div class="sc-lbl">সম্পন্নের হার</div></div>
    <div class="summary-card green"><div class="sc-val">${totalDone}</div><div class="sc-lbl">সম্পন্ন</div></div>
    <div class="summary-card orange"><div class="sc-val">${totalAsgn-totalDone}</div><div class="sc-lbl">বাকি</div></div>
  </div>
  <div class="date-nav">
    <button class="date-nav-btn" onclick="renderAmalOverview('${prev}')">◀ আগের দিন</button>
    <span class="date-nav-title">${displayDate}</span>
    <button class="date-nav-btn" onclick="renderAmalOverview('${next}')" ${date>=API.today()?'disabled':''}>পরের দিন ▶</button>
  </div>`;
  overview.forEach(({task,completed,pending,percent})=>{
    const assignees=Object.keys(task.assignees||{});
    const avatars=assignees.map(sid=>{
      const s=stuMap[sid]; if(!s) return '';
      return `<span class="amal-avatar ${completed.includes(sid)?'done':'pending'}" style="background:${s.color||'#128C7E'}" title="${esc(s.name)}">${(s.name||'?').slice(0,2)}</span>`;
    }).join('');
    h+=`<div class="amal-card">
      <div class="amal-card-hd"><span class="amal-card-title">${esc(task.title)}</span>
        <span class="type-badge ${task.type==='daily'?'daily':'onetime'}">${task.type==='daily'?'দৈনিক':'এককালীন'}</span></div>
      <div class="amal-prog-wrap"><div class="amal-prog-bar"><div class="amal-prog-fill" style="width:${percent}%"></div></div>
        <span class="amal-prog-txt">${completed.length}/${assignees.length}</span></div>
      <div class="amal-avatar-strip">${avatars}</div>
    </div>`;
  });
  if(!overview.length) h+=`<div class="empty-state"><div class="icon"><span class="ic-svg"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg></span></div><p>এই তারিখে কোনো আমল নেই।</p></div>`;
  el.innerHTML=h;
}
function renderAmalLeaderboard(period){
  const _p=period||window._lbPeriod||'week'; window._lbPeriod=_p;
  const el=document.getElementById('amalLeaderboardContent'); if(!el) return;
  const lb=API.Tasks.getLeaderboard(_p);
  const filters=`<div class="stu-amal-filters no-scrollbar">
    <button type="button" class="stu-filter-pill ${_p==='week'?'active':''}"  onclick="renderAmalLeaderboard('week')">এই সপ্তাহ</button>
    <button type="button" class="stu-filter-pill ${_p==='month'?'active':''}" onclick="renderAmalLeaderboard('month')">এই মাস</button>
  </div>`;
  if(!lb.length){ el.innerHTML=filters+`<div class="tea-lb-empty"><p>কোনো ছাত্র নেই।</p><p class="tea-lb-empty-hint">ছাত্র যোগ করলে এখানে অগ্রগতি দেখা যাবে।</p></div>`; return; }
  let h=filters+`<div class="tea-lb-list">`;
  lb.forEach((item,i)=>{
    const rank=i+1;
    const rk=rank<=3?` tea-lb-rank--${rank}`:'';
    const streak=item.streak>0?`<div class="tea-lb-streak"><span class="tea-lb-streak-n">${item.streak}</span><span class="tea-lb-streak-lbl">দিন ধারাবাহিক</span></div>`:'';
    h+=`<div class="tea-lb-block">
      <button type="button" class="tea-lb-row" onclick="_toggleLbDetail('ld-${esc(item.sid)}',this)">
        <span class="tea-lb-rank${rk}" aria-hidden="true">${rank}</span>
        ${pctAvatarHtml(item.sid,'tea-lb-avatar')}
        <span class="tea-lb-info">
          <span class="tea-lb-name">${esc(item.name)}${item.responsibility?` <span style="font-size:10px;font-weight:700;color:#E65100;background:#FFF3E0;border-radius:5px;padding:1px 5px">${esc(item.responsibility)}</span>`:''}</span>
          <span class="tea-lb-meta">${item.done}/${item.total} সম্পন্ন</span>
        </span>
        <span class="tea-lb-right">
          <span class="tea-lb-pct">${item.percent}<span class="tea-lb-pct-suffix">%</span></span>
          ${streak}
        </span>
        <span class="tea-lb-chev" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></span>
      </button>
      <div class="tea-lb-detail" id="ld-${esc(item.sid)}" style="display:none">${_stuWeekGrid(item.sid)}</div>
    </div>`;
  });
  el.innerHTML=h+'</div>';
}
function _stuWeekGrid(sid){
  const today=API.today();
  const dates=[];
  for(let i=6;i>=0;i--){dates.push(API.nextDate(-i));}
  const tasks=API.Tasks.getForStudent(sid).filter(t=>t.type==='daily');
  const cells=dates.map(date=>{
    const comps=window.ApiAmal?window.ApiAmal.Completions.getForDate(date).filter(c=>c.student_id===sid&&c.status==='done'):[];
    const done=comps.filter(c=>tasks.find(t=>t.id===c.task_id)).length;
    const lbl=new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{weekday:'short',timeZone:'Asia/Dhaka'});
    const cls=date===today?'today':!tasks.length?'empty':done===0?'miss':done<tasks.length?'partial':'done';
    return `<div class="wk-cell ${cls}"><div class="wk-day">${lbl}</div><div class="wk-dot"></div></div>`;
  }).join('');
  return `<div class="wk-grid">${cells}</div>`;
}
function _toggleLbDetail(id,btn){
  const d=document.getElementById(id); if(!d) return;
  const open=d.style.display==='none';
  d.style.display=open?'block':'none';
  if(btn&&btn.closest){ const row=btn.closest('.tea-lb-row'); if(row) row.classList.toggle('tea-lb-row--open',open); }
}

function setTaskType(type){
  newTaskType=type;
  document.getElementById('typeDaily').classList.toggle('active',type==='daily');
  document.getElementById('typeOnetime').classList.toggle('active',type==='onetime');
  document.getElementById('t_dl_group').style.display=type==='onetime'?'block':'none';
}
function openAddTask(preselectId=null){
  document.getElementById('taskStudents').innerHTML=API.Students.getAll().map(s=>`
    <div class="s-check-item"><input type="checkbox" id="tc_${s.id}" value="${s.id}" ${preselectId===s.id?'checked':''} style="accent-color:#128C7E">
    <label for="tc_${s.id}" style="font-size:14px;cursor:pointer"><span style="color:#128C7E;font-weight:600;font-size:12px">${esc(API.Students.displayWaqfId(s.waqfId))}</span> · ${esc(s.name)}${s.responsibility?` <span style="font-size:11px;font-weight:700;color:#E65100;background:#FFF3E0;border-radius:5px;padding:1px 5px">${esc(s.responsibility)}</span>`:''} <span style="color:var(--gray-400);font-size:12px">${s.cls||''}</span></label></div>`).join('');
  document.getElementById('selAll').checked=false;
  setTaskType('daily');
  openModal('addTaskModal');
}
function toggleAll(cb){ document.querySelectorAll('#taskStudents input').forEach(c=>c.checked=cb.checked); }
async function addTask(){
  const title=document.getElementById('t_title').value.trim(); if(!title){ showToast('শিরোনাম লিখুন!'); return; }
  const checked=[...document.querySelectorAll('#taskStudents input:checked')]; if(!checked.length){ showToast('কমপক্ষে একজন নির্বাচন করুন!'); return; }
  try{ await API.Tasks.add({ title, desc:document.getElementById('t_desc').value.trim(), deadline:document.getElementById('t_dl').value, type:newTaskType, assigneeIds:checked.map(c=>c.value) }); }
  catch(e){ console.error(e); showToast('❌ আমল সেভ হয়নি'); return; }
  closeModal('addTaskModal'); ['t_title','t_desc'].forEach(id=>document.getElementById(id).value=''); document.getElementById('t_dl').value=API.nextDate(3);
  renderAll(); showToast('📋 আমল দেওয়া হয়েছে');
}

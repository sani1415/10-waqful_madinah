/* Waqful Madinah — js/student/schedule.js: নিজামুল আওকাত (daily schedule) panel + edit modal */
function renderTaskSchedulePanel(){
  const el=document.getElementById('taskSchedulePanel');
  if(!el||!me||!API.DailySchedule) return;
  const ds=API.DailySchedule.getForStudent(me.id);
  const rows=ds.rows||[];
  const pend=ds.pending;
  const isPending=!!(pend&&pend.status==='pending');
  let banner='';
  if(isPending)
    banner='<div class="stu-sched-banner pending">⏳ আপনার পরিবর্তনের অনুমোদনের অপেক্ষায় — নিচে কী বদলাচ্ছে দেখুন।</div>';
  else if(pend&&pend.status==='rejected')
    banner='<div class="stu-sched-banner rejected">✕ জিম্মাদার প্রত্যাখ্যান করেছেন'+(pend.teacherNote?(' · '+esc(pend.teacherNote)):'')+'। আবার সম্পাদনা করে পাঠাতে পারেন।</div>';
  let body='';
  if(isPending){
    const diffOps=API.DailySchedule.diffRows(rows,pend.rows||[]);
    body=diffOps.length
      ? `<table class="stu-sched-table"><thead><tr><th>সময়</th><th>কাজ</th></tr></thead><tbody>${diffOps.map(op=>{const cls=op.type==='del'?' class="sched-diff-del"':op.type==='add'?' class="sched-diff-add"':'';return `<tr${cls}><td>${esc(op.row.time)}</td><td>${esc(op.row.task)}</td></tr>`;}).join('')}</tbody></table>`
      : '<p style="padding:10px 14px;font-size:12px;color:var(--gray-500)">সম্পূর্ণ সময়সূচি মুছে ফেলার প্রস্তাব পাঠানো হয়েছে।</p>';
  } else if(rows.length){
    body=`<table class="stu-sched-table"><thead><tr><th>সময়</th><th>কাজ</th><th></th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(r.time)}</td><td>${esc(r.task)}</td><td class="stu-sched-row-del"><button type="button" class="stu-sched-row-del-btn" onclick="scheduleDeleteRow(${i})" aria-label="সারি মুছুন">✕</button></td></tr>`).join('')}</tbody></table>`;
  }
  const showDeleteAll=!isPending&&rows.length>0;
  el.innerHTML=`<div class="stu-sched-card"><div class="stu-sched-card-hd">বিসমিল্লাহির রহমানির রহিম</div>${banner}${body}<div class="stu-sched-foot"><button type="button" class="stu-sched-btn" onclick="openScheduleEditModal()">তৈরি করো</button>${showDeleteAll?'<button type="button" class="stu-sched-btn secondary" onclick="scheduleSubmitDeleteAll()">🗑 সম্পূর্ণ মুছুন</button>':''}</div></div><div style="height:16px"></div>`;
}
async function scheduleDeleteRow(idx){
  if(!me||!API.DailySchedule) return;
  const ds=API.DailySchedule.getForStudent(me.id);
  const rows=ds.rows||[];
  if(idx<0||idx>=rows.length) return;
  const ok=await showConfirm('এই সারিটি মুছে ফেলার জন্য জিম্মাদারের অনুমোদন চাইবেন?',{title:'সারি মুছুন',okText:'পাঠান',danger:true});
  if(!ok) return;
  const reduced=rows.filter((_,i)=>i!==idx).map(r=>({task:r.task,time:r.time}));
  try{
    await API.DailySchedule.submitProposal(me.id,reduced);
    renderTaskSchedulePanel();
    showToast('মুছে ফেলার প্রস্তাব পাঠানো হয়েছে');
  }catch(e){ console.error(e); showToast('পাঠানো যায়নি'); }
}
async function scheduleSubmitDeleteAll(){
  if(!me||!API.DailySchedule) return;
  const ok=await showConfirm('সম্পূর্ণ সময়সূচি মুছে ফেলার জন্য জিম্মাদারের অনুমোদন চাইবেন?',{title:'সম্পূর্ণ মুছুন',okText:'পাঠান',danger:true});
  if(!ok) return;
  try{
    await API.DailySchedule.submitProposal(me.id,[]);
    renderTaskSchedulePanel();
    showToast('মুছে ফেলার প্রস্তাব পাঠানো হয়েছে');
  }catch(e){ console.error(e); showToast('পাঠানো যায়নি'); }
}

const _schedDelIc='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>';
function schedDigitsOnly(s){ return String(s||'').replace(/\D/g,'').slice(0,4); }
function schedLiveClock(digits){
  const d=schedDigitsOnly(digits);
  if(d.length<=2) return d;
  if(d.length===3) return d[0]+':'+d.slice(1);
  return d.slice(0,2)+':'+d.slice(2);
}
function schedFormatClock(digits){
  const d=schedDigitsOnly(digits);
  if(!d) return '';
  let h=0,m=0;
  if(d.length<=2){ h=parseInt(d,10)||0; m=0; }
  else if(d.length===3){ h=parseInt(d[0],10)||0; m=parseInt(d.slice(1),10)||0; }
  else { h=parseInt(d.slice(0,2),10)||0; m=parseInt(d.slice(2),10)||0; }
  if(h>12) h=h%12||12;
  if(h===0) h=12;
  if(m>59) m=59;
  return h+':'+String(m).padStart(2,'0');
}
function schedNormAmpm(v){
  const s=String(v||'').trim().toUpperCase();
  if(s.startsWith('P')||s.indexOf('পি')>=0) return 'PM';
  return 'AM';
}
function schedParseStored(time){
  const raw=String(time||'').trim();
  const empty={start:'',end:'',ampm:'AM'};
  if(!raw) return empty;
  const re=/(\d{1,2})\s*[:.]?\s*(\d{0,2})\s*(AM|PM|A\.M\.|P\.M\.|এ\.?\s*ম\.?|পি\.?\s*ম\.?)?\s*[-–—~]\s*(\d{1,2})\s*[:.]?\s*(\d{0,2})\s*(AM|PM|A\.M\.|P\.M\.|এ\.?\s*ম\.?|পি\.?\s*ম\.?)?/i;
  const m=raw.match(re);
  if(m){
    const sDig=(m[1]||'')+(m[2]?String(m[2]).padStart(2,'0'):'');
    const eDig=(m[4]||'')+(m[5]?String(m[5]).padStart(2,'0'):'');
    return {
      start:schedFormatClock(sDig),
      end:schedFormatClock(eDig),
      ampm:schedNormAmpm(m[3]||m[6]||'AM')
    };
  }
  const one=/(\d{1,2})\s*[:.]?\s*(\d{0,2})\s*(AM|PM|A\.M\.|P\.M\.|এ\.?\s*ম\.?|পি\.?\s*ম\.?)?/i.exec(raw);
  if(one){
    const dig=(one[1]||'')+(one[2]?String(one[2]).padStart(2,'0'):'');
    return {start:schedFormatClock(dig),end:'',ampm:schedNormAmpm(one[3]||'AM')};
  }
  return empty;
}
function schedComposeTime(start,end,ampm){
  const s=schedFormatClock(start);
  const e=schedFormatClock(end);
  const ap=schedNormAmpm(ampm);
  if(!s&&!e) return '';
  if(s&&e) return s+' – '+e+' '+ap;
  if(s) return s+' '+ap;
  return e+' '+ap;
}
function schedAmpmBtn(val){
  const v=schedNormAmpm(val);
  return `<div class="sched-ampm-wrap"><button type="button" class="sched-ampm-btn" data-ampm-for="row" onclick="schedToggleAmpmMenu(this)" aria-label="AM/PM">${v}</button><div class="sched-ampm-menu" role="listbox"><button type="button" class="sched-ampm-opt${v==='AM'?' active':''}" onclick="schedPickAmpm(this,'AM')">AM</button><button type="button" class="sched-ampm-opt${v==='PM'?' active':''}" onclick="schedPickAmpm(this,'PM')">PM</button></div></div>`;
}
function schedEditRowHtml(r){
  const p=schedParseStored(r&&r.time);
  const task=esc((r&&r.task)||'');
  return `<div class="schedule-edit-row">
    <input type="text" class="sched-in-clock sched-in-start" inputmode="numeric" maxlength="5" placeholder="শুরু" value="${esc(p.start)}" oninput="schedOnClockInput(this)" onblur="schedOnClockBlur(this)">
    <span class="sched-time-dash">–</span>
    <input type="text" class="sched-in-clock sched-in-end" inputmode="numeric" maxlength="5" placeholder="শেষ" value="${esc(p.end)}" oninput="schedOnClockInput(this)" onblur="schedOnClockBlur(this)">
    ${schedAmpmBtn(p.ampm)}
    <input type="text" class="sched-in-task" placeholder="কাজ" value="${task}">
    <button type="button" class="schedule-edit-del" onclick="this.closest('.schedule-edit-row').remove()" aria-label="সারি মুছুন">${_schedDelIc}</button>
  </div>`;
}
function schedOnClockInput(inp){
  const d=schedDigitsOnly(inp.value);
  inp.value=schedLiveClock(d);
  inp.dataset.digits=d;
}
function schedOnClockBlur(inp){
  const d=schedDigitsOnly(inp.dataset.digits||inp.value);
  inp.value=schedFormatClock(d);
  inp.dataset.digits=d;
}
function schedCloseAllAmpmMenus(except){
  document.querySelectorAll('#scheduleEditRows .sched-ampm-menu.open').forEach(m=>{ if(m!==except) m.classList.remove('open'); });
  document.querySelectorAll('#scheduleEditRows .sched-ampm-btn.open').forEach(b=>{ if(!except||b.nextElementSibling!==except) b.classList.remove('open'); });
}
function schedToggleAmpmMenu(btn){
  const menu=btn.nextElementSibling;
  const open=menu.classList.contains('open');
  schedCloseAllAmpmMenus();
  if(!open){ menu.classList.add('open'); btn.classList.add('open'); }
}
function schedPickAmpm(opt,val){
  const wrap=opt.closest('.sched-ampm-wrap');
  const btn=wrap.querySelector('.sched-ampm-btn');
  btn.textContent=schedNormAmpm(val);
  wrap.querySelectorAll('.sched-ampm-opt').forEach(o=>o.classList.toggle('active',o===opt));
  schedCloseAllAmpmMenus();
}
function openScheduleEditModal(){
  if(!me||!API.DailySchedule) return;
  const ds=API.DailySchedule.getForStudent(me.id);
  const editRows=(ds.pending&&ds.pending.status==='pending'&&ds.pending.rows&&ds.pending.rows.length)?ds.pending.rows:(ds.rows&&ds.rows.length?ds.rows:[{task:'',time:''}]);
  const wrap=document.getElementById('scheduleEditRows');
  wrap.innerHTML=editRows.map(r=>schedEditRowHtml(r)).join('')||schedEditRowHtml({task:'',time:''});
  openModal('scheduleEditModal');
}
function scheduleEditAddRow(){
  const wrap=document.getElementById('scheduleEditRows');
  wrap.insertAdjacentHTML('beforeend',schedEditRowHtml({task:'',time:''}));
}
function scheduleCollectRows(){
  const out=[];
  document.querySelectorAll('#scheduleEditRows .schedule-edit-row').forEach(row=>{
    const task=row.querySelector('.sched-in-task')?.value.trim()||'';
    const start=row.querySelector('.sched-in-start')?.value||'';
    const end=row.querySelector('.sched-in-end')?.value||'';
    const ampm=row.querySelector('.sched-ampm-btn')?.textContent||'AM';
    const time=schedComposeTime(start,end,ampm);
    if(task||time) out.push({task,time});
  });
  return out;
}
async function scheduleSubmitForApproval(){
  if(!me) return;
  document.querySelectorAll('#scheduleEditRows .sched-in-clock').forEach(schedOnClockBlur);
  const rows=scheduleCollectRows();
  if(!rows.length){ showToast('অন্তত একটি সারি দিন'); return; }
  try{
    await API.DailySchedule.submitProposal(me.id,rows);
    closeModal('scheduleEditModal');
    renderAll();
    showToast('প্রস্তাব পাঠানো হয়েছে। জিম্মাদার অনুমোদন দিলে কার্যকর হবে।');
  }catch(e){ console.error(e); showToast('পাঠানো যায়নি'); }
}

/* Waqful Madinah — js/teacher/student-dashboard.js: in-chat student tabs (info, amal, docs, exams, goals, notes, schedule strip) */
// ══ IN-CHAT STUDENT TABS ═══════════════════════════════
function switchChatTab(tab,btn){
  curChatTab=tab;
  document.querySelectorAll('.cs-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const panels=['info','task','doc','exam','goal','note'];
  document.getElementById('chatMsgs').style.display=tab==='msg'?'flex':'none';
  panels.forEach(p=>{ document.getElementById('csp-'+p).style.display=p===tab?'flex':'none'; });
  document.getElementById('chatAttachBtn').style.display=tab==='msg'?'flex':'none';
  document.getElementById('msgIn').placeholder='রিসালা লিখুন';
  if(!curChat) return;
  if(tab==='msg') setTimeout(()=>document.getElementById('chatMsgs').scrollTop=9e9,30);
  else if(tab==='info') renderChatInfo();
  else if(tab==='task') renderChatTasks();
  else if(tab==='doc')  renderChatDocs();
  else if(tab==='exam') renderChatExams();
  else if(tab==='goal') renderChatGoals();
  else if(tab==='note') renderChatNotes();
  if(typeof renderChatScheduleStrip==='function') renderChatScheduleStrip();
}
function openStudentDashTab(tab,noteView){
  if(noteView) chatNoteView=noteView;
  switchChatTab(tab, document.getElementById('cst-'+tab));
}
function stuDashKpi(color,val,label,tab,noteView){
  return `<button type="button" class="stu-dash-kpi ${color}" onclick="openStudentDashTab('${tab}'${noteView?`, '${noteView}'`:''})"><span class="stu-dash-kpi-val">${val}</span><span class="stu-dash-kpi-lbl">${label}</span></button>`;
}
function stuDashAction(text,tab,noteView){
  return `<div class="stu-dash-action"><div class="stu-dash-action-main">${text}</div><button type="button" class="stu-dash-action-btn" onclick="openStudentDashTab('${tab}'${noteView?`, '${noteView}'`:''})">দেখুন</button></div>`;
}
function stuDashActivities(sid){
  const rows=[];
  const push=(type,text,ts)=>{ if(text) rows.push({type,text,ts:ts||0}); };
  const msgs=API.Messages.getThread(sid).filter(m=>m.role==='in');
  const lastMsg=msgs[msgs.length-1];
  if(lastMsg) push('রিসালা', String(lastMsg.text||lastMsg.fileName||'রিসালা এসেছে').replace(/\s+/g,' ').trim(), lastMsg._ts||0);
  const docs=API.Docs.getForStudent(sid)||[];
  const lastDoc=docs.slice().sort((a,b)=>new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0))[0];
  if(lastDoc) push('ডক', lastDoc.fileName||'ডকুমেন্ট', new Date(lastDoc.uploadedAt||0).getTime());
  const sNotes=API.StudentNotes?API.StudentNotes.getAll(sid):[];
  const lastSNote=sNotes[0];
  if(lastSNote) push('ছাত্রের বিবরণ', lastSNote.title||lastSNote.text, new Date((lastSNote.date||API.today())+'T'+(lastSNote.time||'00:00')+':00').getTime());
  const tNotes=API.TeacherNotes.getAll(sid);
  const lastTNote=tNotes[0];
  if(lastTNote) push('জিম্মাদারের নোট', lastTNote.text, new Date((lastTNote.date||API.today())+'T'+(lastTNote.time||'00:00')+':00').getTime());
  return rows.sort((a,b)=>b.ts-a.ts).slice(0,5).map(r=>`
    <div class="stu-dash-activity">
      <span class="stu-dash-activity-dot"></span>
      <div class="stu-dash-activity-main">
        <div class="stu-dash-activity-title">${esc(r.type)}</div>
        <div class="stu-dash-activity-text">${esc(r.text)}</div>
      </div>
    </div>`).join('')||'<div class="stu-dash-empty">এখনও সাম্প্রতিক কার্যক্রম নেই।</div>';
}
function renderChatInfo(){
  const el=document.getElementById('csp-info'); if(!el||!curChat) return;
  const s=API.Students.getById(curChat);
  if(!s){ el.innerHTML='<div class="csp-empty">ছাত্র পাওয়া যায়নি।</div>'; return; }
  curProfileSid=curChat;
  const row=API.Biboron?API.Biboron.getStudentRow(s.id):{};
  const batchLbl=API.Students.formatBatchYear(s.enrollmentDate);
  const academic=API.AcademicHistory.getAll(s.id);
  const subLine=[s.waqfId?API.Students.displayWaqfId(s.waqfId):'',batchLbl||'',s.cls||''].filter(Boolean).join(' · ')||'পরিচয়';
  const quizCount=(row.pendingQuiz||0)+(row.manualQuiz||0);
  const latestStudentNote=(API.StudentNotes?API.StudentNotes.getAll(s.id):[]).filter(n=>!isWeeklyReceiptNote(n))[0];
  const actions=[];
  if(row.unreadMessages>0) actions.push(stuDashAction(`${row.unreadMessages}টি অপঠিত রিসালা আছে`,'msg'));
  if(row.pendingSchedule) actions.push(stuDashAction('সময়সূচি অনুমোদন বাকি','msg'));
  if(row.pendingDocs>0) actions.push(stuDashAction(`${row.pendingDocs}টি ডক রিভিউ বাকি`,'doc'));
  if(quizCount>0) actions.push(stuDashAction(`${quizCount}টি পরীক্ষা/নম্বর বাকি`,'exam'));
  if(row.dayTotal>0&&row.dayDone<row.dayTotal) actions.push(stuDashAction(`গতকাল আমল অসম্পূর্ণ: ${row.dayDone}/${row.dayTotal}`,'task'));
  if(row.studentNoteCount>0) actions.push(stuDashAction(`${row.studentNoteCount}টি ছাত্রের বিবরণ আছে`,'note','student'));
  el.innerHTML=`<div class="stu-dash">
    <div class="stu-dash-hero">
      <div class="stu-dash-avatar" style="background:${s.color||C[0]}">${esc((s.name||'?').charAt(0))}</div>
      <div class="stu-dash-main">
        <div class="stu-dash-name">${esc(s.name)}</div>
        <div class="stu-dash-meta">${esc(subLine)}${row.lastActivity?' · শেষ: '+esc(row.lastActivity.label||'কার্যক্রম'):''}</div>
      </div>
      <span class="stu-dash-status ${row.needsAttention?'warn':''}">${row.needsAttention?'মনোযোগ দরকার':'স্বাভাবিক'}</span>
    </div>
    <div class="stu-dash-kpis">
      ${stuDashKpi('blue',row.dayTotal>0?`${row.dayDone}/${row.dayTotal}`:'0/0','গতকাল আমল','task')}
      ${stuDashKpi('green',row.unreadMessages||0,'রিসালা','msg')}
      ${stuDashKpi('orange',row.pendingDocs||0,'ডক','doc')}
      ${stuDashKpi('red',quizCount,'পরীক্ষা','exam')}
    </div>
    <div class="stu-dash-panel">
      <div class="stu-dash-panel-hd"><span>মনোযোগ দরকার</span><span class="stu-dash-panel-sub">${actions.length?actions.length+'টি':''}</span></div>
      ${actions.length?actions.join(''):'<div class="stu-dash-empty">এই মুহূর্তে জরুরি কিছু নেই।</div>'}
    </div>
    <div class="stu-dash-panel">
      <div class="stu-dash-panel-hd"><span>সাম্প্রতিক কার্যক্রম</span><span class="stu-dash-panel-sub">শেষ আপডেট</span></div>
      ${stuDashActivities(s.id)}
    </div>
    <div class="stu-dash-panel">
      <div class="stu-dash-panel-hd"><span>সর্বশেষ ছাত্র-বিবরণ</span>${latestStudentNote?`<button type="button" class="stu-dash-action-btn" onclick="openStudentDashTab('note','student')">সব দেখুন</button>`:''}</div>
      ${latestStudentNote?`<div class="stu-dash-note-preview">${esc(latestStudentNote.text)}</div><div class="csp-note-time">${esc(API.StudentNotes.catLabel(latestStudentNote.categoryId))} · ${latestStudentNote.date||''} ${latestStudentNote.time||''}</div>`:'<div class="stu-dash-empty">ছাত্র এখনও কোনো বিবরণ লেখেনি।</div>'}
    </div>
    <details class="stu-dash-edit">
      <summary>প্রোফাইল তথ্য সম্পাদনা</summary>
      <div class="stu-dash-edit-body">
        <div class="profile-v2-sheet" style="margin:0;border:none;box-shadow:none;padding:0">
          <div class="profile-v2-sec">মূল তথ্য</div>
          ${pRow('নাম','p_name',s.name)}
          ${pRow('দায়িত্ব','p_resp',s.responsibility||'')}
          ${pRow('পিতার নাম','p_father',s.fatherName||'')}
          ${pRow('পিতার পেশা','p_focc',s.fatherOccupation||'')}
          ${pRow('মোবাইল','p_contact',s.contact||'')}
          ${pRow('রক্তের গ্রুপ','p_blood',s.bloodGroup||'')}
          <div class="profile-v2-sec">ঠিকানা</div>
          ${pRow('জেলা','p_district',s.district||'')}
          ${pRow('উপজেলা','p_upazila',s.upazila||'')}
          <div class="profile-v2-sec">বর্তমান শিক্ষা</div>
          ${pRow('শ্রেণী','p_cls',s.cls||'')}
          ${pRow('রোল','p_roll',s.roll||'')}
          ${pRow('ভর্তির তারিখ','p_enroll',s.enrollmentDate||'',' type="date"')}
          <div class="profile-v2-sec">সময়সূচি</div>
          <div id="schedulePaneInner"></div>
          <div class="profile-v2-sec">পূর্ববর্তী ফলাফল</div>
          <div id="acadList">${academic.length?academic.map(r=>`
            <div class="acad-item" id="acad_${r.id}">
              <div class="acad-year">${esc(r.yearClass)}</div>
              <div class="acad-grade">${esc(r.grade)}</div>
              <button type="button" class="acad-del" onclick="deleteAcadRec('${r.id}')">মুছুন</button>
            </div>`).join(''):'<div style="padding:12px 14px;font-size:13px;color:var(--gray-400)">কোনো রেকর্ড নেই।</div>'}</div>
          <div class="acad-add-row">
            <input id="acadYear" placeholder="বছর / শ্রেণী (যেমন: ২০২২ - জামাতে খামেছা)">
            <input id="acadGrade" placeholder="নম্বর / গ্রেড">
            <button type="button" class="acad-add-btn" onclick="addAcadRec()">যোগ</button>
          </div>
          <div class="profile-v2-sec profile-v2-sec--flex">
            <span>লগইন পিন</span>
            <button type="button" class="profile-v2-sec-btn" onclick="showPinResetInProfile()">পরিবর্তন</button>
          </div>
          <div class="profile-v2-row profile-v2-row--pin">
            <span>বর্তমান পিন</span>
            <div class="profile-v2-pin-dots" id="profilePinDisplay">${esc(s.pin||'----')}</div>
          </div>
          <div id="profilePinReset" class="profile-v2-pin-edit" style="display:none">
            <div class="profile-pin-row">
              <input class="form-input" id="profileNewPin" type="number" placeholder="নতুন ৪ সংখ্যার পিন">
              <button type="button" class="profile-pin-save" onclick="saveProfilePin()" style="background:#075E54;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">সেভ পিন</button>
            </div>
          </div>
          <button type="button" class="btn-primary" style="margin:10px 0 0" onclick="saveProfileEdits()">সেভ</button>
          <div class="profile-v2-sec">ঝুঁকিপূর্ণ কাজ</div>
          <button type="button" onclick="confirmClearStudentData()" style="width:100%;background:#fff;border:1.5px solid #E57373;color:#B71C1C;border-radius:10px;padding:10px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px">শুধু সংশ্লিষ্ট তথ্য মুছুন</button>
          <button type="button" onclick="confirmDeleteStudent()" style="width:100%;background:#C62828;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">ছাত্র সম্পূর্ণ মুছুন</button>
        </div>
      </div>
    </details>
  </div>`;
  const hero=el.querySelector('.stu-dash-hero');
  if(hero){
    hero.outerHTML=`<div class="stu-dash-topbar">
      <span class="stu-dash-status ${row.needsAttention?'warn':''}">${row.needsAttention?'মনোযোগ দরকার':'স্বাভাবিক'}</span>
      <button type="button" class="stu-dash-edit-btn" onclick="openProfileEditModal()">প্রোফাইল সম্পাদনা</button>
    </div>`;
  }
  el.querySelector('.stu-dash-edit')?.remove();
  if(typeof renderSchedulePane==='function') renderSchedulePane(s);
}
function openProfileEditModal(tab='basic'){
  const sid=curProfileSid||curChat;
  const s=API.Students.getById(sid); if(!s) return;
  curProfileSid=sid;
  const batchLbl=API.Students.formatBatchYear(s.enrollmentDate);
  const academic=API.AcademicHistory.getAll(s.id);
  document.getElementById('profileEditTitle').textContent='প্রোফাইল সম্পাদনা';
  document.getElementById('profileEditSub').textContent=[s.name,s.waqfId?API.Students.displayWaqfId(s.waqfId):'',batchLbl||''].filter(Boolean).join(' · ');
  document.getElementById('profileEditBody').innerHTML=`
    <div class="profile-edit-pane" id="pe-pane-basic">
      <div class="profile-v2-sheet" style="margin:0">
        <div class="profile-v2-sec">মূল তথ্য</div>
        ${pRow('নাম','p_name',s.name)}
        ${pRow('দায়িত্ব','p_resp',s.responsibility||'')}
        ${pRow('পিতার নাম','p_father',s.fatherName||'')}
        ${pRow('পিতার পেশা','p_focc',s.fatherOccupation||'')}
        ${pRow('মোবাইল','p_contact',s.contact||'')}
        ${pRow('রক্তের গ্রুপ','p_blood',s.bloodGroup||'')}
        <div class="profile-v2-sec">ঠিকানা</div>
        ${pRow('জেলা','p_district',s.district||'')}
        ${pRow('উপজেলা','p_upazila',s.upazila||'')}
        <div class="profile-edit-actions">
          <button type="button" class="btn-primary" onclick="saveProfileEdits()">সেভ</button>
        </div>
      </div>
    </div>
    <div class="profile-edit-pane" id="pe-pane-study">
      <div class="profile-v2-sheet" style="margin:0">
        <div class="profile-v2-sec">বর্তমান শিক্ষা</div>
        ${pRow('শ্রেণী','p_cls',s.cls||'')}
        ${pRow('রোল','p_roll',s.roll||'')}
        ${pRow('ভর্তির তারিখ','p_enroll',s.enrollmentDate||'',' type="date"')}
        <div class="profile-v2-sec">পূর্ববর্তী ফলাফল</div>
        <div id="acadList">${academic.length?academic.map(r=>`
          <div class="acad-item" id="acad_${r.id}">
            <div class="acad-year">${esc(r.yearClass)}</div>
            <div class="acad-grade">${esc(r.grade)}</div>
            <button type="button" class="acad-del" onclick="deleteAcadRec('${r.id}')">মুছুন</button>
          </div>`).join(''):'<div style="padding:12px 14px;font-size:13px;color:var(--gray-400)">কোনো রেকর্ড নেই।</div>'}</div>
        <div class="acad-add-row">
          <input id="acadYear" placeholder="বছর / শ্রেণী (যেমন: ২০২২ - জামাতে খামেছা)">
          <input id="acadGrade" placeholder="নম্বর / গ্রেড">
          <button type="button" class="acad-add-btn" onclick="addAcadRec()">যোগ</button>
        </div>
        <div class="profile-edit-actions">
          <button type="button" class="btn-primary" onclick="saveProfileEdits()">সেভ</button>
        </div>
      </div>
    </div>
    <div class="profile-edit-pane" id="pe-pane-schedule">
      <div id="schedulePaneInner"></div>
    </div>
    <div class="profile-edit-pane" id="pe-pane-pin">
      <div class="profile-v2-sheet" style="margin:0">
        <div class="profile-v2-sec">লগইন পিন</div>
        <div class="profile-v2-row profile-v2-row--pin">
          <span>বর্তমান পিন</span>
          <div class="profile-v2-pin-dots" id="profilePinDisplay">${esc(s.pin||'----')}</div>
        </div>
        <div id="profilePinReset" class="profile-v2-pin-edit" style="display:block">
          <div class="profile-pin-row">
            <input class="form-input" id="profileNewPin" type="number" placeholder="নতুন ৪ সংখ্যার পিন">
            <button type="button" class="profile-pin-save" onclick="saveProfilePin()" style="background:#075E54;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">সেভ পিন</button>
          </div>
        </div>
      </div>
    </div>
    <div class="profile-edit-pane" id="pe-pane-danger">
      <div class="profile-v2-sheet" style="margin:0">
        <div class="profile-v2-sec">ঝুঁকিপূর্ণ কাজ</div>
        <button type="button" onclick="confirmClearStudentData()" style="width:100%;background:#fff;border:1.5px solid #E57373;color:#B71C1C;border-radius:10px;padding:10px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px">শুধু সংশ্লিষ্ট তথ্য মুছুন</button>
        <button type="button" onclick="confirmDeleteStudent()" style="width:100%;background:#C62828;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">ছাত্র সম্পূর্ণ মুছুন</button>
      </div>
    </div>`;
  openModal('profileEditModal');
  const btn=document.querySelector(`#profileEditTabs .profile-edit-tab[onclick*="'${tab}'"]`)||document.querySelector('#profileEditTabs .profile-edit-tab');
  goProfileEditTab(tab,btn);
}
function goProfileEditTab(tab,btn){
  document.querySelectorAll('#profileEditTabs .profile-edit-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#profileEditBody .profile-edit-pane').forEach(p=>p.classList.remove('active'));
  const pane=document.getElementById('pe-pane-'+tab)||document.getElementById('pe-pane-basic');
  pane.classList.add('active');
  if(tab==='schedule'&&curProfileSid&&typeof renderSchedulePane==='function') renderSchedulePane(API.Students.getById(curProfileSid));
}
function chatAmalRing(pct,stroke,label){
  const p=Math.round(Math.min(100,Math.max(0,Number(pct)||0)));
  const r=22,c=2*Math.PI*r,off=c*(1-p/100);
  const svg=`<svg class="stu-ring-svg" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" fill="none" stroke="#e8e8e8" stroke-width="5"/><circle cx="26" cy="26" r="${r}" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 26 26)"/></svg>`;
  return `<div class="stu-ring-col"><div class="stu-svg-ring-wrap">${svg}<span class="stu-ring-pct">${p}%</span></div><span class="stu-ring-lbl">${esc(label)}</span></div>`;
}
function renderTeacherAmalSummary(sid){
  const prog=API.Tasks.getProgressSummary(sid);
  const selected=teacherAmalEndDate||API.today();
  const selectedDay=selected===API.today()?prog.today:API.Tasks.getRangeProgress(sid,selected,selected);
  const date=new Date(selected+'T12:00:00Z').toLocaleDateString('bn-BD',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'});
  const backIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
  const calIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
  return `<div class="csp-amal-ring-wrap"><div class="stu-amal-dash-card csp-amal-ring-card">
    <div class="stu-amal-dash-hd"><button type="button" class="stu-amal-yday-btn" onclick="shiftTeacherAmalDate(-1)" title="আগের দিন" aria-label="আগের দিন">${backIcon}</button><div class="stu-amal-dash-title-wrap"><div class="stu-amal-dash-title">মুহাসাবা</div><div class="stu-amal-dash-date">${esc(date)}</div></div><button type="button" class="stu-amal-cal-btn" onclick="openTeacherAmalCalendar()" title="আমল ইতিহাস" aria-label="আমল ইতিহাস ক্যালেন্ডার">${calIcon}</button></div>
    <div class="stu-amal-rings">${chatAmalRing(selectedDay?.percent,'#4CAF50',selected===API.today()?'আজ':'নির্বাচিত')}${chatAmalRing(prog.week?.percent,'#43A047','সপ্তাহ')}${chatAmalRing(prog.month?.percent,'#42A5F5','মাস')}${chatAmalRing(prog.all?.percent,'#8D6E63','শুরু থেকে')}</div>
  </div></div>`;
}
function shiftTeacherAmalDate(delta){
  teacherAmalEndDate=teacherWeekDateAdd(teacherAmalEndDate||API.today(),delta);
  if(teacherAmalEndDate>API.today()) teacherAmalEndDate=API.today();
  renderChatTasks();
}
function openTeacherAmalCalendar(){
  const pop=document.getElementById('teacherAmalCalPopover'); if(!pop||!curChat) return;
  const selected=teacherAmalEndDate||API.today();
  const parts=selected.split('-'); window._teacherCalYear=Number(parts[0]); window._teacherCalMonth=Number(parts[1]);
  pop.classList.add('open'); pop.setAttribute('aria-hidden','false');
  renderTeacherAmalCalendar();
}
function closeTeacherAmalCalendar(){
  const pop=document.getElementById('teacherAmalCalPopover'); if(!pop) return;
  pop.classList.remove('open'); pop.setAttribute('aria-hidden','true');
}
function selectTeacherAmalDate(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))) return;
  teacherAmalEndDate=date>API.today()?API.today():date;
  closeTeacherAmalCalendar();
  renderChatTasks();
}
function renderTeacherAmalCalendar(){
  const el=document.getElementById('teacherAmalCalendarContent'); if(!el||!curChat) return;
  const today=API.today(),selected=teacherAmalEndDate||today;
  if(!window._teacherCalYear){const t=selected.split('-');window._teacherCalYear=Number(t[0]);window._teacherCalMonth=Number(t[1]);}
  const y=window._teacherCalYear,m=window._teacherCalMonth;
  const data=API.Tasks.getCalendarData(curChat,y,m);
  const dInM=new Date(y,m,0).getDate(),firstDay=new Date(y,m-1,1).getDay();
  const pad=n=>String(n).padStart(2,'0');
  const mNames=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  let h=`<div class="cal-header"><button type="button" class="date-nav-btn" onclick="teacherAmalCalNav(-1)">◀</button><span class="cal-month-title">${mNames[m-1]} ${y}</span><button type="button" class="date-nav-btn" onclick="teacherAmalCalNav(1)">▶</button></div><div class="s-cal-grid"><div class="s-cal-day-hd">রবি</div><div class="s-cal-day-hd">সোম</div><div class="s-cal-day-hd">মঙ্গল</div><div class="s-cal-day-hd">বুধ</div><div class="s-cal-day-hd">বৃহঃ</div><div class="s-cal-day-hd">শুক্র</div><div class="s-cal-day-hd">শনি</div>`;
  for(let i=0;i<firstDay;i++) h+='<div class="s-cal-cell empty"></div>';
  for(let d=1;d<=dInM;d++){
    const date=`${y}-${pad(m)}-${pad(d)}`,cell=data[date],isToday=date===today,isSelected=date===selected;
    if(date>today){h+=`<div class="s-cal-cell future${isToday?' cal-today':''}"><span class="s-cal-date">${d}</span></div>`;continue;}
    if(!cell){h+=`<button type="button" class="s-cal-cell selectable${isToday?' cal-today':''}${isSelected?' selected':''}" onclick="selectTeacherAmalDate('${date}')"><span class="s-cal-date">${d}</span></button>`;continue;}
    const st=cell.status||cell,pct=typeof cell.percent==='number'?cell.percent:(st==='done'?100:st==='partial'?50:0);
    h+=`<button type="button" class="s-cal-cell selectable ${st}${isToday?' cal-today':''}${isSelected?' selected':''}" onclick="selectTeacherAmalDate('${date}')"><span class="s-cal-date">${d}</span><span class="s-cal-pct">${pct}%</span></button>`;
  }
  el.innerHTML=h+'</div>';
}
function teacherAmalCalNav(dir){
  let m=window._teacherCalMonth+dir,y=window._teacherCalYear;
  if(m>12){m=1;y++;} if(m<1){m=12;y--;}
  window._teacherCalMonth=m; window._teacherCalYear=y; renderTeacherAmalCalendar();
}
function chatAmalDateLabel(date){
  try{ return new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{day:'numeric',month:'short',timeZone:'Asia/Dhaka'}); }
  catch(e){ return date.slice(5); }
}
function chatAmalMonthStart(date){
  return String(date||API.today()).slice(0,7)+'-01';
}
function chatAmalMonthAdd(date,delta){
  const d=new Date(chatAmalMonthStart(date)+'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth()+delta);
  return d.toISOString().slice(0,10);
}
function chatAmalMonthEnd(date){
  const d=new Date(chatAmalMonthStart(date)+'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth()+1);
  d.setUTCDate(0);
  const end=d.toISOString().slice(0,10);
  return end>API.today()?API.today():end;
}
function chatAmalMonthLabel(date){
  try{ return new Date(chatAmalMonthStart(date)+'T12:00:00Z').toLocaleDateString('bn-BD',{month:'short',year:'numeric',timeZone:'Asia/Dhaka'}); }
  catch(e){ return String(date||'').slice(0,7); }
}
function renderAmalHistoryBreakdown(sid){
  const today=API.today();
  const months=[0,-1,-2].map(offset=>chatAmalMonthAdd(today,offset));
  const monthHtml=months.map(start=>{
    const p=API.Tasks.getRangeProgress(sid,start,chatAmalMonthEnd(start));
    return `<div class="csp-amal-month"><span class="csp-amal-month-name">${esc(chatAmalMonthLabel(start))}</span><span class="csp-amal-month-val">${p.percent}% · ${p.done}/${p.total}</span></div>`;
  }).join('');
  return `<div class="csp-amal-section-title">মাসভিত্তিক</div><div class="csp-amal-months">${monthHtml}</div>`;
}
function renderTeacherAmalSevenDays(sid){
  const end=teacherAmalEndDate||API.today();
  const dates=Array.from({length:7},(_,i)=>teacherWeekDateAdd(end,i-6));
  const tasks=API.Tasks.getForStudent(sid).filter(t=>t.type==='daily');
  if(!tasks.length) return '<div class="csp-amal-section-title">৭ দিনের আমল</div><div class="csp-empty" style="padding:12px 0">কোনো দৈনিক আমল নেই।</div>';
  let done=0;
  tasks.forEach(t=>dates.forEach(date=>{ if(API.Tasks.isCompleted(t.id,sid,date)) done++; }));
  const total=tasks.length*dates.length;
  const pct=total?Math.round(done/total*100):0;
  return `<div class="csp-amal-readonly-grid"><div class="weekly-amal-card">
    <div class="weekly-amal-head"><div><div class="weekly-amal-title">৭ দিনের আমল</div><div class="weekly-amal-sub">${esc(dates[0])} – ${esc(dates[6])} · ${done}/${total} · ${pct}%</div></div></div>
    <div class="weekly-amal-grid-wrap"><div class="weekly-amal-grid" style="--week-cols:${dates.length}">
      <div class="weekly-amal-corner">আমল</div>
      ${dates.map(date=>`<div class="weekly-amal-day"><span class="weekly-amal-date">${esc(new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{day:'numeric',timeZone:'Asia/Dhaka'}))}</span><span class="weekly-amal-weekday">${esc(new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{weekday:'short',timeZone:'Asia/Dhaka'}))}</span></div>`).join('')}
      ${tasks.map(t=>`<div class="weekly-amal-task">${esc(t.title)}</div>${dates.map(date=>{const on=!!API.Tasks.isCompleted(t.id,sid,date);return `<div class="weekly-amal-cell ${on?'on':'off'}" aria-label="${esc(t.title)} ${esc(date)} ${on?'সম্পন্ন':'অসম্পন্ন'}">${on?'✓':'✕'}</div>`;}).join('')}`).join('')}
    </div></div>
  </div></div>`;
}
function renderChatTasks(){
  const el=document.getElementById('csp-task'); if(!el||!curChat) return;
  const tasks=API.Tasks.getAll().filter(t=>t.assignees&&curChat in t.assignees);
  const stLbl={done:'সম্পন্ন',pending:'বকেয়া',late:'দেরি'};
  const stCls={done:'ok',pending:'warn',late:'bad'};
  const addBtn=`<button type="button" class="csp-add-btn" onclick="openAddTask('${curChat}')">＋ নতুন আমল</button>`;
  const taskRows=tasks.length?tasks.map(t=>{
    const isDaily=t.type==='daily';
    const st=isDaily?(API.Tasks.isDailyDoneToday(t,curChat)?'done':'pending'):(t.assignees[curChat]||'pending');
    const typeLbl=isDaily?'দৈনিক':'এককালীন';
    const when=isDaily?'প্রতিদিন':(t.deadline||'—');
    return `<div class="csp-row" title="${esc(t.desc||'')}">
      <div class="csp-row-main">${esc(t.title)} · ${typeLbl} · ${esc(when)}</div>
      <span class="csp-row-meta ${stCls[st]||'warn'}">${stLbl[st]||st}</span>
    </div>`;
  }).join(''):'<div class="csp-empty" style="padding:12px 0">কোনো আমল নেই।</div>';
  el.innerHTML=addBtn+renderTeacherAmalSummary(curChat)+renderAmalHistoryBreakdown(curChat)+renderTeacherAmalSevenDays(curChat)+'<div class="csp-amal-section-title">বর্তমান আমল</div>'+taskRows;
}
function renderChatDocs(){
  const el=document.getElementById('csp-doc'); if(!el||!curChat) return;
  const docs=API.Docs.getForStudent(curChat);
  if(!docs.length){ el.innerHTML='<div class="csp-empty">কোনো ডকুমেন্ট নেই।</div>'; return; }
  el.innerHTML=docs.map(d=>{
    const when=d.uploadedAt?API.bdDateStr(d.uploadedAt):'';
    const note=d.note?` · ${esc(d.note)}`:'';
    const review=d.reviewStatus==='done'&&d.reviewComment?`<div class="csp-doc-review"><strong>মন্তব্য:</strong> ${esc(d.reviewComment)}</div>`:'';
    return `<div class="csp-row clickable" onclick="teacherPreviewChatDoc('${d.id}',true);switchChatTab('doc',document.getElementById('cst-doc'))">
      <div class="csp-doc-body"><div class="csp-row-main">${esc(d.fileName)}</div>${review}</div>
      <span class="csp-row-meta">${when}${note}</span>
      ${!d.read?'<span class="csp-row-dot" title="অপঠিত"></span>':''}
    </div>`;
  }).join('');
}
function renderDocReviewState(meta){
  const box=document.getElementById('docReviewBox');
  const result=document.getElementById('docReviewResult');
  const input=document.getElementById('docReviewComment');
  const pending=meta&&meta.reviewStatus==='pending';
  if(box) box.style.display=pending?'block':'none';
  if(input) input.value=pending?'':(meta?.reviewComment||'');
  if(!result) return;
  if(pending){ result.style.display='none'; result.innerHTML=''; return; }
  let reviewed='';
  if(meta?.reviewedAt){
    try{ reviewed=new Date(meta.reviewedAt).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'}); }
    catch(e){ reviewed=formatDate(meta.reviewedAt); }
  }
  const comment=String(meta?.reviewComment||'').trim();
  result.innerHTML=`<div class="doc-review-result-hd"><span>পর্যালোচনা সম্পন্ন</span>${reviewed?`<span class="doc-review-result-date">${esc(reviewed)}</span>`:''}</div><div class="doc-review-result-text">${comment?esc(comment):'কোনো মন্তব্য দেওয়া হয়নি।'}</div>`;
  result.style.display='block';
}
function renderChatExams(){
  const el=document.getElementById('csp-exam'); if(!el||!curChat) return;
  const quizzes=API.Exams.getQuizzes().filter(q=>q.assigneeIds?.includes(curChat));
  const addBtn=`<button type="button" class="csp-add-btn" onclick="openAddExamForChat('${curChat}')">＋ নতুন পরীক্ষা</button>`;
  if(!quizzes.length){ el.innerHTML=addBtn+'<div class="csp-empty">কোনো পরীক্ষা নেই।</div>'; return; }
  el.innerHTML=addBtn+quizzes.map(q=>{
    const subs=API.Exams.getSubmissionsForQuiz(q.id);
    const sub=subs.find(s=>s.studentId===curChat);
    let meta='জমা দেয়নি', mCls='warn';
    if(sub&&sub.needsManualGrade){ meta='জমা · নম্বর বাকি'; mCls='warn'; }
    else if(sub){ meta=`${sub.score}/${sub.total} · ${sub.passed?'পাস':'ফেল'}`; mCls=sub.passed?'ok':'bad'; }
    const bits=[q.subject, (q.questions?.length||0)+' প্রশ্ন', q.timeLimit?q.timeLimit+' মি':''].filter(Boolean);
    const grade=sub&&sub.needsManualGrade
      ?`<div class="csp-exam-grade"><input class="marks-input" type="number" placeholder="নম্বর" value="${sub.score||0}" min="0" max="${sub.total}" style="width:72px" onchange="updateChatExamScore('${sub.id}',this.value)"><span style="font-size:11px;color:var(--gray-400)">/ ${sub.total}</span></div>`
      :'';
    const oral=sub?renderOralAnswerButtons(q,sub):'';
    return `<div class="csp-row"><div class="csp-row-main">${esc(q.title)}${bits.length?' · '+esc(bits.join(' · ')):''}</div><span class="csp-row-meta ${mCls}">${meta}</span></div>${oral}${grade}`;
  }).join('');
}
function renderChatGoals(){
  const el=document.getElementById('csp-goal'); if(!el||!curChat) return;
  const goals=API.Goals.getAll(curChat);
  if(!goals.length){ el.innerHTML='<div class="csp-empty">কোনো লক্ষ্য নেই।</div>'; return; }
  el.innerHTML=goals.map(g=>`
    <div class="csp-row">
      <span class="csp-row-mark ${g.done?'done':''}" aria-hidden="true">${g.done?'✓':''}</span>
      <div class="csp-row-main ${g.done?'done':''}">${esc(g.title)}</div>
      ${g.deadline?`<span class="csp-row-meta">${esc(g.deadline)}</span>`:''}
    </div>`).join('');
}
function teacherWeekDateAdd(date,delta){
  const d=new Date((date||API.today())+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+delta);
  return d.toISOString().split('T')[0];
}
function isWeeklyReceiptNote(n){
  return /^সাপ্তাহিক আমল:/.test(String(n.title||'')) || /^সাপ্তাহিক আমল জমা/.test(String(n.text||''));
}
function renderChatNotes(){
  const el=document.getElementById('csp-note'); if(!el||!curChat) return;
  const view=chatNoteView==='student'?'student':'teacher';
  const sourceBar=`<div class="csp-note-source">
    <button type="button" class="${view==='student'?'active':''}" onclick="setChatNoteView('student')">ছাত্রের বিবরণ</button>
    <button type="button" class="${view==='teacher'?'active':''}" onclick="setChatNoteView('teacher')">জিম্মাদারের নোট</button>
  </div>`;
  if(view==='student'){
    const notes=(API.StudentNotes?API.StudentNotes.getAll(curChat):[]).filter(n=>!isWeeklyReceiptNote(n)).slice().sort((a,b)=>String((b.date||'')+(b.time||'')).localeCompare(String((a.date||'')+(a.time||''))));
    el.innerHTML=sourceBar+(notes.length?notes.map(n=>{
      const cat=API.StudentNotes&&API.StudentNotes.catLabel?API.StudentNotes.catLabel(n.categoryId):'বিবরণ';
      const pending=n.reviewStatus!=='done';
      return `<div class="csp-note-item">
        ${n.title?`<div class="csp-note-title">${esc(n.title)}</div>`:''}
        <div class="csp-note-body">${esc(n.text)}</div>
        <div class="csp-note-time">${pending?'<span class="doc-pending-badge">পর্যালোচনাধীন</span>':''}<span class="csp-note-cat">${esc(cat)}</span> ${n.date||''} ${n.time||''}${pending?`<button type="button" class="doc-btn done" style="width:22px;height:22px;display:inline-flex;vertical-align:middle;margin-left:6px" onclick="markNoteReviewed('${esc(n.id)}')" title="পর্যালোচনা সম্পন্ন" aria-label="পর্যালোচনা সম্পন্ন">✓</button>`:''}</div>
      </div>`;
    }).join(''):'<div class="csp-empty" style="padding:16px 0">ছাত্রের কোনো বিবরণ নেই।</div>');
    return;
  }
  const notes=API.TeacherNotes.getAll(curChat);
  el.innerHTML=sourceBar+(notes.length?notes.slice().reverse().map(n=>`
    <div class="csp-note-item">
      <div class="csp-note-body">${esc(n.text)}</div>
      <div class="csp-note-time">${n.date||''} ${n.time||''}</div>
    </div>`).join(''):'<div class="csp-empty" style="padding:16px 0">কোনো নোট নেই।</div>')
  +`<div class="csp-note-add">
      <textarea id="chatNoteInput" placeholder="নতুন নোট লিখুন..." rows="2"></textarea>
      <button onclick="saveChatNote()">যোগ</button>
    </div>`;
}
function setChatNoteView(view){
  chatNoteView=view==='student'?'student':'teacher';
  renderChatNotes();
}
async function markNoteReviewed(noteId){
  if(!curChat||!API.StudentNotes) return;
  try{
    await API.StudentNotes.markReviewed(curChat,noteId);
    renderChatNotes();
    showToast('✅ পর্যালোচনা সম্পন্ন');
  }catch(e){ console.error(e); showToast('❌ আপডেট হয়নি'); }
}
async function saveChatNote(){
  const inp=document.getElementById('chatNoteInput'); if(!inp||!curChat) return;
  const text=inp.value.trim(); if(!text){ showToast('নোট লিখুন!'); return; }
  try{ await API.TeacherNotes.add(curChat,text); inp.value=''; renderChatNotes(); showToast('✅ নোট সংরক্ষিত'); }
  catch(e){ console.error(e); showToast('❌ নোট সেভ হয়নি'); }
}

/** Pending সময়সূচি প্রস্তাব — চ্যাটের মেসেজের নিচে, ইনপুটের উপরে */
function renderChatScheduleStrip(){
  const strip=document.getElementById('chatSchedulePendingStrip');
  if(!strip) return;
  if(!curChat||curChat==='_broadcast'||curChatTab!=='msg'||!API.DailySchedule||!API.DailySchedule.hasPendingApproval(curChat)){
    strip.style.display='none';
    strip.innerHTML='';
    return;
  }
  const ds=API.DailySchedule.getForStudent(curChat);
  const rows=(ds.pending&&ds.pending.rows)||[];
  // Must NOT use JSON.stringify(sid) inside onclick="..." — it injects '"' and breaks the attribute (and can cause SyntaxError).
  const sidJs=String(curChat).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const curRows=ds.rows||[];
  const diffOps=API.DailySchedule.diffRows(curRows,rows);
  const tableRows=diffOps.length
    ? diffOps.map(op=>{const cls=op.type==='del'?' class="sched-diff-del"':op.type==='add'?' class="sched-diff-add"':'';return `<tr${cls}><td>${esc(op.row.task)}</td><td>${esc(op.row.time)}</td></tr>`;}).join('')
    : `<tr><td colspan="2" style="color:var(--gray-400);font-size:12px;padding:8px">সম্পূর্ণ সময়সূচি মুছে ফেলার প্রস্তাব</td></tr>`;
  strip.style.display='block';
  strip.innerHTML=`<div class="tea-chat-sched-card">
    <div class="tea-chat-sched-hd">📅 সময়সূচি পরিবর্তনের অনুরোধ</div>
    <div class="tea-chat-sched-body">
      <table class="tea-chat-sched-tbl"><thead><tr><th>কাজ</th><th>সময়</th></tr></thead><tbody>${tableRows}</tbody></table>
      <div class="tea-chat-sched-actions">
        <button type="button" class="tea-chat-sched-btn tea-chat-sched-btn--ok" onclick="teacherApproveSchedule('${sidJs}')">✅ অনুমোদন</button>
        <button type="button" class="tea-chat-sched-btn tea-chat-sched-btn--no" onclick="teacherRejectSchedulePrompt('${sidJs}')">✕ প্রত্যাখ্যান</button>
      </div>
    </div>
  </div>`;
}

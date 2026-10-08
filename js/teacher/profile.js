/* Waqful Madinah — js/teacher/profile.js: student profile (info, schedule, academic history, teacher notes) */
// ══ STUDENT PROFILE ════════════════════════════════════════
function openStudentProfile(sid){
  openChat(sid,'info');
}
function closeStudentProfile(){
  document.getElementById('profileView').classList.remove('open');
  var _tn=document.getElementById('teaBottomNav'); if(_tn) _tn.style.display='block';
  document.getElementById('fab').style.display=curChat?'none':'flex';
  curProfileSid=null;
}

function renderProfileBody(s){
  const batchLbl=API.Students.formatBatchYear(s.enrollmentDate);
  const academic=API.AcademicHistory.getAll(s.id);
  const notes=API.TeacherNotes.getAll(s.id);
  const subLine=(()=>{ const p=[]; if(s.waqfId) p.push(API.Students.displayWaqfId(s.waqfId)); if(batchLbl) p.push(batchLbl); if(s.enrollmentDate) p.push(s.enrollmentDate.slice(0,4)); return p.length?p.join(' · '):'পরিচয়'; })();
  document.getElementById('profileBody').innerHTML=`
  <!-- ── Tab: তথ্য ───────────────────────────────────── -->
  <div class="prof-pane" id="ppane-info">
    <div class="profile-v2-hero">
      <div class="profile-v2-av" style="background:${s.color||C[0]}">${s.name.charAt(0)}</div>
      <div class="profile-v2-meta">
        <div class="profile-v2-name">${esc(s.name)}</div>
        <div class="profile-v2-sub">${esc(subLine)}</div>
      </div>
    </div>
    <div class="profile-v2-sheet">
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
    </div>
  </div>

  <!-- ── Tab: সময়সূচি ─────────────────────────────── -->
  <div class="prof-pane" id="ppane-schedule" style="display:none">
    <div id="schedulePaneInner"></div>
  </div>

  <!-- ── Tab: একাডেমিক ──────────────────────────────── -->
  <div class="prof-pane" id="ppane-acad" style="display:none">
    <div class="profile-v2-sheet">
      <div class="profile-v2-sec">বর্তমান</div>
      ${pRow('শ্রেণী','p_cls',s.cls||'')}
      ${pRow('রোল','p_roll',s.roll||'')}
      ${pRow('ভর্তির তারিখ','p_enroll',s.enrollmentDate||'',' type="date"')}
      <div class="profile-v2-sec">পূর্ববর্তী ফলাফল</div>
      <div id="acadList">${academic.length?academic.map(r=>`
        <div class="acad-item" id="acad_${r.id}">
          <div class="acad-year">${esc(r.yearClass)}</div>
          <div class="acad-grade">${esc(r.grade)}</div>
          <button type="button" class="acad-del" onclick="deleteAcadRec('${r.id}')">🗑</button>
        </div>`).join(''):'<div style="padding:12px 14px;font-size:13px;color:var(--gray-400)">কোনো রেকর্ড নেই।</div>'}</div>
      <div class="acad-add-row">
        <input id="acadYear" placeholder="বছর / শ্রেণী (যেমন: ২০২২ - জামাতে খামেছা)">
        <input id="acadGrade" placeholder="নম্বর / গ্রেড">
        <button type="button" class="acad-add-btn" onclick="addAcadRec()">যোগ</button>
      </div>
    </div>
  </div>

  <!-- ── Tab: নোট ───────────────────────────────────── -->
  <div class="prof-pane" id="ppane-notes" style="display:none">
    <div class="profile-v2-sheet">
      <div class="profile-v2-sec">জিম্মাদারের নোট <span style="font-size:11px;font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0">(ছাত্র দেখতে পাবে না)</span></div>
      <div id="notesList">${renderNotesList(notes)}</div>
      <div class="note-add-row">
        <textarea id="noteInput" placeholder="নতুন নোট লিখুন..." rows="2"></textarea>
        <button type="button" class="note-submit-btn" onclick="addNote()" style="background:#075E54;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">📝 যোগ</button>
      </div>
    </div>
  </div>

  <!-- ── Tab: বিকল্প ────────────────────────────────── -->
  <div class="prof-pane" id="ppane-actions" style="display:none">
    <div class="profile-v2-sheet">
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
    </div>
    <div class="profile-section profile-v2-foot-danger">
      <div class="profile-sec-hd">ঝুঁকিপূর্ণ কাজ</div>
      <p style="font-size:13px;color:var(--gray-600);padding:0 14px 8px;line-height:1.55;margin:0">ছাত্রের নাম, ওয়াকফ ও পিন <strong>থাকবে</strong>। চ্যাট, আমল, পরীক্ষার জমা, ডকুমেন্ট, লক্ষ্য, একাডেমিক রেকর্ড ও জিম্মাদারের নোট মুছে যাবে।</p>
      <div style="padding:0 14px 12px">
        <button type="button" onclick="confirmClearStudentData()" style="width:100%;background:#fff;border:1.5px solid #E57373;color:#B71C1C;border-radius:10px;padding:10px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">🧹 শুধু সংশ্লিষ্ট তথ্য মুছুন</button>
      </div>
      <p style="font-size:13px;color:var(--gray-600);padding:0 14px 8px;line-height:1.55;margin:0;border-top:1px solid #FFEBEE;padding-top:12px">ছাত্র সম্পূর্ণ মুছবেন। নতুন ছাত্র যোগ করলে খালি ওয়াকফ নম্বর আবার ব্যবহার হতে পারে।</p>
      <div style="padding:0 14px 16px">
        <button type="button" onclick="confirmDeleteStudent()" style="width:100%;background:#C62828;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">🗑 ছাত্র সম্পূর্ণ মুছুন</button>
      </div>
    </div>
  </div>
  `;
}
function switchProfileTab(tab,btn){
  document.querySelectorAll('.prof-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.prof-pane').forEach(p=>p.style.display='none');
  document.getElementById('ppane-'+tab).style.display='block';
  if(tab==='schedule'&&curProfileSid&&typeof renderSchedulePane==='function') renderSchedulePane(API.Students.getById(curProfileSid));
}
function renderSchedulePane(s){
  const el=document.getElementById('schedulePaneInner');
  if(!el||!s||!API.DailySchedule) return;
  if(window.ScheduleEditUI) ScheduleEditUI.bindDocClick();
  const ds=API.DailySchedule.getForStudent(s.id);
  const rows=ds.rows||[];
  const pend=ds.pending;
  let pendBlock='';
  if(pend&&pend.status==='pending'&&Array.isArray(pend.rows)){
    const diffOps=API.DailySchedule.diffRows(rows,pend.rows);
    const diffBody=diffOps.length
      ? diffOps.map(op=>{const cls=op.type==='del'?' class="sched-diff-del"':op.type==='add'?' class="sched-diff-add"':'';return `<tr${cls}><td>${esc(op.row.time)}</td><td>${esc(op.row.task)}</td></tr>`;}).join('')
      : `<tr><td colspan="2" style="color:var(--gray-400);font-size:12px;padding:8px">সম্পূর্ণ সময়সূচি মুছে ফেলার প্রস্তাব</td></tr>`;
    pendBlock=`<div class="profile-v2-sheet" style="margin-bottom:10px">
      <div class="profile-v2-sec">অনুমোদনের অপেক্ষায় · ছাত্রের প্রস্তাব</div>
      <table class="tea-sched-table">
      <thead><tr><th>সময়</th><th>কাজ</th></tr></thead>
      <tbody>${diffBody}</tbody></table>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button type="button" style="background:#2E7D32;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-family:var(--font);font-weight:600;cursor:pointer" onclick="teacherApproveSchedule('${s.id}')">✅ অনুমোদন</button>
        <button type="button" style="background:#fff;color:#E65100;border:1.5px solid #E65100;border-radius:8px;padding:8px 14px;font-family:var(--font);font-weight:600;cursor:pointer" onclick="teacherRejectSchedulePrompt('${s.id}')">✕ প্রত্যাখ্যান</button>
      </div>
    </div>`;
  }
  const rowEdits=rows.length?rows:[{task:'',time:''}];
  const editorRows=(window.ScheduleEditUI
    ? rowEdits.map(r=>ScheduleEditUI.rowHtml(r)).join('')
    : rowEdits.map(r=>`<div class="schedule-edit-row"><input type="text" class="sched-in-task" placeholder="কাজ" value="${esc(r.task)}"><input type="text" class="sched-in-clock" placeholder="সময়" value="${esc(r.time)}"><button type="button" class="schedule-edit-del" onclick="this.closest('.schedule-edit-row').remove()">✕</button></div>`).join(''));
  el.innerHTML=pendBlock+`
    <div class="profile-v2-sheet">
      <div class="profile-v2-sec">নির্ধারিত সময়সূচি</div>
      <p class="tea-sched-hint">এক লাইনে: শুরু – শেষ · AM/PM · কাজ। ছাত্রের প্রস্তাব এখানে অনুমোদন করা যায়; সরাসরি সেভ করলে তাৎক্ষণিক কার্যকর হবে।</p>
      <div id="teaScheduleRows">${editorRows}</div>
      <button type="button" class="btn-secondary tea-sched-add" onclick="teaScheduleAddRow()"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>সারি যোগ</button>
      <button type="button" class="btn-primary" style="width:100%" onclick="teacherSaveScheduleDirect('${s.id}')">💾 সময়সূচি সেভ করুন</button>
    </div>`;
}
function teaScheduleAddRow(){
  const wrap=document.getElementById('teaScheduleRows');
  if(!wrap) return;
  if(window.ScheduleEditUI){
    wrap.insertAdjacentHTML('beforeend',ScheduleEditUI.rowHtml({task:'',time:''}));
    return;
  }
  wrap.insertAdjacentHTML('beforeend','<div class="schedule-edit-row"><input type="text" class="sched-in-task" placeholder="কাজ"><input type="text" class="sched-in-clock" placeholder="সময়"><button type="button" class="schedule-edit-del" onclick="this.closest(\'.schedule-edit-row\').remove()">✕</button></div>');
}
function teacherCollectScheduleRows(){
  if(window.ScheduleEditUI) return ScheduleEditUI.collectRows('#teaScheduleRows');
  const out=[];
  document.querySelectorAll('#teaScheduleRows .schedule-edit-row').forEach(row=>{
    const t=row.querySelector('.sched-in-task')?.value.trim()||'';
    const tm=row.querySelector('.sched-in-clock')?.value.trim()||'';
    if(t||tm) out.push({task:t,time:tm});
  });
  return out;
}
async function teacherSaveScheduleDirect(sid){
  if(window.ScheduleEditUI){
    document.querySelectorAll('#teaScheduleRows .sched-in-clock').forEach(el=>ScheduleEditUI.onClockBlur(el));
  }
  const rows=teacherCollectScheduleRows();
  try{
    await API.DailySchedule.setTeacherDirect(sid,rows);
    showToast('✅ সময়সূচি সেভ হয়েছে');
    const st=API.Students.getById(sid);
    if(st) renderSchedulePane(st);
    renderAll();
  }catch(e){ console.error(e); showToast('সেভ করা যায়নি'); }
}
async function teacherApproveSchedule(sid){
  try{
    await API.DailySchedule.teacherResolve(sid,true,'');
    showToast('✅ অনুমোদিত হয়েছে');
    const st=API.Students.getById(sid);
    if(st) renderSchedulePane(st);
    renderAll();
  }catch(e){ console.error(e); showToast('ব্যর্থ'); }
}
function teacherRejectSchedulePrompt(sid){
  const note=prompt('প্রত্যাখ্যানের কারণ (ঐচ্ছিক):','')||'';
  void API.DailySchedule.teacherResolve(sid,false,note).then(()=>{
    showToast('প্রত্যাখ্যান রেকর্ড হয়েছে');
    const st=API.Students.getById(sid);
    if(st) renderSchedulePane(st);
    renderAll();
  }).catch(()=>showToast('ব্যর্থ'));
}
function pRow(label,id,val,extra=''){
  return `<div class="profile-v2-row"><span>${esc(label)}</span><input id="${id}" value="${esc(val)}"${extra} placeholder="${esc(label)}…"></div>`;
}
function renderNotesList(notes){
  if(!notes.length) return '<div style="padding:12px 14px;font-size:13px;color:var(--gray-400)">এখনো কোনো নোট নেই।</div>';
  return notes.map(n=>`<div class="note-item" id="note_${n.id}">
    <div class="note-date"><span>📅 ${n.date} ${n.time||''}</span>${n.edited?`<span style="color:var(--gray-400)">(সম্পাদিত ${n.edited})</span>`:''}</div>
    <div class="note-text" id="notetext_${n.id}">${esc(n.text)}</div>
    <div class="note-actions">
      <button class="note-btn" onclick="editNoteInline('${n.id}')">✏️ সম্পাদন</button>
      <button class="note-btn del" onclick="deleteNote('${n.id}')">🗑 মুছুন</button>
    </div>
  </div>`).join('');
}
async function confirmClearStudentData(){
  if(!curProfileSid) return;
  const st=API.Students.getById(curProfileSid);
  const ok=await showConfirm(
    `«${st?.name||'এই ছাত্র'}»-এর চ্যাট, আমল, পরীক্ষার জমা, ডকুমেন্ট, লক্ষ্য, একাডেমিক রেকর্ড ও জিম্মাদারের নোট মুছে যাবে। ছাত্রের নাম, ওয়াকফ নম্বর ও পিন থাকবে। চালিয়ে যাবেন?`,
    {title:'সংশ্লিষ্ট তথ্য মুছুন',okText:'হ্যাঁ, মুছে ফেলুন',danger:true}
  );
  if(!ok) return;
  try{
    await API.Students.clearAllRelatedData(curProfileSid);
    closeStudentProfile();
    renderAll();
    showToast('✅ সংশ্লিষ্ট তথ্য মুছে ফেলা হয়েছে');
  } catch(e){
    console.error(e);
    showToast('কাজটি ব্যর্থ হয়েছে');
  }
}
async function confirmDeleteStudent(){
  if(!curProfileSid) return;
  const st=API.Students.getById(curProfileSid);
  if(!st) return;
  const label=`«${st.name}»${st.waqfId?' ('+API.Students.displayWaqfId(st.waqfId)+')':''}`;
  const firstOk=await showConfirm(
    `${label} সম্পূর্ণ মুছে যাবে। ছাত্রের প্রোফাইলসহ সব সংশ্লিষ্ট তথ্য মুছে যাবে এবং ডেটা ফিরিয়ে আনা যাবে না।`,
    {title:'ছাত্র সম্পূর্ণ মুছুন',okText:'পরের ধাপ',danger:true}
  );
  if(!firstOk) return;
  const finalOk=await showConfirm(
    `শেষ নিশ্চিতকরণ: ${label} স্থায়ীভাবে মুছে ফেলবেন?`,
    {title:'চূড়ান্ত নিশ্চিতকরণ',okText:'স্থায়ীভাবে মুছুন',danger:true}
  );
  if(!finalOk) return;
  try{
    await API.Students.deleteCompletely(curProfileSid);
    closeStudentProfile();
    renderAll();
    showToast('🗑 ছাত্র মুছে ফেলা হয়েছে');
  } catch(e){
    console.error(e);
    showToast('কাজটি ব্যর্থ হয়েছে');
  }
}
async function saveProfileEdits(){
  if(!curProfileSid) return;
  const prev=API.Students.getById(curProfileSid); if(!prev) return;
  const g=(id,fallback)=>document.getElementById(id)?.value.trim()??(fallback||'');
  try{ await API.Students.update(curProfileSid,{
    name:g('p_name',prev.name), responsibility:g('p_resp',prev.responsibility), fatherName:g('p_father',prev.fatherName), fatherOccupation:g('p_focc',prev.fatherOccupation),
    contact:g('p_contact',prev.contact), bloodGroup:g('p_blood',prev.bloodGroup),
    district:g('p_district',prev.district), upazila:g('p_upazila',prev.upazila),
    cls:g('p_cls',prev.cls), roll:g('p_roll',prev.roll), enrollmentDate:g('p_enroll',prev.enrollmentDate),
  }); }catch(e){ console.error(e); showToast('❌ প্রোফাইল সেভ হয়নি'); return; }
  const s=API.Students.getById(curProfileSid);
  const batchLbl=API.Students.formatBatchYear(s.enrollmentDate);
  document.getElementById('profileHdName').textContent=s.name;
  document.getElementById('profileHdSub').textContent=(s.waqfId?API.Students.displayWaqfId(s.waqfId):'')+(batchLbl?' · '+batchLbl:'');
  if(curChat===curProfileSid&&curChatTab==='info') renderChatInfo();
  else {
    renderProfileBody(s);
    if(typeof renderSchedulePane==='function') renderSchedulePane(s);
  }
  renderAll(); showToast('✅ প্রোফাইল সেভ হয়েছে');
}
function showPinResetInProfile(){
  const el=document.getElementById('profilePinReset');
  el.style.display=el.style.display==='none'?'block':'none';
}
async function saveProfilePin(){
  if(!curProfileSid) return;
  const p=String(document.getElementById('profileNewPin').value).trim();
  if(!/^\d{4}$/.test(p)){ showToast('৪ সংখ্যার পিন দিন!'); return; }
  try{
    await API.Students.updatePin(curProfileSid,p);
    document.getElementById('profilePinDisplay').textContent=p;
    document.getElementById('profileNewPin').value='';
    document.getElementById('profilePinReset').style.display='none';
    showToast('✅ পিন পরিবর্তন হয়েছে · নতুন পিন: '+p);
  } catch{ showToast('সেভ করা যায়নি'); }
}
// Academic history
async function addAcadRec(){
  if(!curProfileSid) return;
  const yearClass=document.getElementById('acadYear').value.trim();
  const grade=document.getElementById('acadGrade').value.trim();
  if(!yearClass||!grade){ showToast('বছর এবং নম্বর দুটোই লিখুন!'); return; }
  let rec;
  try{ rec=await API.AcademicHistory.add(curProfileSid,{yearClass,grade}); }
  catch(e){ console.error(e); showToast('❌ রেকর্ড সেভ হয়নি'); return; }
  document.getElementById('acadYear').value='';
  document.getElementById('acadGrade').value='';
  const list=document.getElementById('acadList');
  if(list.querySelector('[style*="color:var(--gray-400)"]')) list.innerHTML='';
  list.insertAdjacentHTML('beforeend',`<div class="acad-item" id="acad_${rec.id}">
    <div class="acad-year">${esc(rec.yearClass)}</div>
    <div class="acad-grade">${esc(rec.grade)}</div>
    <button class="acad-del" onclick="deleteAcadRec('${rec.id}')">🗑</button>
  </div>`);
  showToast('✅ রেকর্ড যোগ হয়েছে');
}
async function deleteAcadRec(rid){
  if(!curProfileSid) return;
  try{ await API.AcademicHistory.delete(curProfileSid,rid); }
  catch(e){ console.error(e); showToast('❌ রেকর্ড মোছা যায়নি'); return; }
  document.getElementById('acad_'+rid)?.remove();
  if(!document.getElementById('acadList').children.length)
    document.getElementById('acadList').innerHTML='<div style="padding:12px 14px;font-size:13px;color:var(--gray-400)">কোনো রেকর্ড নেই।</div>';
}
// Teacher notes
async function addNote(){
  if(!curProfileSid) return;
  const text=document.getElementById('noteInput').value.trim();
  if(!text){ showToast('নোট লিখুন!'); return; }
  let note;
  try{ note=await API.TeacherNotes.add(curProfileSid,text); }
  catch(e){ console.error(e); showToast('❌ নোট সেভ হয়নি'); return; }
  document.getElementById('noteInput').value='';
  const list=document.getElementById('notesList');
  const empty=list.querySelector('[style*="color:var(--gray-400)"]');
  if(empty) empty.remove();
  list.insertAdjacentHTML('afterbegin',`<div class="note-item" id="note_${note.id}">
    <div class="note-date"><span>📅 ${note.date} ${note.time||''}</span></div>
    <div class="note-text" id="notetext_${note.id}">${esc(note.text)}</div>
    <div class="note-actions">
      <button class="note-btn" onclick="editNoteInline('${note.id}')">✏️ সম্পাদন</button>
      <button class="note-btn del" onclick="deleteNote('${note.id}')">🗑 মুছুন</button>
    </div>
  </div>`);
  showToast('📝 নোট যোগ হয়েছে');
}
function editNoteInline(nid){
  if(!curProfileSid) return;
  const el=document.getElementById('notetext_'+nid);
  const cur=el.textContent;
  el.outerHTML=`<textarea id="noteedit_${nid}" style="width:100%;border:1.5px solid #075E54;border-radius:8px;padding:6px 10px;font-family:var(--font);font-size:14px;outline:none;resize:none;min-height:60px">${esc(cur)}</textarea>
  <div style="display:flex;gap:6px;margin-top:4px">
    <button onclick="saveNoteEdit('${nid}')" style="background:#075E54;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-family:var(--font);font-size:12px;cursor:pointer">✅ সেভ</button>
    <button onclick="cancelNoteEdit('${nid}','${esc(cur)}')" style="background:var(--gray-100);border:none;border-radius:6px;padding:4px 12px;font-family:var(--font);font-size:12px;cursor:pointer">বাতিল</button>
  </div>`;
}
async function saveNoteEdit(nid){
  if(!curProfileSid) return;
  const text=document.getElementById('noteedit_'+nid)?.value.trim();
  if(!text) return;
  try{ await API.TeacherNotes.update(curProfileSid,nid,text); }
  catch(e){ console.error(e); showToast('❌ নোট সেভ হয়নি'); return; }
  // re-render notes section
  document.getElementById('notesList').innerHTML=renderNotesList(API.TeacherNotes.getAll(curProfileSid));
}
function cancelNoteEdit(nid,orig){
  document.getElementById('notesList').innerHTML=renderNotesList(API.TeacherNotes.getAll(curProfileSid));
}
async function deleteNote(nid){
  if(!curProfileSid) return;
  try{ await API.TeacherNotes.delete(curProfileSid,nid); }
  catch(e){ console.error(e); showToast('❌ নোট মোছা যায়নি'); return; }
  document.getElementById('note_'+nid)?.remove();
}

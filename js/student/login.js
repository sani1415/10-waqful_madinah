/* Waqful Madinah — js/student/login.js: init, lock screen (notification, pending, keypad), login/logout, header stats */
// ══ Init ═══════════════════════════════════════════════════
function init(){
  if(window.MadrasaPwa) MadrasaPwa.markPushSlot('student');
  Promise.resolve(API.DB.init()).then(()=>{
    void API.Pwa.registerServiceWorker();
    API.Tasks.resetDailyForToday();
    document.querySelectorAll('.modal-overlay').forEach(el=>el.addEventListener('click',e=>{ if(e.target===el){ if(el.id==='dailyNoteModal') closeDailyNoteModal(); else closeModal(el.id); } }));
    renderPendingSection();
    updateNotifBtn();
    // Remote bootstrap শেষে lock hints refresh করো
    Promise.resolve(API.refreshStudentLockHints()).then(()=>renderPendingSection()).catch(()=>{});
    // Personal student notifications are registered after login with that student's waqfId.
  }).catch(e=>{ console.error(e); const la=document.getElementById('lockAppName'); if(la){ la.textContent='সার্ভার সংযোগ ব্যর্থ'; la.removeAttribute('dir'); la.removeAttribute('lang'); la.classList.add('lock-soft-app-name--err'); } });
}

// ══ NOTIFICATION BUTTON (lock screen) — SVG আইকন ═══════════
function notifBtnSvgBell(){
  return '<svg class="lock-soft-notif-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
}
function notifBtnSvgBellOff(){
  return '<svg class="lock-soft-notif-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
}
function notifBtnSvgSpinner(){
  return '<svg class="lock-soft-notif-svg lock-soft-notif-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>';
}
function updateNotifBtn(){
  const btn=document.getElementById('notifBtn');
  if(!btn) return;
  btn.style.opacity='';
  btn.classList.remove('is-muted','is-blocked');
  if(!('Notification' in window)){ btn.style.display='none'; return; }
  btn.style.display='';
  const perm=Notification.permission;
  if(perm==='granted'){
    btn.innerHTML=notifBtnSvgBell();
    btn.classList.add('is-muted');
    btn.title='নোটিফিকেশন চালু আছে — চাপলে পুনরায় নিবন্ধন করবে';
    btn.setAttribute('aria-label','নোটিফিকেশন চালু আছে');
  } else if(perm==='denied'){
    btn.innerHTML=notifBtnSvgBellOff();
    btn.classList.add('is-blocked');
    btn.title='নোটিফিকেশন বন্ধ আছে — browser সেটিং থেকে চালু করুন';
    btn.setAttribute('aria-label','নোটিফিকেশন বন্ধ');
  } else {
    btn.innerHTML=notifBtnSvgBell();
    btn.title='নোটিফিকেশন চালু করুন';
    btn.setAttribute('aria-label','নোটিফিকেশন চালু করুন');
  }
}
async function enableSharedNotif(){
  const btn=document.getElementById('notifBtn');
  if(btn){ btn.innerHTML=notifBtnSvgSpinner(); btn.disabled=true; btn.setAttribute('aria-label','নোটিফিকেশন চালু করা হচ্ছে'); }
  try{
    await API.Pwa.registerServiceWorker();
    updateNotifBtn();
    showToast('ছাত্র হিসেবে লগইন করলে এই ডিভাইসে ব্যক্তিগত নোটিফিকেশন চালু হবে।');
  }catch(e){ console.error('notif error',e); updateNotifBtn(); }
  finally{ if(btn) btn.disabled=false; }
}

// ══ PENDING SECTION (lock screen) ══════════════════════════
function renderPendingSection(){
  const pending=API.Students.getPendingForLockScreen();
  const sec=document.getElementById('pendingSection');
  if(!pending.length){ sec.style.display='none'; return; }
  sec.style.display='block';
  document.getElementById('pendingList').innerHTML=pending.map(s=>{
    const msgCnt=s.unreadCount!=null?s.unreadCount:API.Messages.unreadCount(s.id,'out');
    const waqf=API.Students.getShortId(s)||'---';
    return `<button class="pending-item" onclick="prefillId('${esc(waqf)}')">
      <div class="pending-name">${esc(s.name||'')}<span class="pending-waqf">${esc(API.Students.getShortId(s)||'')}</span></div>
      ${msgCnt>0?`<span class="pending-badge msg">${msgCnt}</span>`:''}
      ${s.taskCount>0?`<span class="pending-badge task">${s.taskCount}</span>`:''}
    </button>`;
  }).join('');
}

// ══ ON-SCREEN KEYPAD LOGIN ══════════════════════════════════
// _skId, _skPin, skp(), skd() and their helpers are defined early (before external
// scripts) in the inline <script> right after the lock screen div, so keypad
// buttons work even while CDN scripts are still downloading.
function loginIdNext(){
  if(!_skId){ showLoginErr('আইডি লিখুন'); return; }
  showLoginErr('');
  _skPin=''; _skUpdatePinDots();
  document.getElementById('loginId').value=_skId;
  const s=API.Students.getByWaqfShortId(_skId);
  const nameEl=document.getElementById('loginPinForName');
  if(nameEl){ nameEl.textContent='ওয়াক্বফ নং: '+_skId+(s&&s.name?' · '+s.name:''); nameEl.style.display='block'; }
  document.getElementById('loginStepId').style.display='none';
  document.getElementById('loginStepPin').style.display='flex';
}
function loginPinBack(){
  _skPin=''; _skUpdatePinDots(); showLoginErr('');
  const nameEl=document.getElementById('loginPinForName');
  if(nameEl) nameEl.style.display='none';
  document.getElementById('loginStepPin').style.display='none';
  document.getElementById('loginStepId').style.display='flex';
}
function prefillId(shortId){
  _skId=shortId; _skUpdateIdDisplay(); showLoginErr('');
  document.getElementById('loginId').value=shortId;
  // stay on step 1 — user sees ID filled, presses পরবর্তী themselves
  document.getElementById('loginStepPin').style.display='none';
  document.getElementById('loginStepId').style.display='flex';
  // scroll lock-bottom into view smoothly
  document.querySelector('.lock-bottom').scrollIntoView({behavior:'smooth',block:'end'});
}

// ══ LOGIN (ID + PIN form) ═══════════════════════════════════
async function doLogin(){
  const rawId=(_skId||document.getElementById('loginId').value||'').trim();
  const pin=(_skPin||document.getElementById('loginPin').value||'').trim();
  if(!rawId){ showLoginErr('ওয়াকফ আইডি দিন'); return; }
  if(!pin){ showLoginErr('পিন কোড দিন'); return; }
  if(window.RemoteSync && RemoteSync.isRemote() && RemoteSync.usesSecureKv()){
    try{
      await API.loginStudentRemote(rawId, pin);
      me=API.Students.getByWaqfShortId(rawId);
      if(!me){ showLoginErr('লগইন ব্যর্থ'); return; }
      document.getElementById('lockScreen').style.display='none';
      onLogin();
    } catch(e){
      showLoginErr(API.Auth.loginErrorText(e,'পিন বা আইডি ভুল'));
      _skPin=''; _skUpdatePinDots();
    }
    return;
  }
  const student=API.Students.getByWaqfShortId(rawId);
  if(!student){ showLoginErr('ওয়াকফ আইডি পাওয়া যায়নি'); return; }
  if(pin!==student.pin){ showLoginErr('পিন ভুল হয়েছে'); _skPin=''; _skUpdatePinDots(); return; }
  me=student;
  document.getElementById('lockScreen').style.display='none';
  onLogin();
}

function showLoginErr(msg){
  const el=document.getElementById('loginErr');
  el.textContent=msg;
  setTimeout(()=>{ if(el.textContent===msg) el.textContent=''; },2500);
}
function updateStudentHeaderSub(){
  const el=document.getElementById('hSub');
  if(!el||!me) return;
  const p=[];
  if(me.responsibility) p.push(me.responsibility);
  if(me.cls) p.push(me.cls);
  const txt=p.join(' · ');
  el.textContent=txt;
  el.style.display=txt?'block':'none';
}
function onLogin(){
  localStorage.setItem('madrasa_lastPanel','student');
  if(me && me.waqfId) try{ localStorage.setItem('madrasa_last_student_waqf', String(me.waqfId)); }catch(e){}
  document.getElementById('hTitle').textContent=me.name;
  updateStudentHeaderSub();
  const sb=document.getElementById('stuInChatSearchBtn'); if(sb) sb.style.display='flex';
  var _nav=document.getElementById('stuBottomNav'); if(_nav) _nav.style.display='block';
  renderAll();
  goTab('tasks',true);
  void API.Pwa.enableNotificationsAfterAuth('student', { waqfId: me && me.waqfId });
  checkFortnightlyLock();
}
function checkFortnightlyLock(){
  if(!me||!API.StudentNotes) return false;
  const status=API.StudentNotes.getFortnightlyStatus(me.id);
  if(!status.locked) return false;
  openDailyNoteModal(status.cfg,status.lastDate);
  return true;
}
function waqfDaysSinceEnrollment(student){
  const en=student&&student.enrollmentDate;
  if(!en||!/^\d{4}-\d{2}-\d{2}/.test(String(en))) return null;
  const from=String(en).slice(0,10);
  const today=API.today();
  if(from>today) return 0;
  return Math.round((new Date(today+'T12:00:00')-new Date(from+'T12:00:00'))/86400000)+1;
}
function updateHeaderStats(){
  if(!me) return;
  const pctEl=document.getElementById('hAvatarPct');
  const ring=document.getElementById('hAvatarRing');
  const daysNumEl=document.getElementById('hWaqfDaysNum');
  const prog=API.Tasks.getProgressSummary(me.id);
  const pct=Math.round(Math.min(100,Math.max(0,Number(prog.all&&prog.all.percent)||0)));
  if(pctEl) pctEl.textContent=pct+'%';
  if(ring){
    const C=2*Math.PI*16;
    ring.setAttribute('stroke-dasharray', String(C));
    ring.setAttribute('stroke-dashoffset', String(C*(1-pct/100)));
  }
  const days=waqfDaysSinceEnrollment(me);
  if(daysNumEl) daysNumEl.textContent=days==null?'—':String(days);
}
function logout(){
  goTab('tasks',true);
  me=null;
  dailyNoteForced=false;
  closeModal('dailyNoteModal');
  try{ stopChatVoice(false); }catch(e){}
  try{ stopDailyRecording(false); }catch(e){}
  closeStuInChatSearch();
  const sb=document.getElementById('stuInChatSearchBtn'); if(sb) sb.style.display='none';
  var _nav=document.getElementById('stuBottomNav'); if(_nav) _nav.style.display='none';
  _skId=''; _skPin=''; _skUpdateIdDisplay(); _skUpdatePinDots();
  showLoginErr('');
  document.getElementById('loginStepPin').style.display='none';
  document.getElementById('loginStepId').style.display='flex';
  const _lnEl=document.getElementById('loginPinForName');
  if(_lnEl) _lnEl.style.display='none';
  document.getElementById('lockScreen').style.display='flex';
  Promise.resolve(API.refreshStudentLockHints()).then(()=>renderPendingSection());
}
function renderAll(){ updateHeaderStats(); renderTaskSchedulePanel(); renderChat(); renderTaskList(); renderAmalDashboard(); renderExamList(); renderSentDocs(); renderReceivedDocs(); renderGoals(); renderDailyNotes(); updateBadges(); }

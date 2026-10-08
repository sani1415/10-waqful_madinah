/* Waqful Madinah — js/teacher/init.js: init, lock-screen notification button, PIN login */
// ══ Init ═══════════════════════════════════════════════════
function clearTeacherBootUi(){
  document.documentElement.classList.remove('tea-autologin');
  const splash=document.getElementById('teaBootSplash');
  if(splash){ splash.style.display='none'; splash.setAttribute('aria-busy','false'); }
}
function enterTeacherApp(){
  localStorage.setItem('madrasa_lastPanel','teacher');
  clearTeacherBootUi();
  document.getElementById('lockScreen').style.display='none';
  var _tn=document.getElementById('teaBottomNav'); if(_tn) _tn.style.display='block';
  const err=document.getElementById('pinErr'); if(err) err.textContent='';
  pin=''; dots();
  renderAll();
  if(window.AdminAi) AdminAi.showAfterAuth();
  void API.Pwa.enableNotificationsAfterAuth('teacher').then(updateTeacherNotifBtn);
}
function setLockStatus(msg){
  const err=document.getElementById('pinErr');
  if(err) err.textContent=msg||'';
}
function showTeacherLockScreen(){
  clearTeacherBootUi();
  document.getElementById('lockScreen').style.display='flex';
  var _tn=document.getElementById('teaBottomNav'); if(_tn) _tn.style.display='none';
  pin=''; dots(); setLockStatus('');
  if(window.AdminAi) AdminAi.hideOnLock();
}
async function tryRestoreTeacherSession(){
  const saved=API.Auth.getTeacherSessionPin();
  if(!saved){ clearTeacherBootUi(); return false; }
  try{
    if(window.RemoteSync && RemoteSync.isRemote() && RemoteSync.usesSecureKv()){
      await API.unlockTeacherRemote(saved);
      await API.DB.finalizeRemoteTeacherAfterUnlock();
    } else if(!API.Auth.checkTeacherPin(saved)){
      API.Auth.clearTeacherSession();
      showTeacherLockScreen();
      return false;
    }
    enterTeacherApp();
    return true;
  } catch(e){
    console.warn('teacher session restore failed', e);
    API.Auth.clearTeacherSession();
    showTeacherLockScreen();
    return false;
  }
}
async function teacherLogout(){
  if(!confirm('লগআউট করবেন? পরেরবার পিন দিতে হবে।')) return;
  API.Auth.clearTeacherSession();
  try{
    if(window.RemoteSync && RemoteSync.isRemote() && RemoteSync.bootstrapTeacherIdle)
      await RemoteSync.bootstrapTeacherIdle();
  } catch(e){ console.warn(e); }
  try{ if(document.getElementById('chatView')?.classList.contains('open')) closeChat(); }catch(e){}
  try{ closeInChatSearch(); }catch(e){}
  goTab('chats');
  showTeacherLockScreen();
  showToast('লগআউট হয়েছে');
}
function init(){
  if(window.MadrasaPwa) MadrasaPwa.markPushSlot('teacher');
  Promise.resolve(API.DB.init()).then(async ()=>{
    void API.Pwa.registerServiceWorker();
    API.Tasks.resetDailyForToday();
    const t=API.DB.getTeacher();
    document.getElementById('tName').value=t.name||'';
    document.getElementById('tMadrasa').value=brandName(t.madrasa);
    setAppHeaderTitle(t.madrasa);
    document.getElementById('t_dl').value=API.nextDate(3);
    loadProgressSettingsUI();
    document.querySelectorAll('.modal-overlay').forEach(el=>el.addEventListener('click',e=>{ if(e.target===el) closeModal(el.id); }));
    updateTeacherNotifBtn();
    setTimeout(()=>void API.Pwa.refreshPushSubscription('teacher').then(updateTeacherNotifBtn),2000);
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible') void API.Pwa.refreshPushSubscription('teacher').then(updateTeacherNotifBtn);
    });
    const restored=await tryRestoreTeacherSession();
    if(!restored) clearTeacherBootUi();
  }).catch(e=>{
    console.error(e);
    clearTeacherBootUi();
    const la=document.getElementById('lockAppName');
    if(la){ la.textContent='সার্ভার সংযোগ ব্যর্থ'; la.removeAttribute('dir'); la.removeAttribute('lang'); la.classList.add('lock-soft-app-name--err'); }
  });
}

// ══ NOTIFICATION (lock screen) ═════════════════════════════
function teaNotifBtnSvgBell(){
  return '<svg class="lock-soft-notif-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
}
function teaNotifBtnSvgBellOff(){
  return '<svg class="lock-soft-notif-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
}
function teaNotifBtnSvgSpinner(){
  return '<svg class="lock-soft-notif-svg lock-soft-notif-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>';
}
function updateTeacherNotifBtn(){
  const btn=document.getElementById('teaNotifBtn');
  if(!btn) return;
  btn.style.opacity='';
  btn.classList.remove('is-muted','is-blocked');
  if(!('Notification' in window)){ btn.style.display='none'; return; }
  btn.style.display='';
  const perm=Notification.permission;
  if(perm==='granted'){
    btn.innerHTML=teaNotifBtnSvgBell();
    btn.classList.add('is-muted');
    btn.title='নোটিফিকেশন চালু আছে — চাপলে পুনরায় নিবন্ধন করবে';
    btn.setAttribute('aria-label','নোটিফিকেশন চালু আছে');
  } else if(perm==='denied'){
    btn.innerHTML=teaNotifBtnSvgBellOff();
    btn.classList.add('is-blocked');
    btn.title='নোটিফিকেশন বন্ধ আছে — browser সেটিং থেকে চালু করুন';
    btn.setAttribute('aria-label','নোটিফিকেশন বন্ধ');
  } else {
    btn.innerHTML=teaNotifBtnSvgBell();
    btn.title='নোটিফিকেশন চালু করুন';
    btn.setAttribute('aria-label','নোটিফিকেশন চালু করুন');
  }
}
async function enableTeacherNotif(){
  const btn=document.getElementById('teaNotifBtn');
  if(btn){ btn.innerHTML=teaNotifBtnSvgSpinner(); btn.disabled=true; btn.setAttribute('aria-label','নোটিফিকেশন চালু করা হচ্ছে'); }
  try{
    const repaired=Notification.permission==='granted'
      ? await API.Pwa.repairPushSubscription('teacher')
      : await API.Pwa.enableNotificationsAfterAuth('teacher');
    updateTeacherNotifBtn();
    if(repaired) showToast('নোটিফিকেশন নতুন করে সংযুক্ত হয়েছে।');
    else if(Notification.permission==='granted') showToast('নোটিফিকেশন সংযুক্ত হয়নি—ইন্টারনেট দেখে আবার চেষ্টা করুন।');
    else showToast('নোটিফিকেশন অনুমতি দেওয়া হয়নি।');
  }catch(e){ console.error('teacher notif error',e); updateTeacherNotifBtn(); }
  finally{ if(btn) btn.disabled=false; }
}

// ══ PIN ════════════════════════════════════════════════════
function pk(k){ if(!k||pin.length>=4) return; pin+=k; dots(); if(pin.length===4) setTimeout(chkPin,150); }
function pd(){ pin=pin.slice(0,-1); dots(); }
function dots(){ [0,1,2,3].forEach(i=>document.getElementById('d'+i).classList.toggle('filled',i<pin.length)); }
async function chkPin(){
  const entered=pin;
  if(window.RemoteSync && RemoteSync.isRemote() && RemoteSync.usesSecureKv()){
    try{
      await API.unlockTeacherRemote(entered);
      await API.DB.finalizeRemoteTeacherAfterUnlock();
      API.Auth.saveTeacherSession(entered);
      enterTeacherApp();
    } catch(e){
      const locked=API.Auth.isLockedError(e);
      document.getElementById('pinErr').textContent=API.Auth.loginErrorText(e,'পিন ভুল হয়েছে');
      pin=''; dots();
      setTimeout(()=>document.getElementById('pinErr').textContent='',locked?6000:2000);
    }
    return;
  }
  if(API.Auth.checkTeacherPin(entered)){
    API.Auth.saveTeacherSession(entered);
    enterTeacherApp();
  } else {
    document.getElementById('pinErr').textContent='পিন ভুল হয়েছে';
    pin=''; dots();
    setTimeout(()=>document.getElementById('pinErr').textContent='',2000);
  }
}
function refreshBCReadCounts(){
  if(typeof RemoteSync!=='undefined' && RemoteSync.getBroadcastReadCounts){
    RemoteSync.getBroadcastReadCounts().then(rows=>{
      _bcReadCounts={};
      (rows||[]).forEach(r=>{ if(r.bc_id) _bcReadCounts[r.bc_id]={read_count:r.read_count||0,total_count:r.total_count||0}; });
      renderChatList();
    });
  }
}
function renderAll(){
  renderBiboronSummary(); renderChatList(); renderTaskList(); renderQuizList(); renderDocsGrouped(); updateBadge(); updateDocBadge();
  syncAppBadge();
  refreshBCReadCounts();
  if(curChat){
    if(curChatTab==='msg') renderMsgs(curChat);
    else if(curChatTab==='task') renderChatTasks();
    else if(curChatTab==='exam') renderChatExams();
    else if(curChatTab==='goal') renderChatGoals();
    else if(curChatTab==='doc') renderChatDocs();
    else if(curChatTab==='note') renderChatNotes();
  }
}

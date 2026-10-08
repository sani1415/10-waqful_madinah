/* Waqful Madinah — js/teacher/nav.js: tab navigation, header buttons, search bar */
// ══ NAV ════════════════════════════════════════════════════
let _tabBeforeHeader='chats';
function _headerBackTab(){
  const b=_tabBeforeHeader;
  return (b&&b!=='settings'&&b!=='diary')?b:'chats';
}
function isDiaryOpen(){ return curTab==='diary'; }
function isSearchOpen(){ const b=document.getElementById('searchBar'); return !!(b&&b.style.display!=='none'); }
function syncHeaderBtns(){
  const d=document.getElementById('diaryToggleBtn');
  const s=document.getElementById('searchToggleBtn');
  const t=document.getElementById('settingsToggleBtn');
  if(d) d.classList.toggle('header-btn--active', curTab==='diary');
  if(s) s.classList.toggle('header-btn--active', isSearchOpen());
  if(t) t.classList.toggle('header-btn--active', curTab==='settings');
}
function closeSearchBar(){
  const b=document.getElementById('searchBar');
  if(!b||b.style.display==='none') return;
  const inp=b.querySelector('input');
  b.style.display='none';
  if(inp) inp.value='';
  hideGlobalMsgSearchResults();
  if(curTab==='docs') renderDocsGrouped();
  else if(curTab==='chats') renderChatList('');
}
function toggleSettings(){
  if(curTab==='settings'){
    closeSearchBar();
    goTab(_headerBackTab());
    return;
  }
  closeSearchBar();
  goTab('settings');
}
function toggleDiary(){
  if(curTab==='diary'){
    closeSearchBar();
    goTab(_headerBackTab());
    return;
  }
  closeSearchBar();
  goTab('diary');
}
function goTab(tab, opts){
  uiViewTransition(()=>{
  if(tab==='students') tab='chats';
  if((tab==='settings'||tab==='diary')&&curTab!=='settings'&&curTab!=='diary')
    _tabBeforeHeader=curTab||'chats';
  curTab=tab;
  // Close profile panel if open
  if(document.getElementById('profileView').classList.contains('open')) closeStudentProfile();
  // Restore header actions (may have been hidden inside a chat)
  document.getElementById('searchToggleBtn').style.display='flex';
  const setBtn=document.getElementById('settingsToggleBtn');
  if(setBtn) setBtn.style.display='flex';
  const diaryBtn=document.getElementById('diaryToggleBtn');
  if(diaryBtn) diaryBtn.style.display='flex';
  if(!(opts&&opts.keepSearch)){
    const sb=document.getElementById('searchBar');
    if(sb&&sb.style.display!=='none'){
      const inp=sb.querySelector('input'); if(inp) inp.value='';
      sb.style.display='none';
      hideGlobalMsgSearchResults(); renderChatList('');
    }
  }
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  const tabBtn=document.getElementById('tab-'+tab);
  if(tabBtn) tabBtn.classList.add('active');
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const screenEl=document.getElementById('screen-'+tab);
  if(screenEl) screenEl.classList.add('active');
  document.getElementById('chatView').classList.remove('open'); curChat=null;
  document.getElementById('app').classList.remove('in-chat');
  document.getElementById('backBtn').style.display='none';
  document.getElementById('inChatSearchBtn').style.display='none';
  // Reset chat header to default
  const _t=API.DB.getTeacher();
  setAppHeaderTitle(_t.madrasa);
  const hAvTab=document.getElementById('hAvatar');
  if(hAvTab){
    hAvTab.classList.remove('s-avatar-pct','chat-avatar--bc');
    hAvTab.style.removeProperty('--pct');
    hAvTab.innerHTML='';
    hAvTab.style.display='none';
  }
  document.getElementById('fab').style.display=(tab==='settings'||tab==='diary')?'none':'flex';
  if(tab==='settings'){ goSettingsTab(settingsTab||'profile'); }
  if(tab==='diary'){ renderDiaryList(); }
  if(tab==='chats'){ renderBiboronSummary(); renderChatList(''); }
  if(tab==='exams')  { renderQuizList(); goExamTab('list'); }
  if(tab==='docs')   { renderDocsGrouped(); }
  if(tab==='tasks')  { if(_amalTab==='overview') renderAmalOverview(); else if(_amalTab==='students') renderAmalLeaderboard(); else renderTaskList(); }
  syncHeaderBtns();
  });
}
function fabClick(){
  if(curTab==='tasks') openAddTask();
  else if(curTab==='exams') goExamTab('create', document.querySelectorAll('.exam-tab-btn')[1]);
  else openModal('fabMenu');
}
function toggleSearch(forceClose){
  const b=document.getElementById('searchBar');
  const inp=b.querySelector('input');
  const isOpen=b.style.display!=='none';
  const shouldOpen=forceClose===false?false:!isOpen;
  if(!shouldOpen){
    if(isOpen){
      b.style.display='none';
      if(inp) inp.value='';
      if(curTab==='docs'){ renderDocsGrouped(); }
      else { hideGlobalMsgSearchResults(); if(curTab==='chats') renderChatList(''); }
    }
    syncHeaderBtns();
    return;
  }
  if(curTab==='settings'||curTab==='diary') goTab(_headerBackTab(),{keepSearch:true});
  b.style.display='block';
  if(curTab==='docs'){
    inp.placeholder='ডকুমেন্ট বা ছাত্রের নাম খুঁজুন…';
  } else {
    inp.placeholder='নাম, আইডি বা মেসেজ খুঁজুন…';
  }
  inp.focus();
  syncHeaderBtns();
}
function onSearchInput(q){
  if(curTab==='docs') onDocSearchInput(q);
  else onGlobalMsgSearchInput(q);
}
function onDocSearchInput(q){
  const all=API.Docs.getAll().filter(d=>d.sentBy!=='teacher');
  const filtered=q?all.filter(d=>{
    const lq=q.toLowerCase();
    return (d.fileName||'').toLowerCase().includes(lq)||(d.studentName||'').toLowerCase().includes(lq)||(d.note||'').toLowerCase().includes(lq);
  }):null;
  if(!filtered){ renderDocsGrouped(); return; }
  const el=document.getElementById('docsGrouped');
  if(!filtered.length){ el.innerHTML=`<div class="empty-state"><div class="icon"><span class="ic-svg">${_svgSearch}</span></div><p>কোনো ফলাফল নেই।</p></div>`; return; }
  el.innerHTML=filtered.map(d=>`<div style="padding:8px 0;border-bottom:1px solid var(--gray-100)">${renderDocItem(d)}</div>`).join('');
}

/* Waqful Madinah — js/student/nav.js: badges + tab navigation */
// ══ BADGES ═════════════════════════════════════════════════
function updateBadges(){
  if(!me) return;
  const ur=API.Messages.unreadCount(me.id,'out'); const ub=document.getElementById('urBadge'); ub.textContent=ur; ub.classList.toggle('show',ur>0);
  const pn=API.Tasks.pendingCount(me.id);          const tb=document.getElementById('tBadge');  tb.textContent=pn; tb.classList.toggle('show',pn>0);
  updateExamBadge();
  syncAppBadge();
}
function studentAppBadgeCount(){
  if(!me) return 0;
  const ur=API.Messages.unreadCount(me.id,'out');
  const pn=API.Tasks.pendingCount(me.id);
  const ex=API.Exams.getQuizzesForStudent(me.id).filter(q=>!API.Exams.getSubmission(q.id,me.id)).length;
  return Math.max(0,ur+pn+ex);
}
function syncAppBadge(){
  const n=studentAppBadgeCount();
  try{
    if('setAppBadge' in navigator){
      if(n>0) navigator.setAppBadge(n);
      else if('clearAppBadge' in navigator) navigator.clearAppBadge();
    }
  }catch(e){}
  function post(sw){ if(sw) try{ sw.postMessage({type:'SET_BADGE',count:n,role:'student'}); }catch(e){} }
  if(navigator.serviceWorker){
    if(navigator.serviceWorker.controller) post(navigator.serviceWorker.controller);
    else navigator.serviceWorker.ready.then(reg=>post(reg&&reg.active)).catch(()=>{});
  }
}

// ══ NAV ════════════════════════════════════════════════════
function goTab(tab,instant){
  const run=()=>{
  closeAmalCalendar();
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+tab).classList.add('active');
  const sb=document.getElementById('stuInChatSearchBtn');
  if(sb) sb.style.display=tab==='chat'&&me?'flex':'none';
  if(tab!=='chat') closeStuInChatSearch();
  if(tab==='chat' && me){ API.Messages.markRead(me.id,'out'); renderChat(); updateBadges(); setTimeout(()=>document.getElementById('chatMsgs').scrollTop=9e9,50); }
  if(tab==='exams') renderExamList();
  if(tab==='tasks' && me){ renderAmalDashboard(); renderTaskList(); }
  if(tab==='docs'){ renderSentDocs(); renderReceivedDocs(); }
  if(tab==='goals') renderGoals();
  };
  if(instant) run(); else uiViewTransition(run);
}

// Hide bottom nav when keyboard is open (interactive-widget=resizes-content handles the rest)

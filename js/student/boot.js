/* Waqful Madinah — js/student/boot.js: viewport fix, init(), live-sync listeners */
window.addEventListener('madrasa-remote-sync',()=>{ try{ const u=document.getElementById('lockScreen').style.display==='none'; if(u&&me) renderAll(); else renderPendingSection(); }catch(e){ console.error(e); } });
document.addEventListener('click',function(e){
  if(!e.target.closest('.sched-ampm-wrap')) schedCloseAllAmpmMenus();
  if(!e.target.closest('.daily-note-filter-wrap')) closeDailyNoteFilterMenu();
});
function fixVH(){
  const kbOpen=window.visualViewport&&(window.innerHeight-window.visualViewport.height>100);
  document.documentElement.classList.toggle('kb-open',!!kbOpen);
  document.documentElement.style.setProperty('--shell-pb',kbOpen?'0px':'calc(12px + 68px + env(safe-area-inset-bottom))');
}
fixVH();
window.addEventListener('resize',fixVH);
if(window.visualViewport) window.visualViewport.addEventListener('resize',fixVH);

init();

// ── Live sync: re-render when data changes ─────────────────
// Fires when teacher (or any other tab) writes to localStorage
window.addEventListener('storage', e => {
  if(!e.key || e.key.startsWith('madrasa_') || e.key==='teacher_pin') {
    if(me) renderAll();
    else renderPendingSection();
  }
});
// Fires when user switches back to this tab / app (same device)
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState==='visible') {
    syncAppBadge();
    API.Tasks.resetDailyForToday();
    if(typeof RemoteSync !== 'undefined' && RemoteSync.pullRemoteSnapshot) RemoteSync.pullRemoteSnapshot();
    else if(me) renderAll();
    else Promise.resolve(API.refreshStudentLockHints()).then(()=>renderPendingSection());
  }
});
if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function(e){
  if(e.data && e.data.type==='REFRESH_DATA' && typeof RemoteSync!=='undefined' && RemoteSync.pullRemoteSnapshot)
    RemoteSync.pullRemoteSnapshot().finally(()=>syncAppBadge());
  else if(e.data && e.data.type==='REFRESH_DATA') syncAppBadge();
});

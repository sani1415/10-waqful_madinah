/* Waqful Madinah — js/teacher/boot.js: viewport fix, lifecycle listeners, init() */
window.addEventListener('madrasa-remote-sync',()=>{
  void API.Pwa.refreshPushSubscription('teacher').then(updateTeacherNotifBtn);
  try{
    if(document.getElementById('lockScreen').style.display==='none'){
      if(curChat&&curChat!=='_broadcast'&&curChatTab==='msg'&&API.Messages.unreadCount(curChat,'in')>0){
        API.Messages.markRead(curChat,'in');
      }
      renderAll();
    }
  }catch(e){ console.error(e); }
});
// Hide bottom nav when keyboard is open (interactive-widget=resizes-content handles the rest)
function fixVH(){
  const kbOpen=window.visualViewport&&(window.innerHeight-window.visualViewport.height>100);
  document.documentElement.classList.toggle('kb-open',!!kbOpen);
  document.documentElement.style.setProperty('--shell-pb',kbOpen?'0px':'calc(12px + 68px + env(safe-area-inset-bottom))');
}
fixVH();
window.addEventListener('resize',fixVH);
if(window.visualViewport) window.visualViewport.addEventListener('resize',fixVH);

document.addEventListener('visibilitychange', () => {
  if(document.visibilityState==='visible') {
    syncAppBadge();
    if(typeof RemoteSync !== 'undefined' && RemoteSync.pullRemoteSnapshot) RemoteSync.pullRemoteSnapshot();
  }
});
if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function(e){
  if(e.data && e.data.type==='REFRESH_DATA' && typeof RemoteSync!=='undefined' && RemoteSync.pullRemoteSnapshot)
    RemoteSync.pullRemoteSnapshot().finally(()=>syncAppBadge());
});

init();

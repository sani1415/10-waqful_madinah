/* Waqful Madinah — js/shared/pwa-install-banner.js: "install app" banner (both pages). */
(function(){
  var _prompt=null;
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); _prompt=e;
    document.getElementById('pwaInstallBanner').classList.add('show');
  });
  window.addEventListener('appinstalled',function(){ document.getElementById('pwaInstallBanner').classList.remove('show'); _prompt=null; });
  window.pwaBannerInstall=function(){ if(_prompt){ _prompt.prompt(); _prompt.userChoice.then(function(){ document.getElementById('pwaInstallBanner').classList.remove('show'); _prompt=null; }); } };
  window.pwaBannerDismiss=function(){ document.getElementById('pwaInstallBanner').classList.remove('show'); };
})();

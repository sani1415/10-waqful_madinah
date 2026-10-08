/* Waqful Madinah — js/teacher/settings.js: settings, broadcast, backup export/import */
// ══ SETTINGS ═══════════════════════════════════════════════
let settingsTab='profile';
function goSettingsTab(tab){
  settingsTab=['profile','biboron','backup','more'].includes(tab)?tab:'profile';
  document.querySelectorAll('#settingsTabs .settings-tab').forEach(b=>b.classList.toggle('active',b.getAttribute('data-tab')===settingsTab));
  document.querySelectorAll('#settingsScroll .settings-pane').forEach(p=>{
    p.style.display=p.id==='settings-pane-'+settingsTab?'':'none';
  });
  if(settingsTab==='biboron'){
    loadProgressSettingsUI();
    renderNoteCatSettings();
    renderFortnightlySettings();
  }
  const sc=document.getElementById('settingsScroll');
  if(sc) sc.scrollTop=0;
}
async function sendBC(){ const text=document.getElementById('bcText').value.trim(); if(!text){ showToast('বার্তা লিখুন!'); return; } try{ await API.Messages.broadcast(text); closeModal('bcModal'); document.getElementById('bcText').value=''; renderChatList(); showToast('📢 সবাইকে পাঠানো হয়েছে'); }catch(e){ console.error(e); showToast('❌ বার্তা পাঠানো হয়নি'); } }
async function saveInfo(){ try{ await API.DB.saveTeacher({name:document.getElementById('tName').value.trim()||'জিম্মাদার',madrasa:document.getElementById('tMadrasa').value.trim()||BRAND_AR}); setAppHeaderTitle(API.DB.getTeacher().madrasa); showToast('✅ সংরক্ষিত'); }catch(e){ console.error(e); showToast('❌ সংরক্ষণ হয়নি'); } }
async function changeTPin(){ const p=String(document.getElementById('newTPin').value).trim(); if(!/^\d{4}$/.test(p)){ showToast('৪ সংখ্যার পিন দিন!'); return; } try{ await API.Auth.setTeacherPin(p); document.getElementById('newTPin').value=''; showToast('✅ পিন পরিবর্তন হয়েছে'); }catch(e){ console.error(e); showToast('❌ পিন পরিবর্তন হয়নি'); } }
function doExport(){ const b=new Blob([API.DB.exportJSON()],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`madrasa_${API.today()}.json`; a.click(); showToast('✅ ব্যাকআপ হচ্ছে'); }
function doImport(input){ const r=new FileReader(); r.onload=e=>{ try{ API.DB.importJSON(e.target.result).then(()=>{ renderAll(); showToast('✅ পুনরুদ্ধার সম্পন্ন!'); }).catch(()=>showToast('❌ পুনরুদ্ধার ব্যর্থ!')); }catch{ showToast('❌ ফাইল সঠিক নয়!'); } }; r.readAsText(input.files[0]); input.value=''; }

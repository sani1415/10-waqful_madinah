/* Waqful Madinah — js/student/profile.js: self profile (photo, PIN change) */
// ══ STUDENT SELF-PROFILE ════════════════════════════════════
function openStudentSelfProfile(){
  if(!me) return;
  const avatarEl=document.getElementById('spAvatar');
  avatarEl.style.background=me.color||'#4CAF50';
  const letterEl=document.getElementById('spAvatarLetter');
  if(me.photoDataUrl){
    avatarEl.style.backgroundImage=`url(${JSON.stringify(me.photoDataUrl)})`;
    avatarEl.style.backgroundSize='cover';
    avatarEl.style.backgroundPosition='center';
    if(letterEl) letterEl.textContent='';
  } else {
    avatarEl.style.backgroundImage='none';
    if(letterEl) letterEl.textContent=me.name.charAt(0);
  }
  document.getElementById('spName').textContent=me.name;
  document.getElementById('spWaqf').textContent=me.waqfId?'ওয়াকফ · '+API.Students.displayWaqfId(me.waqfId):'';
  document.getElementById('spNewPin').value='';
  openModal('studentProfileModal');
}
function onStudentPhotoChange(inp){
  const file=inp.files&&inp.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    const dataUrl=e.target.result;
    API.Students.update(me.id,{photoDataUrl:dataUrl});
    me=API.Students.getById(me.id);
    const avatarEl=document.getElementById('spAvatar');
    avatarEl.style.backgroundImage=`url(${JSON.stringify(dataUrl)})`;
    avatarEl.style.backgroundSize='cover';
    avatarEl.style.backgroundPosition='center';
    const ltr=document.getElementById('spAvatarLetter'); if(ltr) ltr.textContent='';
    showToast('✅ ছবি আপডেট হয়েছে');
  };
  reader.readAsDataURL(file);
  inp.value='';
}
async function saveStudentPin(){
  const pinVal=(document.getElementById('spNewPin').value||'').trim();
  if(!/^\d{4}$/.test(pinVal)){ showToast('❌ ৪ সংখ্যার পিন দিন'); return; }
  if(window.RemoteSync && RemoteSync.updateStudentPinRemote){
    try{ await RemoteSync.updateStudentPinRemote(pinVal); }
    catch(e){ showToast('❌ পিন পরিবর্তন ব্যর্থ হয়েছে'); return; }
  }
  await API.Students.updatePin(me.id, pinVal, { skipRemote:true });
  me=API.Students.getById(me.id);
  closeModal('studentProfileModal');
  showToast('✅ পিন পরিবর্তন হয়েছে');
}

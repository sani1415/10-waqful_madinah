/* Waqful Madinah — js/teacher/groups.js: contact groups */
// ══ CONTACT GROUPS ════════════════════════════════════════
function openGrpPanel(gid){
  currentGrpId=gid;
  const g=API.Groups.getById(gid); if(!g) return;
  const stus=API.Students.getAll().filter(s=>g.studentIds.includes(s.id));
  document.getElementById('grpPanelName').textContent=g.name;
  document.getElementById('grpPanelSub').textContent=stus.length+' জন সদস্য';
  document.getElementById('grpMembersBar').innerHTML=stus.length
    ? stus.map(s=>`<span class="grp-member-chip">${esc(s.name)}</span>`).join('')
    : '<span class="grp-empty-chips">কোনো সদস্য নেই</span>';
  document.getElementById('grpMsgIn').value='';
  document.getElementById('grpPanel').classList.add('open');
  document.getElementById('fab').style.display='none';
  setTimeout(()=>document.getElementById('grpMsgIn').focus(),100);
}
function closeGrpPanel(){
  document.getElementById('grpPanel').classList.remove('open');
  document.getElementById('fab').style.display='flex';
  currentGrpId=null;
  renderChatList();
}
async function sendGrpMsg(){
  const text=document.getElementById('grpMsgIn').value.trim();
  if(!text||!currentGrpId) return;
  try{
    const msgs=await API.Groups.sendToGroup(currentGrpId,text);
    if(!msgs.length){ showToast('গ্রুপে কোনো সদস্য নেই!'); return; }
    document.getElementById('grpMsgIn').value='';
    document.getElementById('grpMsgIn').style.height='auto';
    showToast('✅ '+msgs.length+' জনকে বার্তা পাঠানো হয়েছে');
    updateBadge(); renderChatList();
  }catch(e){
    console.error(e);
    showToast('❌ বার্তা পাঠানো হয়নি');
  }
}
function openGrpModal(gid){
  const g=gid?API.Groups.getById(gid):null;
  document.getElementById('grpModalTitle').textContent=g?'গ্রুপ সম্পাদনা':'নতুন গ্রুপ তৈরি';
  document.getElementById('grpNameIn').value=g?g.name:'';
  document.getElementById('grpEditingId').value=gid||'';
  document.getElementById('grpDeleteBtn').style.display=g?'block':'none';
  const stus=API.Students.getAll();
  document.getElementById('grpStuList').innerHTML=stus.length
    ? stus.map(s=>`<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f3f4f6;cursor:pointer">
        <input type="checkbox" value="${s.id}" ${g&&g.studentIds.includes(s.id)?'checked':''} style="accent-color:#128C7E;width:16px;height:16px;flex-shrink:0">
        <span style="font-size:14px;font-weight:600;color:#1e293b;flex:1">${esc(s.name)}</span>
        <span style="font-size:12px;color:#64748b">${s.waqfId?API.Students.displayWaqfId(s.waqfId):''}</span>
      </label>`).join('')
    : '<p style="font-size:13px;color:#94a3b8">কোনো ছাত্র নেই।</p>';
  openModal('grpModal');
}
async function saveGrp(){
  const name=document.getElementById('grpNameIn').value.trim();
  if(!name){ showToast('গ্রুপের নাম লিখুন!'); return; }
  const checked=[...document.querySelectorAll('#grpStuList input[type=checkbox]:checked')].map(el=>el.value);
  const gid=document.getElementById('grpEditingId').value;
  try{
    if(gid){
      await API.Groups.update(gid,name,checked);
      showToast('✅ গ্রুপ আপডেট হয়েছে');
      if(currentGrpId===gid) openGrpPanel(gid);
    } else {
      await API.Groups.add(name,checked);
      showToast('✅ নতুন গ্রুপ তৈরি হয়েছে');
    }
  }catch(e){ console.error(e); showToast('❌ গ্রুপ সেভ হয়নি'); return; }
  closeModal('grpModal'); renderChatList();
}
async function deleteGrpFromModal(){
  const gid=document.getElementById('grpEditingId').value; if(!gid) return;
  if(!confirm('এই গ্রুপটি মুছবেন?')) return;
  try{ await API.Groups.delete(gid); }
  catch(e){ console.error(e); showToast('❌ গ্রুপ মোছা যায়নি'); return; }
  closeModal('grpModal');
  if(currentGrpId===gid) closeGrpPanel(); else renderChatList();
  showToast('গ্রুপ মুছে গেছে');
}

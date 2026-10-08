/* Waqful Madinah — js/teacher/documents.js: documents tab */
// ══ DOCUMENTS ══════════════════════════════════════════════
function updateDocBadge(){
  const unread=API.Docs.unreadCount();
  const pending=API.Docs.getAll().filter(d=>d.sentBy!=='teacher'&&d.reviewStatus==='pending').length;
  const n=Math.max(unread,pending);
  const b=document.getElementById('docBadge'); b.textContent=n; b.classList.toggle('show',n>0);
  syncAppBadge();
}
function goDocTab(tab, btn){
  docViewTab=tab;
  document.querySelectorAll('.doc-tab-btn').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active');
  document.getElementById('docsReceivedPane').style.display = tab==='received'?'block':'none';
  document.getElementById('docsSentPane').style.display     = tab==='sent'?'block':'none';
  document.getElementById('docsStoragePane').style.display  = tab==='storage'?'block':'none';
  if(tab==='received') renderDocsGrouped();
  if(tab==='sent') renderTeacherSentDocs();
  if(tab==='storage')  renderStorageTree();
}
function fDoc(f,btn){ document.querySelectorAll('.doc-tab-btn').length; // just keep ref
  document.querySelectorAll('#docsReceivedPane .filter-chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
  docExpandedSid=null;
  docFilter=f; renderDocsGrouped();
}
function renderDocsGrouped(){
  // Only show student-sent (received by teacher); sentBy undefined = old records = student-sent
  const all=API.Docs.getAll().filter(d=>d.sentBy!=='teacher');
  const pendingAll=all.filter(d=>d.reviewStatus==='pending');
  // Update pending banner
  const banner=document.getElementById('pendingDocsBanner');
  if(banner){ banner.style.display=pendingAll.length>0?'flex':'none'; const pc=document.getElementById('pendingDocsCount'); if(pc) pc.textContent=pendingAll.length; }
  const filtered=docFilter==='all'?all:docFilter==='pending'?pendingAll:all.filter(d=>d.category===docFilter);
  const el=document.getElementById('docsGrouped');
  if(!filtered.length){ el.innerHTML=`<div class="empty-state"><div class="icon"><span class="ic-svg">${_svgInbox}</span></div><p>`+(docFilter==='pending'?'সব পর্যালোচনা সম্পন্ন!':'ছাত্ররা এখনো কোনো ফাইল পাঠায়নি।')+`</p></div>`; return; }

  // Group by student
  const groups={};
  filtered.forEach(d=>{ if(!groups[d.studentId]) groups[d.studentId]=[]; groups[d.studentId].push(d); });

  el.innerHTML=Object.entries(groups).map(([sid,docs])=>{
    const s=API.Students.getById(sid);
    const name=s?.name||docs[0]?.studentName||'অজানা';
    const unread=docs.filter(d=>!d.read).length;
    const grpId='grp_'+sid;
    const isOpen=docExpandedSid===sid;
    const av=s?pctAvatarHtml(sid,'doc-group-avatar'):`<div class="doc-group-avatar" style="background:${C[0]}">${esc(name.charAt(0))}</div>`;
    return `<div class="doc-group">
      <div class="doc-group-hd ${isOpen?'open':''}" onclick="toggleDocGroup('${grpId}','${sid}')">
        ${av}
        <span class="doc-group-name">${esc(name)}${s?.waqfId?' <span style="color:#128C7E;font-weight:600;font-size:13px">'+esc(API.Students.displayWaqfId(s.waqfId))+'</span>':''}</span>
        ${unread?`<span class="unread-dot"></span>`:''}
        <span class="doc-group-count">${docs.length}টি</span>
        <span class="doc-group-chevron ${isOpen?'open':''}" id="chev_${grpId}">${isOpen?'⌄':'›'}</span>
      </div>
      <div id="${grpId}" style="display:${isOpen?'block':'none'}">
        ${docs.map(d=>renderDocItem(d)).join('')}
      </div>
    </div>`;
  }).join('');
}
function renderDocItem(d){
  const catLabel={general:'সাধারণ',question:'রোযনামচা',report:'বিবরণ'}[d.category]||d.category||'সাধারণ';
  const isPending=d.reviewStatus==='pending';
  return `<div class="doc-item" id="ditem_${d.id}">
    <div class="doc-icon">${fileIconSvg(d.fileType)}</div>
    <div class="doc-info">
      <div class="doc-name">${esc(d.fileName)}</div>
      <div class="doc-meta">${isPending?'<span class="doc-pending-badge">বাকি</span>':''}<span class="doc-cat-badge">${catLabel}</span>${formatBytes(d.fileSize)} · ${formatDate(d.uploadedAt)}</div>
    </div>
    <div class="doc-actions">
      ${isPending?`<button class="doc-btn done" onclick="previewDoc('${d.id}')" title="রিভিউ করুন" aria-label="রিভিউ করুন"><span class="ic-svg">${_svgCheck}</span></button>`:''}
      <button class="doc-btn view" onclick="previewDoc('${d.id}')" title="দেখুন" aria-label="দেখুন"><span class="ic-svg">${_svgEye}</span></button>
      <button class="doc-btn del"  onclick="deleteDoc('${d.id}')" title="মুছুন" aria-label="মুছুন"><span class="ic-svg">${_svgTrash}</span></button>
    </div>
  </div>`;
}
function toggleDocGroup(grpId, sid){
  const el=document.getElementById(grpId); const chev=document.getElementById('chev_'+grpId);
  const open=el.style.display==='none';
  el.style.display=open?'block':'none';
  docExpandedSid=open?sid:null;
  chev.classList.toggle('open',open);
  chev.textContent=open?'⌄':'›';
  if(open){
    const docs=API.Docs.getForStudent(sid);
    docs.forEach(d=>{ API.Docs.markRead(d.id); const item=document.getElementById('ditem_'+d.id); if(item) item.querySelector('.doc-cat-badge')?.closest('.doc-info')?.parentElement; });
    API.Docs.getForStudent(sid).forEach(d=>API.Docs.markRead(d.id));
    updateDocBadge();
  }
}
function previewDoc(id){ openDocPreview(id, true); }
async function markDocReviewed(id,comment=''){
  const d=API.Docs.getById(id);
  try{
    await API.Docs.markReviewed(id,comment);
    if(d&&d.studentId) docExpandedSid=d.studentId;
    renderDocsGrouped();
    updateDocBadge();
    showToast('✅ পর্যালোচনা সম্পন্ন');
  }catch(e){ console.error(e); showToast('❌ আপডেট হয়নি'); }
}
async function markDocReviewedFromPreview(){
  if(!curPreviewDocId) return;
  const btn=document.getElementById('docReviewBtn');
  const comment=(document.getElementById('docReviewComment')?.value||'').trim();
  if(btn){ btn.disabled=true; btn.textContent='পাঠানো হচ্ছে…'; }
  await markDocReviewed(curPreviewDocId,comment);
  const meta=API.Docs.getById(curPreviewDocId);
  if(meta&&meta.reviewStatus==='done') renderDocReviewState(meta);
  else if(btn){ btn.disabled=false; btn.textContent='রিভিউ সম্পূর্ণ ও পাঠান'; }
}
async function triggerDocDownload(){
  const meta=API.Docs.getById(curPreviewDocId);
  if(!meta) return;
  const data=await API.Docs.resolveFileUrl(curPreviewDocId);
  if(!data) return;
  const a=document.createElement('a'); a.href=data; a.download=meta.fileName; a.click();
}
async function deleteDoc(id){ if(!confirm('এই ডকুমেন্ট মুছবেন?')) return; try{ await API.Docs.delete(id); if(docViewTab==='sent') renderTeacherSentDocs(); else renderDocsGrouped(); updateDocBadge(); showToast('🗑 মুছে ফেলা হয়েছে'); }catch(e){ console.error(e); showToast('❌ ডকুমেন্ট মোছা যায়নি'); } }
function renderTeacherSentDocs(){
  const all=API.Docs.getAll().filter(d=>d.sentBy==='teacher');
  const el=document.getElementById('docsSentGrouped');
  if(!all.length){ el.innerHTML=`<div class="empty-state"><div class="icon"><span class="ic-svg">${_svgSend}</span></div><p>এখনো কোনো ফাইল পাঠাননি।</p></div>`; return; }
  const groups={};
  all.forEach(d=>{ if(!groups[d.studentId]) groups[d.studentId]=[]; groups[d.studentId].push(d); });
  el.innerHTML=Object.entries(groups).map(([sid,docs])=>{
    const s=API.Students.getById(sid);
    const name=s?.name||docs[0]?.studentName||'অজানা';
    const grpId='sgrp_'+sid;
    const av=s?pctAvatarHtml(sid,'doc-group-avatar'):`<div class="doc-group-avatar" style="background:${C[0]}">${esc(name.charAt(0))}</div>`;
    return `<div class="doc-group">
      <div class="doc-group-hd" onclick="toggleSentDocGroup('${grpId}')">
        ${av}
        <span class="doc-group-name">${esc(name)}${s?.waqfId?' <span style="color:#128C7E;font-weight:600;font-size:13px">'+esc(API.Students.displayWaqfId(s.waqfId))+'</span>':''}</span>
        <span class="doc-group-count">${docs.length}টি</span>
        <span class="doc-group-chevron" id="chev_${grpId}">›</span>
      </div>
      <div id="${grpId}" style="display:none">
        ${docs.map(d=>`<div class="doc-item">
          <div class="doc-icon">${fileIcon(d.fileType)}</div>
          <div class="doc-info">
            <div class="doc-name">${esc(d.fileName)}</div>
            <div class="doc-meta">${formatBytes(d.fileSize)} · ${formatDate(d.uploadedAt)}</div>
          </div>
          <div class="doc-actions">
            <button class="doc-btn view" onclick="previewDoc('${d.id}')" title="দেখুন" aria-label="দেখুন"><span class="ic-svg">${_svgEye}</span></button>
            <button class="doc-btn del"  onclick="deleteDoc('${d.id}')" title="মুছুন" aria-label="মুছুন"><span class="ic-svg">${_svgTrash}</span></button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}
function toggleSentDocGroup(grpId){
  const el=document.getElementById(grpId); const chev=document.getElementById('chev_'+grpId);
  const open=el.style.display==='none';
  el.style.display=open?'block':'none';
  chev.classList.toggle('open',open);
  chev.textContent=open?'⌄':'›';
}

function renderStorageTree(){
  const docs=API.Docs.getAll();
  const usedKB=API.Docs.totalStorageKB();
  const maxKB=200*1024;
  const pct=Math.min(100,Math.round(usedKB/maxKB*100));
  document.getElementById('storageUsed').textContent=`${usedKB} KB (আনুমানিক) · প্রতি ফাইল সর্বোচ্চ ১০ MB`;
  document.getElementById('storageFill').style.width=pct+'%';
  document.getElementById('storageFill').style.background=pct>80?'#C62828':pct>50?'#E65100':'#128C7E';

  if(!docs.length){ document.getElementById('storageFileTree').innerHTML='<p style="text-align:center;padding:20px;color:var(--gray-400);font-size:13px">ফাইল নেই।</p>'; return; }

  // Tree: group by student → files
  const groups={};
  docs.forEach(d=>{ const key=d.studentName||d.studentId; if(!groups[key]) groups[key]=[]; groups[key].push(d); });

  document.getElementById('storageFileTree').innerHTML=Object.entries(groups).map(([name,files])=>`
    <div class="doc-group" style="margin:0 12px 8px">
      <div class="doc-group-hd" style="cursor:default"><span class="ic-svg" style="color:#075E54">${_svgFolder}</span><span class="doc-group-name">${esc(name)}</span><span class="doc-group-count">${files.length} ফাইল</span></div>
      ${files.map(d=>{
        const sizeKB=d.fileSize?Math.round(d.fileSize/1024):0;
        return `<div class="doc-item">
          <div class="doc-icon">${fileIconSvg(d.fileType)}</div>
          <div class="doc-info"><div class="doc-name">${esc(d.fileName)}</div><div class="doc-meta">${sizeKB} KB · ${formatDate(d.uploadedAt)}</div></div>
          <div class="doc-actions">
            <button class="doc-btn view" onclick="previewDoc('${d.id}')" title="দেখুন" aria-label="দেখুন"><span class="ic-svg">${_svgEye}</span></button>
            <button class="doc-btn del"  onclick="deleteDoc('${d.id}')" title="মুছুন" aria-label="মুছুন"><span class="ic-svg">${_svgTrash}</span></button>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

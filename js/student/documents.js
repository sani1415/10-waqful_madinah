/* Waqful Madinah — js/student/documents.js: documents tab (upload, sent, received) */
// ══ DOCUMENTS ══════════════════════════════════════════════
async function handleFileSelect(input){
  if(!input.files?.length) return;
  try{
    if(input.files.length>1) showToast('📄 ছবি একত্রিত করা হচ্ছে…',5000);
    pendingFile=await API.prepareFilesForUpload(input.files);
    document.getElementById('uploadPreview').style.display='block';
    showToast(`📎 নির্বাচিত: ${pendingFile.name}`);
  } catch(e){
    pendingFile=null;
    showUploadPrepError(e);
  }
  input.value='';
}
function cancelUpload(){
  pendingFile=null; document.getElementById('fileInput').value='';
  document.getElementById('uploadPreview').style.display='none';
}
async function confirmUpload(){
  if(!pendingFile||!me){ showToast('ফাইল নির্বাচন করুন!'); return; }
  const cat=document.getElementById('uploadCat').value;
  const note=document.getElementById('uploadNote').value.trim();
  const progWrap=document.getElementById('uploadProgressWrap');
  const progFill=document.getElementById('uploadProgressFill');
  progWrap.style.display='block'; progFill.classList.add('indeterminate');
  try {
    const meta=await API.Docs.upload(me.id, pendingFile, { category:cat, note });
    // Also add a doc message in chat
    await API.Messages.sendFromStudent(me.id, `📎 ${meta.fileName}`, 'doc', { fileName:meta.fileName, fileSize:meta.fileSize, docId:meta.id });
    progFill.classList.remove('indeterminate'); progFill.style.width='100%';
    setTimeout(()=>{ progWrap.style.display='none'; progFill.style.width='0%'; },500);
    cancelUpload();
    renderSentDocs(); renderChat();
    showToast('✅ ডকুমেন্ট পাঠানো হয়েছে!');
  } catch(e){
    progFill.classList.remove('indeterminate'); progFill.style.width='0%';
    progWrap.style.display='none';
    showUploadSaveError(e);
  }
}
const _svgDocFile='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const _svgDocImg='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
const _svgDocEye='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
function _stuDocKind(ft){
  const t=ft||'';
  if(t==='image'||t.startsWith('image/')) return {cls:'img',svg:_svgDocImg};
  if(t==='pdf'||t==='application/pdf') return {cls:'pdf',svg:_svgDocFile};
  return {cls:'',svg:_svgDocFile};
}
function renderSentDocs(){
  const docs=API.Docs.getForStudent(me.id).filter(d=>d.sentBy!=='teacher');
  const el=document.getElementById('sentDocsList');
  if(!docs.length){ el.innerHTML='<div class="stu-doc-empty">এখনো কোনো ফাইল পাঠাননি।</div>'; return; }
  const catLabel={general:'সাধারণ',question:'রোযনামচা',report:'বিবরণ'};
  el.innerHTML=docs.map(d=>{
    const k=_stuDocKind(d.fileType);
    const st=d.reviewStatus==='pending'
      ? '<span class="stu-doc-st wait">পর্যালোচনা চলছে</span>'
      : '<span class="stu-doc-st ok">দেখা হয়েছে</span>';
    return `<div class="stu-doc-row">
      <span class="stu-doc-row-ic ${k.cls}" aria-hidden="true">${k.svg}</span>
      <div class="stu-doc-row-mid">
        <div class="stu-doc-row-name">${esc(d.fileName)}</div>
        <div class="stu-doc-row-meta"><span class="stu-doc-pill">${esc(catLabel[d.category]||d.category||'সাধারণ')}</span><span>${formatBytes(d.fileSize)}</span><span>·</span><span>${formatDate(d.uploadedAt)}</span><span>·</span>${st}</div>
        ${d.reviewStatus==='done'&&d.reviewComment?`<div class="stu-doc-review-note"><strong>উস্তাদের মন্তব্য:</strong> ${esc(d.reviewComment)}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function goStudentDocTab(tab, btn){
  studentDocTab=tab;
  document.querySelectorAll('#screen-docs .doc-tab-btn').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active');
  document.getElementById('sDocsSentPane').style.display     = tab==='sent'?'block':'none';
  document.getElementById('sDocsReceivedPane').style.display = tab==='received'?'block':'none';
  if(tab==='sent') renderSentDocs();
  if(tab==='received') renderReceivedDocs();
}
function renderReceivedDocs(){
  if(!me) return;
  const docs=API.Docs.getForStudent(me.id).filter(d=>d.sentBy==='teacher');
  const el=document.getElementById('receivedDocsList');
  if(!docs.length){ el.innerHTML='<div class="stu-doc-empty">উস্তাদ এখনো কোনো ফাইল পাঠাননি।</div>'; return; }
  el.innerHTML=docs.map(d=>{
    const k=_stuDocKind(d.fileType);
    return `<div class="stu-doc-row">
      <span class="stu-doc-row-ic ${k.cls}" aria-hidden="true">${k.svg}</span>
      <div class="stu-doc-row-mid">
        <div class="stu-doc-row-name">${esc(d.fileName)}</div>
        <div class="stu-doc-row-meta"><span>${formatBytes(d.fileSize)}</span><span>·</span><span>${formatDate(d.uploadedAt)}</span></div>
      </div>
      <button type="button" class="stu-doc-view" onclick="previewStudentChatDoc('${d.id}')" title="দেখুন" aria-label="দেখুন">${_svgDocEye}</button>
    </div>`;
  }).join('');
}

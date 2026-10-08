/* Waqful Madinah — js/student/chat.js: chat thread, files, reply, swipe, in-chat search */
// ══ CHAT ═══════════════════════════════════════════════════
function tickHtml(msg){
  // msg.role==='in' means student sent it (out from student's view)
  // msg.read=true means teacher has seen it → double tick
  if(msg.read) return '<span class="tick-double msg-tick">✓✓</span>';
  return '<span class="tick-single">✓</span>';
}
function fileIcon(type){
  const t=type||'';
  const svg=(t==='image'||t.startsWith('image/'))
    ?'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
    :(t==='pdf'||t==='application/pdf')
    ?'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/></svg>'
    :'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  return `<span class="ic-svg">${svg}</span>`;
}
const _svgEye='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

async function previewStudentChatDoc(docId){
  studentChatPreviewDocId=docId;
  const meta=API.Docs.getById(docId);
  if(!meta){ showToast('ফাইল পাওয়া যায়নি'); return; }
  const data=await API.Docs.resolveFileUrl(docId);
  document.getElementById('chatDocPreviewTitle').textContent=meta.fileName||'ফাইল';
  const box=document.getElementById('chatDocPreviewBody');
  const _ft2=meta.fileType||'';
  const _isImg2=_ft2==='image'||_ft2.startsWith('image/');
  const _isPdf2=window.PdfPreview?PdfPreview.isPdfMeta(meta):(_ft2==='pdf'||_ft2==='application/pdf');
  if(_isImg2 && data){
    box.innerHTML=`<img src=${JSON.stringify(data)} style="max-width:100%;max-height:55vh;border-radius:8px;display:block;margin:0 auto" alt="">`;
  } else if(_isPdf2 && data && window.PdfPreview){
    box.innerHTML='';
  } else if(_isPdf2 && data){
    box.innerHTML=`<iframe src=${JSON.stringify(data)} style="width:100%;height:50vh;border:none;border-radius:8px;background:var(--gray-100)" title="${esc(meta.fileName)}"></iframe>`;
  } else {
    const ic=fileIcon(meta.fileType);
    box.innerHTML=`<div style="padding:16px;text-align:center;background:var(--gray-50);border-radius:8px"><span class="msg-doc-tile" style="width:56px;height:56px;margin:0 auto">${ic}</span><p style="margin:8px 0 0;font-size:13px;color:var(--gray-600)">${esc(meta.fileName)}</p><p style="font-size:12px;color:var(--gray-400)">${formatBytes(meta.fileSize||0)}</p></div>`;
  }
  document.getElementById('chatDocPreviewDl').style.display=data?'block':'none';
  openModal('chatDocPreviewModal');
  if(_isPdf2 && data && window.PdfPreview) PdfPreview.render(box, data, { maxHeight:'55vh', fileName:meta.fileName });
}
async function downloadStudentChatDoc(){
  if(!studentChatPreviewDocId) return;
  const meta=API.Docs.getById(studentChatPreviewDocId);
  const data=await API.Docs.resolveFileUrl(studentChatPreviewDocId);
  if(!data||!meta) return;
  const a=document.createElement('a'); a.href=data; a.download=meta.fileName||'file'; a.rel='noopener'; a.click();
}

function renderChat(){
  const msgs=API.Messages.getThread(me.id); const el=document.getElementById('chatMsgs');
  if(!msgs.length){ el.innerHTML='<div style="text-align:center;padding:40px;color:var(--gray-400);font-size:14px">📖 উস্তাদকে সালাম দিন! 👋</div>'; return; }
  const _todayStr=API.today();
  function _mds(m){ const ts=m._ts||parseInt(/^m(\d{13})/.exec(m.id)?.[1]||'0'); if(!ts) return null; return API.bdDateStr(ts); }
  function _dlbl(ds){ if(!ds) return null; if(ds===_todayStr) return 'আজ'; const d=new Date(ds+'T00:00:00Z'); return `${d.getUTCDate()}/${d.getUTCMonth()+1}/${d.getUTCFullYear()}`; }
  let h='', _lastDs=null;
  msgs.forEach(m=>{
    const _ds=_mds(m); if(_ds&&_ds!==_lastDs){ const _l=_dlbl(_ds); if(_l) h+=`<div class="msg-date-sep"><span>${_l}</span></div>`; _lastDs=_ds; }
    const replyRef=m.replyTo?`<div class="msg-reply-ref" onclick="scrollToMsg('${m.replyTo.id}')"><div class="rr-sender">${esc(m.replyTo.senderLabel||'')}</div><div class="rr-text">${esc(m.replyTo.text||'')}</div></div>`:'';
    const swiIcon=`<div class="swipe-reply-icon">↩</div>`;
    if(m.type==='task'){
      const tLabel=m.task?.taskType==='daily'?'🔁 দৈনিক':'📌 এককালীন';
      h+=`<div class="msg-wrap in" data-mid="${m.id}">${swiIcon}<div class="task-bubble"><div class="task-bubble-hd">📋 উস্তাদ আমল দিয়েছেন · ${tLabel}</div><div class="task-bubble-bd">${replyRef}<div class="task-bubble-title">${esc(m.task.title)}</div><div class="task-bubble-desc">${esc(m.task.desc)}</div>${m.task.deadline?`<div class="task-bubble-dl">📅 শেষ তারিখ: ${m.task.deadline}</div>`:''}</div></div><div style="font-size:11px;color:var(--gray-400);text-align:left;margin-top:2px;padding-left:4px">${m.time}</div></div>`;
    } else if(m.type==='doc'){
      const ic=fileIcon(m.fileType);
      const viewBtn=m.docId?`<button type="button" class="chat-doc-view-btn" onclick="previewStudentChatDoc('${m.docId}')"><span class="ic-svg">${_svgEye}</span> দেখুন</button>`:'';
      const card=`${replyRef}<div class="msg-doc-card"><div class="msg-doc-tile">${ic}</div><div class="msg-doc-info"><div class="msg-doc-name">${esc(m.fileName)}</div><div class="msg-doc-size">${m.fileSize?formatBytes(m.fileSize):''}</div></div></div>${viewBtn}`;
      if(m.role==='in'){
        h+=`<div class="msg-wrap out" data-mid="${m.id}">${swiIcon}<div class="msg-doc-bubble">${card}</div><div class="msg-meta"><span class="msg-time">${m.time}</span>${tickHtml(m)}</div></div>`;
      } else {
        h+=`<div class="msg-wrap in" data-mid="${m.id}">${swiIcon}<div class="msg-doc-bubble">${card}</div><div style="font-size:11px;color:var(--gray-400);margin-top:2px;padding-left:4px">${m.time}</div></div>`;
      }
    } else {
      const _bodyHtml=_stuIcsHighlight(m.text,_stuIcsQuery);
      const _bcTag=m.isBroadcast?`<div style="font-size:10px;font-weight:700;color:#7B1FA2;background:#F3E5F5;border-radius:6px;padding:1px 7px;margin-bottom:4px;display:inline-block">📢 সবার উদ্দেশ্যে</div>`:'';
      const _edTag=m.editedAt?'<span style="font-size:10px;opacity:.75"> · সম্পাদিত</span>':'';
      const _ow=API.Messages.canModifyOwnMessage(m,false)
        ?`<span class="msg-ow-bar"><button type="button" class="msg-ow-tool" onclick="event.stopPropagation();openStudentMsgEdit('${m.id}')" title="সম্পাদনা (১৫ মিনিটের মধ্যে)">✏️</button><button type="button" class="msg-ow-tool" onclick="event.stopPropagation();openStudentMsgDelete('${m.id}')" title="সবার কাছ থেকে মুছুন">🗑</button></span>`:'';
      if(m.role==='in'){
        h+=`<div class="msg-wrap out" data-mid="${m.id}">${swiIcon}<div class="msg-bubble out">${replyRef}${_bcTag}${_bodyHtml}<div class="msg-meta"><span class="msg-time">${m.time}${_edTag}</span>${tickHtml(m)}${_ow}</div></div></div>`;
      } else {
        h+=`<div class="msg-wrap in" data-mid="${m.id}">${swiIcon}<div class="msg-bubble in">${replyRef}${_bcTag}${_bodyHtml}<div class="msg-meta"><span class="msg-time">${m.time}${_edTag}</span></div></div></div>`;
      }
    }
  });
  el.innerHTML=h; setTimeout(()=>el.scrollTop=9e9,50);
}
async function openStudentMsgEdit(mid){
  if(!me) return;
  const msgs=API.Messages.getThread(me.id);
  const m=msgs.find(x=>x.id===mid); if(!m||!API.Messages.canModifyOwnMessage(m,false)) return;
  const nv=await showPrompt('মেসেজ সম্পাদনা করুন',m.text||'');
  if(nv===null) return;
  const t=nv.trim(); if(!t){ showToast('খালি রাখা যাবে না'); return; }
  try{
    const r=await API.Messages.updateOwnText(me.id,mid,t,false);
    if(r.ok){ renderChat(); showToast('✅ সম্পাদিত হয়েছে'); }
    else showToast('❌ সম্পাদনা সম্ভব হয়নি');
  }catch(e){ console.error(e); showToast('❌ সম্পাদনা সেভ হয়নি'); }
}
async function openStudentMsgDelete(mid){
  if(!me) return;
  const ok=await showConfirm('এই মেসেজ উস্তাদসহ সবার কাছ থেকে চিরতরে মুছে যাবে (শুধু আপনার নয়)। চালিয়ে যাবেন?',{title:'মেসেজ মুছুন',okText:'মুছে ফেলুন',danger:true});
  if(!ok) return;
  try{
    const r=await API.Messages.deleteOwn(me.id,mid,false);
    if(r.ok){ renderChat(); updateBadges(); showToast('✅ সবার কাছ থেকে মুছে গেছে'); }
    else showToast('❌ মোছা হয়নি');
  }catch(e){ console.error(e); showToast('❌ মোছা হয়নি'); }
}
async function sendMsg(){
  if(!me) return;
  if(chatPendingFile){ sendChatFile(); return; }
  const inp=document.getElementById('msgIn'); const text=inp.value.trim(); if(!text) return;
  const rt=replyingTo?{...replyingTo}:null;
  try{
    await API.Messages.sendFromStudent(me.id, text, 'text', rt?{replyTo:rt}:{});
    cancelReply();
    inp.value=''; inp.style.height='auto'; renderChat(); updateBadges();
  }catch(e){
    console.error(e);
    showToast('❌ বার্তা পাঠানো হয়নি');
  }
}

// ── Chat file attachment ─────────────────────────────────
async function onChatFileChosen(input){
  if(!input.files?.length) return;
  try{
    if(input.files.length>1) showToast('📄 ছবি একত্রিত করা হচ্ছে…',5000);
    const f=await API.prepareFilesForUpload(input.files);
    chatPendingFile=f;
    document.getElementById('chatFileIcon').innerHTML=fileIcon(f.type);
    document.getElementById('chatFileName').textContent=f.name;
    document.getElementById('chatFileSize').textContent=formatBytes(f.size);
    document.getElementById('chatFilePreview').style.display='flex';
    showToast(`📎 ${f.name} — ➤ বোতামে চাপুন`);
  } catch(e){
    showUploadPrepError(e);
  }
  input.value='';
}
function cancelChatFile(){
  chatPendingFile=null;
  document.getElementById('chatFileInput').value='';
  document.getElementById('chatFileTitleIn').value='';
  document.getElementById('chatFilePreview').style.display='none';
}
async function sendChatFile(){
  if(!chatPendingFile||!me) return;
  const titleEl=document.getElementById('chatFileTitleIn');
  const title=titleEl.value.trim();
  if(!title){ titleEl.classList.add('error'); titleEl.focus(); setTimeout(()=>titleEl.classList.remove('error'),400); showToast('ফাইলের শিরোনাম দিন!'); return; }
  const f=chatPendingFile;
  const rt=replyingTo?{...replyingTo}:null;
  cancelChatFile(); cancelReply();
  try{
    await API.Messages.sendFileFromStudent(me.id, f, {replyTo:rt, displayName:title});
    renderChat(); renderSentDocs(); updateBadges();
    showToast('✅ ফাইল পাঠানো হয়েছে!');
  } catch(e){
    showUploadSaveError(e);
  }
}

// ── Reply-to ────────────────────────────────────────────────
function triggerReply(mid){
  const msgs=API.Messages.getThread(me.id);
  const m=msgs.find(x=>x.id===mid); if(!m) return;
  const senderLabel=m.role==='in'?'আপনি':'উস্তাদ';
  replyingTo={id:m.id, text:m.text||m.fileName||'(ফাইল)', role:m.role, senderLabel};
  document.getElementById('replyPreviewSender').textContent=senderLabel;
  document.getElementById('replyPreviewText').textContent=replyingTo.text;
  document.getElementById('replyPreviewBar').style.display='flex';
  document.getElementById('msgIn').focus();
}
function cancelReply(){
  replyingTo=null;
  const bar=document.getElementById('replyPreviewBar'); if(bar) bar.style.display='none';
}
function scrollToMsg(mid){
  const el=document.querySelector(`.msg-wrap[data-mid="${mid}"]`);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.classList.add('msg-highlight');
  setTimeout(()=>el.classList.remove('msg-highlight'),1200);
}
// ── Swipe-to-reply ──────────────────────────────────────────
(function initSwipeReply(){
  let _st=null;
  const THRESH=60;
  function _getBubble(wrap){ return wrap.querySelector('.msg-bubble')||wrap.querySelector('.msg-doc-bubble')||wrap.querySelector('.task-bubble'); }
  document.addEventListener('touchstart',e=>{
    const wrap=e.target.closest('#chatMsgs .msg-wrap[data-mid]');
    if(!wrap){_st=null;return;}
    _st={wrap,sx:e.touches[0].clientX,sy:e.touches[0].clientY,dx:0,locked:false};
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!_st) return;
    const dx=e.touches[0].clientX-_st.sx, dy=e.touches[0].clientY-_st.sy;
    if(!_st.locked){
      if(Math.abs(dy)>Math.abs(dx)+6){_st=null;return;}
      if(Math.abs(dx)<8) return;
      _st.locked=true;
    }
    const isIn=_st.wrap.classList.contains('in'), isOut=_st.wrap.classList.contains('out');
    let clamped=0;
    if(isIn&&dx>0) clamped=Math.min(dx,THRESH+20);
    else if(isOut&&dx<0) clamped=Math.max(dx,-(THRESH+20));
    else{_st=null;return;}
    _st.dx=clamped;
    const b=_getBubble(_st.wrap); if(b) b.style.transform=`translateX(${clamped}px)`;
    const ic=_st.wrap.querySelector('.swipe-reply-icon');
    if(ic) ic.style.opacity=Math.min(Math.abs(clamped)/THRESH,1);
  },{passive:true});
  document.addEventListener('touchend',()=>{
    if(!_st) return;
    const {wrap,dx}=_st; _st=null;
    const b=_getBubble(wrap);
    if(b){b.style.transition='transform .2s ease';b.style.transform='';setTimeout(()=>{b.style.transition=''},200);}
    const ic=wrap.querySelector('.swipe-reply-icon'); if(ic) ic.style.opacity='0';
    if(Math.abs(dx)>=THRESH) triggerReply(wrap.dataset.mid);
  });
})();

// ══ IN-CHAT SEARCH (student) ════════════════════════════════
let _stuIcsMatches=[], _stuIcsIdx=-1, _stuIcsQuery='';
function toggleStuInChatSearch(){
  const bar=document.getElementById('stuInChatSearchBar');
  if(bar.classList.contains('open')){ closeStuInChatSearch(); }
  else { bar.classList.add('open'); document.getElementById('stuInChatSearchIn').focus(); }
}
function closeStuInChatSearch(){
  _stuIcsQuery=''; _stuIcsMatches=[]; _stuIcsIdx=-1;
  const bar=document.getElementById('stuInChatSearchBar');
  if(bar) bar.classList.remove('open');
  const inp=document.getElementById('stuInChatSearchIn'); if(inp) inp.value='';
  _stuIcsUpdateCounter();
  if(me) renderChat();
}
function _stuIcsUpdateCounter(){
  const el=document.getElementById('stuIcsCounter');
  const prev=document.getElementById('stuIcsPrev');
  const next=document.getElementById('stuIcsNext');
  if(!el) return;
  if(!_stuIcsMatches.length){ el.textContent=_stuIcsQuery?'০':''; }
  else { el.textContent=`${_stuIcsIdx+1}/${_stuIcsMatches.length}`; }
  if(prev) prev.disabled=_stuIcsMatches.length<2;
  if(next) next.disabled=_stuIcsMatches.length<2;
}
function onStuInChatSearch(v){
  _stuIcsQuery=String(v||'').trim();
  _stuIcsMatches=[]; _stuIcsIdx=-1;
  renderChat();
  if(!_stuIcsQuery){ _stuIcsUpdateCounter(); return; }
  requestAnimationFrame(()=>{
    _stuIcsMatches=[...document.querySelectorAll('#chatMsgs mark.msg-hl')];
    if(_stuIcsMatches.length){ _stuIcsIdx=0; _stuIcsScrollTo(0); }
    _stuIcsUpdateCounter();
  });
}
function stuInChatNav(dir){
  if(!_stuIcsMatches.length) return;
  _stuIcsIdx=(_stuIcsIdx+dir+_stuIcsMatches.length)%_stuIcsMatches.length;
  _stuIcsScrollTo(_stuIcsIdx);
  _stuIcsUpdateCounter();
}
function _stuIcsScrollTo(i){
  const el=_stuIcsMatches[i]; if(!el) return;
  _stuIcsMatches.forEach((m,j)=>m.classList.toggle('msg-hl-active',j===i));
  el.scrollIntoView({behavior:'smooth',block:'center'});
}
function _stuIcsHighlight(text,query){
  if(!query) return esc(text);
  const safe=esc(text);
  const safeQ=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return safe.replace(new RegExp('('+safeQ+')','gi'),'<mark class="msg-hl">$1</mark>');
}

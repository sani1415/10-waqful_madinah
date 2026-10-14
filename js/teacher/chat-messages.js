/* Waqful Madinah — js/teacher/chat-messages.js: message thread, files, reply, edit/delete, swipe, send */
/** ছাত্র যা জমা দেয় কিন্তু বার্তা নয় — বিবরণ, আর খাতা থেকে পাঠানো ফাইল — রিসালায় সময় অনুযায়ী কার্ড */
function _chatSubmissions(sid){
  if(!sid||sid==='_broadcast') return [];
  const s=API.Students.getById(sid); if(!s) return [];
  const out=[];
  (API.StudentNotes?API.StudentNotes.getAll(sid):[]).filter(n=>!isWeeklyReceiptNote(n)).forEach(n=>{
    const t=Date.parse(`${n.date||''}T${String(n.time||'00:00').slice(0,5)}:00+06:00`);
    out.push({kind:'note',sid,s,note:n,ts:t?t+59999:0,ds:n.date||null}); // মিনিটের শেষ ধরে — একই মিনিটের বার্তার পরে
  });
  const inChat=new Set(API.Messages.getThread(sid).filter(m=>m.type==='doc'&&m.docId).map(m=>m.docId));
  API.Docs.getForStudent(sid).filter(d=>d.sentBy!=='teacher'&&!inChat.has(d.id)).forEach(d=>{
    const t=Date.parse(d.uploadedAt||'')||0;
    out.push({kind:'doc',sid,s,doc:d,ts:t,ds:t?API.bdDateStr(t):null});
  });
  return out.sort((a,b)=>a.ts-b.ts);
}
function _chatSubCard(it){
  const pending=it.kind==='note'?it.note.reviewStatus!=='done':it.doc.reviewStatus==='pending';
  if(pending) return `<div class="msg-wrap in chat-sub-wrap"><div class="chat-sub">${_rdCard(it,{compact:true,kp:'c'})}</div></div>`;
  if(it.kind==='note'){
    const n=it.note;
    return `<div class="msg-wrap in chat-sub-wrap"><div class="chat-sub chat-sub-done"><div class="cs-hd">📖 বিবরণ · <b>✓ পর্যালোচিত</b></div>${n.title?`<div class="cs-title">${esc(n.title)}</div>`:''}<p>${esc(n.text||'')}</p><span class="msg-time">${esc(String(n.time||'').slice(0,5))}</span></div></div>`;
  }
  const d=it.doc;
  return `<div class="msg-wrap in chat-sub-wrap"><button type="button" class="chat-sub chat-sub-done" onclick="teacherPreviewChatDoc('${rdJs(d.id)}',true)"><div class="cs-hd">📄 ফাইল (খাতা থেকে) · <b>✓ পর্যালোচিত</b></div><div class="cs-title">${esc(d.fileName||'ফাইল')}</div>${d.reviewComment?`<p>মন্তব্য: ${esc(d.reviewComment)}</p>`:''}</button></div>`;
}
function renderMsgs(id){
  const msgs=API.Messages.getThread(id==='_broadcast'?'_bc':id);
  const el=document.getElementById('chatMsgs');
  const subs=_chatSubmissions(id);
  if(!msgs.length&&!subs.length){
    el.innerHTML='<div style="text-align:center;padding:30px;color:var(--gray-400);font-size:13px">কথোপকথন শুরু করুন 👋</div>';
  } else {
  const todayStr=API.today();
  function _msgDateStr(m){ const ts=m._ts||parseInt(/^m(\d{13})/.exec(m.id)?.[1]||'0'); if(!ts) return null; return API.bdDateStr(ts); }
  function _dateSepLabel(ds){ if(!ds) return null; if(ds===todayStr) return 'আজ'; const d=new Date(ds+'T00:00:00Z'); return `${d.getUTCDate()}/${d.getUTCMonth()+1}/${d.getUTCFullYear()}`; }
  let h='', lastDs=null, si=0;
  function _sep(ds){ if(ds && ds!==lastDs){ const lbl=_dateSepLabel(ds); if(lbl) h+=`<div class="msg-date-sep"><span>${lbl}</span></div>`; lastDs=ds; } }
  function _flushSubs(upTo){ while(si<subs.length&&subs[si].ts<=upTo){ const it=subs[si++]; _sep(it.ds); h+=_chatSubCard(it); } }
  msgs.forEach(m=>{
    const mts=m._ts||parseInt(/^m(\d{13})/.exec(m.id)?.[1]||'0'); if(mts) _flushSubs(mts);
    const ds=_msgDateStr(m);
    _sep(ds);
    const replyRef=docReviewReferenceHtml(m,'teacherPreviewChatDoc')||(m.replyTo?`<div class="msg-reply-ref" onclick="scrollToMsg('${m.replyTo.id}')"><div class="rr-sender">${esc(m.replyTo.senderLabel||'')}</div><div class="rr-text">${esc(m.replyTo.text||'')}</div></div>`:'');
    const swiIcon=`<div class="swipe-reply-icon">↩</div>`;
    if(m.type==='task'){
      const tLabel=m.task?.taskType==='daily'?'🔁 দৈনিক':'📌 এককালীন';
      h+=`<div class="msg-wrap out" data-mid="${m.id}">${swiIcon}<div class="task-bubble"><div class="task-bubble-hd">📋 আমল · ${tLabel}</div><div class="task-bubble-bd">${replyRef}<div class="task-bubble-title">${esc(m.task.title)}</div><div class="task-bubble-desc">${esc(m.task.desc)}</div>${m.task.deadline?`<div class="task-bubble-dl">📅 ${m.task.deadline}</div>`:''}</div></div><div style="font-size:11px;color:var(--gray-400);text-align:right;margin-top:2px">${m.time}</div></div>`;
    } else if(m.type==='doc'){
      const dm=m.role==='in'&&m.docId?API.Docs.getById(m.docId):null;
      const revTag=dm?(dm.reviewStatus==='pending'?'<span class="chat-doc-rev pending">পর্যালোচনা বাকি</span>':'<span class="chat-doc-rev">✓ পর্যালোচিত</span>'):'';
      const card=replyRef+chatDocOpenHtml(m,'teacherPreviewChatDoc',revTag);
      if(m.role==='in'){
        h+=`<div class="msg-wrap in" data-mid="${m.id}">${swiIcon}<div class="msg-doc-bubble">${card}</div><div style="font-size:11px;color:var(--gray-400);margin-top:2px;padding-left:4px">${m.time}</div></div>`;
      } else {
        h+=`<div class="msg-wrap out" data-mid="${m.id}">${swiIcon}<div class="msg-doc-bubble">${card}</div><div style="font-size:11px;color:var(--gray-400);text-align:right;margin-top:2px">${m.time}</div></div>`;
      }
    } else {
      const tickHtml=m.role==='out'?(m.read?'<span class="msg-tick" style="color:#5E8A68">✓✓</span>':'<span class="msg-tick" style="color:rgba(0,0,0,.3)">✓</span>'):'';
      const bodyHtml=typeof _icsHighlight==='function'?_icsHighlight(m.text,_icsQuery):esc(m.text);
      const rcpt=id==='_broadcast'&&m.role==='out'&&_bcReadCounts[m.id]
        ?`<div class="bc-receipt">👁 ${_bcReadCounts[m.id].read_count}/${_bcReadCounts[m.id].total_count} জন দেখেছেন</div>`:'';
      const editedTag=m.editedAt?'<span style="font-size:10px;opacity:.75"> · সম্পাদিত</span>':'';
      const owBar=API.Messages.canModifyOwnMessage(m,true)
        ?`<span class="msg-ow-bar"><button type="button" class="msg-ow-tool" onclick="event.stopPropagation();openTeacherMsgEdit('${m.id}')" title="সম্পাদনা (১৫ মিনিটের মধ্যে)">✏️</button><button type="button" class="msg-ow-tool" onclick="event.stopPropagation();openTeacherMsgDelete('${m.id}')" title="সবার কাছ থেকে মুছুন">🗑</button></span>`:'';
      h+=`<div class="msg-wrap ${m.role}" data-mid="${m.id}">${swiIcon}<div class="msg-bubble ${m.role}">${replyRef}${bodyHtml}<div class="msg-meta"><span class="msg-time">${m.time}${editedTag}</span>${tickHtml}${owBar}</div></div>${rcpt}</div>`;
    }
  });
  _flushSubs(Infinity);
  el.innerHTML=h;
  }
  setTimeout(()=>el.scrollTop=9e9,50);
  renderChatScheduleStrip();
}

async function openDocPreview(docId, markAsRead){
  const meta=API.Docs.getById(docId); if(!meta){ showToast('ফাইল পাওয়া যায়নি!'); return; }
  curPreviewDocId=docId;
  const data=await API.Docs.resolveFileUrl(docId);
  document.getElementById('docPreviewTitle').textContent=meta.fileName;
  { const st=meta.studentId?API.Students.getById(meta.studentId):null;
    document.getElementById('docPreviewMeta').textContent=`${formatBytes(meta.fileSize)}${st?.waqfId?' · '+API.Students.displayWaqfId(st.waqfId):''}${meta.studentName?' · '+meta.studentName:''} · ${formatDate(meta.uploadedAt)}`;
  }
  const content=document.getElementById('docPreviewContent');
  const _ft=meta.fileType||'';
  const _isImg=_ft==='image'||_ft.startsWith('image/');
  const _isPdf=window.PdfPreview?PdfPreview.isPdfMeta(meta):(_ft==='pdf'||_ft==='application/pdf');
  const _isDocx=!!(window.DocxPreview&&DocxPreview.isDocxMeta(meta));
  const _isOldDoc=!!(window.DocxPreview&&DocxPreview.isLegacyDocMeta(meta));
  setSheetFull('docPreviewModal',false);
  if(window.DocxPreview) DocxPreview.cancel();
  if(_isImg && data){
    content.innerHTML=`<img src=${JSON.stringify(data)} style="max-width:100%;max-height:65vh;border-radius:8px;object-fit:contain;display:block;margin:0 auto" alt="">`;
  } else if(_isPdf && data && window.PdfPreview){
    content.innerHTML='';
  } else if(_isPdf && data){
    content.innerHTML=`<iframe src=${JSON.stringify(data)} style="width:100%;height:65vh;border:none;border-radius:8px;background:var(--gray-100)" title="${esc(meta.fileName)}"></iframe>`;
  } else if(_isDocx && data){
    content.innerHTML='';
  } else if(_isOldDoc){
    DocxPreview.legacyNotice(content);
  } else {
    const icon=fileIcon(meta.fileType);
    content.innerHTML=`<div style="padding:24px 16px;background:var(--gray-100);border-radius:8px;display:flex;flex-direction:column;align-items:center;gap:8px"><span class="msg-doc-tile" style="width:56px;height:56px">${icon}</span><span style="font-size:14px;font-weight:600;color:var(--gray-700);word-break:break-all">${esc(meta.fileName)}</span><span style="font-size:12px;color:var(--gray-500)">${formatBytes(meta.fileSize)}</span><span style="font-size:12px;color:var(--gray-400)">পূর্বরূপ সম্ভব নয় — ডাউনলোড করুন</span></div>`;
  }
  const btn=document.getElementById('docDownloadBtn');
  btn.style.display=data?'block':'none';
  renderDocReviewState(meta);
  if(markAsRead){ API.Docs.markRead(docId); updateDocBadge(); }
  openModal('docPreviewModal');
  // Focusing a file button must not scroll the shell toward its hidden panels.
  document.getElementById('app').scrollLeft=0;
  if(_isPdf && data && window.PdfPreview) PdfPreview.render(content, data, { maxHeight:'65vh', fileName:meta.fileName });
  if(_isDocx && data) DocxPreview.render(content, data, { fileName:meta.fileName });
  const fullBtn=document.getElementById('docFullBtn'); if(fullBtn) fullBtn.style.display=(data&&(_isImg||_isPdf||_isDocx))?'':'none';
}
function teacherPreviewChatDoc(docId, markRead){
  if(!docId) return;
  openDocPreview(docId, markRead!==false);
}
// ── Teacher chat file functions ───────────────────────────
async function onTeacherChatFileChosen(input){
  if(!input.files?.length) return;
  try{
    if(input.files.length>1) showToast('📄 ছবি একত্রিত করা হচ্ছে…',5000);
    const f=await API.prepareFilesForUpload(input.files);
    chatTeacherPendingFile=f;
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
function cancelTeacherChatFile(){
  chatTeacherPendingFile=null;
  document.getElementById('chatFileInput').value='';
  document.getElementById('chatFileTitleIn').value='';
  document.getElementById('chatFilePreview').style.display='none';
}
async function sendTeacherChatFile(){
  if(!chatTeacherPendingFile||!curChat) return;
  const titleEl=document.getElementById('chatFileTitleIn');
  const title=titleEl.value.trim();
  if(!title){ titleEl.classList.add('error'); titleEl.focus(); setTimeout(()=>titleEl.classList.remove('error'),400); showToast('ফাইলের শিরোনাম দিন!'); return; }
  const f=chatTeacherPendingFile;
  const rt=replyingTo?{...replyingTo}:null;
  cancelTeacherChatFile(); cancelReply();
  try{
    await API.Messages.sendFileFromTeacher(curChat, f, {replyTo:rt, displayName:title});
    renderMsgs(curChat); renderChatList(); updateBadge();
    showToast('✅ ফাইল পাঠানো হয়েছে!');
  } catch(e){
    if(e.message==='file_too_large') showToast('❌ ফাইল ১০ MB এর বেশি!');
    else if(e.message==='storage_full') showToast('❌ স্টোরেজ পূর্ণ!');
    else showToast('❌ পাঠানো ব্যর্থ হয়েছে!');
  }
}
function openChatDocsPanel(){
  if(!curChat||curChat==='_broadcast') return;
  switchChatTab('doc', document.getElementById('cst-doc'));
}
// ── Reply-to ────────────────────────────────────────────────
function triggerReply(mid){
  const msgs=API.Messages.getThread(curChat==='_broadcast'?'_bc':curChat);
  const m=msgs.find(x=>x.id===mid); if(!m) return;
  const senderLabel=m.role==='out'?'আপনি':(API.Students.getById(curChat)?.name||'ছাত্র');
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
// ── Long-press delete (broadcast chat only) ──────────────────
(function initLongPressDelete(){
  let _lp=null;
  function cancel(){ if(_lp){ clearTimeout(_lp.t); _lp=null; } }
  document.addEventListener('touchstart',e=>{
    if(curChat!=='_broadcast') return;
    const wrap=e.target.closest('#chatMsgs .msg-wrap[data-mid]'); if(!wrap) return;
    const mid=wrap.dataset.mid;
    _lp={t:setTimeout(()=>{
      _lp=null;
      if(confirm('এই বার্তাটি মুছবেন?')) deleteBCMessage(mid);
    },600), mid};
  },{passive:true});
  document.addEventListener('touchmove',cancel,{passive:true});
  document.addEventListener('touchend',cancel,{passive:true});
})();
function deleteBCMessage(mid){
  const db=API.DB.get();
  if(db.chats['_bc']) db.chats['_bc']=db.chats['_bc'].filter(m=>m.id!==mid);
  // also remove from any student thread (local broadcast copies)
  Object.keys(db.chats).forEach(tid=>{
    if(tid!=='_bc') db.chats[tid]=db.chats[tid].filter(m=>m.id!==mid);
  });
  API.DB.save(db);
  if(typeof RemoteSync!=='undefined'&&RemoteSync.deleteMessageRemote) RemoteSync.deleteMessageRemote(mid,curChat);
  if(typeof RemoteSync!=='undefined'&&RemoteSync.mem?.core?.chats){
    const c=RemoteSync.mem.core.chats;
    if(c['_bc']) c['_bc']=c['_bc'].filter(m=>m.id!==mid);
  }
  renderMsgs('_broadcast');
  showToast('🗑 বার্তা মুছে ফেলা হয়েছে');
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
async function openTeacherMsgEdit(mid){
  const tid=curChat==='_broadcast'?'_bc':curChat;
  const msgs=API.Messages.getThread(tid);
  const m=msgs.find(x=>x.id===mid); if(!m||!API.Messages.canModifyOwnMessage(m,true)) return;
  const nv=prompt('মেসেজ সম্পাদনা করুন:',m.text||'');
  if(nv===null) return;
  const t=nv.trim(); if(!t){ showToast('খালি রাখা যাবে না'); return; }
  try{
    const r=await API.Messages.updateOwnText(tid,mid,t,true);
    if(r.ok){ renderMsgs(curChat); showToast('✅ সম্পাদিত হয়েছে'); }
    else showToast('❌ সম্পাদনা সম্ভব হয়নি');
  }catch(e){ console.error(e); showToast('❌ সম্পাদনা সেভ হয়নি'); }
}
async function openTeacherMsgDelete(mid){
  if(!confirm('এই মেসেজ ছাত্রসহ সবার কাছ থেকে চিরতরে মুছে যাবে (শুধু আপনার ডিভাইসে নয়)। চালিয়ে যাবেন?')) return;
  const tid=curChat==='_broadcast'?'_bc':curChat;
  try{
    const r=await API.Messages.deleteOwn(tid,mid,true);
    if(r.ok){ renderMsgs(curChat); renderChatList(); updateBadge(); showToast('✅ সবার কাছ থেকে মুছে গেছে'); }
    else showToast('❌ মোছা হয়নি');
  }catch(e){ console.error(e); showToast('❌ মোছা হয়নি'); }
}
async function sendMsg(){
  if(!curChat) return;
  if(chatTeacherPendingFile){ sendTeacherChatFile(); return; }
  const inp=document.getElementById('msgIn'); const text=inp.value.trim(); if(!text) return;
  const rt=replyingTo?{...replyingTo}:null;
  try{
    if(curChat==='_broadcast') await API.Messages.broadcast(text);
    else await API.Messages.send(curChat, text, 'text', rt?{replyTo:rt}:{});
    cancelReply();
    inp.value=''; inp.style.height='auto'; renderMsgs(curChat==='_broadcast'?'_broadcast':curChat);
    renderChatList(); updateBadge();
    setTimeout(()=>document.getElementById('chatMsgs').scrollTop=9e9,50);
  }catch(e){
    console.error(e);
    showToast('❌ বার্তা পাঠানো হয়নি');
  }
}

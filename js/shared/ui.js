/* Waqful Madinah · js/shared/ui.js — global UI helpers (esc, toast, modals, …) shared by both pages. */
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>'); }
function autoResize(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }
// Both panels use the persisted document ID, including reviews loaded after sync.
function docReviewReferenceHtml(message, previewFunction){
  const ref=API.Docs.getReviewReference(message);
  if(!ref) return '';
  const id=encodeURIComponent(ref.docId).replace(/'/g,'%27');
  return `<button type="button" class="msg-reply-ref msg-doc-review-ref" onclick="${previewFunction}(decodeURIComponent('${id}'))" aria-label="পর্যালোচিত ফাইল খুলুন"><span class="rr-sender">ফাইলের পর্যালোচনা</span><span class="rr-text">${esc(ref.fileName)}</span></button>`;
}
function chatDocOpenHtml(message, previewFunction, leading=''){
  const content=`${leading}<div class="msg-doc-card"><div class="msg-doc-tile">${fileIcon(message.fileType)}</div><div class="msg-doc-info"><div class="msg-doc-name">${esc(message.fileName)}</div><div class="msg-doc-size">${message.fileSize?formatBytes(message.fileSize):''}</div></div></div>`;
  if(!message.docId) return content;
  const id=encodeURIComponent(message.docId).replace(/'/g,'%27');
  return `<button type="button" class="msg-doc-open" onclick="${previewFunction}(decodeURIComponent('${id}'))" aria-label="ফাইল খুলুন">${content}</button>`;
}
function showToast(msg,duration=2800){ const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),duration); }
function uiViewTransition(run){
  if(typeof document==='undefined'||typeof run!=='function') return;
  if(document.startViewTransition&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(run);
  else run();
}
function openModal(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.remove('modal-closing');
  const sh=el.querySelector('.modal-sheet');
  if(sh) sh.style.transform='';
  el.classList.add('open');
}
function closeModal(id){
  const el=document.getElementById(id);
  if(!el||!el.classList.contains('open')) return;
  const sh=el.querySelector('.modal-sheet');
  if(sh) sh.style.transform='';
  el.classList.remove('open','modal-closing');
  if(id==='docPreviewModal'||id==='chatDocPreviewModal'){
    if(window.PdfPreview) window.PdfPreview.cancel();
    if(window.DocxPreview) window.DocxPreview.cancel();
    el.classList.remove('sheet-full');
  }
}
function formatBytes(b){ if(!b) return ''; if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function formatDate(iso){ if(!iso) return ''; return new Date(iso).toLocaleDateString('bn-BD',{year:'numeric',month:'short',day:'numeric',timeZone:'Asia/Dhaka'}); }

/** ফাইল প্রিভিউ শিট পুরো পর্দায় / আগের মাপে (PDF, ছবি, Word) */
function setSheetFull(modalId, on){
  const ov=document.getElementById(modalId); if(!ov) return;
  ov.classList.toggle('sheet-full', !!on);
  const b=ov.querySelector('[data-full-btn]');
  if(b) b.setAttribute('aria-pressed', on?'true':'false');
  // পাতার মাপ বদলালে Word/PDF পুনরায় মানিয়ে নেয়
  window.dispatchEvent(new Event('resize'));
}
function toggleSheetFull(modalId){
  const ov=document.getElementById(modalId);
  setSheetFull(modalId, !(ov&&ov.classList.contains('sheet-full')));
}

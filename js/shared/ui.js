/* Waqful Madinah · js/shared/ui.js — global UI helpers (esc, toast, modals, …) shared by both pages. */
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>'); }
function autoResize(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }
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
  if((id==='docPreviewModal'||id==='chatDocPreviewModal')&&typeof window!=='undefined'&&window.PdfPreview) window.PdfPreview.cancel();
}
function formatBytes(b){ if(!b) return ''; if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function formatDate(iso){ if(!iso) return ''; return new Date(iso).toLocaleDateString('bn-BD',{year:'numeric',month:'short',day:'numeric',timeZone:'Asia/Dhaka'}); }

/* Waqful Madinah — js/teacher/state.js: page state, confirm dialog, stroke icons */
// ══ State ══════════════════════════════════════════════════
let pin='', curTab='chats', curChat=null, curChatTab='msg', chatReturnTab='chats', chatNoteView='teacher', tFilter='all', docFilter='all', editSid=null, teacherAmalEndDate='';
let _bcReadCounts={}; // { [bc_id]: {read_count, total_count} }
let currentGrpId=null;
let newTaskType='daily';
let examTab='list', docViewTab='received', docExpandedSid=null;
let questions=[], curQContainer='questionList', examChatSid=null, qSelectedIds=[];
let curPreviewDocId=null;
let chatTeacherPendingFile=null;
let curProfileSid=null;
let replyingTo=null;
const C=['#128C7E','#1565C0','#6A1B9A','#BF360C','#1B5E20'];
const BRAND_AR='وقف المدينة';
function brandName(m){
  const s=String(m==null?'':m).trim();
  if(!s || /^waqful\s*madinah$/i.test(s)) return BRAND_AR;
  return s;
}
function setAppHeaderTitle(name){
  const el=document.getElementById('hTitle');
  if(!el) return;
  const t=brandName(name);
  el.textContent=t;
  // আরবি ব্র্যান্ড — বামেই থাকবে (dir=rtl দিলে ডানে চলে যায়)
  el.removeAttribute('dir');
  if(t===BRAND_AR){
    el.setAttribute('lang','ar');
    el.classList.add('header-title--ar');
  }else{
    el.removeAttribute('lang');
    el.classList.remove('header-title--ar');
  }
  const sub=document.getElementById('hSub');
  if(sub){ sub.textContent=''; sub.style.display='none'; }
}
function setChatHeaderTitle(name){
  const el=document.getElementById('hTitle');
  if(!el) return;
  el.textContent=name==null?'':String(name);
  el.removeAttribute('dir');
  el.removeAttribute('lang');
  el.classList.remove('header-title--ar');
}
function setHeaderSub(text){
  const sub=document.getElementById('hSub');
  if(!sub) return;
  const t=String(text==null?'':text).trim();
  sub.textContent=t;
  sub.style.display=t?'block':'none';
}

// ── Custom confirm (native confirm() often blocked in PWA) ──
let _confirmModalCb=null;
function showConfirm(msg,{title='নিশ্চিত করুন',okText='নিশ্চিত',danger=false}={}){
  return new Promise(resolve=>{
    _confirmModalCb=resolve;
    document.getElementById('confirmModalTitle').textContent=title;
    document.getElementById('confirmModalMsg').textContent=msg;
    const ok=document.getElementById('confirmModalOkBtn');
    ok.textContent=okText;
    ok.style.background=danger?'#dc2626':'';
    openModal('confirmModal');
  });
}
function _confirmModalResolve(v){
  closeModal('confirmModal');
  if(_confirmModalCb){ const cb=_confirmModalCb; _confirmModalCb=null; cb(v); }
}

// ── Stroke SVG icons (bottom-nav / student amal style) ─────
const _svgIcDone='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>';
const _svgIcPend='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/></svg>';
const _svgIcLate='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg>';
const _svgIcPartial='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 12a9 9 0 11-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>';
const _svgTrash='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
const _svgSearch='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const _svgDiary='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8M8 11h6"/></svg>';
const _svgMegaphone='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 11v2a1 1 0 001 1h2l6 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M16 8.5a4.5 4.5 0 010 7"/><path d="M18.5 6a8 8 0 010 12"/></svg>';
const _svgTag='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
const _svgPencil='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
const _svgEye='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const _svgCheck='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const _svgInbox='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>';
const _svgSend='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
const _svgHdd='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 12h.01M10 12h8"/></svg>';
const _svgFolder='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
const _svgFile='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const _svgImage='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
const _svgPdf='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/></svg>';
const _svgCal='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const _svgRepeat='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>';
const _svgPin='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 01-.76 1.57l-2.48 1.86A1 1 0 006.5 16h11a1 1 0 00.74-1.81l-2.48-1.86A2 2 0 0115 10.76V5a1 1 0 00-1-1h-4a1 1 0 00-1 1v5.76z"/></svg>';
const _svgChat='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.5 8.5 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.5 8.5 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"/></svg>';
const _svgClip='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.4 11.6l-8.5 8.5a5 5 0 01-7.1-7.1l9.2-9.2a3.2 3.2 0 014.5 4.5l-9.2 9.2a1.4 1.4 0 01-2-2l8.1-8.1"/></svg>';

function pctAvatarHtml(sid, cls){
  const prog=API.Tasks.getListProgress(sid);
  const pct=Math.max(0,Math.min(100,prog.percent|0));
  return `<div class="${cls||'s-avatar'} s-avatar-pct" style="--pct:${pct}" title="অবস্থা ${pct}%"><span>${pct}%</span></div>`;
}
function setHeaderAvatarHtml(html, bg){
  const el=document.getElementById('hAvatar');
  if(!el) return;
  el.innerHTML=html;
  el.style.background=bg||'#128C7E';
}
function fileIconSvg(type){
  const t=type||'';
  if(t==='image'||t.startsWith('image/')) return `<span class="ic-svg">${_svgImage}</span>`;
  if(t==='pdf'||t==='application/pdf') return `<span class="ic-svg">${_svgPdf}</span>`;
  return `<span class="ic-svg">${_svgFile}</span>`;
}

function showUploadPrepError(e){
  const m=e && e.message;
  if(m==='file_too_large') showToast('❌ একটি ফাইল সর্বোচ্চ ১০ MB!');
  else if(m==='mixed_or_non_image') showToast('❌ একাধিক নিলে সবগুলো ছবি হতে হবে; নয়তো একটি ফাইল নিন।');
  else if(m==='pdf_lib_missing') showToast('❌ PDF লাইব্রেরি লোড হয়নি। পাতা রিফ্রেশ করুন।');
  else if(m==='no_file') showToast('❌ কোনো ফাইল নেই।');
  else if(m==='image_load_error') showToast('❌ ছবি পড়া যায়নি।');
  else showToast('❌ ফাইল প্রস্তুত করা যায়নি!');
}

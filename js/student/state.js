/* Waqful Madinah — js/student/state.js: page state, upload error toasts, confirm/prompt dialogs */
// ══ State ══════════════════════════════════════════════════
let me=null, tFilter='all', gFilter='all', replyingTo=null, studentDocTab='sent';
let activeQuizId=null, quizAnswers={}, quizTimerInterval=null, quizSecondsLeft=0;
let quizAudioState={}, activeQuizAudioId=null;
let pendingFile=null, chatPendingFile=null;
let studentChatPreviewDocId=null;
let dailyNoteSecondsLeft=120;
let dailyNoteEditId=null;
let _dailyVoiceBound=false;
let dailyNoteCatId='general';
let dailyNoteListFilter='all';
let dailyNoteForced=false;
let amalWorkDate=null; /* null = আজ; YYYY-MM-DD = নির্বাচিত দিন */

function showUploadPrepError(e){
  const m=e && e.message;
  if(m==='file_too_large') showToast('❌ একটি ফাইল সর্বোচ্চ ১০ MB!');
  else if(m==='mixed_or_non_image') showToast('❌ একাধিক নিলে সবগুলো ছবি হতে হবে; নয়তো একটি ফাইল নিন।');
  else if(m==='pdf_lib_missing') showToast('❌ PDF লাইব্রেরি লোড হয়নি। পাতা রিফ্রেশ করুন।');
  else if(m==='no_file') showToast('❌ কোনো ফাইল নেই।');
  else if(m==='image_load_error') showToast('❌ ছবি পড়া যায়নি।');
  else showToast('❌ ফাইল প্রস্তুত করা যায়নি!');
}
function showUploadSaveError(e){
  const m=String((e && e.message) || '');
  if(m==='file_too_large') showToast('❌ ফাইল ১০ MB এর বেশি!');
  else if(m==='storage_full') showToast('❌ স্টোরেজ পূর্ণ! পুরনো ফাইল মুছুন।');
  else if(m==='invalid_pin'||m.includes('invalid_pin')) showToast('❌ সেশন মেয়াদ শেষ — আবার লগইন করে চেষ্টা করুন।');
  else if(m.includes('invalid_credentials')) showToast('❌ লগইন তথ্য ভুল — আবার লগইন করুন।');
  else { console.error('upload failed:', e); showToast('❌ আপলোড ব্যর্থ! ইন্টারনেট চেক করে আবার চেষ্টা করুন।'); }
}

// ══ Custom confirm/prompt modals (replace native confirm()/prompt()) ══
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
let _promptModalCb=null;
function showPrompt(title,defVal=''){
  return new Promise(resolve=>{
    _promptModalCb=resolve;
    document.getElementById('promptModalTitle').textContent=title;
    const inp=document.getElementById('promptModalInput');
    inp.value=defVal;
    openModal('promptModal');
    setTimeout(()=>{ inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); },300);
  });
}
function _promptModalResolve(ok){
  const inp=document.getElementById('promptModalInput');
  const val=inp.value;
  closeModal('promptModal');
  if(_promptModalCb){ const cb=_promptModalCb; _promptModalCb=null; cb(ok?val:null); }
}

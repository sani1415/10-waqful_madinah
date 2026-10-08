/* Waqful Madinah — js/student/goals-notes.js: goals + daily notes (বিবরণ) */
// ══ GOALS + DAILY NOTES ════════════════════════════════════
const _goalCatLbl={ilm:'ইলম',amal:'আমল',akhlaq:'আখলাক',afkar:'আফকার',quran:'কুরআন',study:'ইলম',ibadah:'আমল',other:'অন্যান্য'};
const _svgGoalBook='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>';
const _svgGoalClip='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>';
const _svgGoalHeart='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
const _svgGoalBulb='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>';
const _svgGoalTarget='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
const _svgGoalCal='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const _svgGoalTrash='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/><path d="M10 11v6M14 11v6"/></svg>';
const _svgNoteTrash='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
const _svgNotePencil='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
function catIc(c){
  const map={ilm:_svgGoalBook,study:_svgGoalBook,amal:_svgGoalClip,ibadah:_svgGoalClip,akhlaq:_svgGoalHeart,afkar:_svgGoalBulb,quran:_svgGoalBook,other:_svgGoalTarget};
  return `<span class="goal-meta-ic" aria-hidden="true">${map[c]||_svgGoalTarget}</span>`;
}
function getDailyNotes(){
  if(!me||!API.StudentNotes) return [];
  return API.StudentNotes.getAll(me.id).filter(n=>!isWeeklyReceiptNote(n));
}
function isWeeklyReceiptNote(n){
  return /^সাপ্তাহিক আমল:/.test(String(n&&n.title||'')) || /^সাপ্তাহিক আমল জমা/.test(String(n&&n.text||''));
}
function dailyNoteDateLabel(date){
  if(!date) return '';
  try{ return new Date(date+'T12:00:00Z').toLocaleDateString('bn-BD',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'}); }catch(e){ return date; }
}
function renderDailyNoteFilter(){
  const el=document.getElementById('dailyNoteFilter');
  if(!el||!API.StudentNotes) return;
  const items=[{id:'all',label:'সব'}].concat(API.StudentNotes.getCategories());
  el.innerHTML=items.map(c=>`<button type="button" class="daily-note-filter-opt${dailyNoteListFilter===c.id?' active':''}" onclick="setDailyNoteFilter('${esc(c.id)}')">${esc(c.label)}</button>`).join('');
  const lbl=document.getElementById('dailyNoteFilterLabel');
  const active=items.find(c=>c.id===dailyNoteListFilter)||items[0];
  if(lbl) lbl.textContent=active.label;
}
function toggleDailyNoteFilterMenu(btn){
  const menu=document.getElementById('dailyNoteFilter');
  if(!menu) return;
  const open=menu.classList.contains('open');
  closeDailyNoteFilterMenu();
  if(!open){ menu.classList.add('open'); btn.classList.add('open'); }
}
function closeDailyNoteFilterMenu(){
  const menu=document.getElementById('dailyNoteFilter');
  const btn=document.querySelector('.daily-note-filter-btn');
  if(menu) menu.classList.remove('open');
  if(btn) btn.classList.remove('open');
}
function setDailyNoteFilter(id){
  dailyNoteListFilter=id||'all';
  closeDailyNoteFilterMenu();
  renderDailyNotes();
}
function renderDailyNoteCats(){
  const el=document.getElementById('dailyNoteCatSelect');
  if(!el||!API.StudentNotes) return;
  const cats=API.StudentNotes.getCategories();
  if(!cats.some(c=>c.id===dailyNoteCatId)) dailyNoteCatId='general';
  el.innerHTML=cats.map(c=>`<option value="${esc(c.id)}"${c.id===dailyNoteCatId?' selected':''}>${esc(c.label)}</option>`).join('');
  el.value=dailyNoteCatId;
}
function dailyNotePreview(n){
  const t=String((n&&n.title)||'').trim();
  if(t) return t;
  const body=String((n&&n.text)||'').replace(/\s+/g,' ').trim();
  return body||'—';
}
function renderDailyNotes(){
  const el=document.getElementById('dailyNoteList');
  if(!el||!me) return;
  renderDailyNoteFilter();
  const notes=getDailyNotes();
  const filtered=dailyNoteListFilter==='all'?notes:notes.filter(n=>(n.categoryId||'general')===dailyNoteListFilter);
  if(!filtered.length){
    el.innerHTML=`<div class="empty-state"><div class="icon goal-empty-ic" aria-hidden="true">${_svgGoalClip}</div><p>এখনো কোনো বিবরণ নেই।<br>উপরে নতুন নোট থেকে শুরু করুন।</p></div>`;
    return;
  }
  el.innerHTML=filtered.map(n=>{
    const catLbl=API.StudentNotes?API.StudentNotes.catLabel(n.categoryId||'general'):'সাধারণ';
    const locked=n.reviewStatus==='done';
    const actions=locked?'':`<div class="daily-note-actions">
          <button type="button" class="daily-note-act-btn edit" onclick="openDailyNoteEdit('${esc(n.id)}')" title="সম্পাদনা" aria-label="সম্পাদনা"><span class="ic-svg">${_svgNotePencil}</span></button>
          <button type="button" class="daily-note-act-btn del" onclick="deleteDailyNote('${esc(n.id)}')" title="মুছুন" aria-label="মুছুন"><span class="ic-svg">${_svgNoteTrash}</span></button>
        </div>`;
    return `<div class="daily-note-item">
    <div class="daily-note-main">
      <div class="daily-note-head-row">
        <div class="daily-note-date">${esc(dailyNoteDateLabel(n.date))}</div>
        <div class="daily-note-meta">
          <span class="daily-note-cat-badge">${esc(catLbl)}</span>
          ${!locked?'<span class="daily-note-pending-badge">পর্যালোচনাধীন</span>':''}
          <span class="daily-note-time">${esc(n.time||'')}</span>
        </div>
      </div>
      <div class="daily-note-title-row">
        <span class="daily-note-title-preview">${esc(dailyNotePreview(n))}</span>
        ${actions}
      </div>
    </div>
  </div>`;
  }).join('');
}
function formatDailyTimer(sec){
  const m=String(Math.floor(sec/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return m+':'+s;
}
function setDailyRecorderState(state){
  const timer=document.getElementById('dailyRecordTimer');
  if(timer){
    timer.textContent=formatDailyTimer(dailyNoteSecondsLeft);
    timer.classList.toggle('is-live',state==='recording');
    timer.style.display=state==='recording'?'block':'none';
  }
}
function updateDailyNoteSaveState(){
  const btn=document.getElementById('dailyNoteSaveBtn');
  const txt=document.getElementById('dailyNoteText');
  const busy=typeof VoiceType!=='undefined'&&VoiceType.isBusy();
  if(btn&&txt) btn.disabled=!txt.value.trim()||busy;
}
function ensureDailyVoice(){
  if(_dailyVoiceBound||typeof VoiceType==='undefined') return;
  VoiceType.bind({
    id:'daily',
    micBtn:'#dailyRecordBtn',
    target:'#dailyNoteText',
    timerEl:'#dailyRecordTimer',
    timerMode:'countdown',
    join:'newline',
    maxSeconds:120,
    idleTitle:'রেকর্ড শুরু করুন',
    onTick:function(left){
      dailyNoteSecondsLeft=left;
    },
    onState:function(state,extra){
      if(state==='recording'){
        dailyNoteSecondsLeft=120;
        setDailyRecorderState('recording');
      } else if(state==='busy'){
        setDailyRecorderState('idle');
      } else if(state==='ready'){
        dailyNoteSecondsLeft=120;
        setDailyRecorderState('idle');
      } else {
        if(extra&&extra.error){
          const msg=extra.error==='permission'?'মাইক অনুমতি দিন'
            :extra.error==='unsupported'?'মাইক নেই — হাতে লিখুন'
            :extra.error==='recorder'||extra.error==='start'?'রেকর্ড শুরু হয়নি'
            :'ট্রান্সক্রিপশন ব্যর্থ — আবার চেষ্টা করুন';
          if(typeof showToast==='function') showToast(msg);
        }
        dailyNoteSecondsLeft=120;
        setDailyRecorderState('idle');
      }
      updateDailyNoteSaveState();
    },
    onAppend:function(){ updateDailyNoteSaveState(); }
  });
  _dailyVoiceBound=true;
}
function toggleDailyRecording(){
  ensureDailyVoice();
  if(typeof VoiceType!=='undefined') VoiceType.toggle('daily');
}
function stopDailyRecording(run){
  if(typeof VoiceType!=='undefined') VoiceType.stop('daily', !!run);
}
function openDailyNoteModal(forceCfg,forceLastDate){
  ensureDailyVoice();
  stopDailyRecording(false);
  dailyNoteEditId=null;
  dailyNoteSecondsLeft=120;
  dailyNoteForced=!!forceCfg;
  dailyNoteCatId=forceCfg?(forceCfg.categoryId||'general'):'general';
  const title=document.getElementById('dailyNoteModalTitle');
  if(title) title.textContent=dailyNoteForced?'পাক্ষিক বিবরণ (বাধ্যতামূলক)':'নতুন বিবরণ';
  const titleIn=document.getElementById('dailyNoteTitle');
  if(titleIn) titleIn.value='';
  const txt=document.getElementById('dailyNoteText');
  if(txt){
    txt.value='';
    const lastLine=forceLastDate?`(সর্বশেষ বিবরণ: ${forceLastDate})`:'(এখনও কোনো পাক্ষিক বিবরণ জমা দেননি)';
    txt.placeholder=dailyNoteForced
      ? (forceCfg.questions&&forceCfg.questions.length
          ? 'এই প্রশ্নগুলোর আলোকে লিখুন:\n'+forceCfg.questions.map(q=>'• '+q.text).join('\n')+'\n\n'+lastLine
          : 'আজকের সার্বিক অবস্থা লিখুন (আমল, পড়ালেখা, সমস্যা — যা মনে হয়)\n\n'+lastLine)
      : 'এখানে লিখুন, অথবা মাইকে বলে ট্রান্সক্রিপশন নিন…';
  }
  renderDailyNoteCats();
  const catSel=document.getElementById('dailyNoteCatSelect');
  if(catSel) catSel.disabled=dailyNoteForced;
  const cancelBtn=document.getElementById('dailyNoteCancelBtn');
  if(cancelBtn) cancelBtn.textContent=dailyNoteForced?'লগ-আউট':'বাতিল';
  setDailyRecorderState('idle');
  updateDailyNoteSaveState();
  openModal('dailyNoteModal');
}
function openDailyNoteEdit(noteId){
  if(!me||!API.StudentNotes||!noteId) return;
  const note=API.StudentNotes.get(me.id, noteId);
  if(!note){ showToast('নোট পাওয়া যায়নি'); return; }
  if(note.reviewStatus==='done'){ showToast('শিক্ষক পর্যালোচনা করে ফেলেছেন — এখন এডিট করা যাবে না'); return; }
  ensureDailyVoice();
  stopDailyRecording(false);
  dailyNoteForced=false;
  dailyNoteEditId=note.id;
  dailyNoteSecondsLeft=120;
  dailyNoteCatId=note.categoryId||'general';
  const title=document.getElementById('dailyNoteModalTitle');
  if(title) title.textContent='বিবরণ সম্পাদনা';
  const titleIn=document.getElementById('dailyNoteTitle');
  if(titleIn) titleIn.value=note.title||'';
  const txt=document.getElementById('dailyNoteText');
  if(txt){ txt.value=note.text||''; txt.placeholder='এখানে লিখুন, অথবা মাইকে বলে ট্রান্সক্রিপশন নিন…'; }
  renderDailyNoteCats();
  const catSel=document.getElementById('dailyNoteCatSelect');
  if(catSel) catSel.disabled=false;
  const cancelBtn=document.getElementById('dailyNoteCancelBtn');
  if(cancelBtn) cancelBtn.textContent='বাতিল';
  setDailyRecorderState('idle');
  updateDailyNoteSaveState();
  openModal('dailyNoteModal');
}
function closeDailyNoteModal(){
  if(dailyNoteForced) return;
  stopDailyRecording(false);
  dailyNoteEditId=null;
  closeModal('dailyNoteModal');
}
function dailyNoteCancelClick(){
  if(dailyNoteForced){ logout(); return; }
  closeDailyNoteModal();
}
async function saveDailyNote(){
  const txt=document.getElementById('dailyNoteText');
  const text=(txt?.value||'').trim();
  const title=(document.getElementById('dailyNoteTitle')?.value||'').trim();
  if(!text){ showToast('নোট লিখুন বা রেকর্ড করুন'); return; }
  if(!me||!API.StudentNotes){ showToast('সেভ ব্যর্থ'); return; }
  stopDailyRecording(false);
  const btn=document.getElementById('dailyNoteSaveBtn');
  if(btn) btn.disabled=true;
  const wasForced=dailyNoteForced;
  try{
    if(dailyNoteEditId){
      await API.StudentNotes.update(me.id, dailyNoteEditId, {text, title, categoryId:dailyNoteCatId||'general'});
    } else {
      await API.StudentNotes.add(me.id,{text, title, categoryId:dailyNoteCatId||'general'});
    }
    dailyNoteForced=false;
    closeDailyNoteModal();
    renderDailyNotes();
    showToast(wasForced?'✅ পাক্ষিক বিবরণ জমা হয়েছে':'বিবরণ সেভ হয়েছে');
  }catch(e){
    console.error(e);
    showToast(e.message==='note_locked'?'শিক্ষক পর্যালোচনা করে ফেলেছেন — এখন এডিট করা যাবে না':'সেভ হয়নি — আবার চেষ্টা করুন');
    updateDailyNoteSaveState();
  }
}
async function deleteDailyNote(id){
  if(!me||!API.StudentNotes) return;
  const note=API.StudentNotes.get(me.id,id);
  if(note&&note.reviewStatus==='done'){ showToast('শিক্ষক পর্যালোচনা করে ফেলেছেন — এখন ডিলিট করা যাবে না'); return; }
  const ok=await showConfirm('এই বিবরণটি মুছে ফেলবেন?',{title:'বিবরণ মুছুন',okText:'মুছে ফেলুন',danger:true});
  if(!ok) return;
  try{
    await API.StudentNotes.delete(me.id,id);
    renderDailyNotes();
    showToast('বিবরণ মুছে ফেলা হয়েছে');
  }catch(e){
    console.error(e);
    showToast(e.message==='note_locked'?'শিক্ষক পর্যালোচনা করে ফেলেছেন — এখন ডিলিট করা যাবে না':'মুছা যায়নি');
  }
}
function renderGoals(){
  const goals=API.Goals.getAll(me.id); const el=document.getElementById('goalList'); const wp=document.getElementById('goalProgress');
  const total=goals.length; const done=goals.filter(g=>g.done).length; const pct=total?Math.round(done/total*100):0;
  wp.innerHTML=total?`<div style="margin:12px 12px 0"><div class="goal-progress-wrap"><div class="goal-progress-label"><span class="goal-prog-title"><span class="goal-meta-ic" aria-hidden="true">${_svgGoalTarget}</span>আমার লক্ষ্য</span><span>${done}/${total} (${pct}%)</span></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${pct}%"></div></div></div></div>`:'' ;
  const filtered=gFilter==='all'?goals:goals.filter(g=>g.cat===gFilter);
  if(!filtered.length){ el.innerHTML=`<div class="empty-state"><div class="icon goal-empty-ic" aria-hidden="true">${_svgGoalTarget}</div><p>কোনো লক্ষ্য নেই।<br>উপরে বাটন দিয়ে যোগ করুন।</p></div>`; return; }
  const active=filtered.filter(g=>!g.done); const comp=filtered.filter(g=>g.done);
  let h='';
  if(active.length){ h+='<div class="goal-section">চলমান লক্ষ্য</div>'; h+=active.map(g=>gItem(g)).join(''); }
  if(comp.length)  { h+='<div class="goal-section" style="margin-top:8px">সম্পন্ন লক্ষ্য</div>'; h+=comp.map(g=>gItem(g)).join(''); }
  el.innerHTML=h;
}
function gItem(g){
  const catLbl=_goalCatLbl[g.cat]||g.cat||'';
  const dl=g.deadline?`<span class="goal-meta-ic" aria-hidden="true">${_svgGoalCal}</span>${esc(g.deadline)}`:'';
  return `<div class="goal-item"><div class="goal-check ${g.done?'done':''}" onclick="toggleGoal('${g.id}')"></div><div style="flex:1"><div class="goal-text ${g.done?'done':''}">${esc(g.title)}</div><div class="goal-meta">${catIc(g.cat)} ${esc(catLbl)}${dl?' · '+dl:''}${g.note?' · '+esc(g.note):''}</div></div><button type="button" class="goal-del" onclick="delGoal('${g.id}')" title="মুছুন" aria-label="মুছুন">${_svgGoalTrash}</button></div>`;
}
function fGoal(f,btn){ document.querySelectorAll('#screen-goals .filter-chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); gFilter=f; renderGoals(); }
async function addGoalModal(){ const t=document.getElementById('gm_title').value.trim(); if(!t){ showToast('লক্ষ্যের বিবরণ লিখুন!'); return; } try{ await API.Goals.add(me.id,{title:t,cat:document.getElementById('gm_cat').value,deadline:document.getElementById('gm_dl').value,note:document.getElementById('gm_note').value.trim()}); closeModal('addGoalModal'); ['gm_title','gm_note'].forEach(id=>document.getElementById(id).value=''); document.getElementById('gm_dl').value=''; renderGoals(); showToast('লক্ষ্য যোগ হয়েছে'); }catch(e){ console.error(e); showToast('লক্ষ্য সেভ হয়নি'); } }
async function toggleGoal(id){ try{ const g=await API.Goals.toggle(me.id,id); renderGoals(); if(g?.done) showToast('مَا شَاءَ اللّٰه! লক্ষ্য সম্পন্ন'); }catch(e){ console.error(e); showToast('লক্ষ্য আপডেট হয়নি'); } }
async function delGoal(id){
  const ok=await showConfirm('এই লক্ষ্যটি মুছে ফেলবেন?',{title:'লক্ষ্য মুছুন',okText:'মুছে ফেলুন',danger:true});
  if(!ok) return;
  try{ await API.Goals.delete(me.id,id); renderGoals(); showToast('লক্ষ্য মুছে ফেলা হয়েছে'); }catch(e){ console.error(e); showToast('লক্ষ্য মোছা যায়নি'); }
}

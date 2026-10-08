/* Waqful Madinah — js/teacher/diary.js: teacher diary */
// ── Diary ──────────────────────────────────────────────────
function openDiary(){ goTab('diary'); }
function closeDiary(){ if(curTab==='diary') goTab(_headerBackTab()); }
function diaryDateLabel(iso){
  if(!iso) return '';
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if(m){
    const d=Number(m[3]), mo=Number(m[2]), yy=String(m[1]).slice(-2);
    return d+'/'+mo+'/'+yy;
  }
  try{
    const dt=new Date(iso+'T12:00:00Z');
    if(!isNaN(dt.getTime())) return dt.getUTCDate()+'/'+(dt.getUTCMonth()+1)+'/'+String(dt.getUTCFullYear()).slice(-2);
  }catch(_){}
  return String(iso);
}
function diaryPreview(e){
  const t=String((e&&e.title)||'').trim();
  if(t) return t;
  const body=String((e&&e.text)||'').replace(/\s+/g,' ').trim();
  return body||'—';
}
function renderDiaryList(){
  const entries=API.Diary.getAll();
  const sub=document.getElementById('diaryHdSub');
  if(sub) sub.textContent=entries.length?entries.length+'টি':'';
  const el=document.getElementById('diaryList');
  if(!el) return;
  if(!entries.length){ el.innerHTML='<div style="text-align:center;padding:60px 20px;color:#94a3b8;font-size:14px">কোনো এন্ট্রি নেই।<br>＋ নতুন বাটনে লিখুন।</div>'; return; }
  el.innerHTML=entries.map(e=>`
    <div class="diary-entry-card">
      <div class="diary-entry-main">
        <span class="diary-entry-date">${esc(diaryDateLabel(e.date))}</span>
        <span class="diary-entry-preview">${esc(diaryPreview(e))}</span>
      </div>
      <div class="diary-entry-actions">
        <button type="button" class="diary-act-btn edit" onclick="editDiaryEntry('${esc(e.id)}')" title="সম্পাদনা" aria-label="সম্পাদনা"><span class="ic-svg">${_svgPencil}</span></button>
        <button type="button" class="diary-act-btn del" onclick="deleteDiaryEntry('${esc(e.id)}')" title="মুছুন" aria-label="মুছুন"><span class="ic-svg">${_svgTrash}</span></button>
      </div>
    </div>`).join('');
}
function formatDiaryTimer(sec){
  const m=String(Math.floor(sec/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return m+':'+s;
}
let _diaryVoiceBound=false;
let diaryVoiceSecondsLeft=120;
function setDiaryRecorderState(state){
  const timer=document.getElementById('diaryRecordTimer');
  if(timer){
    timer.textContent=formatDiaryTimer(diaryVoiceSecondsLeft);
    timer.classList.toggle('is-live',state==='recording');
    timer.style.display=state==='recording'?'block':'none';
  }
}
function updateDiarySaveState(){
  const btn=document.getElementById('diarySaveBtn');
  const txt=document.getElementById('diaryEntryText');
  const titleEl=document.getElementById('diaryEntryTitle');
  const busy=typeof VoiceType!=='undefined'&&VoiceType.isBusy();
  const has=(txt&&txt.value.trim())||(titleEl&&titleEl.value.trim());
  if(btn) btn.disabled=!has||busy;
}
function ensureDiaryVoice(){
  if(_diaryVoiceBound||typeof VoiceType==='undefined') return;
  VoiceType.bind({
    id:'diary',
    micBtn:'#diaryRecordBtn',
    target:'#diaryEntryText',
    timerEl:'#diaryRecordTimer',
    timerMode:'countdown',
    join:'newline',
    maxSeconds:120,
    idleTitle:'রেকর্ড শুরু করুন',
    onTick:function(left){ diaryVoiceSecondsLeft=left; },
    onState:function(state,extra){
      if(state==='recording'){
        diaryVoiceSecondsLeft=120;
        setDiaryRecorderState('recording');
      } else if(state==='busy'){
        setDiaryRecorderState('idle');
      } else if(state==='ready'){
        diaryVoiceSecondsLeft=120;
        setDiaryRecorderState('idle');
      } else {
        if(extra&&extra.error){
          const msg=extra.error==='permission'?'মাইক অনুমতি দিন'
            :extra.error==='unsupported'?'মাইক নেই — হাতে লিখুন'
            :extra.error==='recorder'||extra.error==='start'?'রেকর্ড শুরু হয়নি'
            :'ট্রান্সক্রিপশন ব্যর্থ — আবার চেষ্টা করুন';
          showToast(msg);
        }
        diaryVoiceSecondsLeft=120;
        setDiaryRecorderState('idle');
      }
      updateDiarySaveState();
    },
    onAppend:function(){ updateDiarySaveState(); }
  });
  _diaryVoiceBound=true;
}
function toggleDiaryRecording(){
  ensureDiaryVoice();
  if(typeof VoiceType!=='undefined') VoiceType.toggle('diary');
}
function stopDiaryRecording(run){
  if(typeof VoiceType!=='undefined') VoiceType.stop('diary', !!run);
}
function closeDiaryEntryModal(){
  stopDiaryRecording(false);
  closeModal('diaryEntryModal');
}
function openDiaryEntryModal(id){
  ensureDiaryVoice();
  stopDiaryRecording(false);
  diaryVoiceSecondsLeft=120;
  document.getElementById('diaryEditingId').value=id||'';
  document.getElementById('diaryModalTitle').textContent=id?'ডায়েরি সম্পাদনা':'নতুন ডায়েরি';
  const titleEl=document.getElementById('diaryEntryTitle');
  if(id){
    const e=API.Diary.getAll().find(x=>x.id===id);
    document.getElementById('diaryEntryDate').value=e?.date||API.today();
    if(titleEl) titleEl.value=e?.title||'';
    document.getElementById('diaryEntryText').value=e?.text||'';
  } else {
    document.getElementById('diaryEntryDate').value=API.today();
    if(titleEl) titleEl.value='';
    document.getElementById('diaryEntryText').value='';
  }
  setDiaryRecorderState('idle');
  updateDiarySaveState();
  openModal('diaryEntryModal');
}
function editDiaryEntry(id){ openDiaryEntryModal(id); }
async function saveDiaryEntry(){
  stopDiaryRecording(false);
  const id=document.getElementById('diaryEditingId').value;
  const text=document.getElementById('diaryEntryText').value.trim();
  const title=(document.getElementById('diaryEntryTitle')?.value||'').trim();
  const date=document.getElementById('diaryEntryDate').value;
  if(!text&&!title){ showToast('⚠️ কিছু লিখুন'); return; }
  const btn=document.getElementById('diarySaveBtn');
  if(btn) btn.disabled=true;
  try{
    if(id) await API.Diary.update(id,text||title,date,title);
    else await API.Diary.add(text||title,date,title);
  }catch(e){ console.error(e); showToast('❌ ডায়েরি সেভ হয়নি'); updateDiarySaveState(); return; }
  closeModal('diaryEntryModal');
  renderDiaryList();
  showToast('✅ ডায়েরি সেভ হয়েছে');
}
async function deleteDiaryEntry(id){
  const ok=await showConfirm('এই ডায়েরি মুছে ফেলবেন?',{title:'ডায়েরি মুছুন',okText:'মুছে ফেলুন',danger:true});
  if(!ok) return;
  try{ await API.Diary.delete(id); }
  catch(e){ console.error(e); showToast('❌ এন্ট্রি মোছা যায়নি'); return; }
  renderDiaryList();
  showToast('🗑 মুছে ফেলা হয়েছে');
}

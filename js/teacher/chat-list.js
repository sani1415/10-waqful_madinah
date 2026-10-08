/* Waqful Madinah — js/teacher/chat-list.js: chat list + in-chat search */
// ══ CHAT LIST ══════════════════════════════════════════════
let _globalMsgSearchTimer=null;
function hideGlobalMsgSearchResults(){
  const box=document.getElementById('globalMsgSearchResults');
  if(box){ box.style.display='none'; box.innerHTML=''; }
}
function onGlobalMsgSearchInput(v){
  clearTimeout(_globalMsgSearchTimer);
  const box=document.getElementById('globalMsgSearchResults');
  if(!box) return;
  const q=String(v||'').trim();
  if(biboronDetailMode) showBiboronDetail('');
  if(!q){ hideGlobalMsgSearchResults(); renderChatList(''); return; }
  // Always filter chat list by name/waqf
  renderChatList(q);
  // Also search message content after short debounce
  _globalMsgSearchTimer=setTimeout(()=>{
    const rows=API.Messages.searchAllChats(q,{limit:50});
    if(!rows.length){ hideGlobalMsgSearchResults(); return; }
    box.innerHTML=`<div class="gms-section-hd">💬 মেসেজ ফলাফল</div>`+rows.map(r=>{
      const waqf=r.waqfShort?`<span class="gms-waqf">${esc(r.waqfShort)}</span>`:'';
      const kind=r.kind==='doc'?'📎':r.kind==='task'?'📋':'💬';
      return `<button type="button" class="global-msg-search-item" data-tid="${esc(r.threadId)}" data-mid="${esc(r.messageId)}" onclick="openChatFromGlobalSearch(this.dataset.tid,this.dataset.mid)"><div class="gms-line1"><span class="gms-kind">${kind}</span><span class="gms-name">${esc(r.studentLabel)}</span>${waqf}<span class="gms-time">${esc(r.time)}</span></div><div class="gms-snippet">${esc(r.snippet)}</div></button>`;
    }).join('');
    box.style.display='block';
  },300);
}
// ══ IN-CHAT SEARCH (teacher) ════════════════════════════════
let _icsMatches=[], _icsIdx=-1, _icsQuery='';
function toggleInChatSearch(){
  const bar=document.getElementById('inChatSearchBar');
  if(bar.classList.contains('open')){ closeInChatSearch(); }
  else { bar.classList.add('open'); document.getElementById('inChatSearchIn').focus(); }
}
function closeInChatSearch(){
  _icsQuery=''; _icsMatches=[]; _icsIdx=-1;
  const bar=document.getElementById('inChatSearchBar');
  bar.classList.remove('open');
  const inp=document.getElementById('inChatSearchIn'); if(inp) inp.value='';
  _icsUpdateCounter();
  // re-render without highlights
  if(curChat) renderMsgs(curChat);
}
function _icsUpdateCounter(){
  const el=document.getElementById('icsCounter');
  const prev=document.getElementById('icsPrev');
  const next=document.getElementById('icsNext');
  if(!el) return;
  if(!_icsMatches.length){ el.textContent=_icsQuery?'০':''; }
  else { el.textContent=`${_icsIdx+1}/${_icsMatches.length}`; }
  if(prev) prev.disabled=_icsMatches.length<2;
  if(next) next.disabled=_icsMatches.length<2;
}
function onInChatSearch(v){
  _icsQuery=String(v||'').trim();
  _icsMatches=[]; _icsIdx=-1;
  if(curChat) renderMsgs(curChat); // re-render with highlights
  if(!_icsQuery){ _icsUpdateCounter(); return; }
  // collect match elements after render
  requestAnimationFrame(()=>{
    _icsMatches=[...document.querySelectorAll('#chatMsgs mark.msg-hl')];
    if(_icsMatches.length){ _icsIdx=0; _icsScrollTo(0); }
    _icsUpdateCounter();
  });
}
function inChatNav(dir){
  if(!_icsMatches.length) return;
  _icsIdx=(_icsIdx+dir+_icsMatches.length)%_icsMatches.length;
  _icsScrollTo(_icsIdx);
  _icsUpdateCounter();
}
function _icsScrollTo(i){
  const el=_icsMatches[i]; if(!el) return;
  // highlight active match differently
  _icsMatches.forEach((m,j)=>m.classList.toggle('msg-hl-active',j===i));
  el.scrollIntoView({behavior:'smooth',block:'center'});
}
function _icsHighlight(text, query){
  if(!query) return esc(text);
  const safe=esc(text);
  const safeQ=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return safe.replace(new RegExp('('+safeQ+')','gi'),'<mark class="msg-hl">$1</mark>');
}

function openChatFromGlobalSearch(threadId,mid){
  // grab keyword before clearing global search
  const gInp=document.getElementById('globalMsgSearchIn');
  const kw=gInp?gInp.value.trim():'';
  hideGlobalMsgSearchResults();
  if(gInp){ gInp.value=''; gInp.blur(); }
  renderChatList('');
  toggleSearch(false);
  openChat(threadId);
  // after chat renders, open in-chat search with keyword and jump to the clicked message
  setTimeout(()=>{
    if(kw){
      _icsQuery=kw;
      const bar=document.getElementById('inChatSearchBar');
      if(bar) bar.classList.add('open');
      const sInp=document.getElementById('inChatSearchIn');
      if(sInp) sInp.value=kw;
      if(curChat) renderMsgs(curChat);
      // double rAF: let browser paint the new HTML before we query marks
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        _icsMatches=[...document.querySelectorAll('#chatMsgs mark.msg-hl')];
        if(!_icsMatches.length){ _icsUpdateCounter(); return; }
        // find match inside the clicked message; fallback → first
        const targetWrap=document.querySelector(`#chatMsgs .msg-wrap[data-mid="${CSS.escape(mid)}"]`);
        let idx=0;
        if(targetWrap){
          const inTarget=targetWrap.querySelector('mark.msg-hl');
          if(inTarget){ const i=_icsMatches.indexOf(inTarget); if(i>=0) idx=i; }
        }
        _icsIdx=idx;
        _icsScrollTo(_icsIdx);   // sets .msg-hl-active immediately
        _icsUpdateCounter();
      }));
    } else {
      scrollToMsg(mid);
    }
  },200);
}

function renderGrpSection(){
  const groups=API.Groups.getAll();
  let h=`<div class="grp-section-hd">গ্রুপ <button class="grp-new-btn" onclick="openGrpModal(null)">＋ নতুন</button></div>`;
  if(!groups.length){ h+=`<div style="padding:8px 14px 6px;font-size:13px;color:#94a3b8">কোনো গ্রুপ নেই।</div>`; return h; }
  groups.forEach(g=>{
    const stus=API.Students.getAll().filter(s=>g.studentIds.includes(s.id));
    const preview=stus.slice(0,3).map(s=>s.name.split(' ')[0]).join(', ')+(stus.length>3?` +${stus.length-3}`:'');
    h+=`<div class="grp-item" onclick="openGrpPanel('${g.id}')">
      <div class="grp-avatar"><span class="ic-svg">${_svgTag}</span></div>
      <div class="grp-info">
        <div class="grp-name">${esc(g.name)}</div>
        <div class="grp-sub">${stus.length} জন${preview?' · '+esc(preview):''}</div>
      </div>
      <button class="grp-edit-btn" onclick="event.stopPropagation();openGrpModal('${g.id}')" title="সম্পাদনা" aria-label="সম্পাদনা"><span class="ic-svg">${_svgPencil}</span></button>
    </div>`;
  });
  return h;
}
function renderChatList(f=''){
  const msgTs=s=>{ const m=API.Messages.getThread(s.id); if(!m.length) return 0; const last=m[m.length-1]; return last._ts||parseInt(last.id.slice(1))||0; };
  const students=API.Students.getAll()
    .filter(s=>API.Students.matchesSearchQuery(s, f))
    .sort((a,b)=>msgTs(b)-msgTs(a));
  let h='';
  if(!f) h+=renderGrpSection();
  students.forEach(s=>{
    const msgs=API.Messages.getThread(s.id); const last=msgs[msgs.length-1];
    const ur=API.Messages.unreadCount(s.id,'in'); // messages from student (teacher hasn't read)
    // For teacher's outgoing messages: show ✓ if student hasn't seen, ✓✓ if seen
    let tickPrefix='';
    if(last?.role==='out'){
      tickPrefix=last.read?'<span style="color:#25D366;font-size:13px">✓✓</span> ':'<span style="color:var(--gray-400);font-size:13px">✓</span> ';
    }
    const previewText=last&&last.type!=='doc'?String(last.text||'').replace(/\s+/g,' ').trim().slice(0,40):'';
    const preview=last?(tickPrefix+(last.type==='doc'?`<span class="ic-svg" style="vertical-align:-2px">${_svgClip}</span> ${esc(String(last.fileName||last.text||'').replace(/\s+/g,' ').trim())}`:esc(previewText))):esc(s.cls||'নতুন');
    // Badge: green = student sent a message teacher hasn't read yet
    let badgeHtml='';
    if(ur) badgeHtml+=`<span class="chat-badge">${ur}</span>`;
    if(API.DailySchedule&&API.DailySchedule.hasPendingApproval(s.id))
      badgeHtml+=`<span class="chat-badge chat-badge--sched" title="সময়সূচি অনুমোদনের অপেক্ষায়"><span class="ic-svg">${_svgCal}</span></span>`;
    h+=`<div class="chat-item" onclick="openChat('${s.id}')">${pctAvatarHtml(s.id,'chat-avatar')}<div class="chat-body"><div class="chat-row1"><span class="chat-name-wrap"><span class="chat-name">${esc(s.name)}</span>${s.waqfId?`<span class="chat-waqf">· ${esc(API.Students.displayWaqfId(s.waqfId))}</span>`:''}${s.responsibility?`<span style="font-size:10px;font-weight:700;color:#E65100;background:#FFF3E0;border-radius:5px;padding:1px 5px;flex-shrink:0">${esc(s.responsibility)}</span>`:''}</span><span class="chat-time">${last?.time||''}</span></div><div class="chat-row2"><span class="chat-preview">${preview}</span>${badgeHtml}</div></div></div>`;
  });
  // সবাইকে বার্তা — সবসময় তালিকার নিচে
  if(!f){
    const bc=API.Messages.getThread('_bc'); const last=bc[bc.length-1];
    const rcpt=last&&_bcReadCounts[last.id];
    const rcptHtml=rcpt
      ? (rcpt.read_count<rcpt.total_count
          ? `<span style="font-size:11px;font-weight:700;background:#FFF3E0;color:#E65100;border-radius:8px;padding:1px 7px;margin-left:4px">${rcpt.read_count}/${rcpt.total_count} দেখেছেন</span>`
          : `<span style="font-size:11px;font-weight:700;background:#E8F5E9;color:#2E7D32;border-radius:8px;padding:1px 7px;margin-left:4px">সবাই দেখেছেন</span>`)
      : '';
    h+=`<div class="chat-item" onclick="openChat('_broadcast')"><div class="chat-avatar chat-avatar--bc"><span class="ic-svg">${_svgMegaphone}</span></div><div class="chat-body"><div class="chat-row1"><span class="chat-name">সবাইকে বার্তা</span><span class="chat-time">${last?.time||''}</span></div><div class="chat-row2"><span class="chat-preview">${esc(String(last?.text||'গ্রুপ বার্তা').replace(/\s+/g,' ').trim())}</span>${rcptHtml}</div></div></div>`;
  }
  document.getElementById('chatList').innerHTML=h||`<div class="empty-state"><div class="icon"><span class="ic-svg">${_svgChat}</span></div><p>ছাত্র যোগ করুন।</p></div>`;
}
function openChat(id, initialTab){
  uiViewTransition(()=>{
  document.getElementById('app').classList.add('in-chat');
  chatReturnTab=(curTab&&document.getElementById('screen-'+curTab))?curTab:'chats';
  if(initialTab!=='note') chatNoteView='teacher';
  curChat=id; teacherAmalEndDate=API.today(); const isBC=id==='_broadcast';
  const s=isBC?null:API.Students.getById(id);
  // Mark student messages as read — this triggers double-tick on student's side
  API.Messages.markRead(id==='_broadcast'?'_bc':id,'in');
  document.getElementById('backBtn').style.display='flex';
  const hAv=document.getElementById('hAvatar');
  if(hAv) hAv.style.display='flex';
  if(isBC){
    hAv.classList.remove('s-avatar-pct');
    hAv.style.removeProperty('--pct');
    setHeaderAvatarHtml(`<span class="ic-svg">${_svgMegaphone}</span>`,'#7B1FA2');
    hAv.classList.add('chat-avatar--bc');
  } else if(s){
    hAv.classList.remove('chat-avatar--bc');
    const prog=API.Tasks.getListProgress(s.id);
    const pct=Math.max(0,Math.min(100,prog.percent|0));
    setHeaderAvatarHtml(`<span>${pct}%</span>`,'#E0E0E0');
    hAv.classList.add('s-avatar-pct');
    hAv.style.setProperty('--pct',String(pct));
  }
  setChatHeaderTitle(isBC?'সবাইকে বার্তা':(s?.name||''));
  const headerMeta=s?[s.waqfId?API.Students.displayWaqfId(s.waqfId):null,API.Students.formatBatchYear(s.enrollmentDate)||null,s.responsibility||null,s.cls||null].filter(Boolean).join(' · '):'';
  setHeaderSub(isBC?`${API.Students.getAll().length} জন`:headerMeta);
  document.getElementById('fab').style.display='none';
  document.getElementById('searchToggleBtn').style.display='none';
  const _setBtn=document.getElementById('settingsToggleBtn'); if(_setBtn) _setBtn.style.display='none';
  document.getElementById('inChatSearchBtn').style.display='flex';
  document.getElementById('bcNotice').classList.toggle('show',isBC);
  // Student tabs — only for 1:1 chats
  const tabs=document.getElementById('chatStudentTabs');
  const attachBtn=document.getElementById('chatAttachBtn');
  if(!isBC){
    tabs.style.display='flex';
    attachBtn.style.display='flex';
    const tab=['info','msg','task','exam','doc','note'].includes(initialTab)?initialTab:'msg';
    switchChatTab(tab, document.getElementById('cst-'+tab));
  } else {
    tabs.style.display='none';
    attachBtn.style.display='none';
  }
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  document.getElementById('chatView').classList.add('open');
  renderMsgs(id);
  if(isBC && typeof RemoteSync!=='undefined' && RemoteSync.getBroadcastReadCounts){
    RemoteSync.getBroadcastReadCounts().then(rows=>{
      _bcReadCounts={};
      (rows||[]).forEach(r=>{ if(r.bc_id) _bcReadCounts[r.bc_id]={read_count:r.read_count||0,total_count:r.total_count||0}; });
      renderMsgs('_broadcast');
    });
  }
  setTimeout(()=>{ document.getElementById('chatMsgs').scrollTop=9e9; document.getElementById('msgIn').focus(); },50);
  });
}
function closeChat(){
  try{ if(typeof stopChatVoice==='function') stopChatVoice(false); }catch(e){}
  closeInChatSearch();
  uiViewTransition(()=>{
  const returnTab=(chatReturnTab&&document.getElementById('screen-'+chatReturnTab))?chatReturnTab:'chats';
  curChat=null; curChatTab='msg'; document.getElementById('chatView').classList.remove('open');
  const _schedStrip=document.getElementById('chatSchedulePendingStrip');
  if(_schedStrip){ _schedStrip.style.display='none'; _schedStrip.innerHTML=''; }
  document.getElementById('app').classList.remove('in-chat');
  var _tn=document.getElementById('teaBottomNav'); if(_tn) _tn.style.display='block'; document.getElementById('fab').style.display='flex';
  document.getElementById('backBtn').style.display='none';
  document.getElementById('searchToggleBtn').style.display='flex';
  const _setBtn2=document.getElementById('settingsToggleBtn'); if(_setBtn2) _setBtn2.style.display='flex';
  document.getElementById('inChatSearchBtn').style.display='none';
  const t=API.DB.getTeacher();
  setAppHeaderTitle(t.madrasa);
  const hAvClose=document.getElementById('hAvatar');
  if(hAvClose){
    hAvClose.classList.remove('s-avatar-pct','chat-avatar--bc');
    hAvClose.style.removeProperty('--pct');
    hAvClose.innerHTML='';
    hAvClose.style.display='none';
  }
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  curTab=returnTab;
  document.getElementById('screen-'+curTab).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  const tabBtn=document.getElementById('tab-'+curTab);
  if(tabBtn) tabBtn.classList.add('active');
  if(curTab==='chats'){ renderBiboronSummary(); renderChatList(''); }
  updateBadge();
  syncHeaderBtns();
  });
}
function fileIcon(type){ return fileIconSvg(type); }

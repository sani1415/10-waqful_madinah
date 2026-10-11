/* Waqful Madinah — js/teacher/more.js: «আরও» menu + পরিকল্পনা › «ঘোষণা ও গ্রুপ» pane */
const _MORE_IC={
  folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  diary:'<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4M2 6h4M2 10h4M2 14h4M2 18h4"/><path d="M21.4 5.6a2 2 0 1 0-2.8-2.8l-5.4 5.4L12 11l2.8-1.2Z"/>',
  ai:'<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  sliders:'<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  report:'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  save:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  mega:'<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  tag:'<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',
  chevR:'<path d="m9 18 6-6-6-6"/>',
};
function moreIcon(k){ return `<svg class="rd-i" viewBox="0 0 24 24" aria-hidden="true">${_MORE_IC[k]||''}</svg>`; }
function _moreRow(icon,tone,title,sub,onclick,count){
  return `<button type="button" class="rd-menu-row" onclick="${onclick}"><span class="rd-menu-ic ${tone}">${moreIcon(icon)}</span><span class="rd-menu-t"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</span>${count?`<span class="rd-cnt">${rdBn(count)}</span>`:''}${moreIcon('chevR')}</button>`;
}
const _SETTINGS_TITLES={profile:'প্রোফাইল ও পিন',biboron:'বিবরণ ও অগ্রগতি',backup:'ব্যাকআপ',more:'অন্যান্য'};
/** «আরও»-র সেটিংস সারি → নিচ থেকে ড্রয়ার (আলাদা ট্যাবওয়ালা স্ক্রিন নয়) */
function openSettingsPane(tab){
  const body=document.getElementById('settingsSheetBody'), sc=document.getElementById('settingsScroll');
  if(body&&sc&&sc.parentElement!==body) body.appendChild(sc);
  goSettingsTab(tab);
  const t=document.getElementById('settingsSheetTitle'); if(t) t.textContent=_SETTINGS_TITLES[settingsTab]||'সেটিংস';
  openModal('settingsSheet');
}

// ডায়েরি ও AI এখন টপ বারে — «আরও»-তে শুধু সেটিংস
function renderMore(){
  const el=document.getElementById('morePane'); if(!el) return;
  const pendingDocs=API.Docs.getAll().filter(d=>d.sentBy!=='teacher'&&d.reviewStatus==='pending').length;
  const t=API.DB.getTeacher();
  el.innerHTML=`
  <div class="rd-top"><div class="rd-date">${esc(t.name||'উস্তাদ')}</div><h1 class="rd-title">সেটিংস</h1></div>
  <div class="rd-card rd-menu">
    ${_moreRow('user','tone-sky','প্রোফাইল ও পিন','নাম, মাদরাসার নাম, জিম্মাদারের পিন',"openSettingsPane('profile')")}
    ${_moreRow('report','tone-sage','বিবরণ ও অগ্রগতি','হিসাবের সময়সীমা, ক্যাটাগরি, পাক্ষিক লক',"openSettingsPane('biboron')")}
    ${_moreRow('save','tone-plum','ব্যাকআপ','সব ডেটা ডাউনলোড বা ফিরিয়ে আনা',"openSettingsPane('backup')")}
    ${_moreRow('sliders','tone-sky','অন্যান্য','নোটিফিকেশন, ছাত্র প্যানেল, লগআউট',"openSettingsPane('more')")}
  </div>
  <div class="rd-bottom-space"></div>`;
}

function renderGroupsPane(){
  const el=document.getElementById('groupsPane'); if(!el) return;
  const bc=API.Messages.getThread('_bc'); const last=bc[bc.length-1];
  const rc=last&&_bcReadCounts[last.id];
  const seen=rc?(rc.read_count<rc.total_count?`${rdBn(rc.read_count)}/${rdBn(rc.total_count)} জন দেখেছে`:'সবাই দেখেছে'):'';
  const students=API.Students.getAll();
  const groups=API.Groups.getAll();
  el.innerHTML=`
  <div class="rd-card rd-ann">
    <div class="rd-ann-hd"><span class="rd-menu-ic tone-sky">${moreIcon('mega')}</span><div class="rd-who-t"><b>সবাইকে ঘোষণা</b><span>${rdBn(students.length)} জন ছাত্র পাবে</span></div></div>
    ${last?`<div class="rd-ann-last"><span class="rd-time">শেষ ঘোষণা · ${esc(last.time||'')}</span><p>${esc(String(last.text||last.fileName||'').slice(0,160))}</p>${seen?`<span class="rd-kind k-sched">${esc(seen)}</span>`:''}</div>`:'<div class="rd-empty">এখনো কোনো ঘোষণা পাঠানো হয়নি।</div>'}
    <div class="rd-acts"><button type="button" class="rd-btn ghost" onclick="openChat('_broadcast')">সব ঘোষণা</button><button type="button" class="rd-btn pri" onclick="openModal('bcModal')">${moreIcon('mega')}নতুন ঘোষণা</button></div>
  </div>
  <div class="rd-sec-h"><h4>গ্রুপ</h4><button type="button" onclick="openGrpModal(null)">＋ নতুন গ্রুপ</button></div>
  ${groups.length?`<div class="rd-card rd-menu">${groups.map(g=>{
    const mem=students.filter(s=>g.studentIds.includes(s.id));
    const preview=mem.slice(0,3).map(s=>s.name.split(' ')[0]).join(', ')+(mem.length>3?` +${rdBn(mem.length-3)}`:'');
    return `<div class="rd-menu-row" role="button" tabindex="0" onclick="openGrpPanel('${rdJs(g.id)}')"><span class="rd-menu-ic tone-sage">${moreIcon('tag')}</span><span class="rd-menu-t"><b>${esc(g.name)}</b><span>${rdBn(mem.length)} জন${preview?' · '+esc(preview):''}</span></span><button type="button" class="rd-pill" onclick="event.stopPropagation();openGrpModal('${rdJs(g.id)}')">সম্পাদনা</button></div>`;
  }).join('')}</div>`:`<div class="rd-card rd-empty-card"><p>নির্দিষ্ট কয়েকজনকে একসাথে বার্তা দিতে গ্রুপ বানান — যেমন «হিফজ ২য় বর্ষ»।</p><button type="button" class="rd-btn soft" onclick="openGrpModal(null)">${moreIcon('plus')}প্রথম গ্রুপ</button></div>`}
  <div class="rd-bottom-space"></div>`;
}

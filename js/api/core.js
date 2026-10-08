/* Waqful Madinah · js/api/core.js — shared data helpers, storage, Auth, DB.
   Section modules (js/api/*.js) attach API.Students, API.Messages, … after this file.
   LocalStorage, or remote-sync + supabase-config when configured. */
/* Waqful Madinah · api.js — সব ডেটা লজিক এখানে। LocalStorage বা remote-sync + supabase-config। */
const API = (() => {
  const DB_KEY='madrasa_db', GOALS_KEY='madrasa_goals',
        EXAMS_KEY='madrasa_exams', DOCS_KEY='madrasa_docs',
        T_PIN_KEY='teacher_pin', DEF_PIN='1234',
        T_SESSION_KEY='madrasa_teacher_session',
        PROG_SETTINGS_KEY='madrasa_progress_settings';

  const _useRemote = typeof window !== 'undefined' && window.RemoteSync && window.RemoteSync.isRemote();
  const RS = typeof window !== 'undefined' ? window.RemoteSync : null;

  // বাংলাদেশ সময় (Asia/Dhaka, UTC+6, কোনো DST নেই) — ডিভাইসের টাইমজোন/ঘড়ি যাই থাকুক, সবসময় এই অফসেট ব্যবহার হয়
  const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
  const bdNow    = () => new Date(Date.now() + BD_OFFSET_MS);
  const bdDateStr= ts => new Date((ts!=null ? new Date(ts).getTime() : Date.now()) + BD_OFFSET_MS).toISOString().split('T')[0];
  const today  = () => bdDateStr();
  const nowTime= () => { const d=bdNow(); return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; };
  const nextDate= d => { const dt=bdNow(); dt.setUTCDate(dt.getUTCDate()+d); return dt.toISOString().split('T')[0]; };
  const uid    = p => (p||'id')+Date.now()+Math.random().toString(36).slice(2,5);
  const safeFilePart = name => String(name||'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80);
  /** একক আপলোড সর্বোচ্চ আকার (রিমোট: Supabase Storage; মেটা `docs_meta` এ KV তে) */
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  const MAX_ORAL_AUDIO_BYTES = 8 * 1024 * 1024;

  function fileWithinUploadLimit(file) {
    return file && typeof file.size === 'number' && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
  }

  function looksLikeImageFile(f) {
    if (f.type && f.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name || '');
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('read_fail'));
      fr.readAsDataURL(blob);
    });
  }

  async function prepareFilesForUpload(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) throw new Error('no_file');
    for (const f of files) {
      if (!fileWithinUploadLimit(f)) throw new Error('file_too_large');
    }
    const compressor = typeof window !== 'undefined' ? window.compressImageFileForUpload : null;
    if (files.length === 1) {
      let one = files[0];
      if (looksLikeImageFile(one) && compressor) {
        try { one = await compressor(one); } catch (e) { /* keep original if compress fails */ }
        if (!fileWithinUploadLimit(one)) throw new Error('file_too_large');
      }
      return one;
    }
    const allImg = files.every(looksLikeImageFile);
    if (!allImg) throw new Error('mixed_or_non_image');
    const merger = typeof window !== 'undefined' && window.mergeImageFilesToPdf;
    if (!merger) throw new Error('pdf_lib_missing');
    const pdf = await merger(files);
    if (!fileWithinUploadLimit(pdf)) throw new Error('file_too_large');
    return pdf;
  }

  function ensureChatsShape(db) {
    if (!db.chats) db.chats = {};
    (db.students || []).forEach(s => { if (!db.chats[s.id]) db.chats[s.id] = []; });
    if (!db.chats._bc) db.chats._bc = [];
  }

  const readDB = () => {
    if (_useRemote) return RS.mem.core;
    try { return JSON.parse(localStorage.getItem(DB_KEY))||null; } catch { return null; }
  };
  // Stamps _notifyAt on db so the Edge Function knows this write contains a new chat message.
  // Call only when a message is actually sent — NOT for markRead, task completions, or resets.
  function stampNotify(db) { db._notifyAt = new Date().toISOString(); }

  const writeDB = db => {
    if (_useRemote) {
      RS.mem.core = db;
      RS.schedule('core', () => JSON.parse(JSON.stringify(RS.mem.core)));
      return;
    }
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  };

  // ── Seed ──────────────────────────────────────────────────
  function buildSeedDemo() {
    const colors=['#128C7E','#1565C0','#6A1B9A','#BF360C','#1B5E20'];
    return {
      teacher: { name:'উস্তাজ', madrasa:'وقف المدينة' },
      students: [
        { id:'s1', waqfId:'waqf_001', name:'মুহাম্মাদ রাফি',      cls:'হিফজ ১ম',   roll:'০১', note:'',  color:colors[0], pin:'1111', fatherName:'আব্দুর রহমান',   contact:'01711000001', enrollmentDate:'2024-01-10' },
        { id:'s2', waqfId:'waqf_002', name:'আব্দুল্লাহ মাহমুদ',   cls:'হিফজ ১ম',   roll:'০২', note:'',  color:colors[1], pin:'2222', fatherName:'মোহাম্মদ হানিফ', contact:'01711000002', enrollmentDate:'2024-01-10' },
        { id:'s3', waqfId:'waqf_003', name:'উমর ফারুক',           cls:'হিফজ ২য়',   roll:'০৩', note:'',  color:colors[2], pin:'3333', fatherName:'ইব্রাহীম খলিল', contact:'01711000003', enrollmentDate:'2024-03-05' },
        { id:'s4', waqfId:'waqf_004', name:'ইয়াহইয়া নাদিম',      cls:'নাজেরা ১ম', roll:'০৪', note:'',  color:colors[3], pin:'4444', fatherName:'সালেহ আহমাদ',   contact:'01711000004', enrollmentDate:'2024-06-01' },
        { id:'s5', waqfId:'waqf_005', name:'হামজা আব্দুল আজিজ',  cls:'নাজেরা ২য়', roll:'০৫', note:'',  color:colors[4], pin:'5555', fatherName:'জামালুদ্দিন',   contact:'01711000005', enrollmentDate:'2025-01-15' },
      ],
      chats: {
        's1': [{ id:uid('m'), role:'out', text:'আস-সালামু আলাইকুম রাফি! আজকের সবক তৈরি করো।', time:nowTime(), read:false, type:'text' }],
      },
      tasks: [],
    };
  }
  function seedDemo() {
    const db = buildSeedDemo();
    writeDB(db);
    return db;
  }

  // ── AUTH ──────────────────────────────────────────────────
  // Teacher PWA: pin session in localStorage until explicit logout (one trusted device).
  const Auth = {
    getTeacherPin() {
      if (_useRemote) return RS.mem.teacherPin || DEF_PIN;
      return localStorage.getItem(T_PIN_KEY)||DEF_PIN;
    },
    async setTeacherPin(p) {
      if (_useRemote) {
        await RS.flushKey('teacher_pin', { pin: p });
        RS.mem.teacherPin = p;
      } else {
        localStorage.setItem(T_PIN_KEY, p);
      }
      if (this.getTeacherSessionPin()) this.saveTeacherSession(p);
    },
    checkTeacherPin(p)  { return p === this.getTeacherPin(); },
    getTeacherSessionPin() {
      try {
        const p = String(localStorage.getItem(T_SESSION_KEY) || '').trim();
        return /^\d{4}$/.test(p) ? p : null;
      } catch (e) { return null; }
    },
    saveTeacherSession(pin) {
      const p = String(pin || '').trim();
      if (!/^\d{4}$/.test(p)) return;
      try { localStorage.setItem(T_SESSION_KEY, p); } catch (e) {}
    },
    clearTeacherSession() {
      try { localStorage.removeItem(T_SESSION_KEY); } catch (e) {}
    },
    /** Server says too many wrong PINs (migration 20261008120000_waqf_pin_guard). */
    isLockedError(e) {
      return /pin_locked/.test(String((e && (e.message || e.details || e.hint)) || e || ''));
    },
    loginErrorText(e, fallback) {
      return this.isLockedError(e)
        ? 'অনেকবার ভুল পিন দেওয়া হয়েছে — কিছুক্ষণ পর (সর্বোচ্চ ১ ঘণ্টা) আবার চেষ্টা করুন।'
        : fallback;
    },
  };

  // ── DB ────────────────────────────────────────────────────
  const DB = {
    init() {
      if (!_useRemote) {
        let db=readDB();
        if(!db||!db.students?.length) db=seedDemo();
        else ensureChatsShape(db);
        API.Tasks.syncTodayFromCompletions();
        return Promise.resolve(db);
      }
      return RS.bootstrap().then(async () => {
        if (RS.startRealtimeSync) RS.startRealtimeSync();
        let c = RS.mem.core;
        const secure = RS.usesSecureKv?.();
        if (secure) {
          ensureChatsShape(c);
          API.Tasks.syncTodayFromCompletions();
          return c;
        }
        const needSeed = !c || (!c.students?.length && !c.allowEmptyStudents);
        if (needSeed) {
          c = buildSeedDemo();
          ensureChatsShape(c);
          RS.mem.core = c;
          await RS.flushKey('core', c);
        } else {
          ensureChatsShape(c);
        }
        if (RS.mem.teacherPin == null || RS.mem.teacherPin === '') {
          RS.mem.teacherPin = DEF_PIN;
          await RS.flushKey('teacher_pin', { pin: DEF_PIN });
        }
        API.Tasks.syncTodayFromCompletions();
        return c;
      });
    },
    get() {
      if (_useRemote) {
        if (!RS.mem.loaded || !RS.mem.core) throw new Error('API not ready — await API.DB.init()');
        return RS.mem.core;
      }
      let db=readDB();
      if(!db) db=seedDemo();
      else if(!db.students?.length && !db.allowEmptyStudents) db=seedDemo();
      else ensureChatsShape(db);
      return db;
    },
    save(db)        { writeDB(db); },
    getTeacher()    { return this.get().teacher; },
    async saveTeacher(data){
      const db=this.get();
      const next={...db.teacher,...data};
      if (_useRemote && RS.updateConfigRemote) await RS.updateConfigRemote(next);
      db.teacher=next; this.save(db);
      return next;
    },
    exportJSON() {
      const goals = _useRemote ? RS.mem.goals : JSON.parse(localStorage.getItem(GOALS_KEY)||'{}');
      const exams = _useRemote ? RS.mem.exams : JSON.parse(localStorage.getItem(EXAMS_KEY)||'{}');
      const docs = _useRemote ? RS.mem.docs : JSON.parse(localStorage.getItem(DOCS_KEY)||'[]');
      const academic = _useRemote ? RS.mem.academic : JSON.parse(localStorage.getItem('madrasa_academic')||'{}');
      const tnotes = _useRemote ? RS.mem.tnotes : JSON.parse(localStorage.getItem('madrasa_tnotes')||'{}');
      // chats: remote-এ RS.mem.core.chats, local-এ db.chats
      const chats = _useRemote ? (RS.mem.core?.chats || {}) : (this.get().chats || {});
      const completions = window.ApiAmal ? window.ApiAmal.Completions._all()
        : (()=>{ try{return JSON.parse(localStorage.getItem('madrasa_completions')||'[]');}catch{return[];} })();
      return JSON.stringify({ db:this.get(), goals, exams, docs, academic, tnotes, chats, completions, _backupAt: new Date().toISOString() }, null, 2);
    },
    importJSON(json){
      const p=JSON.parse(json); if(!p.db?.students) throw new Error('invalid');
      if (p.db.students.length) delete p.db.allowEmptyStudents;
      // chats backup থাকলে db-তে merge করো
      if (p.chats && typeof p.chats === 'object') p.db.chats = p.chats;
      writeDB(p.db);
      if (_useRemote) {
        RS.mem.core = p.db;
        RS.mem.goals = p.goals || {};
        RS.mem.exams = p.exams || { quizzes: [], submissions: [] };
        RS.mem.docs = Array.isArray(p.docs) ? p.docs : [];
        RS.mem.academic = p.academic || {};
        RS.mem.tnotes = p.tnotes || {};
        if (Array.isArray(p.completions)) RS.mem.completions = p.completions;
        return RS.flushAllFromMem().then(()=>p.db);
      }
      if(p.goals) localStorage.setItem(GOALS_KEY,JSON.stringify(p.goals));
      if(p.exams) localStorage.setItem(EXAMS_KEY,JSON.stringify(p.exams));
      if(p.docs) localStorage.setItem(DOCS_KEY,JSON.stringify(p.docs));
      if(p.academic) localStorage.setItem('madrasa_academic',JSON.stringify(p.academic));
      if(p.tnotes) localStorage.setItem('madrasa_tnotes',JSON.stringify(p.tnotes));
      if(Array.isArray(p.completions)) localStorage.setItem('madrasa_completions',JSON.stringify(p.completions));
      return Promise.resolve(p.db);
    },
    /** সব ছাত্র + টাস্ক/পরীক্ষা/ডক/লক্ষ্য/নোট খালি; শিক্ষক তথ্য ও গ্রুপ ব্রডকাস্ট চ্যাট রাখে। */
    resetForNewRoster() {
      const db = this.get();
      const bc = (db.chats && Array.isArray(db.chats._bc)) ? db.chats._bc.slice() : [];
      db.students = [];
      db.chats = { _bc: bc };
      db.tasks = [];
      db.allowEmptyStudents = true;
      this.save(db);
      if (_useRemote) {
        RS.mem.goals = {};
        RS.mem.exams = { quizzes: [], submissions: [] };
        RS.mem.docs = [];
        RS.mem.academic = {};
        RS.mem.tnotes = {};
        return RS.flushAllFromMem();
      }
      localStorage.setItem(GOALS_KEY, '{}');
      localStorage.setItem(EXAMS_KEY, JSON.stringify({ quizzes: [], submissions: [] }));
      localStorage.setItem(DOCS_KEY, '[]');
      localStorage.setItem('madrasa_academic', '{}');
      localStorage.setItem('madrasa_tnotes', '{}');
      Object.keys(localStorage).filter(k => k.startsWith('madrasa_doc_')).forEach(k => localStorage.removeItem(k));
      return Promise.resolve();
    },
    finalizeRemoteTeacherAfterUnlock() {
      if (!_useRemote || !RS.usesSecureKv?.() || typeof window === 'undefined' || window.__MADRASA_ROLE__ !== 'teacher') return Promise.resolve();
      let c = RS.mem.core;
      const needSeed = !c || (!c.students?.length && !c.allowEmptyStudents);
      if (needSeed) {
        c = buildSeedDemo();
        ensureChatsShape(c);
        RS.mem.core = c;
        return RS.flushKey('core', c).then(() => {
          if (RS.mem.teacherPin == null || RS.mem.teacherPin === '') {
            RS.mem.teacherPin = DEF_PIN;
            return RS.flushKey('teacher_pin', { pin: DEF_PIN });
          }
        });
      }
      ensureChatsShape(c);
      if (RS.mem.teacherPin == null || RS.mem.teacherPin === '') {
        RS.mem.teacherPin = DEF_PIN;
        return RS.flushKey('teacher_pin', { pin: DEF_PIN });
      }
      return Promise.resolve();
    },
  };

  return {
    Auth, DB, today, nowTime, nextDate, bdDateStr, uid,
    MAX_UPLOAD_BYTES,
    prepareFilesForUpload,
    /** POST to our own /api/* endpoints with the caller's login attached (server verifies it). */
    postJson(path, body) {
      const headers = Object.assign({ 'Content-Type': 'application/json' },
        (RS && RS.deviceHeaders) ? RS.deviceHeaders() : {});
      const auth = (RS && RS.sessionAuth) ? RS.sessionAuth() : null;
      return fetch(path, { method: 'POST', headers, body: JSON.stringify(Object.assign({}, body, { auth })) });
    },
    unlockTeacherRemote(pin) {
      if (!_useRemote || !RS.unlockTeacherWithPin) return Promise.reject(new Error('not_remote'));
      return RS.unlockTeacherWithPin(pin);
    },
    loginStudentRemote(waqf, pin) {
      if (!_useRemote || !RS.unlockStudentWithWaqfPin) return Promise.reject(new Error('not_remote'));
      return RS.unlockStudentWithWaqfPin(waqf, pin);
    },
    refreshStudentLockHints() { return _useRemote && RS.refreshStudentLockHints ? RS.refreshStudentLockHints() : Promise.resolve(); },
    Pwa: {
      registerServiceWorker() {
        const win = typeof window !== 'undefined' ? window : null;
        if (!win || !win.MadrasaPwa) return Promise.resolve(null);
        return win.MadrasaPwa.register();
      },
      enableNotificationsAfterAuth(role, opts) {
        const win = typeof window !== 'undefined' ? window : null;
        if (!win || !win.MadrasaPwa) return Promise.resolve();
        return win.MadrasaPwa.enableAfterAuth(role, opts || {});
      },
      refreshPushSubscription(role, opts) {
        const win = typeof window !== 'undefined' ? window : null;
        if (!win || !win.MadrasaPwa) return Promise.resolve();
        return win.MadrasaPwa.refreshPushSubscription(role, opts || {});
      },
      repairPushSubscription(role, opts) {
        const win = typeof window !== 'undefined' ? window : null;
        if (!win || !win.MadrasaPwa) return Promise.resolve(false);
        return win.MadrasaPwa.repairPushSubscription(role, opts || {});
      },
      enableSharedStudentDevice() {
        const win = typeof window !== 'undefined' ? window : null;
        if (!win || !win.MadrasaPwa) return Promise.resolve();
        return win.MadrasaPwa.enableSharedStudentDevice();
      },
    },
    /** Shared helpers for the js/api/* section modules — not for page code. */
    _internal: { DB_KEY, GOALS_KEY, EXAMS_KEY, DOCS_KEY, T_PIN_KEY, DEF_PIN, T_SESSION_KEY, PROG_SETTINGS_KEY, _useRemote, RS, BD_OFFSET_MS, bdNow, bdDateStr, today, nowTime, nextDate, uid, safeFilePart, MAX_UPLOAD_BYTES, MAX_ORAL_AUDIO_BYTES, fileWithinUploadLimit, looksLikeImageFile, blobToDataUrl, prepareFilesForUpload, ensureChatsShape, readDB, stampNotify, writeDB, buildSeedDemo, seedDemo, Auth, DB },
  };
})();

// `api-amal.js` এবং অন্য স্ক্রিপ্ট `window.API` দিয়ে এক্সেস করে; `const API` আলাদাভাবে `window`-এ যায় না।
if (typeof window !== 'undefined') window.API = API;

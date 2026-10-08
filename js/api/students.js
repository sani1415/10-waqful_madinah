/* Waqful Madinah · js/api/students.js — Students, AcademicHistory, TeacherNotes. Attaches to window.API (core.js loads first). */
(function (API) {
  const { DB, GOALS_KEY, RS, _useRemote, nowTime, today, uid } = API._internal;


  // ── STUDENTS ──────────────────────────────────────────────
  const Students = {
    getAll()   { return DB.get().students||[]; },
    getById(id){ return DB.get().students.find(s=>s.id===id)||null; },

    getNextWaqfId() {
      const used = new Set(
        this.getAll()
          .map((s) => {
            const m = String(s.waqfId || '').match(/waqf_(\d+)/i);
            return m ? parseInt(m[1], 10) : NaN;
          })
          .filter((n) => !Number.isNaN(n) && n > 0)
      );
      let n = 1;
      while (used.has(n)) n++;
      return 'waqf_' + String(n).padStart(3, '0');
    },

    /** UI-only: "001" from stored `waqf_001` (waqfId in memory/DB unchanged). */
    displayWaqfId(waqfId) {
      const w = String(waqfId || '').trim();
      if (!w) return '';
      const m = w.match(/^waqf_0*(\d+)$/i);
      if (m) return String(parseInt(m[1], 10)).padStart(3, '0');
      return w;
    },
    /** ছাত্র তালিকা/চ্যাট ফিল্টার — নাম, waqf_001, বা সংক্ষিপ্ত "001". */
    matchesSearchQuery(s, rawFilter) {
      const f = String(rawFilter || '').trim().toLowerCase();
      if (!f) return true;
      if ((s.name || '').toLowerCase().includes(f)) return true;
      if (s.waqfId && String(s.waqfId).toLowerCase().includes(f)) return true;
      return String(this.displayWaqfId(s.waqfId)).toLowerCase().includes(f);
    },
    // Public display id (তিন অঙ্ক); লগইনে `getByWaqfShortId` দিয়ে "001" বা "waqf_001" দুটোই চলে
    getShortId(s) {
      return s?.waqfId ? this.displayWaqfId(s.waqfId) : null;
    },
    getPendingForLockScreen(){ return _useRemote&&RS.mem&&Array.isArray(RS.mem.lockHints)?RS.mem.lockHints.filter(s=>(s.unreadCount||0)>0):this.getAll().filter(s=>API.Messages.unreadCount(s.id,'out')>0); },

    // Login lookup: accepts "001" or "waqf_001" (case-insensitive waqf_)
    getByWaqfShortId(raw) {
      const t=String(raw||'').trim().replace(/\s/g,'');
      if(!t) return null;
      let n;
      if(/^waqf_/i.test(t)) n=parseInt(t.slice(5),10);
      else n=parseInt(t,10);
      if(Number.isNaN(n)||n<0) return null;
      const padded='waqf_'+String(n).padStart(3,'0');
      return this.getAll().find(s=>s.waqfId===padded)||null;
    },

    getBatchYear(enrollmentDate) {
      if(!enrollmentDate) return null;
      const n=new Date().getFullYear() - new Date(enrollmentDate).getFullYear();
      if(n<0) return null;
      return Math.max(1, n); // একই ক্যালেন্ডার বছর = ১ম বর্ষ
    },
    /** বর্ষ লেবেল: ১ম বর্ষ / ২য় বর্ষ / … */
    formatBatchYear(enrollmentDate) {
      const n=this.getBatchYear(enrollmentDate);
      if(n==null) return '';
      if(n===1) return '১ম বর্ষ';
      if(n===2) return '২য় বর্ষ';
      if(n===3) return '৩য় বর্ষ';
      return n+'য় বর্ষ';
    },
    async add({ name, cls, roll, note, pin, fatherName='', fatherOccupation='', contact='', district='', upazila='', bloodGroup='', enrollmentDate='', responsibility='' }) {
      const db = DB.get();
      const colors=['#128C7E','#1565C0','#6A1B9A','#BF360C','#1B5E20','#E65100','#004D40','#880E4F'];
      const s = {
        id:uid('s'), waqfId:this.getNextWaqfId(),
        name, cls, roll, note, pin, color:colors[db.students.length%colors.length],
        fatherName, fatherOccupation, contact, district, upazila, bloodGroup, enrollmentDate, responsibility,
      };
      if (_useRemote && RS.saveStudentRemote) await RS.saveStudentRemote(s);
      db.students.push(s); db.chats[s.id]=[];
      delete db.allowEmptyStudents;
      DB.save(db);
      return s;
    },

    async update(sid, data) {
      const db=DB.get(); const s=db.students.find(s=>s.id===sid); if(!s) return null;
      // Don't overwrite id, waqfId, color
      const { id:_, waqfId:__, color:___, ...rest } = data;
      const next={...s,...rest};
      if (_useRemote && window.__MADRASA_ROLE__==='teacher' && RS.saveStudentRemote)
        await RS.saveStudentRemote(next);
      Object.assign(s, rest); DB.save(db); return s;
    },

    async updatePin(sid, pin, { skipRemote=false }={}) {
      const db=DB.get();
      const s=db.students.find(s=>s.id===sid);
      if(!s) return null;
      if (_useRemote && !skipRemote && window.__MADRASA_ROLE__==='teacher' && RS.saveStudentRemote)
        await RS.saveStudentRemote({...s,pin});
      s.pin=pin; DB.save(db); return s;
    },

    /** ছাত্র সারি অপরিবর্তিত; চ্যাট, টাস্ক, পরীক্ষা, ডক, লক্ষ্য, একাডেমিক, নোট মুছে। */
    async clearAllRelatedData(sid, { skipRemote=false }={}) {
      if (!this.getById(sid)) throw new Error('student_not_found');
      // Delete all related rows from the remote DB first (before local changes)
      if (_useRemote && !skipRemote && RS.clearStudentDataRemote) await RS.clearStudentDataRemote(sid);
      if (typeof window !== 'undefined' && window.DailyScheduleAPI && window.DailyScheduleAPI.clearStudent)
        window.DailyScheduleAPI.clearStudent(sid);
      const AA = window.ApiAmal; if (AA) AA.Completions.clearStudent(sid);
      const db0 = DB.get();
      db0.chats[sid] = [];
      DB.save(db0);
      const acad = AcademicHistory._read();
      delete acad[sid];
      AcademicHistory._write(acad);
      const tnotes = TeacherNotes._read();
      delete tnotes[sid];
      TeacherNotes._write(tnotes);
      const gAll = API.Goals._all();
      delete gAll[sid];
      if (_useRemote) {
        RS.mem.goals = gAll;
        RS.schedule('goals', () => JSON.parse(JSON.stringify(RS.mem.goals)));
      } else {
        localStorage.setItem(GOALS_KEY, JSON.stringify(gAll));
      }
      const db1 = DB.get();
      db1.tasks = (db1.tasks || [])
        .map((t) => {
          if (!t.assignees || t.assignees[sid] === undefined) return t;
          const assignees = { ...t.assignees };
          delete assignees[sid];
          const completedBy = { ...(t.completedBy || {}) };
          delete completedBy[sid];
          if (!Object.keys(assignees).length) return null;
          return { ...t, assignees, completedBy };
        })
        .filter(Boolean);
      DB.save(db1);
      const ex = API.Exams._readAll();
      ex.submissions = (ex.submissions || []).filter((sub) => sub.studentId !== sid);
      ex.quizzes = (ex.quizzes || []).map((q) => ({
        ...q,
        assigneeIds: (q.assigneeIds || []).filter((id) => id !== sid),
      }));
      API.Exams._write(ex);
      API.Docs.deleteAllForStudent(sid);
    },

    /** সব ছাত্রের সংশ্লিষ্ট ডেটা মুছে — নাম/ওয়াকফ/পিন অপরিবর্তিত থাকে। */
    async clearAllStudentsData() {
      for (const s of this.getAll()) await this.clearAllRelatedData(s.id);
    },

    /** ছাত্র + সব সংশ্লিষ্ট ডেটা মুছে; ওয়াকফ নম্বর পরে নতুন ছাত্রের জন্য পুনরায় বরাদ্দ হতে পারে। */
    async deleteCompletely(sid) {
      if (!this.getById(sid)) throw new Error('student_not_found');
      if (_useRemote && RS.deleteStudentRemote) await RS.deleteStudentRemote(sid);
      await this.clearAllRelatedData(sid, { skipRemote:true });
      const db = DB.get();
      db.students = db.students.filter((s) => s.id !== sid);
      delete db.chats[sid];
      DB.save(db);
      if (_useRemote) {
        // Remove from lock-screen hints immediately so UI updates at once
        if (RS.mem && Array.isArray(RS.mem.lockHints))
          RS.mem.lockHints = RS.mem.lockHints.filter(s => s.id !== sid);
      }
    },

    async importFromCSV(csvText) {
      const lines = csvText.replace(/\r/g,'').trim().split('\n');
      if(lines.length < 2) throw new Error('empty_file');
      const parseCSVLine = line => {
        const out = []; let cur = ''; let i = 0; let inQ = false;
        while (i < line.length) {
          const c = line[i];
          if (inQ) {
            if (c === '"') {
              if (line[i + 1] === '"') { cur += '"'; i += 2; continue; }
              inQ = false; i++; continue;
            }
            cur += c; i++; continue;
          }
          if (c === '"') { inQ = true; i++; continue; }
          if (c === ',') { out.push(cur.trim()); cur = ''; i++; continue; }
          cur += c; i++;
        }
        out.push(cur.trim());
        return out.map(x => x.replace(/^"|"$/g, '').replace(/""/g, '"'));
      };
      const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      const col = k => header.indexOf(k);
      const results = { success:0, errors:[] };
      const db = DB.get();
      for(let i=1;i<lines.length;i++){
        if(!lines[i].trim()) continue;
        const r = parseCSVLine(lines[i]);
        const name = r[col('name')]||''; const pin = (r[col('pin')]||'').trim();
        if(!name){ results.errors.push(`Row ${i+1}: name missing`); continue; }
        if(!/^\d{4}$/.test(pin)){ results.errors.push(`Row ${i+1} (${name}): invalid PIN`); continue; }
        const colors=['#128C7E','#1565C0','#6A1B9A','#BF360C','#1B5E20','#E65100','#004D40','#880E4F'];
        const s = {
          id:uid('s'), waqfId:this.getNextWaqfId(),
          name, pin, color:colors[db.students.length%colors.length],
          cls:r[col('class')]||r[col('cls')]||'',
          roll:r[col('roll')]||'',
          fatherName:r[col('father_name')]||'',
          fatherOccupation:r[col('father_occupation')]||'',
          contact:r[col('contact')]||'',
          district:r[col('district')]||'',
          upazila:r[col('upazila')]||'',
          bloodGroup:r[col('blood_group')]||'',
          enrollmentDate:r[col('enrollment_date')]||'',
          note:r[col('note')]||'',
        };
        try {
          if (_useRemote && RS.saveStudentRemote) await RS.saveStudentRemote(s);
          db.students.push(s); db.chats[s.id]=[]; results.success++;
        } catch (e) {
          console.error('CSV student save failed:', e);
          results.errors.push(`Row ${i+1} (${name}): database save failed`);
        }
      }
      if (results.success > 0) delete db.allowEmptyStudents;
      DB.save(db); return results;
    },
  };

  // ── ACADEMIC HISTORY ──────────────────────────────────────
  const AcademicHistory = {
    _key:'madrasa_academic',
    _read(){
      if (_useRemote) return RS.mem.academic || {};
      try{ return JSON.parse(localStorage.getItem(this._key)||'{}'); }catch{ return {}; }
    },
    _write(d){
      if (_useRemote) {
        RS.mem.academic = d;
        RS.schedule('academic', () => JSON.parse(JSON.stringify(RS.mem.academic)));
        return;
      }
      localStorage.setItem(this._key,JSON.stringify(d));
    },
    getAll(sid){ return this._read()[sid]||[]; },
    async add(sid,{yearClass,grade}){
      const all=this._read(); if(!all[sid]) all[sid]=[];
      const rec={id:uid('ah'),yearClass,grade,addedAt:today()};
      if (_useRemote && RS.upsertAcademicHistoryRemote)
        await RS.upsertAcademicHistoryRemote(sid,rec);
      all[sid].push(rec); this._write(all); return rec;
    },
    async delete(sid,rid){
      const all=this._read();
      if (_useRemote && RS.deleteAcademicHistoryRemote)
        await RS.deleteAcademicHistoryRemote(sid,rid);
      if(all[sid]) all[sid]=all[sid].filter(r=>r.id!==rid);
      this._write(all);
    },
  };

  // ── TEACHER NOTES ─────────────────────────────────────────
  const TeacherNotes = {
    _key:'madrasa_tnotes',
    _read(){
      if (_useRemote) return RS.mem.tnotes || {};
      try{ return JSON.parse(localStorage.getItem(this._key)||'{}'); }catch{ return {}; }
    },
    _write(d){
      if (_useRemote) {
        RS.mem.tnotes = d;
        RS.schedule('tnotes', () => JSON.parse(JSON.stringify(RS.mem.tnotes)));
        return;
      }
      localStorage.setItem(this._key,JSON.stringify(d));
    },
    getAll(sid){ return this._read()[sid]||[]; },
    async add(sid,text){
      const all=this._read(); if(!all[sid]) all[sid]=[];
      const note={id:uid('tn'),text,date:today(),time:nowTime()};
      if (_useRemote && RS.upsertTeacherNoteRemote) await RS.upsertTeacherNoteRemote(note, sid);
      all[sid].unshift(note); this._write(all);
      return note;
    },
    async update(sid,nid,text){
      const all=this._read(); const n=(all[sid]||[]).find(x=>x.id===nid);
      if(!n) return null;
      const next={...n,text,edited:today()};
      if (_useRemote && RS.upsertTeacherNoteRemote) await RS.upsertTeacherNoteRemote(next, sid);
      Object.assign(n,next); this._write(all);
      return n;
    },
    async delete(sid,nid){
      const all=this._read();
      if (_useRemote && RS.deleteTeacherNoteRemote) await RS.deleteTeacherNoteRemote(nid);
      if(all[sid]) all[sid]=all[sid].filter(n=>n.id!==nid);
      this._write(all);
    },
  };

  Object.assign(API, { Students, AcademicHistory, TeacherNotes });
})(window.API);

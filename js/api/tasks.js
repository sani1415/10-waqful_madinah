/* Waqful Madinah · js/api/tasks.js — Tasks (আমল) + ProgressSettings. Attaches to window.API (core.js loads first). */
(function (API) {
  const { DB, PROG_SETTINGS_KEY, RS, _useRemote, nextDate, nowTime, today, uid } = API._internal;


  // ── TASKS ─────────────────────────────────────────────────
  const Tasks = {
    getAll()           { return DB.get().tasks||[]; },
    getForStudent(sid) { return this.getAll().filter(t=>t.assignees&&t.assignees[sid]); },

    async add({ title, desc, deadline, type='onetime', assigneeIds }) {
      const db=DB.get();
      const task={
        id:uid('t'), title, desc,
        type:type||'onetime',
        deadline:type==='onetime'?(deadline||nextDate(7)):'',
        created:today(),
        assignees:Object.fromEntries(assigneeIds.map(id=>[id,'pending'])),
        completedBy:{},
      };
      if (_useRemote && RS.saveTaskRemote) await RS.saveTaskRemote(task);
      db.tasks.push(task); DB.save(db);
      return task;
    },

    // ── Completions API ────────────────────────────────────────
    markCompleted(tid,sid,opts)    { const AA=window.ApiAmal; return AA&&AA.markCompleted(tid,sid,opts); },
    unmarkCompleted(tid,sid,date)  { const AA=window.ApiAmal; return AA&&AA.unmarkCompleted(tid,sid,date); },
    isCompleted(tid,sid,date)      { const AA=window.ApiAmal; return !!(AA&&AA.isCompleted(tid,sid,date)); },

    getTodayStatus(task,sid) {
      if (task.type==='daily') return this.isCompleted(task.id,sid,today())?'done':'pending';
      return task.assignees?.[sid]==='done'?'done':'pending';
    },

    syncTodayFromCompletions() {
      const AA=window.ApiAmal;
      if (!AA) { this._legacyResetDaily(); return; }
      const db=DB.get();
      db.tasks=AA.syncTodayFromCompletions(db.tasks);
      DB.save(db);
    },

    _legacyResetDaily() {
      const db=DB.get(); const todayStr=today(); let changed=false;
      db.tasks.forEach(t=>{
        if (t.type!=='daily') return;
        Object.keys(t.assignees||{}).forEach(sid=>{
          const cb=t.completedBy?.[sid];
          if (t.assignees[sid]==='done'&&cb?.date!==todayStr){ t.assignees[sid]='pending'; changed=true; }
        });
      });
      if (changed) DB.save(db);
    },

    // Legacy compat — also records in Completions
    async markDailyDone(tid,sid) {
      const db=DB.get(); const t=db.tasks.find(x=>x.id===tid); if(!t) return null;
      const AA=window.ApiAmal;
      if (AA) await AA.markCompleted(tid,sid,{status:'done'});
      if (!t.completedBy) t.completedBy={};
      t.completedBy[sid]={date:today(),time:nowTime()};
      t.assignees[sid]='done';
      DB.save(db);
      return t;
    },
    async markDone(tid,sid) {
      const db=DB.get(); const t=db.tasks.find(x=>x.id===tid); if(!t) return null;
      const completed={date:today(),time:nowTime()};
      const AA=window.ApiAmal;
      if (_useRemote && RS.completeOnetimeTaskRemote && AA) {
        const row=AA.Completions.prepare({
          task_id:tid, student_id:sid, date:completed.date, status:'done',
        });
        await RS.completeOnetimeTaskRemote(row);
        AA.Completions.commit(row);
      } else if (AA) {
        await AA.markCompleted(tid,sid,{status:'done'});
      }
      t.assignees[sid]='done';
      if (!t.completedBy) t.completedBy={};
      t.completedBy[sid]=completed;
      DB.save(db);
      return t;
    },
    isDailyDoneToday(task,sid) {
      return this.isCompleted(task.id,sid,today())||task.completedBy?.[sid]?.date===today();
    },
    // Undo — reverses markDailyDone/markDone for the student (self-correction of an accidental tap)
    async unmarkDailyDone(tid,sid) {
      const db=DB.get(); const t=db.tasks.find(x=>x.id===tid); if(!t) return null;
      const AA=window.ApiAmal;
      if (AA) await AA.unmarkCompleted(tid,sid,today());
      if (t.completedBy?.[sid]?.date===today()) delete t.completedBy[sid];
      t.assignees[sid]='pending';
      DB.save(db);
      return t;
    },
    async unmarkOnce(tid,sid) {
      const db=DB.get(); const t=db.tasks.find(x=>x.id===tid); if(!t) return null;
      const date=t.completedBy?.[sid]?.date||today();
      const AA=window.ApiAmal;
      if (AA) await AA.unmarkCompleted(tid,sid,date);
      if (_useRemote && RS.updateTaskStatusRemote) await RS.updateTaskStatusRemote(tid,sid,'pending',null);
      t.assignees[sid]='pending';
      if (t.completedBy) delete t.completedBy[sid];
      DB.save(db);
      return t;
    },
    async toggleStatus(tid,sid) {
      const db=DB.get(); const t=db.tasks.find(x=>x.id===tid); if(!t) return null;
      if (t.type==='daily') {
        const done=this.isCompleted(tid,sid,today());
        if (done) await this.unmarkCompleted(tid,sid,today()); else await this.markCompleted(tid,sid);
        t.assignees[sid]=done?'pending':'done';
      } else {
        const c=t.assignees[sid];
        const next=c==='pending'?'done':c==='done'?'late':'pending';
        if (_useRemote && RS.updateTaskStatusRemote)
          await RS.updateTaskStatusRemote(tid,sid,next,next==='done'?{date:today(),time:nowTime()}:null);
        t.assignees[sid]=next;
      }
      DB.save(db); return t;
    },
    resetDailyForToday() { this.syncTodayFromCompletions(); },

    pendingCount(sid=null) {
      const tasks=this.getAll(); let n=0;
      if (sid) return tasks.filter(t=>{
        if (t.type==='daily') return !this.isDailyDoneToday(t,sid);
        return t.assignees?.[sid]==='pending';
      }).length;
      tasks.forEach(t=>Object.keys(t.assignees||{}).forEach(s=>{
        if (t.type==='daily'){ if(!this.isDailyDoneToday(t,s)) n++; }
        else{ if(t.assignees[s]==='pending') n++; }
      })); return n;
    },

    overallStatus(task) {
      const ids=Object.keys(task.assignees||{});
      if (task.type==='daily'){
        const done=ids.filter(id=>this.isDailyDoneToday(task,id)).length;
        return done===ids.length?'done':done>0?'partial':'pending';
      }
      const done=ids.filter(id=>task.assignees[id]==='done').length;
      const late=task.deadline<today()&&done<ids.length;
      return done===ids.length?'done':late?'late':'pending';
    },

    async delete(tid) {
      if (_useRemote && RS.deleteTaskRemote) await RS.deleteTaskRemote(tid);
      const db=DB.get(); db.tasks=db.tasks.filter(t=>t.id!==tid); DB.save(db);
    },

    // ── ApiAmal delegates ─────────────────────────────────────
    getStreak(sid,tid)       { const AA=window.ApiAmal; return AA?AA.getStreak(sid,tid):{current:0,longest:0}; },
    getProgressSummary(sid)  { const AA=window.ApiAmal; const z={done:0,total:0,percent:0}; return AA?AA.getProgressSummary(sid):{today:z,week:z,month:z,all:z}; },
    getRangeProgress(sid,from,to){ const AA=window.ApiAmal; return AA&&AA.getRangeProgress?AA.getRangeProgress(sid,from,to):{done:0,total:0,percent:0,from,to}; },
    getListProgress(sid)     { const AA=window.ApiAmal; return AA&&AA.getListProgress?AA.getListProgress(sid):{done:0,total:0,percent:0,from:null,to:today()}; },
    getTodayOverview(date)   { const AA=window.ApiAmal; return AA?AA.getTodayOverview(date):[]; },
    getLeaderboard(period)   { const AA=window.ApiAmal; return AA?AA.getLeaderboard(period):[]; },
    getCalendarData(sid,y,m) { const AA=window.ApiAmal; return AA?AA.getCalendarData(sid,y,m):{}; },
  };

  // ── Progress settings (শিক্ষক তালিকার % সময়সীমা) ─────────
  // mode: 'enrollment' | 'custom' — localStorage (শিক্ষকের ডিভাইস)
  const ProgressSettings = {
    _defaults() { return { mode:'enrollment', customFrom:'' }; },
    get() {
      try {
        const raw=JSON.parse(localStorage.getItem(PROG_SETTINGS_KEY)||'null');
        if(!raw||typeof raw!=='object') return this._defaults();
        const mode=raw.mode==='custom'?'custom':'enrollment';
        const customFrom=/^\d{4}-\d{2}-\d{2}$/.test(raw.customFrom||'')?raw.customFrom:'';
        return { mode, customFrom };
      } catch { return this._defaults(); }
    },
    save({ mode, customFrom }={}) {
      const next={
        mode: mode==='custom'?'custom':'enrollment',
        customFrom:/^\d{4}-\d{2}-\d{2}$/.test(customFrom||'')?customFrom:'',
      };
      localStorage.setItem(PROG_SETTINGS_KEY, JSON.stringify(next));
      return next;
    },
    /** ছাত্র অনুযায়ী % হিসাবের শুরুর তারিখ (YYYY-MM-DD) বা null */
    resolveFrom(student) {
      const cfg=this.get();
      if(cfg.mode==='custom'&&cfg.customFrom) return cfg.customFrom;
      const en=student&&student.enrollmentDate;
      return en&&/^\d{4}-\d{2}-\d{2}/.test(en)?String(en).slice(0,10):null;
    },
  };

  Object.assign(API, { Tasks, ProgressSettings });
})(window.API);

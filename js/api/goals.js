/* Waqful Madinah · js/api/goals.js — Goals. Attaches to window.API (core.js loads first). */
(function (API) {
  const { GOALS_KEY, RS, _useRemote, today, uid } = API._internal;


  // ── GOALS ─────────────────────────────────────────────────
  const Goals = {
    _all() {
      if (_useRemote) return RS.mem.goals || (RS.mem.goals = {});
      try { return JSON.parse(localStorage.getItem(GOALS_KEY)||'{}'); } catch { return {}; }
    },
    getAll(sid)  { const all=this._all(); return all[sid]||[]; },
    _save(sid,g) {
      const all=this._all();
      all[sid]=g;
      if (_useRemote) {
        RS.schedule('goals', () => JSON.parse(JSON.stringify(RS.mem.goals)));
        return;
      }
      localStorage.setItem(GOALS_KEY,JSON.stringify(all));
    },
    async add(sid,{title,cat='other',deadline='',note=''}) {
      const goals=this.getAll(sid);
      const g={id:uid('g'),title,cat,deadline,note,done:false,created:today()};
      if (_useRemote && RS.upsertGoalRemote) await RS.upsertGoalRemote(g,sid);
      goals.push(g); this._save(sid,goals); return g;
    },
    async toggle(sid,gid)  {
      const goals=this.getAll(sid); const g=goals.find(x=>x.id===gid); if(!g) return null;
      const next={...g,done:!g.done};
      if (_useRemote && RS.upsertGoalRemote) await RS.upsertGoalRemote(next,sid);
      Object.assign(g,next); this._save(sid,goals); return g;
    },
    async delete(sid,gid)  {
      if (_useRemote && RS.deleteGoalRemote) await RS.deleteGoalRemote(sid,gid);
      this._save(sid,this.getAll(sid).filter(g=>g.id!==gid));
    },
  };

  Object.assign(API, { Goals });
})(window.API);

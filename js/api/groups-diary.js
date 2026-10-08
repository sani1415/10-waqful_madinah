/* Waqful Madinah · js/api/groups-diary.js — teacher contact Groups + Diary. Attaches to window.API (core.js loads first). */
(function (API) {
  const { DB, RS, _useRemote, nowTime, stampNotify, today, uid } = API._internal;


  // ── TEACHER CONTACT GROUPS ───────────────────────────────
  const _GROUPS_KEY = 'madrasa_groups';
  const Groups = {
    _read() {
      if (_useRemote) return RS.mem.groups || (RS.mem.groups = []);
      try { return JSON.parse(localStorage.getItem(_GROUPS_KEY)||'[]'); } catch { return []; }
    },
    _write(arr) {
      if (_useRemote) { RS.mem.groups = arr; return; }
      localStorage.setItem(_GROUPS_KEY, JSON.stringify(arr));
    },
    getAll() { return this._read(); },
    getById(gid) { return this._read().find(g => g.id === gid) || null; },
    async add(name, studentIds) {
      const arr = this._read();
      const g = { id: uid('grp'), name: String(name||'').trim(), studentIds: studentIds||[], createdAt: today() };
      if (_useRemote && RS.upsertGroupRemote) await RS.upsertGroupRemote(g);
      arr.push(g); this._write(arr);
      return g;
    },
    async update(gid, name, studentIds) {
      const arr = this._read(); const g = arr.find(x => x.id === gid); if (!g) return null;
      const next={...g,name:String(name||'').trim(),studentIds:studentIds||[]};
      if (_useRemote && RS.upsertGroupRemote) await RS.upsertGroupRemote(next);
      Object.assign(g,next);
      this._write(arr);
      return g;
    },
    async delete(gid) {
      if (_useRemote && RS.deleteGroupRemote) await RS.deleteGroupRemote(gid);
      this._write(this._read().filter(g => g.id !== gid));
    },
    async sendToGroup(gid, text) {
      const g = this.getById(gid); if (!g || !g.studentIds.length) return [];
      const db = DB.get(); const msgs = [];
      g.studentIds.forEach(sid => {
        if (!db.chats[sid]) db.chats[sid] = [];
        const m = { id: uid('m'), role: 'out', text, type: 'text', time: nowTime(), read: false, groupId: gid };
        msgs.push({ sid, message: m });
      });
      if (_useRemote && RS.sendMessageRemote) {
        await Promise.all(msgs.map(x => RS.sendMessageRemote(x.sid, x.message)));
      }
      msgs.forEach(x => db.chats[x.sid].push(x.message));
      if (msgs.length) { stampNotify(db); DB.save(db); }
      return msgs.map(x => x.message);
    },
  };

  // ── TEACHER DIARY ─────────────────────────────────────────
  const _DIARY_KEY = 'madrasa_diary';
  function _diaryPack(title, body) {
    const t = String(title == null ? '' : title).trim();
    const b = String(body == null ? '' : body).trim();
    if (!t) return b;
    return JSON.stringify({ v: 1, title: t, body: b });
  }
  function _diaryUnpack(raw) {
    const s = String(raw == null ? '' : raw);
    if (s.charAt(0) === '{') {
      try {
        const o = JSON.parse(s);
        if (o && o.v === 1 && typeof o.body === 'string') {
          return { title: String(o.title || ''), text: o.body };
        }
      } catch (_) {}
    }
    return { title: '', text: s };
  }
  function _diaryView(e) {
    if (!e) return e;
    if (e.title != null && !String(e.text || '').startsWith('{"v":1')) {
      return { id: e.id, date: e.date, time: e.time, title: String(e.title || ''), text: String(e.text || ''), edited: e.edited || null };
    }
    const u = _diaryUnpack(e.text);
    return { id: e.id, date: e.date, time: e.time, title: u.title, text: u.text, edited: e.edited || null };
  }
  const Diary = {
    _read() {
      if (_useRemote) return RS.mem.diary || (RS.mem.diary = []);
      try { return JSON.parse(localStorage.getItem(_DIARY_KEY)||'[]'); } catch { return []; }
    },
    _write(arr) {
      if (_useRemote) { RS.mem.diary = arr; return; }
      localStorage.setItem(_DIARY_KEY, JSON.stringify(arr));
    },
    getAll() { return this._read().map(_diaryView); },
    async add(text, date, title) {
      const arr = this._read();
      const entry = {
        id: uid('di'),
        date: date || today(),
        time: nowTime(),
        title: String(title || '').trim(),
        text: String(text || '').trim(),
      };
      if (_useRemote && RS.upsertDiaryRemote) {
        await RS.upsertDiaryRemote({ ...entry, text: _diaryPack(entry.title, entry.text) });
      }
      arr.unshift(entry); this._write(arr);
      return entry;
    },
    async update(id, text, date, title) {
      const arr = this._read(); const e = arr.find(x => x.id === id);
      if (e) {
        const next = {
          ...e,
          title: title != null ? String(title).trim() : String(e.title || ''),
          text: String(text || '').trim(),
          date: date || e.date,
          edited: today(),
        };
        if (_useRemote && RS.upsertDiaryRemote) {
          await RS.upsertDiaryRemote({ ...next, text: _diaryPack(next.title, next.text) });
        }
        Object.assign(e, next); this._write(arr);
      }
      return e;
    },
    async delete(id) {
      if (_useRemote && RS.deleteDiaryRemote) await RS.deleteDiaryRemote(id);
      this._write(this._read().filter(x => x.id !== id));
    },
  };

  Object.assign(API, { Groups, Diary });
})(window.API);

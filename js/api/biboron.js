/* Waqful Madinah · js/api/biboron.js — Biboron (teacher বিবরণ dashboard). Attaches to window.API (core.js loads first). */
(function (API) {
  const { nextDate, today } = API._internal;


  // ── বিবরণ (জিম্মাদার ড্যাশবোর্ড) ───────────────────────────
  // দৈনিক আমল সারি/সারাংশ = গতকাল (দিন শেষ হওয়া স্থির তথ্য)
  const _yesterday = () => nextDate(-1);
  const _dateAdd = (date, delta) => {
    const d = new Date((date || today()) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().split('T')[0];
  };
  const _weekStart = (date) => {
    if (typeof window !== 'undefined' && window.ApiAmal && window.ApiAmal.getWeekStart) return window.ApiAmal.getWeekStart(date || today());
    const d = new Date((date || today()) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
    return d.toISOString().split('T')[0];
  };
  const Biboron = {
    yesterdayDate() { return _yesterday(); },
    _dayProgress(sid) {
      const y = _yesterday();
      const p = API.Tasks.getRangeProgress(sid, y, y);
      return { done: p.done | 0, total: p.total | 0, percent: p.percent | 0, date: y };
    },
    _studentNotes(sid) {
      const SN = typeof window !== 'undefined' ? window.API?.StudentNotes : null;
      return SN && SN.getAll ? SN.getAll(sid) : [];
    },
    _isWeeklyReceiptNote(n) {
      return /^সাপ্তাহিক আমল:/.test(String(n.title || '')) || /^সাপ্তাহিক আমল জমা/.test(String(n.text || ''));
    },
    _visibleStudentNotes(sid) {
      return this._studentNotes(sid).filter(n => !this._isWeeklyReceiptNote(n));
    },
    _noteTs(n) {
      const raw = [n.date || n.note_date || '', n.time || n.note_time || '00:00'].join(' ').trim();
      const t = Date.parse(raw.replace(' ', 'T'));
      return Number.isFinite(t) ? t : 0;
    },
    _msgTs(m) {
      if (!m) return 0;
      if (m._ts) return Number(m._ts) || 0;
      const x = /^m(\d{13})/.exec(m.id || '');
      return x ? Number(x[1]) : 0;
    },
    _lastActivity(sid) {
      let best = 0, label = '';
      const set = (ts, text) => {
        if (ts && ts >= best) { best = ts; label = text; }
      };
      const msgs = API.Messages.getThread(sid);
      const lastMsg = msgs[msgs.length - 1];
      set(this._msgTs(lastMsg), lastMsg?.role === 'in' ? 'রিসালা এসেছে' : 'রিসালা পাঠানো');
      API.Docs.getForStudent(sid).forEach(d => set(Date.parse(d.uploadedAt || ''), d.sentBy === 'teacher' ? 'ডক পাঠানো' : 'ডক এসেছে'));
      API.TeacherNotes.getAll(sid).forEach(n => set(this._noteTs(n), 'শিক্ষক নোট'));
      this._visibleStudentNotes(sid).forEach(n => set(this._noteTs(n), 'বিবরণ নোট'));
      return { ts: best, label };
    },
    _activePendingQuizzes(sid) {
      const now = today();
      let pending = 0, manual = 0;
      API.Exams.getQuizzes().forEach(q => {
        if (!(q.assigneeIds || []).includes(sid)) return;
        if (q.deadline && q.deadline < now) return;
        const sub = API.Exams.getSubmission(q.id, sid);
        if (!sub) pending++;
        else if (sub.needsManualGrade) manual++;
      });
      return { pending, manual };
    },
    getSummary() {
      const y = _yesterday();
      const overview = API.Tasks.getTodayOverview(y);
      let dayDone = 0, dayTotal = 0;
      overview.forEach(o => {
        dayDone += o.completed.length;
        dayTotal += o.completed.length + o.pending.length;
      });
      const students = API.Students.getAll();
      const rows = students.map(s => this.getStudentRow(s.id));
      let behindDay = 0, unreadMessages = 0, pendingDocs = 0, pendingSched = 0, pendingQuiz = 0, manualQuiz = 0, noteCount = 0, teacherNoteCount = 0, studentNoteCount = 0, attentionCount = 0;
      rows.forEach(r => {
        if (r.dayTotal > 0 && r.dayDone < r.dayTotal) behindDay++;
        unreadMessages += r.unreadMessages;
        pendingDocs += r.pendingDocs;
        pendingSched += r.pendingSchedule ? 1 : 0;
        pendingQuiz += r.pendingQuiz;
        manualQuiz += r.manualQuiz;
        noteCount += r.noteCount;
        teacherNoteCount += r.teacherNoteCount;
        studentNoteCount += r.studentNoteCount;
        if (r.needsAttention) attentionCount++;
      });
      const cfg = API.ProgressSettings.get();
      const yLabel = new Date(y + 'T12:00:00Z').toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' });
      return {
        dayPct: dayTotal > 0 ? Math.round(dayDone / dayTotal * 100) : 0,
        dayDone, dayTotal, behindDay, unreadMessages, pendingDocs, pendingSched, pendingQuiz, manualQuiz, noteCount, teacherNoteCount, studentNoteCount, attentionCount,
        // পুরনো কী — UI সামঞ্জস্য
        todayPct: dayTotal > 0 ? Math.round(dayDone / dayTotal * 100) : 0,
        todayDone: dayDone, todayTotal: dayTotal, behindToday: behindDay,
        progressLabel: cfg.mode === 'custom' ? 'নির্দিষ্ট তারিখ থেকে' : 'ভর্তির তারিখ থেকে',
        dateLabel: yLabel,
        dayLabel: 'গতকাল',
      };
    },
    getStudentRow(sid) {
      const t = this._dayProgress(sid);
      const flags = [];
      const pendingDocs = API.Docs.getAll().filter(d => d.studentId === sid && d.reviewStatus === 'pending' && d.sentBy !== 'teacher').length;
      if (pendingDocs) flags.push('doc');
      const DS = typeof window !== 'undefined' ? window.API?.DailySchedule : null;
      const pendingSchedule = !!(DS && DS.hasPendingApproval && DS.hasPendingApproval(sid));
      if (pendingSchedule) flags.push('sched');
      const quiz = this._activePendingQuizzes(sid);
      if (quiz.pending) flags.push('quiz');
      if (quiz.manual) flags.push('grade');
      const unreadMessages = API.Messages.unreadCount(sid, 'in') | 0;
      if (unreadMessages) flags.push('msg');
      const prog = API.Tasks.getListProgress(sid);
      const teacherNoteCount = API.TeacherNotes.getAll(sid).length;
      const studentNoteCount = this._visibleStudentNotes(sid).length;
      const noteCount = teacherNoteCount + studentNoteCount;
      const lastActivity = this._lastActivity(sid);
      const progressPct = Math.max(0, Math.min(100, prog.percent | 0));
      const needsAttention = unreadMessages > 0 || pendingDocs > 0 || pendingSchedule || quiz.pending > 0 || quiz.manual > 0 || (t.total > 0 && t.done < t.total);
      return {
        dayDone: t.done, dayTotal: t.total, todayDone: t.done, todayTotal: t.total,
        progressPct, unreadMessages, pendingDocs, pendingSchedule,
        pendingQuiz: quiz.pending, manualQuiz: quiz.manual,
        teacherNoteCount, studentNoteCount, noteCount,
        lastActivity, needsAttention, flags,
      };
    },
    getBatchHint(students, yearFilter) {
      if (!students.length) return { count: 0, avgPct: 0, behindDay: 0, behindToday: 0, prefix: 'মোট ০ জন' };
      let sum = 0, behind = 0;
      students.forEach(s => {
        sum += Math.max(0, Math.min(100, API.Tasks.getListProgress(s.id).percent | 0));
        const t = this._dayProgress(s.id);
        if (t.total > 0 && t.done < t.total) behind++;
      });
      const avg = Math.round(sum / students.length);
      const y = yearFilter === 1 ? '১ম বর্ষ' : yearFilter === 2 ? '২য় বর্ষ' : yearFilter === 3 ? '৩য় বর্ষ' : '';
      const prefix = y ? `${y} · ${students.length} জন` : `মোট ${students.length} জন`;
      return { count: students.length, avgPct: avg, behindDay: behind, behindToday: behind, prefix };
    },
  };

  Object.assign(API, { Biboron });
})(window.API);

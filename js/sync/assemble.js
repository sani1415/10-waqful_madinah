/* Waqful Madinah — js/sync/assemble.js: relational rows (snake_case) → in-memory blobs (camelCase); teacher/student bundle assembly.
   Loaded before js/sync/remote-sync.js, which calls this factory with `ctx`
   (live getters for its state and functions). */
(function (w) {
  w._RSModules = w._RSModules || {};
  w._RSModules.assemble = function (ctx) {
    // ── Field conversion: DB (snake_case) → mem (camelCase) ──────
    function stuFromDB(r) {
      return { id: r.id, waqfId: r.waqf_id, name: r.name, cls: r.cls || '', roll: r.roll || '',
        pin: r.pin, color: r.color || '#128C7E', note: r.note || '',
        fatherName: r.father_name || '', fatherOccupation: r.father_occupation || '',
        contact: r.contact || '', district: r.district || '', upazila: r.upazila || '',
        bloodGroup: r.blood_group || '', enrollmentDate: r.enrollment_date || '',
        responsibility: r.responsibility || '' };
    }

    function msgFromDB(m) {
      return { id: m.id, role: m.role, type: m.type || 'text', text: m.text || '',
        read: m.is_read || false,
        time: m.sent_at ? new Date(m.sent_at).toTimeString().slice(0, 5) : '',
        _ts: m.sent_at ? new Date(m.sent_at).getTime() : 0,
        ...(m.extra && typeof m.extra === 'object' ? m.extra : {}) };
    }

    function _parseProposalRows(pr) {
      const arr = Array.isArray(pr) ? pr : [];
      return arr.map((x, i) => ({
        id: x.id || ('p' + i),
        task: String(x.task || ''),
        time: String(x.time || ''),
        sort: i,
      }));
    }

    function buildDailyScheduleByStudent(bundle) {
      const rows = bundle.daily_schedule_rows || [];
      const props = bundle.daily_schedule_proposals || [];
      const by = {};
      for (const r of rows) {
        const sid = r.student_id;
        if (!by[sid]) by[sid] = { rows: [], pending: null };
        by[sid].rows.push({
          id: r.id,
          task: r.task_text || '',
          time: r.time_text || '',
          sort: r.sort_order,
        });
      }
      Object.keys(by).forEach(k => { by[k].rows.sort((a, b) => a.sort - b.sort); });
      for (const p of props) {
        const sid = p.student_id;
        if (!by[sid]) by[sid] = { rows: [], pending: null };
        by[sid].pending = {
          rows: _parseProposalRows(p.proposed_rows),
          status: p.status,
          submittedAt: p.submitted_at || '',
          teacherNote: p.teacher_note || '',
        };
      }
      return by;
    }

    function buildStudentDailySchedule(bundle, sid) {
      const rows = (bundle.daily_schedule_rows || [])
        .filter(r => r.student_id === sid)
        .map(r => ({
          id: r.id,
          task: r.task_text || '',
          time: r.time_text || '',
          sort: r.sort_order,
        }));
      rows.sort((a, b) => a.sort - b.sort);
      const props = bundle.daily_schedule_proposals || [];
      const p = Array.isArray(props) ? props.find(x => x.student_id === sid) : null;
      let pending = null;
      if (p && p.status) {
        pending = {
          rows: _parseProposalRows(p.proposed_rows),
          status: p.status,
          submittedAt: p.submitted_at || '',
          teacherNote: p.teacher_note || '',
        };
      }
      return { rows, pending };
    }

    // ── Assemble relational teacher bundle → mem ─────────────────
    function assembleTeacherBundle(bundle) {
      const cfg = bundle.config || {};
      const students = (bundle.students || []).map(stuFromDB);
      const chats = { _bc: [] };
      students.forEach(s => { chats[s.id] = []; });
      (bundle.messages || []).forEach(m => {
        ctx._savedMsgIds.add(m.id);
        const msg = msgFromDB(m);
        if (m.thread_id === '_bc') chats._bc.push(msg);
        else { if (!chats[m.thread_id]) chats[m.thread_id] = []; chats[m.thread_id].push(msg); }
      });
      const asByTask = {};
      (bundle.task_assignments || []).forEach(ta => {
        (asByTask[ta.task_id] = asByTask[ta.task_id] || []).push(ta);
      });
      const tasks = (bundle.tasks || []).map(t => {
        const assignees = {}, completedBy = {};
        (asByTask[t.id] || []).forEach(ta => {
          assignees[ta.student_id] = ta.status;
          if (ta.completed_date || ta.completed_time)
            completedBy[ta.student_id] = { date: ta.completed_date || '', time: ta.completed_time || '' };
        });
        return { id: t.id, title: t.title, desc: t.description || '', type: t.type || 'onetime',
          deadline: t.deadline || '', created: t.created_at || '', assignees, completedBy };
      });
      const goals = {};
      (bundle.goals || []).forEach(g => {
        (goals[g.student_id] = goals[g.student_id] || []).push(
          { id: g.id, title: g.title, cat: g.cat, deadline: g.deadline || '',
            note: g.note || '', done: g.done || false, created: g.created_at || '' });
      });
      const qByQ = {}, aByQ = {};
      (bundle.quiz_questions || []).forEach(q => {
        (qByQ[q.quiz_id] = qByQ[q.quiz_id] || []).push({ id: q.id, type: q.type, text: q.text,
          options: q.options || [], correctAnswer: q.correct_answer, marks: q.marks || 1,
          uploadInstructions: q.upload_instructions });
      });
      (bundle.quiz_assignees || []).forEach(qa => {
        (aByQ[qa.quiz_id] = aByQ[qa.quiz_id] || []).push(qa.student_id);
      });
      const quizzes = (bundle.quizzes || []).map(q => ({
        id: q.id, title: q.title, subject: q.subject || '', desc: q.description || '',
        timeLimit: q.time_limit || 30, audioLimitSeconds: q.audio_limit_seconds || 120, passPercent: q.pass_percent || 60,
        deadline: q.deadline || '', created: q.created_at || '',
        questions: qByQ[q.id] || [], assigneeIds: aByQ[q.id] || [] }));
      const submissions = (bundle.quiz_submissions || []).map(qs => ({
        id: qs.id, quizId: qs.quiz_id, studentId: qs.student_id, studentName: qs.student_name || '',
        answers: qs.answers || {}, score: qs.score || 0, total: qs.total || 0,
        passed: qs.passed || false, needsManualGrade: qs.needs_manual_grade || false }));
      const docs = (bundle.documents || []).map(d => ({
        id: d.id, studentId: d.student_id, studentName: d.student_name || '',
        fileName: d.file_name, fileType: d.file_type || '', fileSize: d.file_size || 0,
        category: d.category || 'general', note: d.note || '',
        storage_path: d.storage_path, fileUrl: d.file_url, read: d.is_read || false,
        uploadedAt: d.uploaded_at || '', reviewStatus: d.review_status || 'done',
        reviewComment: d.review_comment || '', reviewedAt: d.reviewed_at || '',
        reviewMessageId: d.review_message_id || '' }));
      const academic = {}, tnotes = {};
      (bundle.academic_history || []).forEach(ah => {
        (academic[ah.student_id] = academic[ah.student_id] || []).push(
          { id: ah.id, yearClass: ah.year_class, grade: ah.grade, addedAt: ah.added_at || '' });
      });
      (bundle.teacher_notes || []).forEach(tn => {
        (tnotes[tn.student_id] = tnotes[tn.student_id] || []).push(
          { id: tn.id, text: tn.text, date: tn.note_date || '', time: tn.note_time || '' });
      });
      ctx.mem.core = { teacher: { name: cfg.teacher_name || '', madrasa: cfg.madrasa_name || 'وقف المدينة' },
        students, chats, tasks };
      ctx.mem.goals = goals; ctx.mem.exams = { quizzes, submissions };
      ctx.mem.docs = docs; ctx.mem.academic = academic; ctx.mem.tnotes = tnotes;
      ctx.mem.teacherPin = cfg.teacher_pin ? String(cfg.teacher_pin) : null;
      ctx.mem.completions = Array.isArray(bundle.completions)
        ? bundle.completions.map(tc => ({
          id: tc.id,
          task_id: tc.task_id,
          student_id: tc.student_id,
          date: (tc.comp_date || tc.date || ''),
          status: tc.status || 'done',
          completed_at: tc.completed_at || null,
          note: tc.note || '',
          created_at: tc.created_at || null,
        }))
        : [];
      ctx.mem.dailyScheduleByStudent = buildDailyScheduleByStudent(bundle);
      ctx.mem.noteCategories = (bundle.note_categories || []).map((c, i) => ({
        id: c.id, label: c.label || '', sort: typeof c.sort_order === 'number' ? c.sort_order : i,
      }));
      const notesBy = {};
      (bundle.student_notes || []).forEach(n => {
        const sid = n.student_id;
        if (!sid) return;
        (notesBy[sid] = notesBy[sid] || []).push({
          id: n.id, studentId: sid,
          categoryId: n.category_id || 'general',
          date: n.note_date || '', time: n.note_time || '',
          title: n.title || '', text: n.text || '',
          reviewStatus: n.review_status || 'done',
        });
      });
      ctx.mem.studentNotesByStudent = notesBy;
      ctx.mem.fortnightly = {
        enabled: !!cfg.fortnightly_enabled,
        intervalDays: cfg.fortnightly_interval_days > 0 ? cfg.fortnightly_interval_days : 15,
        categoryId: cfg.fortnightly_category_id || '',
        questions: Array.isArray(cfg.fortnightly_questions) ? cfg.fortnightly_questions : [],
      };
    }

    // ── Assemble relational student bundle → mem ─────────────────
    function assembleStudentBundle(bundle) {
      const stu = bundle.student ? stuFromDB(bundle.student) : null;
      const cfg = bundle.config || {};
      const chats = { _bc: [] };
      if (stu) chats[stu.id] = [];
      (bundle.messages || []).forEach(m => {
        ctx._savedMsgIds.add(m.id);
        const msg = msgFromDB(m);
        if (m.thread_id === '_bc') chats._bc.push(msg);
        else { if (!chats[m.thread_id]) chats[m.thread_id] = []; chats[m.thread_id].push(msg); }
      });
      const tasks = (bundle.tasks || []).filter(Boolean).map(item => {
        const t = item.task || item, ta = item.assignment || {};
        return { id: t.id, title: t.title, desc: t.description || '', type: t.type || 'onetime',
          deadline: t.deadline || '', created: t.created_at || '',
          assignees: stu ? { [stu.id]: ta.status || 'pending' } : {},
          completedBy: stu && (ta.completed_date || ta.completed_time)
            ? { [stu.id]: { date: ta.completed_date || '', time: ta.completed_time || '' } } : {} };
      });
      const goals = {};
      (bundle.goals || []).forEach(g => {
        (goals[g.student_id] = goals[g.student_id] || []).push(
          { id: g.id, title: g.title, cat: g.cat, deadline: g.deadline || '',
            note: g.note || '', done: g.done || false, created: g.created_at || '' });
      });
      const quizzes = (bundle.quizzes || []).filter(Boolean).map(item => {
        const q = item.quiz || item;
        return { id: q.id, title: q.title, subject: q.subject || '', desc: q.description || '',
          timeLimit: q.time_limit || 30, audioLimitSeconds: q.audio_limit_seconds || 120, passPercent: q.pass_percent || 60,
          deadline: q.deadline || '', created: q.created_at || '',
          questions: (item.questions || []).map(qq => ({ id: qq.id, type: qq.type, text: qq.text,
            options: qq.options || [], correctAnswer: qq.correct_answer, marks: qq.marks || 1 })),
          assigneeIds: stu ? [stu.id] : [] };
      });
      const submissions = (bundle.quizzes || []).filter(Boolean)
        .map(i => i.submission).filter(Boolean).map(qs => ({
          id: qs.id, quizId: qs.quiz_id, studentId: qs.student_id, studentName: qs.student_name || '',
          answers: qs.answers || {}, score: qs.score || 0, total: qs.total || 0,
          passed: qs.passed || false, needsManualGrade: qs.needs_manual_grade || false }));
      const docs = (bundle.documents || []).map(d => ({
        id: d.id, studentId: d.student_id, studentName: d.student_name || '',
        fileName: d.file_name, fileType: d.file_type || '', fileSize: d.file_size || 0,
        category: d.category || 'general', note: d.note || '',
        storage_path: d.storage_path, fileUrl: d.file_url, read: d.is_read || false,
        uploadedAt: d.uploaded_at || '', reviewStatus: d.review_status || 'done',
        reviewComment: d.review_comment || '', reviewedAt: d.reviewed_at || '',
        reviewMessageId: d.review_message_id || '' }));
      const academic = {};
      (bundle.academic_history || []).forEach(ah => {
        (academic[ah.student_id] = academic[ah.student_id] || []).push(
          { id: ah.id, yearClass: ah.year_class, grade: ah.grade, addedAt: ah.added_at || '' });
      });
      ctx.mem.core = { teacher: { name: cfg.teacher_name || '', madrasa: cfg.madrasa || 'وقف المدينة' },
        students: stu ? [stu] : [], chats, tasks };
      ctx.mem.goals = goals; ctx.mem.exams = { quizzes, submissions };
      ctx.mem.docs = docs; ctx.mem.academic = academic; ctx.mem.tnotes = {};
      ctx.mem.teacherPin = null;
      ctx.mem.completions = Array.isArray(bundle.completions)
        ? bundle.completions.map(tc => ({
          id: tc.id,
          task_id: tc.task_id,
          student_id: tc.student_id,
          date: (tc.comp_date || tc.date || ''),
          status: tc.status || 'done',
          completed_at: tc.completed_at || null,
          note: tc.note || '',
          created_at: tc.created_at || null,
        }))
        : [];
      ctx.mem.dailySchedule = stu ? buildStudentDailySchedule(bundle, stu.id) : { rows: [], pending: null };
      ctx.mem.noteCategories = (bundle.note_categories || []).map((c, i) => ({
        id: c.id, label: c.label || '', sort: typeof c.sort_order === 'number' ? c.sort_order : i,
      }));
      const notesBy = {};
      (bundle.student_notes || []).forEach(n => {
        const sid = n.student_id || (stu && stu.id);
        if (!sid) return;
        (notesBy[sid] = notesBy[sid] || []).push({
          id: n.id, studentId: sid,
          categoryId: n.category_id || 'general',
          date: n.note_date || '', time: n.note_time || '',
          title: n.title || '', text: n.text || '',
          reviewStatus: n.review_status || 'done',
        });
      });
      ctx.mem.studentNotesByStudent = notesBy;
      ctx.mem.fortnightly = {
        enabled: !!cfg.fortnightly_enabled,
        intervalDays: cfg.fortnightly_interval_days > 0 ? cfg.fortnightly_interval_days : 15,
        categoryId: cfg.fortnightly_category_id || '',
        questions: Array.isArray(cfg.fortnightly_questions) ? cfg.fortnightly_questions : [],
      };
    }

    return { stuFromDB, msgFromDB, _parseProposalRows, buildDailyScheduleByStudent, buildStudentDailySchedule, assembleTeacherBundle, assembleStudentBundle };
  };
})(typeof window !== 'undefined' ? window : globalThis);

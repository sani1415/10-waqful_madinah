/* Waqful Madinah — js/sync/ops.js: relational write/read operations (madrasa_rel_* RPCs), file storage, groups, diary.
   Loaded before js/sync/remote-sync.js, which calls this factory with `ctx`
   (live getters for its state and functions). */
(function (w) {
  w._RSModules = w._RSModules || {};
  w._RSModules.ops = function (ctx) {
    async function fetchGroupsRemote() {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      try {
        const { data, error } = await sb.rpc('madrasa_rel_get_groups', { p_teacher_pin: ctx._teacherPin });
        if (error || !data) return;
        const raw = typeof data === 'string' ? JSON.parse(data) : data;
        ctx.mem.groups = (Array.isArray(raw) ? raw : []).map(g => ({
          id: g.id, name: g.name,
          studentIds: Array.isArray(g.student_ids) ? g.student_ids : [],
          createdAt: g.created_at || '',
        }));
      } catch (e) { console.warn('fetchGroupsRemote:', e); }
    }

    async function upsertGroupRemote(g) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_group', {
        p_teacher_pin: ctx._teacherPin,
        p_id: g.id, p_name: g.name,
        p_student_ids: g.studentIds || [],
      });
    }

    async function deleteGroupRemote(gid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_group', { p_teacher_pin: ctx._teacherPin, p_group_id: gid });
    }

    async function fetchDiaryRemote() {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      try {
        const { data, error } = await sb.rpc('madrasa_rel_get_diary', { p_teacher_pin: ctx._teacherPin });
        if (error || !data) return;
        const raw = typeof data === 'string' ? JSON.parse(data) : data;
        ctx.mem.diary = (Array.isArray(raw) ? raw : []).map(d => ({
          id: d.id, date: d.date || '', time: d.time || '',
          text: d.text || '', edited: d.edited || null,
        }));
      } catch (e) { console.warn('fetchDiaryRemote:', e); }
    }

    async function upsertDiaryRemote(entry) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_diary', {
        p_teacher_pin: ctx._teacherPin,
        p_id: entry.id, p_date: entry.date || '', p_time: entry.time || '',
        p_text: entry.text || '', p_edited: entry.edited || null,
      });
    }

    async function deleteDiaryRemote(id) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_diary', { p_teacher_pin: ctx._teacherPin, p_id: id });
    }

    // ── File storage ──────────────────────────────────────────────
    async function uploadFile(path, file) {
      if (!file || typeof file.size !== 'number' || file.size > 10 * 1024 * 1024) throw new Error('file_too_large');
      const sb = ctx.getClient();
      const { error } = await sb.storage.from(ctx.BUCKET).upload(path, file,
        { upsert: true, contentType: file.type || 'application/octet-stream' });
      if (error) throw error;
      const { data, error: e2 } = await sb.storage.from(ctx.BUCKET).createSignedUrl(path, ctx.SIGNED_URL_SEC);
      if (e2) throw e2;
      return { url: data.signedUrl, path };
    }

    async function getSignedUrlForPath(path) {
      const sb = ctx.getClient(); if (!sb || !path) return null;
      const { data, error } = await sb.storage.from(ctx.BUCKET).createSignedUrl(path, ctx.SIGNED_URL_SEC);
      if (error) { console.error('Signed URL failed:', path, error); return null; }
      return data.signedUrl;
    }

    function consumeUploadResult(res) {
      if (res && typeof res === 'object' && res.url) return { fileUrl: res.url, storagePath: res.path };
      return { fileUrl: res, storagePath: null };
    }

    async function upsertCompletionRemote(row) {
      if (!ctx.usesSecureKv()) return;
      const sb = ctx.getClient(); if (!sb) return;
      const r = ctx.role(), pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      return ctx._write.upsertCompletionRemote(sb, row, pin, r);
    }

    async function deleteCompletionRemote(tid, sid, date) {
      if (!ctx.usesSecureKv()) return;
      const sb = ctx.getClient(); if (!sb) return;
      const r = ctx.role(), pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      return ctx._write.deleteCompletionRemote(sb, tid, sid, date, pin, r);
    }

    async function clearStudentDataRemote(sid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) throw new Error('remote_unavailable');
      await ctx.rpcOrThrow(sb, 'madrasa_rel_clear_student_data', { p_teacher_pin: ctx._teacherPin, p_student_id: sid });
    }

    async function deleteStudentRemote(sid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) throw new Error('remote_unavailable');
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_student', { p_teacher_pin: ctx._teacherPin, p_student_id: sid });
      if (Array.isArray(ctx.mem.lockHints)) ctx.mem.lockHints = ctx.mem.lockHints.filter(s => s.id !== sid);
    }

    async function deleteQuizRemote(qid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) throw new Error('remote_unavailable');
      if (!qid) throw new Error('invalid_quiz');
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_quiz', { p_teacher_pin: ctx._teacherPin, p_quiz_id: qid });
    }

    async function getBroadcastReadCounts() {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return [];
      const sb = ctx.getClient(); if (!sb) return [];
      try {
        const { data, error } = await sb.rpc('madrasa_rel_broadcast_read_counts', { p_teacher_pin: ctx._teacherPin });
        if (error) return [];
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    }

    async function deleteMessageRemote(mid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb || !mid) return;
      try {
        await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_message', { p_teacher_pin: ctx._teacherPin, p_message_id: mid });
      } catch (e) { console.warn('deleteMessageRemote:', e); }
    }

    async function updateMessageTextRemote(mid, text) {
      if (!ctx.usesSecureKv() || !mid) return;
      const sb = ctx.getClient(); if (!sb) throw new Error('remote_unavailable');
      const r = ctx.role();
      const pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      if (!pin) throw new Error('missing_pin');
      await ctx.rpcOrThrow(sb, 'madrasa_rel_update_message_text', {
        p_pin: pin,
        p_role: r === 'teacher' ? 'teacher' : 'student',
        p_message_id: mid,
        p_new_text: String(text || ''),
      });
    }

    async function sendMessageRemote(threadId, msg) {
      if (!ctx.usesSecureKv()) return;
      const sb = ctx.getClient(); if (!sb) throw new Error('remote_unavailable');
      const r = ctx.role();
      const pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      if (!pin) throw new Error('missing_pin');
      if (!msg || !msg.id) throw new Error('invalid_message');
      if (msg._skipRemote) return;
      const { id, role: msgRole, type, text, read, time, ...extra } = msg;
      const p_message = { id, thread_id: threadId,
        role: msgRole || (r === 'teacher' ? 'out' : 'in'),
        type: type || 'text', text: text || '',
        extra, is_read: read || false, sent_at: null,
        ...(r === 'student' ? { thread_id_waqf: ctx._studentWaqf } : {}),
      };
      await ctx.rpcOrThrow(sb, 'madrasa_rel_insert_message', { p_pin: pin, p_role: r, p_message });
      ctx._savedMsgIds.add(id);
    }

    async function deleteOwnMessageRemote(mid) {
      if (!ctx.usesSecureKv() || !mid) return;
      const sb = ctx.getClient(); if (!sb) throw new Error('remote_unavailable');
      const r = ctx.role();
      const pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      if (!pin) throw new Error('missing_pin');
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_own_message', {
        p_pin: pin,
        p_role: r === 'teacher' ? 'teacher' : 'student',
        p_message_id: mid,
      });
    }

    async function saveTaskRemote(task) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb || !task) return;
      const p_task = { id: task.id, title: task.title, description: task.desc || '',
        type: task.type || 'onetime', deadline: task.deadline || '', created_at: task.created || '' };
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_task', {
        p_teacher_pin: ctx._teacherPin, p_task,
        p_assignee_ids: Object.keys(task.assignees || {}),
      });
      for (const [sid, status] of Object.entries(task.assignees || {})) {
        const cb = (task.completedBy || {})[sid] || {};
        await ctx.rpcOrThrow(sb, 'madrasa_rel_update_task_status', {
          p_pin: ctx._teacherPin, p_role: 'teacher',
          p_task_id: task.id, p_student_id: sid, p_status: status,
          p_completed_date: cb.date || null, p_completed_time: cb.time || null,
        });
      }
    }

    async function saveQuizRemote(quiz) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin || !quiz) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx._write.saveExams(sb, { quizzes: [quiz], submissions: [] });
    }

    async function saveStudentRemote(student) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb || !student) return;
      const stuToDB = s => ({
        id: s.id, waqf_id: s.waqfId, name: s.name, cls: s.cls || '', roll: s.roll || '',
        pin: s.pin, color: s.color || '#128C7E', note: s.note || '',
        father_name: s.fatherName || '', father_occupation: s.fatherOccupation || '',
        contact: s.contact || '', district: s.district || '', upazila: s.upazila || '',
        blood_group: s.bloodGroup || '', enrollment_date: s.enrollmentDate || '',
        responsibility: s.responsibility || '',
      });
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_student', { p_teacher_pin: ctx._teacherPin, p_student: stuToDB(student) });
    }

    async function deleteTaskRemote(tid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) throw new Error('remote_unavailable');
      if (!tid) throw new Error('invalid_task');
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_task', { p_teacher_pin: ctx._teacherPin, p_task_id: tid });
      if (ctx.mem.core && Array.isArray(ctx.mem.core.tasks))
        ctx.mem.core.tasks = ctx.mem.core.tasks.filter(t => t.id !== tid);
    }

    async function submitDailyScheduleProposalRemote(rows) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'student' || !ctx._studentWaqf || !ctx._studentPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      try {
        await ctx.rpcOrThrow(sb, 'madrasa_rel_submit_daily_schedule_proposal', {
          p_waqf: ctx.normalizeWaqfForRpc(ctx._studentWaqf),
          p_pin: String(ctx._studentPin || ''),
          p_rows: rows,
        });
        await ctx.pullRemoteSnapshot();
      } catch (e) { console.warn('submitDailyScheduleProposalRemote:', e); throw e; }
    }

    async function setDailyScheduleTeacherRemote(sid, rows) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      try {
        await ctx.rpcOrThrow(sb, 'madrasa_rel_set_daily_schedule', {
          p_teacher_pin: ctx._teacherPin,
          p_student_id: sid,
          p_rows: rows,
        });
        await ctx.pullRemoteSnapshot();
      } catch (e) { console.warn('setDailyScheduleTeacherRemote:', e); throw e; }
    }

    async function upsertTeacherNoteRemote(note, sid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_teacher_note', {
        p_teacher_pin: ctx._teacherPin,
        p_id: note.id,
        p_student_id: sid,
        p_text: note.text || '',
        p_date: note.date || null,
        p_time: note.time || '',
        p_edited_at: note.edited || null,
      });
    }

    async function deleteTeacherNoteRemote(nid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb || !nid) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_teacher_note', { p_teacher_pin: ctx._teacherPin, p_id: nid });
    }

    async function updateConfigRemote(info) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_update_config', {
        p_teacher_pin: ctx._teacherPin,
        p_teacher_name: String(info?.name || ''),
        p_madrasa_name: String(info?.madrasa || ''),
      });
    }

    async function updateFortnightlyConfigRemote(cfg) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_update_fortnightly_config', {
        p_teacher_pin: ctx._teacherPin,
        p_enabled: !!cfg.enabled,
        p_interval_days: cfg.intervalDays > 0 ? cfg.intervalDays : 15,
        p_category_id: cfg.categoryId || '',
        p_questions: cfg.questions || [],
      });
      ctx.mem.fortnightly = {
        enabled: !!cfg.enabled,
        intervalDays: cfg.intervalDays > 0 ? cfg.intervalDays : 15,
        categoryId: cfg.categoryId || '',
        questions: cfg.questions || [],
      };
    }

    async function upsertAcademicHistoryRemote(sid, record) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_academic_history', {
        p_teacher_pin: ctx._teacherPin,
        p_student_id: sid,
        p_record: {
          id: record.id,
          year_class: record.yearClass || '',
          grade: record.grade || '',
          added_at: record.addedAt || '',
        },
      });
    }

    async function deleteAcademicHistoryRemote(sid, id) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_academic_history', {
        p_teacher_pin: ctx._teacherPin,
        p_student_id: sid,
        p_id: id,
      });
    }

    async function upsertGoalRemote(goal, sid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'student' || !ctx._studentPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_goal', {
        p_pin: ctx._studentPin,
        p_student_id: sid,
        p_goal: {
          id: goal.id,
          title: goal.title,
          cat: goal.cat || 'other',
          deadline: goal.deadline || '',
          note: goal.note || '',
          done: !!goal.done,
          created_at: goal.created || '',
        },
      });
    }

    async function deleteGoalRemote(sid, gid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'student' || !ctx._studentPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_goal', {
        p_pin: ctx._studentPin,
        p_student_id: sid,
        p_goal_id: gid,
      });
    }

    function _patchNoteInMem(note, sid, reviewStatus) {
      const by = ctx.mem.studentNotesByStudent || (ctx.mem.studentNotesByStudent = {});
      const list = by[sid] || (by[sid] = []);
      const ix = list.findIndex(n => n.id === note.id);
      const row = {
        id: note.id, studentId: sid,
        categoryId: note.categoryId || 'general',
        date: note.date || '', time: note.time || '',
        title: note.title || '', text: note.text || '',
        reviewStatus: reviewStatus || (ix >= 0 ? list[ix].reviewStatus : 'pending') || 'pending',
      };
      if (ix >= 0) list[ix] = row; else list.unshift(row);
    }

    async function upsertStudentNoteRemote(note, sid) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'student' || !ctx._studentPin) {
        throw new Error('note_save_unavailable');
      }
      const sb = ctx.getClient();
      if (!sb) throw new Error('note_save_unavailable');
      const res = await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_student_note', {
        p_pin: ctx._studentPin,
        p_student_id: sid,
        p_note: {
          id: note.id,
          category_id: note.categoryId || 'general',
          date: note.date || '',
          time: note.time || '',
          title: note.title || '',
          text: note.text || '',
        },
      });
      _patchNoteInMem(note, sid, res && res.review_status);
    }

    async function markNoteReviewedRemote(noteId) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_mark_note_reviewed', {
        p_teacher_pin: ctx._teacherPin,
        p_note_id: noteId,
      });
      const by = ctx.mem.studentNotesByStudent || {};
      Object.keys(by).forEach(sid => {
        const n = (by[sid] || []).find(x => x.id === noteId);
        if (n) n.reviewStatus = 'done';
      });
    }

    async function deleteStudentNoteRemote(sid, noteId) {
      if (!ctx.usesSecureKv()) throw new Error('note_delete_unavailable');
      const sb = ctx.getClient();
      if (!sb) throw new Error('note_delete_unavailable');
      if (ctx.role() === 'student' && ctx._studentPin) {
        await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_student_note', {
          p_pin: ctx._studentPin,
          p_student_id: sid,
          p_note_id: noteId,
        });
      } else if (ctx.role() === 'teacher' && ctx._teacherPin) {
        await ctx.rpcOrThrow(sb, 'madrasa_rel_teacher_delete_student_note', {
          p_teacher_pin: ctx._teacherPin,
          p_note_id: noteId,
        });
      } else {
        throw new Error('note_delete_unavailable');
      }
      const by = ctx.mem.studentNotesByStudent || {};
      if (by[sid]) by[sid] = by[sid].filter(n => n.id !== noteId);
    }

    async function upsertNoteCategoryRemote(cat) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_upsert_note_category', {
        p_teacher_pin: ctx._teacherPin,
        p_id: cat.id,
        p_label: cat.label,
        p_sort_order: typeof cat.sort === 'number' ? cat.sort : null,
      });
      const list = ctx.mem.noteCategories || (ctx.mem.noteCategories = []);
      const ix = list.findIndex(c => c.id === cat.id);
      const row = { id: cat.id, label: cat.label, sort: typeof cat.sort === 'number' ? cat.sort : list.length };
      if (ix >= 0) list[ix] = row; else list.push(row);
    }

    async function deleteNoteCategoryRemote(id) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_note_category', {
        p_teacher_pin: ctx._teacherPin,
        p_id: id,
      });
      ctx.mem.noteCategories = (ctx.mem.noteCategories || []).filter(c => c.id !== id);
      const by = ctx.mem.studentNotesByStudent || {};
      Object.keys(by).forEach(sid => {
        by[sid] = (by[sid] || []).map(n =>
          n.categoryId === id ? { ...n, categoryId: 'general' } : n
        );
      });
    }

    async function deleteDocumentRemote(id) {
      if (!ctx.usesSecureKv() || !id) return;
      const sb = ctx.getClient(); if (!sb) return;
      const r = ctx.role();
      const pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      if (!pin) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_delete_document', {
        p_pin: pin,
        p_role: r,
        p_doc_id: id,
      });
    }

    async function saveDocumentRemote(doc) {
      if (!ctx.usesSecureKv() || !doc) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx._write.saveDocs(sb, [doc]);
    }

    async function submitQuizRemote(submission) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'student' || !ctx._studentPin || !submission) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_submit_quiz', {
        p_student_pin: ctx._studentPin,
        p_student_id: submission.studentId,
        p_submission: {
          id: submission.id,
          quiz_id: submission.quizId,
          student_name: submission.studentName || '',
          answers: submission.answers || {},
          score: submission.score || 0,
          total: submission.total || 0,
          passed: !!submission.passed,
          needs_manual_grade: !!submission.needsManualGrade,
          submitted_at: submission.submittedAt || null,
        },
      });
    }

    async function updateQuizScoreRemote(submissionId, score) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_update_quiz_score', {
        p_teacher_pin: ctx._teacherPin,
        p_submission_id: submissionId,
        p_score: Number(score) || 0,
      });
    }

    async function updateTaskStatusRemote(taskId, sid, status, completed) {
      if (!ctx.usesSecureKv()) return;
      const sb = ctx.getClient(); if (!sb) return;
      const r = ctx.role();
      const pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      if (!pin) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_update_task_status', {
        p_pin: pin,
        p_role: r,
        p_task_id: taskId,
        p_student_id: sid,
        p_status: status,
        p_completed_date: completed?.date || null,
        p_completed_time: completed?.time || null,
      });
    }

    async function completeOnetimeTaskRemote(row) {
      if (!ctx.usesSecureKv() || !row) return;
      const sb = ctx.getClient(); if (!sb) return;
      const r = ctx.role();
      const pin = r === 'teacher' ? ctx._teacherPin : ctx._studentPin;
      if (!pin) return;
      await ctx.rpcOrThrow(sb, 'madrasa_rel_complete_onetime_task', {
        p_pin: pin,
        p_role: r,
        p_completion_id: row.id,
        p_task_id: row.task_id,
        p_student_id: row.student_id,
        p_date: row.date,
        p_completed_at: row.completed_at || null,
      });
    }

    async function resolveDailyScheduleProposalRemote(sid, approve, note) {
      if (!ctx.usesSecureKv() || ctx.role() !== 'teacher' || !ctx._teacherPin) return;
      const sb = ctx.getClient(); if (!sb) return;
      try {
        await ctx.rpcOrThrow(sb, 'madrasa_rel_resolve_daily_schedule_proposal', {
          p_teacher_pin: ctx._teacherPin,
          p_student_id: sid,
          p_approve: !!approve,
          p_note: String(note || ''),
        });
        await ctx.pullRemoteSnapshot();
      } catch (e) { console.warn('resolveDailyScheduleProposalRemote:', e); throw e; }
    }

    return { fetchGroupsRemote, upsertGroupRemote, deleteGroupRemote, fetchDiaryRemote, upsertDiaryRemote, deleteDiaryRemote, uploadFile, getSignedUrlForPath, consumeUploadResult, upsertCompletionRemote, deleteCompletionRemote, clearStudentDataRemote, deleteStudentRemote, deleteQuizRemote, getBroadcastReadCounts, deleteMessageRemote, updateMessageTextRemote, sendMessageRemote, deleteOwnMessageRemote, saveTaskRemote, saveQuizRemote, saveStudentRemote, deleteTaskRemote, submitDailyScheduleProposalRemote, setDailyScheduleTeacherRemote, upsertTeacherNoteRemote, deleteTeacherNoteRemote, updateConfigRemote, updateFortnightlyConfigRemote, upsertAcademicHistoryRemote, deleteAcademicHistoryRemote, upsertGoalRemote, deleteGoalRemote, _patchNoteInMem, upsertStudentNoteRemote, markNoteReviewedRemote, deleteStudentNoteRemote, upsertNoteCategoryRemote, deleteNoteCategoryRemote, deleteDocumentRemote, saveDocumentRemote, submitQuizRemote, updateQuizScoreRemote, updateTaskStatusRemote, completeOnetimeTaskRemote, resolveDailyScheduleProposalRemote };
  };
})(typeof window !== 'undefined' ? window : globalThis);

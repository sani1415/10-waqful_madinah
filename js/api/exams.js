/* Waqful Madinah · js/api/exams.js — Exams (quizzes). Attaches to window.API (core.js loads first). */
(function (API) {
  const { EXAMS_KEY, MAX_ORAL_AUDIO_BYTES, RS, _useRemote, blobToDataUrl, safeFilePart, today, uid } = API._internal;


  // ── EXAMS ─────────────────────────────────────────────────
  /*
    Quiz structure:
    {
      id, title, subject, desc, timeLimit (minutes), passPercent,
      deadline, created, assigneeIds:[],
      questions: [{id, type, text, options[], correctAnswer, marks, uploadInstructions}]
    }
    Submission structure:
    {
      id, quizId, studentId, studentName,
      answers: { questionId: answer },
      score, total, passed, submittedAt
    }
  */
  const Exams = {
    _readAll() {
      if (_useRemote) return RS.mem.exams || (RS.mem.exams = { quizzes: [], submissions: [] });
      try { return JSON.parse(localStorage.getItem(EXAMS_KEY))||{quizzes:[],submissions:[]}; } catch { return {quizzes:[],submissions:[]}; }
    },
    _write(data) {
      if (_useRemote) {
        RS.mem.exams = data;
        RS.schedule('exams', () => JSON.parse(JSON.stringify(RS.mem.exams)));
        return;
      }
      localStorage.setItem(EXAMS_KEY, JSON.stringify(data));
    },

    getQuizzes()                { return this._readAll().quizzes||[]; },
    getQuizById(qid)            { return this.getQuizzes().find(q=>q.id===qid)||null; },
    getQuizzesForStudent(sid)   { return this.getQuizzes().filter(q=>q.assigneeIds?.includes(sid)); },
    getSubmissions()            { return this._readAll().submissions||[]; },
    getSubmission(qid, sid)     { return this.getSubmissions().find(s=>s.quizId===qid&&s.studentId===sid)||null; },
    getSubmissionsForQuiz(qid)  { return this.getSubmissions().filter(s=>s.quizId===qid); },

    async addQuiz({ title, subject, desc, timeLimit, audioLimitSeconds, passPercent, deadline, assigneeIds, questions }) {
      const data=this._readAll();
      const quiz={
        id:uid('q'), title, subject:subject||'', desc:desc||'',
        timeLimit:parseInt(timeLimit)||30,
        audioLimitSeconds:Math.max(15, Math.min(parseInt(audioLimitSeconds)||120, 600)),
        passPercent:parseInt(passPercent)||60,
        deadline:deadline||'', created:today(),
        assigneeIds:assigneeIds||[],
        questions:(questions||[]).map((q,i)=>({...q,id:uid('qq'+i)})),
      };
      if (_useRemote && RS.saveQuizRemote) await RS.saveQuizRemote(quiz);
      data.quizzes.push(quiz); this._write(data); return quiz;
    },

    async deleteQuiz(qid) {
      if (_useRemote && RS.deleteQuizRemote) await RS.deleteQuizRemote(qid);
      const data=this._readAll();
      data.quizzes=data.quizzes.filter(q=>q.id!==qid);
      data.submissions=data.submissions.filter(s=>s.quizId!==qid);
      this._write(data);
    },

    async _prepareAnswersForSubmit(quiz, sid, answers) {
      const out = { ...(answers || {}) };
      for (const q of (quiz.questions || [])) {
        if (q.type !== 'audio') continue;
        const ans = out[q.id];
        if (!ans || !ans.blob) continue;
        const blob = ans.blob;
        if (typeof blob.size !== 'number' || blob.size <= 0) throw new Error('audio_empty');
        if (blob.size > MAX_ORAL_AUDIO_BYTES) throw new Error('audio_too_large');
        const mimeType = ans.mimeType || blob.type || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const baseMeta = {
          kind: 'audio',
          mimeType,
          size: blob.size,
          duration: Math.max(0, Math.round(Number(ans.duration || 0))),
          recordedAt: ans.recordedAt || new Date().toISOString(),
        };
        if (_useRemote && RS.uploadFile) {
          const path = `oral-exams/${safeFilePart(quiz.id)}/${safeFilePart(sid)}/${safeFilePart(q.id)}_${Date.now()}_${uid('aud')}.${ext}`;
          const res = await RS.uploadFile(path, blob);
          const { fileUrl, storagePath } = RS.consumeUploadResult(res);
          out[q.id] = { ...baseMeta, storagePath: storagePath || path, fileUrl };
        } else {
          out[q.id] = { ...baseMeta, dataUrl: await blobToDataUrl(blob) };
        }
      }
      return out;
    },

    resolveAudioUrl(answer) {
      if (!answer) return null;
      if (answer.dataUrl) return answer.dataUrl;
      if (_useRemote && answer.storagePath && RS.getSignedUrlForPath)
        return RS.getSignedUrlForPath(answer.storagePath);
      return answer.fileUrl || null;
    },

    async submitQuiz(qid, sid, answers) {
      const quiz=this.getQuizById(qid); if(!quiz) throw new Error('quiz_not_found');
      const student=API.Students.getById(sid);
      const finalAnswers = await this._prepareAnswersForSubmit(quiz, sid, answers || {});
      let score=0, total=0;
      quiz.questions.forEach(q=>{
        total+=q.marks||1;
        const ans=finalAnswers[q.id];
        if(q.type==='multiple_choice'||q.type==='true_false'){
          if(String(ans).trim().toLowerCase()===String(q.correctAnswer).trim().toLowerCase()) score+=q.marks||1;
        } else if(q.type==='fill_blank'){
          if(String(ans||'').trim().toLowerCase()===String(q.correctAnswer||'').trim().toLowerCase()) score+=q.marks||1;
        }
        // short_answer / essay / file_upload → teacher grades manually (score=0 initially)
      });
      const data=this._readAll();
      const existing=data.submissions.findIndex(s=>s.quizId===qid&&s.studentId===sid);
      const sub={
        id:uid('sub'), quizId:qid, studentId:sid,
        studentName:student?.name||sid,
        answers:finalAnswers, score, total,
        passed:total>0?(score/total*100)>=(quiz.passPercent||60):false,
        submittedAt:new Date().toISOString(),
        needsManualGrade: quiz.questions.some(q=>['short_answer','essay','file_upload','audio'].includes(q.type)),
      };
      if (_useRemote && RS.submitQuizRemote) await RS.submitQuizRemote(sub);
      if(existing>=0) data.submissions[existing]=sub; else data.submissions.push(sub);
      this._write(data); return sub;
    },

    // Teacher manually updates a score
    async updateScore(subId, score) {
      const data=this._readAll();
      const sub=data.submissions.find(s=>s.id===subId); if(!sub) return null;
      const quiz=this.getQuizById(sub.quizId);
      if (_useRemote && RS.updateQuizScoreRemote) await RS.updateQuizScoreRemote(subId,score);
      sub.score=score;
      sub.passed=quiz?(score/sub.total*100)>=(quiz.passPercent||60):false;
      sub.needsManualGrade=false;
      this._write(data); return sub;
    },
  };

  Object.assign(API, { Exams });
})(window.API);

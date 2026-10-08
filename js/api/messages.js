/* Waqful Madinah · js/api/messages.js — Messages (chat). Attaches to window.API (core.js loads first). */
(function (API) {
  const { DB, DOCS_KEY, RS, _useRemote, fileWithinUploadLimit, nowTime, safeFilePart, stampNotify, uid } = API._internal;


  // ── MESSAGES ─────────────────────────────────────────────
  const Messages = {
    getThread(id)          { return DB.get().chats[id]||[]; },
    async send(threadId,text,type='text',extra={}) {
      const db=DB.get(); if(!db.chats[threadId]) db.chats[threadId]=[];
      // read:false = student hasn't seen it yet (shows single tick; double tick after student opens chat)
      const m={id:uid('m'),role:'out',text,type,time:nowTime(),read:false,_ts:Date.now(),...extra};
      if (_useRemote && RS.sendMessageRemote) await RS.sendMessageRemote(threadId, m);
      db.chats[threadId].push(m); stampNotify(db); DB.save(db);
      return m;
    },
    async sendFromStudent(sid,text,type='text',extra={}) {
      const db=DB.get(); if(!db.chats[sid]) db.chats[sid]=[];
      // read:false = teacher hasn't seen it yet (single tick on student side)
      const m={id:uid('m'),role:'in',text,type,time:nowTime(),read:false,_ts:Date.now(),...extra};
      if (_useRemote && RS.sendMessageRemote) await RS.sendMessageRemote(sid, m);
      db.chats[sid].push(m); stampNotify(db); DB.save(db);
      return m;
    },
    // Send a file directly from chat (student → teacher)
    sendFileFromStudent(sid, file, { category='general', note='', replyTo=null, displayName=null } = {}) {
      return new Promise((resolve, reject) => {
        const student=API.Students.getById(sid);
        if(!student){ reject(new Error('student_not_found')); return; }
        if(!fileWithinUploadLimit(file)){ reject(new Error('file_too_large')); return; }
        const dispName = displayName || file.name;
        if (_useRemote) {
          const docId=uid('doc');
          const path=`${sid}/${docId}_${safeFilePart(file.name)}`;
          RS.uploadFile(path, file).then(async res=>{
            const { fileUrl, storagePath } = RS.consumeUploadResult(res);
            const meta={
              id:docId, studentId:sid, studentName:student.name,
              fileName:dispName, fileType:file.type, fileSize:file.size,
              category, note, uploadedAt:new Date().toISOString(), read:false,
              fileUrl, storage_path: storagePath || path, sentBy:'student', reviewStatus:'pending',
            };
            if (RS.saveDocumentRemote) await RS.saveDocumentRemote(meta);
            const list=RS.mem.docs||[];
            list.unshift(meta);
            RS.mem.docs=list;
            const db=DB.get(); if(!db.chats[sid]) db.chats[sid]=[];
            const m={id:uid('m'),role:'in',type:'doc',text:dispName,time:nowTime(),read:false,
                     fileName:dispName, fileType:file.type, fileSize:file.size, docId, fileUrl, storage_path: storagePath || path,
                     ...(replyTo?{replyTo}:{})};
            if (RS.sendMessageRemote) await RS.sendMessageRemote(sid, m);
            db.chats[sid].push(m); stampNotify(db); DB.save(db);
            resolve({ meta, msg: m });
          }).catch(err=>reject(err));
          return;
        }
        const reader=new FileReader();
        reader.onload=e=>{
          const docId=uid('doc');
          const meta={
            id:docId, studentId:sid, studentName:student.name,
            fileName:dispName, fileType:file.type, fileSize:file.size,
            category, note, uploadedAt:new Date().toISOString(), read:false, sentBy:'student', reviewStatus:'pending',
          };
          try { localStorage.setItem('madrasa_doc_'+docId, e.target.result); }
          catch { reject(new Error('storage_full')); return; }
          const list=JSON.parse(localStorage.getItem('madrasa_docs')||'[]');
          list.unshift(meta); localStorage.setItem('madrasa_docs', JSON.stringify(list));
          const db=DB.get(); if(!db.chats[sid]) db.chats[sid]=[];
          const m={id:uid('m'),role:'in',type:'doc',text:dispName,time:nowTime(),read:false,
                   fileName:dispName, fileType:file.type, fileSize:file.size, docId,
                   ...(replyTo?{replyTo}:{})};
          db.chats[sid].push(m); DB.save(db);
          resolve({ meta, msg: m });
        };
        reader.onerror=()=>reject(new Error('read_error'));
        reader.readAsDataURL(file);
      });
    },
    sendFileFromTeacher(sid, file, { replyTo=null, displayName=null } = {}) {
      return new Promise((resolve, reject) => {
        if(!fileWithinUploadLimit(file)){ reject(new Error('file_too_large')); return; }
        const dispName = displayName || file.name;
        if (_useRemote) {
          const docId=uid('tdoc');
          const path=`teacher/${sid}/${docId}_${safeFilePart(file.name)}`;
          const st=API.Students.getById(sid);
          RS.uploadFile(path, file).then(async res=>{
            const { fileUrl, storagePath } = RS.consumeUploadResult(res);
            const meta={
              id:docId, studentId:sid, studentName:st?.name||'',
              fileName:dispName, fileType:file.type, fileSize:file.size,
              category:'general', note:'', uploadedAt:new Date().toISOString(), read:true,
              fileUrl, storage_path: storagePath || path, sentBy:'teacher',
            };
            if (RS.saveDocumentRemote) await RS.saveDocumentRemote(meta);
            const list=RS.mem.docs||[];
            list.unshift(meta);
            RS.mem.docs=list;
            const db=DB.get(); if(!db.chats[sid]) db.chats[sid]=[];
            const m={id:uid('m'),role:'out',type:'doc',text:dispName,time:nowTime(),read:false,
                     fileName:dispName, fileType:file.type, fileSize:file.size, docId, fileUrl, storage_path: storagePath || path,
                     ...(replyTo?{replyTo}:{})};
            if (RS.sendMessageRemote) await RS.sendMessageRemote(sid, m);
            db.chats[sid].push(m); stampNotify(db); DB.save(db);
            resolve({ msg: m });
          }).catch(err=>reject(err));
          return;
        }
        const reader=new FileReader();
        reader.onload=e=>{
          const docId=uid('tdoc');
          try { localStorage.setItem('madrasa_doc_'+docId, e.target.result); }
          catch { reject(new Error('storage_full')); return; }
          // Add metadata so Docs.getById() can find this file for preview
          const st=API.Students.getById(sid);
          const meta={id:docId, studentId:sid, studentName:st?.name||'',
                      fileName:dispName, fileType:file.type, fileSize:file.size,
                      category:'general', note:'', uploadedAt:new Date().toISOString(), read:true, sentBy:'teacher'};
          const mList=JSON.parse(localStorage.getItem(DOCS_KEY)||'[]');
          mList.unshift(meta); localStorage.setItem(DOCS_KEY, JSON.stringify(mList));
          const db=DB.get(); if(!db.chats[sid]) db.chats[sid]=[];
          const m={id:uid('m'),role:'out',type:'doc',text:dispName,time:nowTime(),read:false,
                   fileName:dispName, fileType:file.type, fileSize:file.size, docId,
                   ...(replyTo?{replyTo}:{})};
          db.chats[sid].push(m); DB.save(db);
          resolve({ msg: m });
        };
        reader.onerror=()=>reject(new Error('read_error'));
        reader.readAsDataURL(file);
      });
    },
    async broadcast(text) {
      const db=DB.get(); const m={id:uid('m'),role:'out',text,type:'text',time:nowTime(),read:false,isBroadcast:true,_ts:Date.now()};
      if (_useRemote && RS.sendMessageRemote) await RS.sendMessageRemote('_bc', m);
      if(!db.chats['_bc']) db.chats['_bc']=[];
      db.chats['_bc'].push({...m});
      // Student copies are local-only — _bc row in Supabase is the single notification source.
      db.students.forEach(s=>{ if(!db.chats[s.id]) db.chats[s.id]=[]; db.chats[s.id].push({...m,id:uid('m'),_skipRemote:true}); });
      stampNotify(db); DB.save(db);
      return m;
    },
    async sendTask(sid,task) {
      const db=DB.get(); if(!db.chats[sid]) db.chats[sid]=[];
      const m={id:uid('m'),role:'out',type:'task',text:task.title,task:{title:task.title,desc:task.desc,deadline:task.deadline,taskType:task.type},time:nowTime(),read:true};
      if (_useRemote && RS.sendMessageRemote) await RS.sendMessageRemote(sid, m);
      db.chats[sid].push(m); stampNotify(db); DB.save(db);
      return m;
    },
    markRead(threadId,role='in') {
      const db=DB.get(); (db.chats[threadId]||[]).forEach(m=>{ if(m.role===role) m.read=true; }); DB.save(db);
      if (_useRemote && RS.markMessagesReadRemote) RS.markMessagesReadRemote(threadId, role === 'in' ? 'teacher' : 'student');
      // Dismiss matching OS push notification
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const tag = role === 'in'
          ? 'msg-in-' + threadId
          : 'msg-out-' + (API.Students.getById(threadId)?.waqfId || threadId);
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_NOTIFICATION', tag });
      }
    },
    // Teacher opened a student's chat → mark student messages as read (→ double tick on student)
    markReadByTeacher(sid) { this.markRead(sid,'in'); },
    unreadCount(threadId,role='in') { return (DB.get().chats[threadId]||[]).filter(m=>m.role===role&&!m.read).length; },
    /** শিক্ষক UI: সব ছাত্র + গ্রুপ ব্রডকাস্ট থ্রেডে মেসেজ টেক্সট খোঁজা (লোকাল মেমোরি থেকে)। */
    searchAllChats(rawQuery, opts = {}) {
      const limit = Math.min(Math.max(Number(opts.limit) || 60, 1), 200);
      const needle = String(rawQuery || '').trim().toLowerCase();
      if (!needle) return [];
      const db = DB.get();
      const textOf = (m) => {
        if (!m) return '';
        if (m.type === 'task' && m.task) return [m.task.title, m.task.desc, m.text].filter(Boolean).join('\n');
        if (m.type === 'doc') return [m.fileName, m.text].filter(Boolean).join('\n');
        return String(m.text || '');
      };
      const tsOf = (m) => {
        if (m._ts) return m._ts;
        const x = /^m(\d{13})/.exec(m.id || '');
        return x ? parseInt(x[1], 10) : 0;
      };
      const snippet = (full) => {
        const fullS = String(full || '').replace(/\s+/g, ' ').trim();
        const low = fullS.toLowerCase();
        const i = low.indexOf(needle);
        const maxLen = 120;
        if (i < 0) return (fullS.slice(0, maxLen) + (fullS.length > maxLen ? '…' : ''));
        const start = Math.max(0, i - 28);
        const chunk = fullS.slice(start, start + maxLen);
        return (start > 0 ? '…' : '') + chunk + (start + maxLen < fullS.length ? '…' : '');
      };
      const bcSigs = new Set();
      (db.chats._bc || []).forEach((m) => {
        if (m && (m.type === 'text' || !m.type)) bcSigs.add(`${String(m.text || '')}\0${String(m.time || '')}`);
      });
      const out = [];
      const push = (threadId, m, studentLabel, waqfShort) => {
        const full = textOf(m);
        if (!full.toLowerCase().includes(needle)) return;
        const sig = `${String(m.text || '')}\0${String(m.time || '')}`;
        if (m.role === 'out' && (m.type === 'text' || !m.type) && threadId !== '_broadcast' && bcSigs.has(sig)) return;
        out.push({
          threadId,
          messageId: m.id,
          studentLabel,
          waqfShort: waqfShort || '',
          time: m.time || '',
          snippet: snippet(full),
          kind: m.type === 'doc' ? 'doc' : m.type === 'task' ? 'task' : 'text',
          _ts: tsOf(m),
        });
      };
      (db.chats._bc || []).forEach((m) => push('_broadcast', m, '📢 সবাইকে বার্তা', ''));
      API.Students.getAll().forEach((s) => {
        const w = s.waqfId ? API.Students.displayWaqfId(s.waqfId) : '';
        (db.chats[s.id] || []).forEach((m) => push(s.id, m, s.name || '', w));
      });
      out.sort((a, b) => (b._ts || 0) - (a._ts || 0));
      return out.slice(0, limit).map(({ _ts, ...rest }) => rest);
    },
    /** টেক্সট মেসেজ সম্পাদনা/মোছার সময় (মিলি সেকেন্ড) — WhatsApp-সদৃশ ১৫ মিনিট */
    MSG_TEXT_WINDOW_MS: 15 * 60 * 1000,
    _msgSentTs(m) {
      if (!m) return 0;
      if (m._ts) return m._ts;
      const x = /^m(\d{13})/.exec(m.id || '');
      return x ? parseInt(x[1], 10) : 0;
    },
    /** asTeacher=true: শিক্ষকের নিজের (out); false: ছাত্রের নিজের (in) — উভয় পক্ষ টেক্সট সম্পাদনা/মোছা (সময়সীমার মধ্যে) */
    canModifyOwnMessage(m, asTeacher) {
      if (!m || m._skipRemote) return false;
      if (m.type && m.type !== 'text') return false;
      if (m.isBroadcast && m.role === 'in') return false;
      const own = asTeacher ? m.role === 'out' : m.role === 'in';
      if (!own) return false;
      const ts = this._msgSentTs(m);
      if (!ts) return false;
      return (Date.now() - ts) <= this.MSG_TEXT_WINDOW_MS;
    },
    async updateOwnText(threadId, msgId, newText, asTeacher) {
      const t = String(newText || '').trim();
      if (!t) return { ok: false, err: 'empty' };
      const db = DB.get();
      const arr = db.chats[threadId];
      const m = arr && arr.find((x) => x.id === msgId);
      if (!m) return { ok: false, err: 'nf' };
      if (!this.canModifyOwnMessage(m, !!asTeacher)) return { ok: false, err: 'forbidden' };
      if (_useRemote && RS.updateMessageTextRemote) await RS.updateMessageTextRemote(msgId, t);
      m.text = t;
      m.editedAt = new Date().toISOString();
      stampNotify(db);
      DB.save(db);
      return { ok: true };
    },
    async deleteOwn(threadId, msgId, asTeacher) {
      const db = DB.get();
      const arr = db.chats[threadId];
      const m = arr && arr.find((x) => x.id === msgId);
      if (!m) return { ok: false, err: 'nf' };
      if (!this.canModifyOwnMessage(m, !!asTeacher)) return { ok: false, err: 'forbidden' };
      const ix = arr.findIndex((x) => x.id === msgId);
      if (ix < 0) return { ok: false };
      if (_useRemote && RS.deleteOwnMessageRemote) await RS.deleteOwnMessageRemote(msgId);
      arr.splice(ix, 1);
      stampNotify(db);
      DB.save(db);
      return { ok: true };
    },
  };

  Object.assign(API, { Messages });
})(window.API);

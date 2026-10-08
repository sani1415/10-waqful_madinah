/* Waqful Madinah · js/api/docs.js — Docs (documents / storage). Attaches to window.API (core.js loads first). */
(function (API) {
  const { DOCS_KEY, RS, _useRemote, fileWithinUploadLimit, safeFilePart, uid } = API._internal;


  // ── DOCUMENTS ────────────────────────────────────────────
  /*
    Document metadata (KV `docs_meta`):
    { id, studentId, studentName, fileName, fileType, fileSize,
      category, note, uploadedAt, read, fileUrl?, storage_path? }
    রিমোট: ফাইলের বাইট Supabase Storage বাকেট `waqf-files` এ; লোকাল: madrasa_doc_<id> base64
  */
  const Docs = {
    _readMeta() {
      if (_useRemote) return RS.mem.docs || (RS.mem.docs = []);
      try { return JSON.parse(localStorage.getItem(DOCS_KEY))||[]; } catch { return []; }
    },
    _writeMeta(list) {
      if (_useRemote) {
        RS.mem.docs = list;
        RS.schedule('docs_meta', () => JSON.parse(JSON.stringify(RS.mem.docs)));
        return;
      }
      localStorage.setItem(DOCS_KEY, JSON.stringify(list));
    },

    getAll()                { return this._readMeta(); },
    getForStudent(sid)      { return this._readMeta().filter(d=>d.studentId===sid); },
    getById(id)             { return this._readMeta().find(d=>d.id===id)||null; },
    getFileData(id) {
      const meta = this.getById(id);
      if (meta && meta.fileUrl) return meta.fileUrl;
      if (_useRemote) return null;
      return localStorage.getItem('madrasa_doc_'+id)||null;
    },
    resolveFileUrl(id) {
      const meta = this.getById(id);
      if (!meta) return Promise.resolve(null);
      /* Private bucket: upload-time fileUrl expires; always refresh from storage_path when remote. */
      if (_useRemote && meta.storage_path && RS.getSignedUrlForPath)
        return RS.getSignedUrlForPath(meta.storage_path);
      if (meta.fileUrl) return Promise.resolve(meta.fileUrl);
      return Promise.resolve(this.getFileData(id));
    },

    // Upload: file is a File object, read as base64 (local) or Storage (remote)
    upload(sid, file, { category='general', note='' } = {}) {
      return new Promise((resolve, reject) => {
        const student=API.Students.getById(sid);
        if(!student){ reject(new Error('student_not_found')); return; }
        if(!fileWithinUploadLimit(file)){ reject(new Error('file_too_large')); return; }

        if (_useRemote) {
          const id=uid('doc');
          const path=`${sid}/${id}_${safeFilePart(file.name)}`;
          RS.uploadFile(path, file).then(async res=>{
            const { fileUrl, storagePath } = RS.consumeUploadResult(res);
            const meta={
              id, studentId:sid, studentName:student.name,
              fileName:file.name, fileType:file.type, fileSize:file.size,
              category, note, uploadedAt:new Date().toISOString(), read:false,
              fileUrl, storage_path: storagePath || path, sentBy:'student',
            };
            if (RS.saveDocumentRemote) await RS.saveDocumentRemote(meta);
            const list=this._readMeta(); list.unshift(meta); this._writeMeta(list);
            resolve(meta);
          }).catch(err=>reject(err.message==='storage_full'?new Error('storage_full'):err));
          return;
        }

        const reader=new FileReader();
        reader.onload=e=>{
          const id=uid('doc');
          const meta={
            id, studentId:sid, studentName:student.name,
            fileName:file.name, fileType:file.type, fileSize:file.size,
            category, note, uploadedAt:new Date().toISOString(), read:false, sentBy:'student',
          };
          try {
            localStorage.setItem('madrasa_doc_'+id, e.target.result);
          } catch(storageErr) {
            reject(new Error('storage_full')); return;
          }
          const list=this._readMeta(); list.unshift(meta); this._writeMeta(list);
          resolve(meta);
        };
        reader.onerror=()=>reject(new Error('read_error'));
        reader.readAsDataURL(file);
      });
    },

    markRead(id) {
      const list=this._readMeta(); const d=list.find(x=>x.id===id);
      if(d){ d.read=true; this._writeMeta(list); }
    },

    async markReviewed(id, comment='') {
      const list=this._readMeta(); const d=list.find(x=>x.id===id);
      if(!d) throw new Error('document_not_found');
      const reviewComment=String(comment||'').trim();
      const messageId=uid('m');
      let result=null;
      if(_useRemote && RS.markDocReviewedRemote) result=await RS.markDocReviewedRemote(id,reviewComment,messageId);
      const reviewedAt=result?.reviewed_at||new Date().toISOString();
      const reviewMessageId=result?.message_id||messageId;
      d.reviewStatus='done'; d.read=true; d.reviewComment=result?.review_comment??reviewComment;
      d.reviewedAt=reviewedAt; d.reviewMessageId=reviewMessageId;
      this._writeMeta(list);
      const messageText=result?.message_text||`আপনার “${d.fileName||'ডকুমেন্ট'}” ডকুমেন্টটি পর্যালোচনা করা হয়েছে।${d.reviewComment?` · মন্তব্য: ${d.reviewComment}`:''}`;
      const thread=API.Messages.getThread(d.studentId);
      if(d.studentId&&!thread.some(m=>m.id===reviewMessageId)){
        await API.Messages.send(d.studentId,messageText,'text',{
          id:reviewMessageId, docId:d.id, fileName:d.fileName||'',
          reviewComment:d.reviewComment||'', reviewedAt,
          ...(_useRemote?{_skipRemote:true}:{}),
        });
      }
      return d;
    },

    async delete(id) {
      if (_useRemote && RS.deleteDocumentRemote) await RS.deleteDocumentRemote(id);
      if (!_useRemote) localStorage.removeItem('madrasa_doc_'+id);
      this._writeMeta(this._readMeta().filter(d=>d.id!==id));
    },

    deleteAllForStudent(sid) {
      const list = this._readMeta();
      const keep = [];
      for (const d of list) {
        if (d.studentId === sid) {
          if (!_useRemote) localStorage.removeItem('madrasa_doc_' + d.id);
        } else keep.push(d);
      }
      this._writeMeta(keep);
    },

    unreadCount() { return this._readMeta().filter(d=>!d.read).length; },

    totalStorageKB() {
      let bytes=0;
      this._readMeta().forEach(d=>{
        if (d.fileUrl) bytes += d.fileSize || 0;
        else {
          const data=localStorage.getItem('madrasa_doc_'+d.id);
          if(data) bytes+=data.length*0.75;
        }
      });
      return Math.round(bytes/1024);
    },
  };

  Object.assign(API, { Docs });
})(window.API);

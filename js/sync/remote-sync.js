/* Waqful Madinah — remote-sync.js (relational, madrasa_rel_* RPCs)
   Requires: remote-sync-write.js loaded first */
(function (w) {
  const BUCKET = 'waqf-files';
  const DEBOUNCE_MS = 400;
  const SIGNED_URL_SEC = 3600;
  let client = null;
  const timers = {};
  let _teacherPin = '';
  let _studentWaqf = '';
  let _studentPin = '';
  let _studentId = '';
  let realtimeChannel = null;
  const _savedMsgIds = new Set();

  const mem = {
    core: null, goals: null, exams: null,
    docs: [], academic: {}, tnotes: {},
    teacherPin: null, lockHints: [], loaded: false,
    completions: [], groups: [], diary: [],
    dailyScheduleByStudent: {},
    dailySchedule: { rows: [], pending: null },
    noteCategories: [],
    studentNotesByStudent: {},
  };

  function role() { const r = w.__MADRASA_ROLE__; return r === 'teacher' || r === 'student' ? r : ''; }
  function usesSecureKv() { return isRemote() && role() !== ''; }

  function getCreateClient() {
    const s = w.supabase;
    if (!s) return null;
    if (typeof s.createClient === 'function') return s.createClient;
    if (s.default && typeof s.default.createClient === 'function') return s.default.createClient;
    return null;
  }

  /* Per-device random token, sent on every request as `x-waqf-device`.
     After a successful login the server marks it trusted, so this device keeps
     working even while someone else's wrong-PIN attempts have locked the account
     (see supabase/migrations/20261008120000_waqf_pin_guard.sql). */
  const DEVICE_TOKEN_KEY = 'madrasa_device_token';
  let _deviceToken = '';
  function deviceToken() {
    if (_deviceToken) return _deviceToken;
    try { _deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY) || ''; } catch (e) {}
    if (!/^[0-9a-f]{64}$/.test(_deviceToken)) {
      const bytes = new Uint8Array(32);
      (w.crypto || globalThis.crypto).getRandomValues(bytes);
      _deviceToken = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(DEVICE_TOKEN_KEY, _deviceToken); } catch (e) {}
    }
    return _deviceToken;
  }
  function deviceHeaders() { return { 'x-waqf-device': deviceToken() }; }

  function getClient() {
    if (client) return client;
    const url = w.SUPABASE_URL, key = w.SUPABASE_ANON_KEY, create = getCreateClient();
    if (!url || !key || !create) return null;
    client = create(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: deviceHeaders() },
    });
    w.supabaseClient = client;
    return client;
  }

  /** Fire-and-forget: register this device as trusted for the logged-in subject. */
  function trustThisDevice(roleName, waqf, pin) {
    const sb = getClient(); if (!sb || !pin) return;
    sb.rpc('madrasa_rel_trust_device', {
      p_role: roleName, p_waqf: waqf || null, p_pin: String(pin), p_token: deviceToken(),
    }).then(({ error }) => { if (error) console.warn('trustThisDevice:', error.message); },
            (e) => console.warn('trustThisDevice:', e));
  }

  /** Current login, for server endpoints (/api/*) that must verify the caller. */
  function sessionAuth() {
    if (role() === 'teacher' && _teacherPin) return { role: 'teacher', pin: _teacherPin };
    if (role() === 'student' && _studentWaqf && _studentPin) return { role: 'student', waqf: _studentWaqf, pin: _studentPin };
    return null;
  }

  async function rpcOrThrow(sb, name, params) {
    const { data, error } = await sb.rpc(name, params);
    if (error) throw error;
    return data;
  }

  function isRemote() { return !!(w.SUPABASE_URL && w.SUPABASE_ANON_KEY && getCreateClient()); }

  /** "001" / "waqf_001" → `waqf_001` for RPC (matches `students.waqf_id`). */
  function normalizeWaqfForRpc(raw) {
    const t = String(raw || '').trim().replace(/\s/g, '');
    if (!t) return '';
    let n;
    if (/^waqf_/i.test(t)) n = parseInt(t.slice(5), 10);
    else n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 0) return t;
    return 'waqf_' + String(n).padStart(3, '0');
  }

  // Write module context — wired up at bottom
  const _write = (w._RSWrite || { init: () => ({}) }).init({
    getPin: () => _teacherPin,
    setPin: (p) => { _teacherPin = p; mem.teacherPin = p; },
    getStudentPin: () => _studentPin,
    getStudentWaqf: () => _studentWaqf,
    getStudentId: () => _studentId,
    getRole: role,
    savedMsgIds: _savedMsgIds,
  });

  // ── Schedule / flush ─────────────────────────────────────────
  function schedule(key, getter) {
    const sb = getClient(); if (!sb) return;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => {
      delete timers[key];
      try { await _write.saveKVImpl(sb, key, typeof getter === 'function' ? getter() : getter, usesSecureKv()); }
      catch (e) { console.error('RemoteSync save failed:', key, e); }
    }, DEBOUNCE_MS);
  }

  async function flushKey(key, value) {
    const sb = getClient(); if (!sb) return;
    clearTimeout(timers[key]); delete timers[key];
    await _write.saveKVImpl(sb, key, value, usesSecureKv());
  }

  async function flushAllFromMem() {
    const sb = getClient(); if (!sb) return;
    try {
      await _write.saveCore(sb, mem.core);
      await _write.saveGoals(sb, mem.goals);
      await _write.saveExams(sb, mem.exams);
      await _write.saveDocs(sb, mem.docs);
    } catch (e) { console.error('flushAllFromMem:', e); }
  }

  async function markDocReviewedRemote(docId, comment, messageId) {
    if (!usesSecureKv()) return;
    const sb = getClient(); if (!sb) throw new Error('remote_unavailable');
    const pin = _teacherPin; if (!pin) throw new Error('missing_pin');
    const res=await rpcOrThrow(sb, 'madrasa_rel_review_document', {
      p_teacher_pin: pin, p_doc_id: docId,
      p_comment: String(comment || ''), p_message_id: messageId,
    });
    const d = (mem.docs || []).find(x => x.id === docId);
    if (d) {
      d.reviewStatus = 'done'; d.read = true;
      d.reviewComment = res?.review_comment || '';
      d.reviewedAt = res?.reviewed_at || new Date().toISOString();
      d.reviewMessageId = res?.message_id || messageId || '';
    }
    return res;
  }

  async function markMessagesReadRemote(threadId, roleStr) {
    const sb = getClient(); if (!sb || !usesSecureKv()) return;
    const r = roleStr || role();
    const pin = r === 'teacher' ? _teacherPin : _studentPin;
    if (!pin) return;
    try {
      await rpcOrThrow(sb, 'madrasa_rel_mark_messages_read', { p_pin: pin, p_role: r, p_thread_id: threadId });
      applyReadReceiptPatch(threadId, r);
      sendReadReceiptBroadcast(threadId, r);
    }
    catch (e) { console.warn('markMessagesReadRemote:', e); }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  async function _publicBranding(sb) {
    const { data, error } = await sb.rpc('madrasa_rel_public_branding');
    if (error) throw error;
    return data?.madrasa ? String(data.madrasa) : 'وقف المدينة';
  }

  async function bootstrapTeacherIdle() {
    const sb = getClient(); if (!sb) throw new Error('Supabase client unavailable');
    const madrasa = await _publicBranding(sb);
    mem.core = { teacher: { name: '', madrasa }, students: [], chats: { _bc: [] }, tasks: [], allowEmptyStudents: true };
    mem.goals = {}; mem.exams = { quizzes: [], submissions: [] };
    mem.docs = []; mem.academic = {}; mem.tnotes = {};
    mem.teacherPin = null; mem.lockHints = []; _teacherPin = ''; mem.loaded = true;
    mem.dailyScheduleByStudent = {};
    mem.noteCategories = []; mem.studentNotesByStudent = {};
  }

  async function bootstrapStudentIdle() {
    const sb = getClient(); if (!sb) throw new Error('Supabase client unavailable');
    const madrasa = await _publicBranding(sb);
    mem.core = { teacher: { name: '', madrasa }, students: [], chats: { _bc: [] }, tasks: [] };
    mem.goals = {}; mem.exams = { quizzes: [], submissions: [] };
    mem.docs = []; mem.academic = {}; mem.tnotes = {};
    mem.teacherPin = null; _studentWaqf = ''; _studentPin = ''; _studentId = '';
    const { data: hints, error: hErr } = await sb.rpc('madrasa_rel_student_lock_hints');
    mem.lockHints = hErr ? [] : (Array.isArray(hints) ? hints : []);
    mem.loaded = true;
    mem.dailySchedule = { rows: [], pending: null };
    mem.noteCategories = []; mem.studentNotesByStudent = {};
  }

  async function bootstrapLegacy() {
    const sb = getClient(); if (!sb) throw new Error('Supabase client unavailable');
    const keys = ['core', 'goals', 'exams', 'docs_meta', 'academic', 'tnotes', 'teacher_pin'];
    const rows = await Promise.all(keys.map(k =>
      sb.from('waqf_app_kv').select('value').eq('key', k).maybeSingle().then(r => r.data?.value)));
    const [core, goals, exams, docs, academic, tnotes, tp] = rows;
    mem.core = core || null; mem.goals = goals || {};
    mem.exams = exams || { quizzes: [], submissions: [] };
    mem.docs = Array.isArray(docs) ? docs : [];
    mem.academic = academic || {}; mem.tnotes = tnotes || {};
    mem.teacherPin = tp?.pin ? String(tp.pin) : null;
    mem.lockHints = []; mem.loaded = true;
  }

  function bootstrap() {
    if (!usesSecureKv()) return bootstrapLegacy();
    if (role() === 'teacher') return bootstrapTeacherIdle();
    if (role() === 'student') return bootstrapStudentIdle();
    return bootstrapLegacy();
  }

  async function unlockTeacherWithPin(pin) {
    const sb = getClient(); if (!sb) throw new Error('Supabase client unavailable');
    const { data, error } = await sb.rpc('madrasa_rel_teacher_bootstrap', { p_teacher_pin: pin });
    if (error) throw error;
    _assemble.assembleTeacherBundle(data);
    _teacherPin = (mem.teacherPin && mem.teacherPin !== '') ? mem.teacherPin : String(pin);
    mem.loaded = true;
    trustThisDevice('teacher', null, _teacherPin);
    void _ops.fetchGroupsRemote();
    void _ops.fetchDiaryRemote();
  }

  async function unlockStudentWithWaqfPin(waqfRaw, pin) {
    const sb = getClient(); if (!sb) throw new Error('Supabase client unavailable');
    const waqfNorm = normalizeWaqfForRpc(waqfRaw);
    const { data, error } = await sb.rpc('madrasa_rel_student_bootstrap',
      { p_waqf: waqfNorm, p_pin: String(pin || '') });
    if (error) throw error;
    _assemble.assembleStudentBundle(data);
    mem.teacherPin = null;
    const stu = mem.core?.students?.[0];
    _studentWaqf = stu?.waqfId || waqfNorm;
    _studentPin = String(pin || '');
    _studentId = stu?.id || '';
    mem.lockHints = []; mem.loaded = true;
    trustThisDevice('student', _studentWaqf, _studentPin);
  }

  async function refreshStudentLockHints() {
    // lock screen-এ কেউ login না করলেও hints দরকার — role check বাদ দিই
    if (!isRemote()) return;
    const sb = getClient(); if (!sb) return;
    const { data, error } = await sb.rpc('madrasa_rel_student_lock_hints');
    mem.lockHints = error ? [] : (Array.isArray(data) ? data : []);
  }

  async function pullRemoteSnapshot() {
    if (!isRemote() || !mem.loaded) return;
    const sb = getClient(); if (!sb) return;
    try {
      if (usesSecureKv() && role() === 'teacher' && _teacherPin) {
        const { data, error } = await sb.rpc('madrasa_rel_teacher_bootstrap', { p_teacher_pin: _teacherPin });
        if (!error) _assemble.assembleTeacherBundle(data);
      } else if (usesSecureKv() && role() === 'student' && _studentWaqf && _studentPin) {
        const { data, error } = await sb.rpc('madrasa_rel_student_bootstrap',
          { p_waqf: _studentWaqf, p_pin: _studentPin });
        if (!error) { _assemble.assembleStudentBundle(data); mem.teacherPin = null; }
      } else if (usesSecureKv() && role() === 'student') {
        await refreshStudentLockHints();
      }
    } catch (e) { console.warn('pullRemoteSnapshot:', e); }
    if (w.dispatchEvent) w.dispatchEvent(new CustomEvent('madrasa-remote-sync'));
  }

  function applyRealtimeMessagePatch(payload) {
    const row = payload && payload.new;
    if (!mem.loaded || !mem.core || !mem.core.chats || !row || payload.eventType !== 'UPDATE') return false;
    const threadId = row.thread_id === '_bc' ? '_bc' : row.thread_id;
    const thread = mem.core.chats[threadId];
    if (!Array.isArray(thread)) return false;
    const idx = thread.findIndex(m => m && m.id === row.id);
    if (idx < 0) return false;
    thread[idx] = _assemble.msgFromDB(row);
    _savedMsgIds.add(row.id);
    if (w.dispatchEvent) w.dispatchEvent(new CustomEvent('madrasa-remote-sync'));
    return true;
  }

  function applyReadReceiptPatch(threadId, readerRole) {
    if (!mem.loaded || !mem.core || !mem.core.chats || !threadId) return false;
    const thread = mem.core.chats[threadId === '_broadcast' ? '_bc' : threadId];
    if (!Array.isArray(thread)) return false;
    const msgRole = readerRole === 'teacher' ? 'in' : 'out';
    let changed = false;
    thread.forEach(m => {
      if (m && m.role === msgRole && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (changed && w.dispatchEvent) w.dispatchEvent(new CustomEvent('madrasa-remote-sync'));
    return changed;
  }

  function sendReadReceiptBroadcast(threadId, readerRole) {
    if (!realtimeChannel || !threadId || !readerRole) return;
    try {
      const sent = realtimeChannel.send({
        type: 'broadcast',
        event: 'read_receipt',
        payload: { threadId, readerRole },
      });
      if (sent && typeof sent.catch === 'function') sent.catch(e => console.warn('sendReadReceiptBroadcast:', e));
    } catch (e) { console.warn('sendReadReceiptBroadcast:', e); }
  }

  function startRealtimeSync() {
    if (!isRemote()) return;
    const sb = getClient(); if (!sb || realtimeChannel) return;
    const pull = () => setTimeout(() => void pullRemoteSnapshot(), 200);
    const onMessageChange = (payload) => {
      if (applyRealtimeMessagePatch(payload)) {
        setTimeout(() => void pullRemoteSnapshot(), 1200);
        return;
      }
      pull();
    };
    realtimeChannel = sb.channel('madrasa_rel_changes')
      .on('broadcast', { event: 'read_receipt' }, payload => {
        const p = payload && payload.payload;
        if (p) applyReadReceiptPatch(p.threadId, p.readerRole);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onMessageChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, pull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, pull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, pull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, pull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, pull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_schedule_rows' }, pull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_schedule_proposals' }, pull)
      .subscribe();
  }

  async function updateStudentPinRemote(newPin) {
    if (!usesSecureKv() || role() !== 'student' || !_studentWaqf || !_studentPin) return;
    const sb = getClient(); if (!sb) return;
    await rpcOrThrow(sb, 'madrasa_rel_student_update_pin', {
      p_waqf: normalizeWaqfForRpc(_studentWaqf),
      p_old_pin: String(_studentPin),
      p_new_pin: String(newPin),
    });
    _studentPin = String(newPin);
  }

  // ── Feature modules (js/sync/assemble.js, js/sync/ops.js) ────────────────
  // They read this file's state through live getters, so `let` values stay current.
  const ctx = {
    get BUCKET() { return BUCKET; },
    get DEBOUNCE_MS() { return DEBOUNCE_MS; },
    get SIGNED_URL_SEC() { return SIGNED_URL_SEC; },
    get client() { return client; },
    get timers() { return timers; },
    get _teacherPin() { return _teacherPin; },
    get _studentWaqf() { return _studentWaqf; },
    get _studentPin() { return _studentPin; },
    get _studentId() { return _studentId; },
    get realtimeChannel() { return realtimeChannel; },
    get _savedMsgIds() { return _savedMsgIds; },
    get mem() { return mem; },
    get role() { return role; },
    get usesSecureKv() { return usesSecureKv; },
    get getCreateClient() { return getCreateClient; },
    get DEVICE_TOKEN_KEY() { return DEVICE_TOKEN_KEY; },
    get _deviceToken() { return _deviceToken; },
    get deviceToken() { return deviceToken; },
    get deviceHeaders() { return deviceHeaders; },
    get getClient() { return getClient; },
    get trustThisDevice() { return trustThisDevice; },
    get sessionAuth() { return sessionAuth; },
    get rpcOrThrow() { return rpcOrThrow; },
    get isRemote() { return isRemote; },
    get normalizeWaqfForRpc() { return normalizeWaqfForRpc; },
    get _write() { return _write; },
    get schedule() { return schedule; },
    get flushKey() { return flushKey; },
    get flushAllFromMem() { return flushAllFromMem; },
    get markDocReviewedRemote() { return markDocReviewedRemote; },
    get markMessagesReadRemote() { return markMessagesReadRemote; },
    get _publicBranding() { return _publicBranding; },
    get bootstrapTeacherIdle() { return bootstrapTeacherIdle; },
    get bootstrapStudentIdle() { return bootstrapStudentIdle; },
    get bootstrapLegacy() { return bootstrapLegacy; },
    get bootstrap() { return bootstrap; },
    get unlockTeacherWithPin() { return unlockTeacherWithPin; },
    get unlockStudentWithWaqfPin() { return unlockStudentWithWaqfPin; },
    get refreshStudentLockHints() { return refreshStudentLockHints; },
    get pullRemoteSnapshot() { return pullRemoteSnapshot; },
    get applyRealtimeMessagePatch() { return applyRealtimeMessagePatch; },
    get applyReadReceiptPatch() { return applyReadReceiptPatch; },
    get sendReadReceiptBroadcast() { return sendReadReceiptBroadcast; },
    get startRealtimeSync() { return startRealtimeSync; },
    get updateStudentPinRemote() { return updateStudentPinRemote; },
    get _assemble() { return _assemble; },
    get _ops() { return _ops; },
  };
  // Cross-module refs resolve through ctx too:
  Object.defineProperty(ctx, 'stuFromDB', { get: () => _assemble.stuFromDB });
  Object.defineProperty(ctx, 'msgFromDB', { get: () => _assemble.msgFromDB });
  Object.defineProperty(ctx, '_parseProposalRows', { get: () => _assemble._parseProposalRows });
  Object.defineProperty(ctx, 'buildDailyScheduleByStudent', { get: () => _assemble.buildDailyScheduleByStudent });
  Object.defineProperty(ctx, 'buildStudentDailySchedule', { get: () => _assemble.buildStudentDailySchedule });
  Object.defineProperty(ctx, 'assembleTeacherBundle', { get: () => _assemble.assembleTeacherBundle });
  Object.defineProperty(ctx, 'assembleStudentBundle', { get: () => _assemble.assembleStudentBundle });
  Object.defineProperty(ctx, 'fetchGroupsRemote', { get: () => _ops.fetchGroupsRemote });
  Object.defineProperty(ctx, 'upsertGroupRemote', { get: () => _ops.upsertGroupRemote });
  Object.defineProperty(ctx, 'deleteGroupRemote', { get: () => _ops.deleteGroupRemote });
  Object.defineProperty(ctx, 'fetchDiaryRemote', { get: () => _ops.fetchDiaryRemote });
  Object.defineProperty(ctx, 'upsertDiaryRemote', { get: () => _ops.upsertDiaryRemote });
  Object.defineProperty(ctx, 'deleteDiaryRemote', { get: () => _ops.deleteDiaryRemote });
  Object.defineProperty(ctx, 'uploadFile', { get: () => _ops.uploadFile });
  Object.defineProperty(ctx, 'getSignedUrlForPath', { get: () => _ops.getSignedUrlForPath });
  Object.defineProperty(ctx, 'consumeUploadResult', { get: () => _ops.consumeUploadResult });
  Object.defineProperty(ctx, 'upsertCompletionRemote', { get: () => _ops.upsertCompletionRemote });
  Object.defineProperty(ctx, 'deleteCompletionRemote', { get: () => _ops.deleteCompletionRemote });
  Object.defineProperty(ctx, 'clearStudentDataRemote', { get: () => _ops.clearStudentDataRemote });
  Object.defineProperty(ctx, 'deleteStudentRemote', { get: () => _ops.deleteStudentRemote });
  Object.defineProperty(ctx, 'deleteQuizRemote', { get: () => _ops.deleteQuizRemote });
  Object.defineProperty(ctx, 'getBroadcastReadCounts', { get: () => _ops.getBroadcastReadCounts });
  Object.defineProperty(ctx, 'deleteMessageRemote', { get: () => _ops.deleteMessageRemote });
  Object.defineProperty(ctx, 'updateMessageTextRemote', { get: () => _ops.updateMessageTextRemote });
  Object.defineProperty(ctx, 'sendMessageRemote', { get: () => _ops.sendMessageRemote });
  Object.defineProperty(ctx, 'deleteOwnMessageRemote', { get: () => _ops.deleteOwnMessageRemote });
  Object.defineProperty(ctx, 'saveTaskRemote', { get: () => _ops.saveTaskRemote });
  Object.defineProperty(ctx, 'saveQuizRemote', { get: () => _ops.saveQuizRemote });
  Object.defineProperty(ctx, 'saveStudentRemote', { get: () => _ops.saveStudentRemote });
  Object.defineProperty(ctx, 'deleteTaskRemote', { get: () => _ops.deleteTaskRemote });
  Object.defineProperty(ctx, 'submitDailyScheduleProposalRemote', { get: () => _ops.submitDailyScheduleProposalRemote });
  Object.defineProperty(ctx, 'setDailyScheduleTeacherRemote', { get: () => _ops.setDailyScheduleTeacherRemote });
  Object.defineProperty(ctx, 'upsertTeacherNoteRemote', { get: () => _ops.upsertTeacherNoteRemote });
  Object.defineProperty(ctx, 'deleteTeacherNoteRemote', { get: () => _ops.deleteTeacherNoteRemote });
  Object.defineProperty(ctx, 'updateConfigRemote', { get: () => _ops.updateConfigRemote });
  Object.defineProperty(ctx, 'updateFortnightlyConfigRemote', { get: () => _ops.updateFortnightlyConfigRemote });
  Object.defineProperty(ctx, 'upsertAcademicHistoryRemote', { get: () => _ops.upsertAcademicHistoryRemote });
  Object.defineProperty(ctx, 'deleteAcademicHistoryRemote', { get: () => _ops.deleteAcademicHistoryRemote });
  Object.defineProperty(ctx, 'upsertGoalRemote', { get: () => _ops.upsertGoalRemote });
  Object.defineProperty(ctx, 'deleteGoalRemote', { get: () => _ops.deleteGoalRemote });
  Object.defineProperty(ctx, '_patchNoteInMem', { get: () => _ops._patchNoteInMem });
  Object.defineProperty(ctx, 'upsertStudentNoteRemote', { get: () => _ops.upsertStudentNoteRemote });
  Object.defineProperty(ctx, 'markNoteReviewedRemote', { get: () => _ops.markNoteReviewedRemote });
  Object.defineProperty(ctx, 'deleteStudentNoteRemote', { get: () => _ops.deleteStudentNoteRemote });
  Object.defineProperty(ctx, 'upsertNoteCategoryRemote', { get: () => _ops.upsertNoteCategoryRemote });
  Object.defineProperty(ctx, 'deleteNoteCategoryRemote', { get: () => _ops.deleteNoteCategoryRemote });
  Object.defineProperty(ctx, 'deleteDocumentRemote', { get: () => _ops.deleteDocumentRemote });
  Object.defineProperty(ctx, 'saveDocumentRemote', { get: () => _ops.saveDocumentRemote });
  Object.defineProperty(ctx, 'submitQuizRemote', { get: () => _ops.submitQuizRemote });
  Object.defineProperty(ctx, 'updateQuizScoreRemote', { get: () => _ops.updateQuizScoreRemote });
  Object.defineProperty(ctx, 'updateTaskStatusRemote', { get: () => _ops.updateTaskStatusRemote });
  Object.defineProperty(ctx, 'completeOnetimeTaskRemote', { get: () => _ops.completeOnetimeTaskRemote });
  Object.defineProperty(ctx, 'resolveDailyScheduleProposalRemote', { get: () => _ops.resolveDailyScheduleProposalRemote });
  const _assemble = w._RSModules.assemble(ctx);
  const _ops = w._RSModules.ops(ctx);

  w.RemoteSync = {
    isRemote, usesSecureKv, getClient,
    mem,
    bootstrap, bootstrapLegacy, bootstrapTeacherIdle, bootstrapStudentIdle,
    unlockTeacherWithPin, unlockStudentWithWaqfPin,
    refreshStudentLockHints,
    schedule, flushKey, flushAllFromMem,
    sendMessageRemote: _ops.sendMessageRemote,
    markDocReviewedRemote, markMessagesReadRemote, clearStudentDataRemote: _ops.clearStudentDataRemote, deleteStudentRemote: _ops.deleteStudentRemote, deleteQuizRemote: _ops.deleteQuizRemote, deleteTaskRemote: _ops.deleteTaskRemote, deleteMessageRemote: _ops.deleteMessageRemote, updateMessageTextRemote: _ops.updateMessageTextRemote, deleteOwnMessageRemote: _ops.deleteOwnMessageRemote, getBroadcastReadCounts: _ops.getBroadcastReadCounts,
    upsertCompletionRemote: _ops.upsertCompletionRemote, deleteCompletionRemote: _ops.deleteCompletionRemote,
    fetchGroupsRemote: _ops.fetchGroupsRemote, upsertGroupRemote: _ops.upsertGroupRemote, deleteGroupRemote: _ops.deleteGroupRemote,
    fetchDiaryRemote: _ops.fetchDiaryRemote, upsertDiaryRemote: _ops.upsertDiaryRemote, deleteDiaryRemote: _ops.deleteDiaryRemote,
    upsertTeacherNoteRemote: _ops.upsertTeacherNoteRemote, deleteTeacherNoteRemote: _ops.deleteTeacherNoteRemote,
    updateConfigRemote: _ops.updateConfigRemote, updateFortnightlyConfigRemote: _ops.updateFortnightlyConfigRemote, upsertAcademicHistoryRemote: _ops.upsertAcademicHistoryRemote, deleteAcademicHistoryRemote: _ops.deleteAcademicHistoryRemote,
    upsertGoalRemote: _ops.upsertGoalRemote, deleteGoalRemote: _ops.deleteGoalRemote, saveDocumentRemote: _ops.saveDocumentRemote, deleteDocumentRemote: _ops.deleteDocumentRemote,
    upsertStudentNoteRemote: _ops.upsertStudentNoteRemote, deleteStudentNoteRemote: _ops.deleteStudentNoteRemote, markNoteReviewedRemote: _ops.markNoteReviewedRemote,
    upsertNoteCategoryRemote: _ops.upsertNoteCategoryRemote, deleteNoteCategoryRemote: _ops.deleteNoteCategoryRemote,
    submitQuizRemote: _ops.submitQuizRemote, updateQuizScoreRemote: _ops.updateQuizScoreRemote, updateTaskStatusRemote: _ops.updateTaskStatusRemote, completeOnetimeTaskRemote: _ops.completeOnetimeTaskRemote,
    saveTaskRemote: _ops.saveTaskRemote, saveQuizRemote: _ops.saveQuizRemote, saveStudentRemote: _ops.saveStudentRemote, updateStudentPinRemote,
    submitDailyScheduleProposalRemote: _ops.submitDailyScheduleProposalRemote, setDailyScheduleTeacherRemote: _ops.setDailyScheduleTeacherRemote, resolveDailyScheduleProposalRemote: _ops.resolveDailyScheduleProposalRemote,
    uploadFile: _ops.uploadFile, getSignedUrlForPath: _ops.getSignedUrlForPath, consumeUploadResult: _ops.consumeUploadResult,
    getStudentPin: () => _studentPin,
    deviceHeaders, sessionAuth,
    BUCKET, startRealtimeSync, pullRemoteSnapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);

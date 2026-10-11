/* Waqful Madinah — js/shared/docx-preview.js: Word (.docx) preview inside the app.
   The file is read in the browser and laid out as pages (docx-preview + JSZip, loaded on
   first use from jsDelivr); nothing is sent to any other service. Old binary .doc files
   cannot be read this way — the user gets a clear message instead. */
(function (global) {
  'use strict';
  var JSZIP_SRC = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  var DOCX_SRC = 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.7/dist/docx-preview.min.js';
  var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var loadPromise = null;
  var activeToken = 0;

  function loadScript(src, flag) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-waqf-lib="' + flag + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src; s.async = true; s.setAttribute('data-waqf-lib', flag);
      s.onload = function () { resolve(); };
      s.onerror = function () { s.remove(); reject(new Error(flag + '_load_fail')); };
      document.head.appendChild(s);
    });
  }
  function ensureLib() {
    if (global.docx && global.docx.renderAsync && global.JSZip) return Promise.resolve(global.docx);
    if (!loadPromise) {
      loadPromise = loadScript(JSZIP_SRC, 'jszip')
        .then(function () { return loadScript(DOCX_SRC, 'docx-preview'); })
        .then(function () {
          if (!global.docx || !global.docx.renderAsync) throw new Error('docx_missing');
          return global.docx;
        })
        .catch(function (err) { loadPromise = null; throw err; });
    }
    return loadPromise;
  }

  function nameOf(meta) { return String((meta && (meta.fileName || meta.name)) || '').toLowerCase(); }
  function isDocxMeta(meta) {
    if (!meta) return false;
    var ft = String(meta.fileType || '').toLowerCase();
    return ft === DOCX_MIME || ft === 'docx' || /\.docx$/i.test(nameOf(meta));
  }
  /** Old Word 97–2003 (.doc) — binary format, not readable in the browser. */
  function isLegacyDocMeta(meta) {
    if (!meta) return false;
    var ft = String(meta.fileType || '').toLowerCase();
    return ft === 'application/msword' || /\.doc$/i.test(nameOf(meta));
  }

  function message(container, icon, text) {
    container.innerHTML = '<div class="docx-preview-msg" role="status"><span aria-hidden="true">' + icon + '</span><span>' + text + '</span></div>';
  }
  function legacyNotice(container) {
    message(container, '📄', 'এটা পুরনো Word (.doc) ফাইল — অ্যাপের ভেতরে দেখা যায় না। ডাউনলোড করে খুলুন, অথবা Word-এ «.docx» হিসেবে সেভ করে পাঠাতে বলুন।');
  }

  /** Lay the pages out to the container's width (Word pages are ~21 cm wide). */
  function fitPages(container) {
    if (container.classList.contains('reflow')) return;
    var wrap = container.querySelector('.docx-wrapper');
    var page = wrap && wrap.querySelector('section.docx');
    if (!wrap || !page) return;
    wrap.style.zoom = '';
    var avail = container.clientWidth - 4;
    var full = page.offsetWidth + 24;
    if (avail > 0 && full > avail) wrap.style.zoom = String(Math.max(0.3, avail / full));
  }

  /**
   * @param {HTMLElement} container where the pages go (it scrolls)
   * @param {string} url signed URL or data: URL of the .docx
   */
  function render(container, url, opts) {
    var token = ++activeToken;
    var o = opts || {};
    container.classList.add('docx-preview-host');
    // ফোনের চওড়ায় A4 পাতা ৪০%-এ নেমে যায় — তখন «পড়ার মোড»: লেখা পর্দার চওড়ায় সাজে, স্বাভাবিক আকারে
    var reflow = (container.clientWidth || global.innerWidth) < 600;
    container.classList.toggle('reflow', reflow);
    if (o.maxHeight) container.style.maxHeight = o.maxHeight;
    message(container, '⏳', 'Word ফাইল সাজানো হচ্ছে…');
    return ensureLib()
      .then(function () { return fetch(url); })
      .then(function (res) { if (!res.ok) throw new Error('fetch_' + res.status); return res.arrayBuffer(); })
      .then(function (buf) {
        if (token !== activeToken) return;
        container.innerHTML = '';
        return global.docx.renderAsync(buf, container, null, {
          className: 'docx', inWrapper: true, breakPages: !reflow,
          ignoreWidth: reflow, ignoreHeight: reflow,
          renderHeaders: true, renderFooters: true, renderFootnotes: true,
          ignoreLastRenderedPageBreak: true, experimental: false, useBase64URL: true,
        });
      })
      .then(function () {
        if (token !== activeToken) return;
        fitPages(container);
        if (global.ResizeObserver && !container._docxRO) {
          container._docxRO = new ResizeObserver(function () { fitPages(container); });
          container._docxRO.observe(container);
        }
      })
      .catch(function (err) {
        if (token !== activeToken) return;
        console.warn('DocxPreview:', err);
        message(container, '⚠️', /load_fail|docx_missing/.test(String(err && err.message))
          ? 'Word দেখার অংশটা লোড হয়নি — ইন্টারনেট চেক করে আবার খুলুন, অথবা ডাউনলোড করুন।'
          : 'ফাইলটা খোলা যায়নি — ডাউনলোড করে দেখুন।');
      });
  }
  function cancel() { activeToken++; }

  global.DocxPreview = { isDocxMeta: isDocxMeta, isLegacyDocMeta: isLegacyDocMeta, render: render, legacyNotice: legacyNotice, cancel: cancel };
})(typeof window !== 'undefined' ? window : globalThis);

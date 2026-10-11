/* Waqful Madinah — js/shared/back-nav.js: Android back button.
   A few "guard" history entries sit on top of the page; each back press removes one and we undo
   one step inside the app (open sheet → inner page → home tab). On the home tab we ask first and
   step down to the page's own entry, so the next back press really closes the app.

   Why several guards, added on a tap: Chrome skips history entries that a page added without a
   user gesture since the last back/forward. A single guard re-added inside the back handler is
   one of those, so the second back press in a row used to close the app with no question. Guards
   are therefore topped up on the user's touches/keys (which count as a gesture), several at a
   time, so a run of back presses without touching the screen still walks back step by step. */
(function (global) {
  'use strict';
  var GUARDS = 4;
  var cfg = null, exiting = false;

  function depth() {
    var s = history.state;
    return s && s.waqfBack ? (s.g | 0) : 0;
  }
  function topUp() {
    try {
      for (var d = depth(); d < GUARDS; d++) history.pushState({ waqfBack: 1, g: d + 1 }, '');
    } catch (e) {}
  }
  function topModal() {
    var open = document.querySelectorAll('.modal-overlay.open');
    return open.length ? open[open.length - 1] : null;
  }
  function askEl() {
    var el = document.getElementById('backExitAsk');
    if (!el) {
      el = document.createElement('div');
      el.id = 'backExitAsk'; el.className = 'back-exit-ask'; el.setAttribute('role', 'alertdialog');
      el.innerHTML = '<b>অ্যাপ বন্ধ করবেন?</b><span>বন্ধ করতে আরেকবার ব্যাক চাপুন।</span>' +
        '<button type="button">না, থাকুন</button>';
      el.querySelector('button').addEventListener('click', hideAsk);
      document.body.appendChild(el);
    }
    return el;
  }
  function asking() {
    var el = document.getElementById('backExitAsk');
    return !!(el && el.classList.contains('show'));
  }
  function hideAsk() {
    var el = document.getElementById('backExitAsk');
    if (el) el.classList.remove('show');
    topUp();
  }
  function ask() {
    askEl().classList.add('show');
    // পাতার নিজের এন্ট্রিতে নেমে যাই — পরের ব্যাকেই অ্যাপ বন্ধ হবে
    var d = depth();
    if (d > 0) { exiting = true; history.go(-d); }
  }
  function onPop() {
    if (exiting) { if (depth() === 0) exiting = false; return; }
    if (!cfg) return;
    if (asking()) { hideAsk(); return; }
    var m = topModal();
    if (m && typeof global.closeModal === 'function') { global.closeModal(m.id); return; }
    var handled = false;
    try { handled = !!(cfg.back && cfg.back()); } catch (e) { console.warn('BackNav', e); }
    if (!handled) ask();
  }
  // পর্দায় যেকোনো ছোঁয়া/চাপ = ব্যবহারকারীর ইশারা — তখন গার্ড ভরে দিই (প্রশ্নটা খোলা থাকলে সেটাও বন্ধ)
  function onGesture() {
    if (exiting) return;
    if (asking()) { hideAsk(); return; }
    if (depth() < GUARDS) topUp();
  }

  /** @param {{back:function():boolean}} options back() undoes one step and returns true, or false when already home */
  function init(options) {
    cfg = options || {};
    if (!global.history || !history.pushState) return;
    global.addEventListener('popstate', onPop);
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
    topUp();
  }

  global.BackNav = { init: init };
})(typeof window !== 'undefined' ? window : globalThis);

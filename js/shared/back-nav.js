/* Waqful Madinah — js/shared/back-nav.js: Android back button.
   One extra history entry sits on top of the page. Each back press removes it; we then
   undo one step inside the app (open sheet → inner page → home tab) and put it back.
   On the home tab we ask first: a second back press within a few seconds closes the app
   (the browser only closes it on a real back press, so we never call close ourselves). */
(function (global) {
  'use strict';
  var cfg = null, armed = false, askTimer = null;

  function arm() {
    if (armed) return;
    try { history.pushState({ waqfBack: 1 }, ''); armed = true; } catch (e) {}
  }
  function topModal() {
    var open = document.querySelectorAll('.modal-overlay.open');
    return open.length ? open[open.length - 1] : null;
  }
  function hideAsk() {
    var el = document.getElementById('backExitAsk');
    if (el) el.classList.remove('show');
    clearTimeout(askTimer); askTimer = null;
  }
  function stay() { hideAsk(); arm(); }
  function ask() {
    var el = document.getElementById('backExitAsk');
    if (!el) {
      el = document.createElement('div');
      el.id = 'backExitAsk'; el.className = 'back-exit-ask'; el.setAttribute('role', 'alertdialog');
      el.innerHTML = '<b>অ্যাপ বন্ধ করবেন?</b><span>বন্ধ করতে আরেকবার ব্যাক চাপুন।</span>' +
        '<button type="button">না, থাকুন</button>';
      el.querySelector('button').addEventListener('click', stay);
      document.body.appendChild(el);
    }
    el.classList.add('show');
    // সাড়া না দিলে কিছুক্ষণ পর আবার আগের মতো — পরের ব্যাকে আবার জিজ্ঞাসা করবে
    clearTimeout(askTimer); askTimer = setTimeout(stay, 3500);
  }
  function onPop() {
    armed = false;
    if (!cfg) return;
    var asking = document.getElementById('backExitAsk');
    if (asking && asking.classList.contains('show')) { hideAsk(); return; }
    var m = topModal();
    if (m && typeof global.closeModal === 'function') { global.closeModal(m.id); arm(); return; }
    var handled = false;
    try { handled = !!(cfg.back && cfg.back()); } catch (e) { console.warn('BackNav', e); }
    if (handled) { arm(); return; }
    ask();
  }

  /** @param {{back:function():boolean}} options back() undoes one step and returns true, or false when already home */
  function init(options) {
    cfg = options || {};
    if (!global.history || !history.pushState) return;
    global.addEventListener('popstate', onPop);
    arm();
  }

  global.BackNav = { init: init };
})(typeof window !== 'undefined' ? window : globalThis);

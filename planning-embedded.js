/**
 * Mode app Canal Forme (?embedded=1) — classe body + signalement WebView.
 */
(function () {
  'use strict';

  var booted = false;

  function isEmbedded() {
    try {
      return new URLSearchParams(window.location.search).get('embedded') === '1';
    } catch (e) {
      return false;
    }
  }

  function pageFileName() {
    var path = window.location.pathname || '';
    return path.split('/').pop() || '';
  }

  function applyEmbeddedPageClass() {
    var file = pageFileName();
    if (file === 'daily_grid.html') {
      document.body.classList.add('embedded-daily-grid');
    } else if (file.indexOf('weekly_vertical') !== -1) {
      document.body.classList.add('embedded-weekly-vertical');
    } else if (file === 'weekly.html') {
      document.body.classList.add('embedded-weekly-horizontal');
    }
  }

  function postPrayerVisible(visible) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PRAYER_VISIBLE',
        visible: !!visible,
      }));
    }
  }

  function readPrayerButtonVisible() {
    var btn = document.getElementById('ramadanSwitchButton');
    if (!btn) {
      postPrayerVisible(false);
      return;
    }
    var style = window.getComputedStyle(btn);
    var visible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity || '1') > 0.05;
    postPrayerVisible(visible);
  }

  function watchPrayerButton() {
    var btn = document.getElementById('ramadanSwitchButton');
    if (!btn) {
      postPrayerVisible(false);
      return;
    }
    readPrayerButtonVisible();
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(readPrayerButtonVisible);
      observer.observe(btn, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    window.addEventListener('resize', readPrayerButtonVisible);
    setInterval(readPrayerButtonVisible, 2500);
  }

  function bootEmbeddedFeatures() {
    if (booted) return;
    booted = true;
    watchPrayerButton();
  }

  function initEmbeddedShell() {
    document.documentElement.classList.add('embedded');
    document.body.classList.add('embedded');
    applyEmbeddedPageClass();
    bootEmbeddedFeatures();
  }

  if (!isEmbedded()) return;

  if (document.body) {
    initEmbeddedShell();
  } else {
    document.addEventListener('DOMContentLoaded', initEmbeddedShell);
  }
})();

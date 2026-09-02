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
    } else if (file === 'daily_matrix.html') {
      document.body.classList.add('embedded-daily-matrix');
    } else if (file === 'daily_columns.html') {
      document.body.classList.add('embedded-daily-columns');
    } else if (file.indexOf('weekly_vertical') !== -1) {
      document.body.classList.add('embedded-weekly-vertical');
    } else if (file === 'weekly.html' || file === 'weekly_landscape.html') {
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

  window.__canalFormeGoToday = function () {
    var file = pageFileName();
    try {
      if (file === 'daily.html' && typeof returnToToday === 'function') {
        returnToToday();
        return;
      }
      if (file === 'daily_grid.html' && typeof selectedDateYmd === 'string' && typeof ymdFromDate === 'function') {
        selectedDateYmd = ymdFromDate(new Date());
        if (typeof currentDayIndex !== 'undefined') currentDayIndex = new Date().getDay();
        if (typeof syncDailyGridDateInUrl === 'function') syncDailyGridDateInUrl();
        if (typeof displayGridSchedule === 'function') displayGridSchedule();
        return;
      }
      if (file === 'daily_columns.html' && typeof goToday === 'function') {
        goToday();
        return;
      }
    } catch (e) {}
  };

  function initEmbeddedShell() {
    document.documentElement.classList.add('embedded');
    document.body.classList.add('embedded');
    applyEmbeddedPageClass();
    bootEmbeddedFeatures();
    bootWeeklyHorizontalEmbedded();
  }

  function bootWeeklyHorizontalEmbedded() {
    var file = pageFileName();
    if (file !== 'weekly_landscape.html') return;

    function markSettling() {
      document.body.classList.add('embedded-orient-settling');
      if (window.__cfOrientSettleT) clearTimeout(window.__cfOrientSettleT);
      window.__cfOrientSettleT = setTimeout(function () {
        document.body.classList.remove('embedded-orient-settling');
      }, 450);
    }

    window.addEventListener('resize', markSettling);
    window.addEventListener('orientationchange', markSettling);
  }

  if (!isEmbedded()) return;

  if (document.body) {
    initEmbeddedShell();
  } else {
    document.addEventListener('DOMContentLoaded', initEmbeddedShell);
  }
})();

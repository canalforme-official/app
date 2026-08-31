/**
 * Reprise WebView Canal Forme — corrige l'écran blanc après longue mise en arrière-plan.
 * Actif dans la WebView React Native ou en mode ?embedded=1.
 */
(function () {
  'use strict';

  var MIN_HIDDEN_MS = 30000;
  var RELOAD_COOLDOWN_MS = 10000;
  var SOFT_RECOVER_VERIFY_MS = 2500;

  var hiddenAt = 0;
  var healthyAt = 0;
  var lastReloadAt = 0;
  var resumeCheckTimer = null;
  var softRecoverTimer = null;

  function isWebViewContext() {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      return true;
    }
    try {
      return new URLSearchParams(window.location.search).get('embedded') === '1';
    } catch (e) {
      return false;
    }
  }

  if (!isWebViewContext()) {
    return;
  }

  var api = window.__canalFormeWebViewResume || {};
  window.__canalFormeWebViewResume = api;

  function pageFileName() {
    var path = window.location.pathname || '';
    return path.split('/').pop() || '';
  }

  api.markHealthy = function markHealthy() {
    healthyAt = Date.now();
  };

  function isOverlayStuck() {
    var ids = ['loadingOverlay', 'bootLoading', 'loading'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el || el.hidden) continue;
      var style = window.getComputedStyle(el);
      if (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity || '1') > 0.05
      ) {
        if (document.body && document.body.classList.contains('loading') && !healthyAt) {
          continue;
        }
        if (healthyAt) return true;
      }
    }
    return false;
  }

  function defaultIsHealthy() {
    if (document.wasDiscarded) return false;

    var body = document.body;
    if (!body) return false;

    var text = (body.innerText || '').replace(/\s+/g, ' ').trim();
    if (text.length < 12) return false;
    if (body.scrollHeight < 60 && text.length < 40) return false;
    if (isOverlayStuck()) return false;

    var bootError = document.getElementById('bootError');
    if (bootError && !bootError.hidden) return false;

    var errorEl = document.getElementById('error');
    if (errorEl) {
      var errorStyle = window.getComputedStyle(errorEl);
      if (
        errorStyle.display !== 'none' &&
        (errorEl.textContent || '').trim().length > 0
      ) {
        return false;
      }
    }

    return true;
  }

  function isHealthy() {
    if (typeof api.isHealthy === 'function') {
      try {
        return !!api.isHealthy();
      } catch (e) {
        /* fallback */
      }
    }
    return defaultIsHealthy();
  }

  function reloadPage() {
    var now = Date.now();
    if (now - lastReloadAt < RELOAD_COOLDOWN_MS) return;
    lastReloadAt = now;
    window.location.reload();
  }

  function softRecover() {
    var file = pageFileName();

    try {
      if (file === 'myzone-leaderboard.html' && typeof loadLeaderboard === 'function') {
        loadLeaderboard();
        return true;
      }
      if (file === 'palmares-myzone.html' && typeof updateLeaderboard === 'function') {
        updateLeaderboard();
        return true;
      }
      if (file === 'status-leaderboard.html' && typeof init === 'function') {
        init(true);
        return true;
      }
      if (file === 'daily.html' && typeof fetchAllData === 'function') {
        fetchAllData();
        return true;
      }
      if (file === 'daily_grid.html' && typeof loadAndDisplayCourses === 'function') {
        loadAndDisplayCourses();
        return true;
      }
      if (file === 'daily_matrix.html' && typeof loadAndDisplay === 'function') {
        loadAndDisplay();
        return true;
      }
      if (file === 'daily_columns.html' && typeof renderBoard === 'function') {
        renderBoard();
        return true;
      }
      if ((file === 'weekly.html' || file === 'weekly_landscape.html' || file.indexOf('weekly_vertical') !== -1) && typeof refreshPlanningDisplay === 'function') {
        refreshPlanningDisplay();
        return true;
      }
      if (file === 'prayer-times.html' && typeof loadPrayerTimes === 'function') {
        loadPrayerTimes();
        return true;
      }
    } catch (e) {
      return false;
    }

    return false;
  }

  function tryRecover() {
    if (softRecoverTimer) {
      clearTimeout(softRecoverTimer);
      softRecoverTimer = null;
    }

    if (healthyAt && softRecover()) {
      softRecoverTimer = setTimeout(function () {
        softRecoverTimer = null;
        if (!isHealthy()) reloadPage();
      }, SOFT_RECOVER_VERIFY_MS);
      return;
    }

    reloadPage();
  }

  function shouldRecover(hiddenDuration) {
    if (document.wasDiscarded) return true;
    if (hiddenDuration < MIN_HIDDEN_MS) return false;
    return !isHealthy();
  }

  function scheduleResumeCheck(immediate) {
    if (resumeCheckTimer) clearTimeout(resumeCheckTimer);
    resumeCheckTimer = setTimeout(function () {
      resumeCheckTimer = null;
      var hiddenDuration = hiddenAt ? Date.now() - hiddenAt : 0;
      if (!shouldRecover(hiddenDuration)) return;
      tryRecover();
    }, immediate ? 80 : 400);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (document.visibilityState === 'visible') {
      scheduleResumeCheck();
    }
  });

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      tryRecover();
      return;
    }
    scheduleResumeCheck(true);
  });

  document.addEventListener('freeze', function () {
    hiddenAt = Date.now();
  });

  document.addEventListener('resume', function () {
    scheduleResumeCheck();
  });
})();

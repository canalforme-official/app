/**
 * Mode app Canal Forme (?embedded=1) — classe body + signalement WebView.
 */
(function () {
  'use strict';

  function isEmbedded() {
    try {
      return new URLSearchParams(window.location.search).get('embedded') === '1';
    } catch (e) {
      return false;
    }
  }

  if (!isEmbedded()) return;

  document.documentElement.classList.add('embedded');
  if (document.body) {
    document.body.classList.add('embedded');
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.classList.add('embedded');
    });
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchPrayerButton);
  } else {
    watchPrayerButton();
  }
})();

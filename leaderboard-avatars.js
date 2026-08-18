/**
 * Avatars + surnoms app (leaderboard-avatars.json) — Classement / Statuts / Palmarès.
 * Surnom app prioritaire sur le surnom Myzone. Photo app prioritaire ; sinon photo coach.
 */
(function (global) {
  'use strict';

  var DEFAULT_COACH_PHOTO = 'default-coach-photo.png';
  var avatarsByGuid = {};

  function normalizeLeaderboardGuid(value) {
    return String(value || '').trim().toUpperCase();
  }

  function userGuid(user) {
    if (!user) return '';
    return normalizeLeaderboardGuid(user.usrGUID || user.guid);
  }

  function loadAvatarsMap(doc) {
    var map = {};
    var byGuid = doc && doc.byGuid ? doc.byGuid : {};
    Object.keys(byGuid).forEach(function (key) {
      var entry = byGuid[key];
      if (typeof entry === 'string') {
        map[normalizeLeaderboardGuid(key)] = { photoUrl: entry, nickname: '' };
        return;
      }
      if (!entry || typeof entry !== 'object') return;
      map[normalizeLeaderboardGuid(key)] = {
        photoUrl: entry.photoUrl ? String(entry.photoUrl) : '',
        nickname: entry.nickname ? String(entry.nickname).trim() : '',
      };
    });
    avatarsByGuid = map;
  }

  function fetchAvatarsJson() {
    return (async function () {
      try {
        var localResp = await fetch('./leaderboard-avatars.json?timestamp=' + Date.now());
        if (localResp.ok) {
          loadAvatarsMap(await localResp.json());
          return;
        }
      } catch (e) { /* fallback GitHub */ }
      try {
        var remoteResp = await fetch(
          'https://raw.githubusercontent.com/canalforme-official/app-data/main/leaderboard-avatars.json?timestamp=' + Date.now()
        );
        if (remoteResp.ok) loadAvatarsMap(await remoteResp.json());
      } catch (e) {
        avatarsByGuid = {};
      }
    })();
  }

  function appEntry(user) {
    return avatarsByGuid[userGuid(user)] || {};
  }

  function memberDisplayName(user) {
    var appName = appEntry(user).nickname;
    if (appName) return appName;
    return String((user && user.nickname) || '');
  }

  /** Photo membre : avatar app prioritaire ; sinon photo coach (feuille). */
  function memberPhotoSrc(user) {
    var appPhoto = appEntry(user).photoUrl;
    if (appPhoto) return appPhoto;
    if (user && user.type === 'Coach') return coachPhotoSrc(user);
    return '';
  }

  function coachPhotoSrc(user) {
    if (!user || user.type !== 'Coach') return '';
    var coachObj = {
      imageUrl: user.coachLink || '',
      pngCaricature: (user.pngCaricature && String(user.pngCaricature).trim()) || ''
    };
    var url = '';
    if (typeof PlanningResolve !== 'undefined' && PlanningResolve.coachPhotoUrl) {
      url = PlanningResolve.coachPhotoUrl(coachObj) || '';
    }
    if (!url) url = user.coachLink || '';
    return url || DEFAULT_COACH_PHOTO;
  }

  global.LeaderboardAvatars = {
    fetchAvatarsJson: fetchAvatarsJson,
    appEntry: appEntry,
    memberDisplayName: memberDisplayName,
    memberPhotoSrc: memberPhotoSrc,
    coachPhotoSrc: coachPhotoSrc,
    normalizeGuid: normalizeLeaderboardGuid
  };
})(typeof window !== 'undefined' ? window : this);

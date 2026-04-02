/**
 * Résolution planning par date (priorité métier) — partagé daily / daily_grid / weekly.
 * Dépendances : aucune (navigateur).
 */
(function (global) {
  'use strict';

  var NAV_DAYS_LIMIT = 180;

  function ymdFromDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parseYmdLocal(s) {
    var p = String(s).split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function addDaysToYmd(ymd, deltaDays) {
    var d = parseYmdLocal(ymd);
    d.setDate(d.getDate() + deltaDays);
    return ymdFromDate(d);
  }

  function clampNavYmd(ymd) {
    var today = ymdFromDate(new Date());
    var min = addDaysToYmd(today, -NAV_DAYS_LIMIT);
    var max = addDaysToYmd(today, NAV_DAYS_LIMIT);
    if (ymd < min) return min;
    if (ymd > max) return max;
    return ymd;
  }

  /** Lundi de la semaine ISO (lundi–dimanche) contenant ymd */
  function mondayOfWeekContaining(ymd) {
    var d = parseYmdLocal(ymd);
    var dow = d.getDay();
    var delta = dow === 0 ? -6 : 1 - dow;
    return addDaysToYmd(ymd, delta);
  }

  /** Premier lundi >= ymd (calendaire) */
  function firstMondayOnOrAfter(ymd) {
    var d = parseYmdLocal(ymd);
    var dow = d.getDay();
    var sinceMon = (dow + 6) % 7;
    if (sinceMon === 0) return ymd;
    return addDaysToYmd(ymd, 7 - sinceMon);
  }

  /** Borne la semaine (lundi) pour que chaque jour Mon–Sun soit dans [min, max] */
  function clampWeekMonday(weekMondayYmd) {
    var today = ymdFromDate(new Date());
    var min = addDaysToYmd(today, -NAV_DAYS_LIMIT);
    var max = addDaysToYmd(today, NAV_DAYS_LIMIT);
    var maxMonday = mondayOfWeekContaining(addDaysToYmd(max, -6));
    var minMonday = firstMondayOnOrAfter(min);
    var m = weekMondayYmd;
    if (m < minMonday) m = minMonday;
    if (m > maxMonday) m = maxMonday;
    return m;
  }

  function getDayNameFrFromYmd(dateStr) {
    var d = parseYmdLocal(dateStr);
    var days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return days[d.getDay()];
  }

  function capitalizeDayFr(dayLower) {
    if (!dayLower || !dayLower.length) return '';
    return dayLower.charAt(0).toUpperCase() + dayLower.slice(1);
  }

  /** JJ MMM (trois lettres + point pour mois courts) */
  function formatDateJjMmm(ymd) {
    var d = parseYmdLocal(ymd);
    var months = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'jun.', 'jul.', 'aoû.', 'sep.', 'oct.', 'nov.', 'déc.'];
    return d.getDate() + ' ' + months[d.getMonth()];
  }

  /** JJ mois complet (ex. 17 mars) — weekly */
  function formatDateJjMmmm(ymd) {
    var d = parseYmdLocal(ymd);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  function normalizePlanningKey(raw) {
    var s = String(raw || '').trim().toLowerCase();
    if (!s) return 'regulier';
    var n = s.replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a').replace(/[ùû]/g, 'u');
    if (n === 'ferme' || (n.length >= 4 && n.substring(0, 4) === 'ferm')) return 'ferme';
    if (n.indexOf('ramadan') !== -1) return 'ramadan';
    if ((n.indexOf('jours') !== -1 && n.indexOf('ferie') !== -1) || n === 'ferie' || n.indexOf('ferie') !== -1) return 'ferie';
    if (n.indexOf('estival') !== -1 || n === 'ete' || n.indexOf('ete') !== -1) return 'ete';
    if (n.indexOf('regulier') !== -1 || n.indexOf('planning') !== -1) return 'regulier';
    return 'regulier';
  }

  function periodPriorityScore(p) {
    var k = normalizePlanningKey((p && p.planningKey) ? p.planningKey : '');
    if (k === 'ferme') return 5;
    if (k === 'ferie') return 4;
    if (k === 'ramadan') return 3;
    if (k === 'ete') return 2;
    if (k === 'regulier') return 1;
    return 0;
  }

  function isDateInRamadanRange(dateStr, meta) {
    if (!dateStr || !meta || !meta.ramadanStart || !meta.ramadanEnd) return false;
    return dateStr >= meta.ramadanStart && dateStr <= meta.ramadanEnd;
  }

  function findPeriodsForDate(dateStr, periodes) {
    var out = [];
    if (!dateStr || !periodes || !periodes.length) return out;
    for (var i = 0; i < periodes.length; i++) {
      var p = periodes[i];
      if (dateStr >= p.start && dateStr <= p.end) out.push(p);
    }
    return out;
  }

  function getEffectivePeriodForDate(dateStr, periodes) {
    var matches = findPeriodsForDate(dateStr, periodes);
    if (!matches.length) return null;
    var normalized = matches.map(function (p) {
      var o = {};
      for (var k in p) {
        if (Object.prototype.hasOwnProperty.call(p, k)) o[k] = p[k];
      }
      o.planningKey = normalizePlanningKey(p.planningKey);
      /* Si la colonne Planning est vide mais « Type » vaut été / férié… (aligné feuille Périodes). */
      if (p.type) {
        var fromType = normalizePlanningKey(p.type);
        if (o.planningKey === 'regulier' && fromType !== 'regulier') {
          o.planningKey = fromType;
        }
      }
      return o;
    });
    var best = normalized[0];
    var bestScore = periodPriorityScore(best);
    for (var j = 1; j < normalized.length; j++) {
      var sc = periodPriorityScore(normalized[j]);
      if (sc > bestScore) {
        bestScore = sc;
        best = normalized[j];
      }
    }
    return best;
  }

  /**
   * Au moins un cours dans planning, planningRamadan ou planningEte pour ce jour (clé fr minuscule).
   */
  function isWeekdayListedInBasePlannings(data, dayNameFrLower) {
    if (!data) return false;
    var p = data.planning && data.planning[dayNameFrLower];
    var r = data.planningRamadan && data.planningRamadan[dayNameFrLower];
    var e = data.planningEte && data.planningEte[dayNameFrLower];
    var np = Array.isArray(p) && p.length > 0;
    var nr = Array.isArray(r) && r.length > 0;
    var ne = Array.isArray(e) && e.length > 0;
    return np || nr || ne;
  }

  function resolveDailyView(dateStr, data) {
    var periodes = data.metadata && data.metadata.periods ? data.metadata.periods : [];
    var eff = getEffectivePeriodForDate(dateStr, periodes);
    var key = eff ? normalizePlanningKey(eff.planningKey) : 'regulier';
    if (key === 'regulier' && isDateInRamadanRange(dateStr, data.metadata)) {
      key = 'ramadan';
    }
    var periodName = eff && eff.name ? String(eff.name) : '';
    var dayName = getDayNameFrFromYmd(dateStr);
    var planning = data.planning || {};
    var planningRamadan = data.planningRamadan || {};
    var planningEte = data.planningEte || {};
    var planningFerieByDate = data.planningFerieByDate || {};
    if (key === 'ferme') {
      return { courses: [], planningKey: 'ferme', periodName: periodName, closed: true, indetermine: false, dayName: dayName };
    }
    var arrF = planningFerieByDate[dateStr];
    if (arrF && arrF.length) {
      return { courses: arrF, planningKey: 'ferie', periodName: periodName, closed: false, indetermine: false, dayName: dayName };
    }
    if (key === 'ferie') {
      return { courses: [], planningKey: 'ferie', periodName: periodName, closed: false, indetermine: true, dayName: dayName };
    }
    if (key === 'ramadan') {
      var arrR = planningRamadan[dayName] || [];
      return { courses: arrR, planningKey: 'ramadan', periodName: periodName, closed: false, indetermine: false, dayName: dayName };
    }
    if (key === 'ete') {
      var arrE = planningEte[dayName] || [];
      if (!arrE.length) {
        return { courses: [], planningKey: 'ete', periodName: periodName, closed: false, indetermine: true, dayName: dayName };
      }
      return { courses: arrE, planningKey: 'ete', periodName: periodName, closed: false, indetermine: false, dayName: dayName };
    }
    var arrReg = planning[dayName] || [];
    return { courses: arrReg, planningKey: 'regulier', periodName: periodName, closed: false, indetermine: false, dayName: dayName };
  }

  /**
   * Bloc créneaux pour un mode planning et un jour (fr minuscule : lundi … dimanche).
   * @param {Object|null} horairesMeta metadata.horaires
   * @param {string} planningKey regulier | ramadan | ete | ferie
   * @param {string} dayNameFrLower ex. depuis resolveDailyView().dayName
   * @returns {Object|null} { open1Label, open1, close1, open2Label, open2, close2 }
   */
  function pickOpeningHoursForDay(horairesMeta, planningKey, dayNameFrLower) {
    if (!horairesMeta || !planningKey) return null;
    var hk = planningKey;
    if (hk === 'ete' && !horairesMeta.ete) hk = 'regulier';
    var block = horairesMeta[hk];
    if (!block || typeof block !== 'object') return null;
    var day = dayNameFrLower ? String(dayNameFrLower).trim().toLowerCase() : '';
    if (block.byDay && day && block.byDay[day]) {
      var slot = block.byDay[day];
      if (slot && typeof slot === 'object') return slot;
    }
    if (block.open1 || block.close1 || block.open2 || block.close2) {
      return {
        open1Label: block.open1Label,
        open1: block.open1,
        close1: block.close1,
        open2Label: block.open2Label,
        open2: block.open2,
        close2: block.close2
      };
    }
    return null;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  /** Caricatures : date réelle du téléphone du 1er au 7 avril */
  function useCaricatureCoachPhotos() {
    var real = new Date();
    if (real.getMonth() !== 3) return false;
    var dom = real.getDate();
    return dom >= 1 && dom <= 7;
  }

  function coachPhotoUrl(coach) {
    if (!coach) return '';
    if (useCaricatureCoachPhotos() && coach.pngCaricature && String(coach.pngCaricature).trim() !== '') {
      return coach.pngCaricature;
    }
    return coach.imageUrl || '';
  }

  /**
   * Portrait plein format (col. F puis G) : en période 1–7 avril, priorité à bigPngCaricature, sinon bigPngUrl, puis vignette.
   */
  function coachBigPhotoUrl(coach) {
    if (!coach) return '';
    if (useCaricatureCoachPhotos() && coach.bigPngCaricature && String(coach.bigPngCaricature).trim() !== '') {
      return String(coach.bigPngCaricature).trim();
    }
    if (coach.bigPngUrl && String(coach.bigPngUrl).trim() !== '') {
      return String(coach.bigPngUrl).trim();
    }
    return coachPhotoUrl(coach) || (coach.imageUrl ? String(coach.imageUrl).trim() : '');
  }

  /**
   * Fond pleine page : priorité aux URL « grandes » (feuille Coachs F et G), sans la petite vignette seule hors période poisson.
   * Du 1er au 7 avril (date locale) : 1) bigPngCaricature (G) 2) bigPngUrl (F) 3) repli pngCaricature (D) si pas de colonnes F/G.
   * Reste de l’année : bigPngUrl (F) uniquement.
   */
  function coachHeroBackgroundUrl(coach) {
    if (!coach) return '';
    if (useCaricatureCoachPhotos()) {
      if (coach.bigPngCaricature && String(coach.bigPngCaricature).trim() !== '') {
        return String(coach.bigPngCaricature).trim();
      }
      if (coach.bigPngUrl && String(coach.bigPngUrl).trim() !== '') {
        return String(coach.bigPngUrl).trim();
      }
      if (coach.pngCaricature && String(coach.pngCaricature).trim() !== '') {
        return String(coach.pngCaricature).trim();
      }
      return '';
    }
    if (coach.bigPngUrl && String(coach.bigPngUrl).trim() !== '') {
      return String(coach.bigPngUrl).trim();
    }
    return '';
  }

  /** Libellé affiché : nom caricature (feuille Coachs, col. E) du 1er au 7 avril si renseigné, sinon nom du coach. */
  function coachDisplayName(coach) {
    if (!coach) return '';
    if (useCaricatureCoachPhotos() && coach.nomCaricature && String(coach.nomCaricature).trim() !== '') {
      return String(coach.nomCaricature).trim();
    }
    return coach.name || '';
  }

  var api = {
    NAV_DAYS_LIMIT: NAV_DAYS_LIMIT,
    ymdFromDate: ymdFromDate,
    parseYmdLocal: parseYmdLocal,
    addDaysToYmd: addDaysToYmd,
    clampNavYmd: clampNavYmd,
    mondayOfWeekContaining: mondayOfWeekContaining,
    firstMondayOnOrAfter: firstMondayOnOrAfter,
    clampWeekMonday: clampWeekMonday,
    getDayNameFrFromYmd: getDayNameFrFromYmd,
    capitalizeDayFr: capitalizeDayFr,
    formatDateJjMmm: formatDateJjMmm,
    formatDateJjMmmm: formatDateJjMmmm,
    normalizePlanningKey: normalizePlanningKey,
    periodPriorityScore: periodPriorityScore,
    isDateInRamadanRange: isDateInRamadanRange,
    findPeriodsForDate: findPeriodsForDate,
    getEffectivePeriodForDate: getEffectivePeriodForDate,
    isWeekdayListedInBasePlannings: isWeekdayListedInBasePlannings,
    resolveDailyView: resolveDailyView,
    pickOpeningHoursForDay: pickOpeningHoursForDay,
    escapeHtml: escapeHtml,
    useCaricatureCoachPhotos: useCaricatureCoachPhotos,
    coachPhotoUrl: coachPhotoUrl,
    coachBigPhotoUrl: coachBigPhotoUrl,
    coachHeroBackgroundUrl: coachHeroBackgroundUrl,
    coachDisplayName: coachDisplayName
  };

  global.PlanningResolve = api;
})(typeof window !== 'undefined' ? window : this);

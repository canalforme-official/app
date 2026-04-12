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
   * Indique si le JSON contient au moins un bloc événement pour cette date (affichage weekly).
   */
  function hasPlanningEventsForDate(dateStr, data) {
    var ev = data && data.planningEventsByDate && data.planningEventsByDate[dateStr];
    return Array.isArray(ev) && ev.length > 0;
  }

  /**
   * Applique les événements planning par-dessus la vue résolue (fermé / férié exclus).
   * Fermé et jour férié : inchangé. Sinon : dans chaque plage + studios, masque les cours de base
   * qui chevauchent et ajoute les cours événement (ordre des blocs = ordre JSON ; dernier gagne en cas de chevauchement).
   * @param {string} dateStr yyyy-MM-dd
   * @param {Object} resolvedView résultat de resolveDailyView
   * @param {Object} data payload planning-v2
   * @returns {Object} copie de la vue avec courses fusionnés et optionnellement planningEventLabels
   */
  function applyPlanningEventsToResolvedView(dateStr, resolvedView, data) {
    var rv = resolvedView;
    if (!rv || !data) return rv;
    if (rv.closed) return rv;
    if (rv.planningKey === 'ferie') return rv;

    var blocks = data.planningEventsByDate && data.planningEventsByDate[dateStr];
    if (!blocks || !blocks.length) return rv;

    var courses = (rv.courses || []).slice();
    var studios = data.studios || [];
    var studioNameToId = {};
    studios.forEach(function(s) {
      studioNameToId[String(s.name).trim().toLowerCase()] = s.id;
    });

    function blockStudioIds(block) {
      var ids = {};
      (block.studios || []).forEach(function(name) {
        var id = studioNameToId[String(name).trim().toLowerCase()];
        if (id) ids[id] = true;
      });
      return ids;
    }

    function intervalsOverlap(s1, e1, s2, e2) {
      return s1 < e2 && e1 > s2;
    }

    var eventLabels = [];

    blocks.forEach(function(block) {
      var ws = block.startTime;
      var we = block.endTime;
      if (!ws || !we) return;
      var idSet = blockStudioIds(block);
      if (!Object.keys(idSet).length) return;

      var blockCourses = (block.courses || []).filter(function(c) {
        if (!c.startTime || !c.endTime) return false;
        return c.startTime >= ws && c.endTime <= we;
      });

      if (block.label && String(block.label).trim()) {
        eventLabels.push(String(block.label).trim());
      }

      courses = courses.filter(function(c) {
        if (!c.studioId) return true;
        if (!idSet[c.studioId]) return true;
        return !intervalsOverlap(c.startTime, c.endTime, ws, we);
      });

      blockCourses.forEach(function(bc) {
        var merged = {};
        var k;
        for (k in bc) {
          if (Object.prototype.hasOwnProperty.call(bc, k)) merged[k] = bc[k];
        }
        merged.isPlanningEventCourse = true;
        if (block.label && String(block.label).trim()) {
          merged.eventLabel = String(block.label).trim();
        }
        courses.push(merged);
      });
    });

    courses.sort(function(a, b) {
      var t = a.startTime.localeCompare(b.startTime);
      return t !== 0 ? t : (a.duration || 0) - (b.duration || 0);
    });

    var out = {};
    for (var k in rv) {
      if (Object.prototype.hasOwnProperty.call(rv, k)) out[k] = rv[k];
    }
    out.courses = courses;
    if (out.indetermine && courses.length && out.planningKey === 'ete') {
      out.indetermine = false;
    }
    if (eventLabels.length) {
      out.planningEventLabels = eventLabels;
    }
    return out;
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

  /**
   * Nom affichable quand l’id n’a pas de fiche dans la feuille Cours (ex. cours ajouté seulement en événement).
   * Ex. cours-bodyjam → « Bodyjam » (segments après le préfixe cours-).
   */
  function formatCourseNameFromCoursId(coursId) {
    if (coursId == null || coursId === '') return 'Cours';
    var parts = String(coursId).split('-');
    if (parts[0] === 'cours') parts = parts.slice(1);
    return parts.filter(Boolean).map(function(seg) {
      if (!seg.length) return '';
      return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
    }).join(' ').trim() || 'Cours';
  }

  /**
   * Fiche cours du catalogue ou objet minimal { id, name, logo } pour l’affichage.
   */
  function courseDisplayFromCoursId(coursId, coursCatalog) {
    var catalog = coursCatalog || [];
    var found = catalog.find(function(c) {
      return c && c.id === coursId;
    });
    if (found) return found;
    return {
      id: coursId,
      name: formatCourseNameFromCoursId(coursId),
      logo: ''
    };
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
   * Portrait plein format (col. F puis G) : du 1er au 7 avril, priorité à bigPngCaricature, sinon bigPngUrl, puis vignette.
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

  /**
   * Particules confetti sur les blocs cours événement (daily / grid / weekly).
   * @param {HTMLElement|Document} root
   * @param {Object} [options]
   * @param {string} [options.variant] 'daily' = particules plus grosses et plus nombreuses (timeline) ; 'compact' = moins nombreuses (grille, hebdo)
   */
  function fillPlanningEventConfetti(root, options) {
    if (!root || !root.querySelectorAll) return;
    options = options || {};
    var variant = options.variant === 'daily' ? 'daily' : 'compact';
    var n = variant === 'daily' ? 32 : 16;
    var sel = '.course-block--planning-event, .course-card--planning-event';
    root.querySelectorAll(sel).forEach(function(block) {
      if (block.querySelector('.planning-event-fx')) return;
      var fx = document.createElement('div');
      fx.className = 'planning-event-fx' + (variant === 'daily' ? ' planning-event-fx--daily' : '');
      fx.setAttribute('aria-hidden', 'true');
      var colors = ['#e8b4a0', '#c9a8e8', '#7ec8e3', '#f5d08a', '#9dd5b8', '#f0a8c8', '#c4b5fd', '#fcd34d', '#fb7185', '#a3e635', '#f472b6', '#38bdf8'];
      var i;
      for (i = 0; i < n; i++) {
        var s = document.createElement('span');
        if (variant === 'daily') {
          var mod = i % 3;
          s.className =
            'planning-event-fx__piece planning-event-fx__piece--daily' +
            (mod === 0 ? ' planning-event-fx__piece--daily-pop' : mod === 1 ? ' planning-event-fx__piece--daily-fall' : ' planning-event-fx__piece--daily-wobble');
          s.style.setProperty('--px-drift', (Math.random() * 28 - 14).toFixed(1) + 'px');
          s.style.left = (2 + Math.random() * 96) + '%';
          if (mod === 1) {
            s.style.top = (Math.random() * 22) + '%';
          } else if (mod === 0) {
            s.style.top = (35 + Math.random() * 50) + '%';
          } else {
            s.style.top = (15 + Math.random() * 65) + '%';
          }
          s.style.animationDuration = (3.2 + Math.random() * 1.8).toFixed(2) + 's';
        } else {
          s.className = 'planning-event-fx__piece' + (i % 3 === 0 ? ' planning-event-fx__piece--wave' : (i % 3 === 1 ? ' planning-event-fx__piece--drift' : ''));
          s.style.left = (2 + Math.random() * 96) + '%';
          s.style.top = (2 + Math.random() * 92) + '%';
        }
        s.style.background = colors[i % colors.length];
        s.style.animationDelay = (i * 0.05 + Math.random() * 0.35) + 's';
        s.style.setProperty('--pe-rot', (Math.random() * 360 | 0) + 'deg');
        fx.appendChild(s);
      }
      block.insertBefore(fx, block.firstChild);
    });
  }

  /**
   * Initiales pour avatar sans photo : première lettre du prénom + première lettre du nom si plusieurs mots,
   * sinon une seule lettre.
   */
  function coachInitialsFromDisplayName(displayName) {
    if (displayName == null || displayName === '') return '?';
    var s = String(displayName).trim();
    if (!s) return '?';
    var parts = s.split(/\s+/).filter(function(p) {
      return p.length > 0;
    });
    function firstUpper(segment) {
      if (!segment) return '';
      var ch = segment.charAt(0);
      try {
        return ch.toLocaleUpperCase('fr-FR');
      } catch (e) {
        return ch.toUpperCase();
      }
    }
    if (parts.length >= 2) {
      return (firstUpper(parts[0]) + firstUpper(parts[parts.length - 1])).slice(0, 2);
    }
    return firstUpper(parts[0]).slice(0, 1) || '?';
  }

  /**
   * Remplace les img portant data-planning-fallback-text si le chargement échoue (logo cours, icône studio, etc.).
   * Optionnel : data-planning-fallback-tag (défaut span), data-planning-fallback-class, data-planning-fallback-dir.
   * Le texte d’attribut est attendu échappé pour HTML (ex. via escapeHtml).
   */
  function wirePlanningImgTextFallbacks(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('img[data-planning-fallback-text]').forEach(function (img) {
      if (img.getAttribute('data-planning-img-fallback-wired')) return;
      img.setAttribute('data-planning-img-fallback-wired', '1');
      img.addEventListener('error', function onPlanningImgErr() {
        img.removeEventListener('error', onPlanningImgErr);
        var text = img.getAttribute('data-planning-fallback-text') || '';
        var tag = (img.getAttribute('data-planning-fallback-tag') || 'span').toLowerCase();
        if (!/^[a-z][a-z0-9]*$/.test(tag)) tag = 'span';
        var el = document.createElement(tag);
        var cls = img.getAttribute('data-planning-fallback-class');
        if (cls) el.className = cls;
        var dir = img.getAttribute('data-planning-fallback-dir');
        if (dir) el.setAttribute('dir', dir);
        el.textContent = text;
        img.replaceWith(el);
      });
    });
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
    hasPlanningEventsForDate: hasPlanningEventsForDate,
    applyPlanningEventsToResolvedView: applyPlanningEventsToResolvedView,
    pickOpeningHoursForDay: pickOpeningHoursForDay,
    escapeHtml: escapeHtml,
    formatCourseNameFromCoursId: formatCourseNameFromCoursId,
    courseDisplayFromCoursId: courseDisplayFromCoursId,
    useCaricatureCoachPhotos: useCaricatureCoachPhotos,
    coachPhotoUrl: coachPhotoUrl,
    coachBigPhotoUrl: coachBigPhotoUrl,
    coachHeroBackgroundUrl: coachHeroBackgroundUrl,
    coachDisplayName: coachDisplayName,
    coachInitialsFromDisplayName: coachInitialsFromDisplayName,
    wirePlanningImgTextFallbacks: wirePlanningImgTextFallbacks,
    fillPlanningEventConfetti: fillPlanningEventConfetti
  };

  global.PlanningResolve = api;
})(typeof window !== 'undefined' ? window : this);

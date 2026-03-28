    const SHOW_COURSE_IMAGES = true;
    var scheduleData = null;
    var weekMondayYmd = '';

    function getPR() {
      return window.PlanningResolve;
    }

    function parseWeekFromUrl() {
      var PR = getPR();
      var params = new URLSearchParams(window.location.search);
      var w = params.get('week');
      if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) {
        var mon = PR.mondayOfWeekContaining(w);
        return PR.clampWeekMonday(mon);
      }
      return PR.clampWeekMonday(PR.mondayOfWeekContaining(PR.ymdFromDate(new Date())));
    }

    function updateUrlWeekParam() {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('week', weekMondayYmd);
        history.replaceState({}, '', url);
      } catch (e) {}
    }

    function changeWeek(delta) {
      var PR = getPR();
      weekMondayYmd = PR.addDaysToYmd(weekMondayYmd, delta * 7);
      weekMondayYmd = PR.clampWeekMonday(weekMondayYmd);
      updateUrlWeekParam();
      refreshPlanningDisplay();
    }

    function updateNavButtonsStateWeek() {
      var PR = getPR();
      var today = PR.ymdFromDate(new Date());
      var min = PR.addDaysToYmd(today, -PR.NAV_DAYS_LIMIT);
      var max = PR.addDaysToYmd(today, PR.NAV_DAYS_LIMIT);
      var maxMonday = PR.mondayOfWeekContaining(PR.addDaysToYmd(max, -6));
      var minMonday = PR.firstMondayOnOrAfter(min);
      var prevBtn = document.getElementById('prevWeek');
      var nextBtn = document.getElementById('nextWeek');
      if (prevBtn) prevBtn.disabled = weekMondayYmd <= minMonday;
      if (nextBtn) nextBtn.disabled = weekMondayYmd >= maxMonday;
    }

    function weekHasRamadanWeek() {
      var PR = getPR();
      if (!scheduleData || !weekMondayYmd) return false;
      for (var i = 0; i < 7; i++) {
        var ymd = PR.addDaysToYmd(weekMondayYmd, i);
        var rv = PR.resolveDailyView(ymd, scheduleData);
        if (rv.planningKey === 'ramadan') return true;
      }
      return false;
    }

    function renderPlanningViewSwitcher(data) {
      var ramadanButton = document.getElementById('ramadanSwitchButton');
      if (!ramadanButton || !data) return;
      var isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        ramadanButton.style.display = 'none';
        ramadanButton.classList.remove('loaded');
        return;
      }
      if (weekHasRamadanWeek()) {
        ramadanButton.style.display = 'flex';
        setTimeout(function() { ramadanButton.classList.add('loaded'); }, 100);
      } else {
        ramadanButton.style.display = 'none';
        ramadanButton.classList.remove('loaded');
      }
    }

    function handleResize() {
      var isMobile = window.innerWidth <= 1024;
      var nav = document.getElementById('weekNavigation');
      if (nav) {
        nav.style.display = isMobile ? 'flex' : 'none';
        if (isMobile) nav.classList.add('loaded');
        else nav.classList.remove('loaded');
      }
      if (scheduleData) renderPlanningViewSwitcher(scheduleData);
    }

    function isAfterNoon(timeStr) {
      var parts = (timeStr || '').split(':');
      var h = parseInt(parts[0], 10) || 0;
      return h >= 12;
    }

    function generateWeeklyScheduleHtml() {
      var PR = getPR();
      var data = scheduleData;
      if (!data || !data.planning) return '<div class="weekly-empty">Chargement…</div>';

      var weekDaysOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
      var weekDaysCap = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

      var columns = [];
      var i, ymd, dayLower, listed, rv;
      for (i = 0; i < 7; i++) {
        ymd = PR.addDaysToYmd(weekMondayYmd, i);
        dayLower = weekDaysOrder[i];
        rv = PR.resolveDailyView(ymd, data);
        listed = PR.isWeekdayListedInBasePlannings(data, dayLower);
        /* Jour sans aucun cours en base mais période été : afficher quand même la colonne « à déterminer ». */
        if (!listed && rv.planningKey !== 'ete') continue;
        columns.push({
          ymd: ymd,
          dayKey: dayLower,
          label: weekDaysCap[i],
          dateLabel: PR.formatDateJjMmmm(ymd),
          rv: rv,
          pk: rv.planningKey
        });
      }

      if (!columns.length) {
        return '<div class="weekly-empty">Aucun jour à afficher pour cette semaine.</div>';
      }

      var scheduleByTimeAndDay = {};
      var cours = data.cours || [];
      var coachs = data.coachs || [];
      var studios = data.studios || [];

      columns.forEach(function(col) {
        var r = col.rv;
        if (r.closed || r.indetermine) return;
        var courses = r.courses || [];
        courses.forEach(function(course) {
          var startTime = course.startTime;
          if (!scheduleByTimeAndDay[startTime]) scheduleByTimeAndDay[startTime] = {};
          if (!scheduleByTimeAndDay[startTime][col.ymd]) scheduleByTimeAndDay[startTime][col.ymd] = [];
          var courseInfo = cours.find(function(c) { return c.id === course.coursId; });
          var studioInfo = studios.find(function(s) { return s.id === course.studioId; });
          var coachsInfo = (course.coachIds || []).map(function(coachId) {
            return coachs.find(function(c) { return c.id === coachId; });
          });
          scheduleByTimeAndDay[startTime][col.ymd].push({
            courseName: courseInfo ? courseInfo.name : 'Cours inconnu',
            logo: courseInfo ? courseInfo.logo : '',
            studio: studioInfo ? studioInfo.name : 'Studio inconnu',
            endTime: course.endTime,
            startTime: course.startTime,
            duration: course.duration,
            type: course.type,
            coachs: coachsInfo.map(function(coach) {
              return {
                name: coach ? coach.name : 'Coach inconnu',
                imageUrl: PR.coachPhotoUrl(coach) || (coach && coach.imageUrl) || ''
              };
            })
          });
        });
      });

      var timesArray = Object.keys(scheduleByTimeAndDay).sort();
      var bodyRows = [];
      var t, time;
      for (t = 0; t < timesArray.length; t++) {
        time = timesArray[t];
        if (t > 0 && isAfterNoon(time) && !isAfterNoon(timesArray[t - 1])) {
          bodyRows.push({ kind: 'noon' });
        }
        bodyRows.push({ kind: 'time', time: time });
      }
      if (!bodyRows.length) {
        /* Aucun créneau : une seule ligne donne des cellules status d’une ligne de haut (effet « tout en haut »). */
        var weekAllStatusOnly = columns.length > 0 && columns.every(function(c) {
          return c.rv.closed || c.rv.indetermine;
        });
        if (weekAllStatusOnly) {
          bodyRows.push({ kind: 'weekAllStatus' });
        } else {
          bodyRows.push({ kind: 'placeholder' });
        }
      }

      var numBodyRows = bodyRows.length;
      var rowspanCols = columns.map(function(col) {
        return (col.rv.closed || col.rv.indetermine) ? numBodyRows : 0;
      });

      var html = '<table class="weekly-schedule">';
      html += '<colgroup><col class="col-hours">';
      columns.forEach(function() { html += '<col class="col-day">'; });
      html += '</colgroup><thead><tr><th></th>';
      columns.forEach(function(col) {
        var today = PR.ymdFromDate(new Date()) === col.ymd;
        var cls = (today ? 'today ' : '') + 'weekly-th-inner';
        html += '<th class="' + cls + '" data-planning-key="' + PR.escapeHtml(col.pk) + '" data-ymd="' + col.ymd + '">';
        html += '<div class="weekly-day-title">' + PR.escapeHtml(col.label) + '</div>';
        html += '<div class="weekly-day-date">' + PR.escapeHtml(col.dateLabel) + '</div>';
        html += '</th>';
      });
      var tbodyAllStatusOnly = bodyRows.length === 1 && bodyRows[0].kind === 'weekAllStatus';
      html += '</tr></thead><tbody' + (tbodyAllStatusOnly ? ' class="weekly-tbody--all-status-only"' : '') + '>';

      var todayYmdGen = PR.ymdFromDate(new Date());
      var nowGen = new Date();

      var isWhiteRow = true;
      var ri, row, ci, col;
      var rowspanDone = columns.map(function() { return false; });

      /**
       * @param {string} layout 'tranches' ( rowspan sur grille ) | 'centered' ( semaine entière sans créneau )
       */
      function weeklyStatusColumnHtml(rv, layout) {
        layout = layout || 'tranches';
        var msgInner;
        if (rv.closed) {
          msgInner = '<div class="weekly-msg weekly-msg--closed"><strong>Fermé</strong>';
          if (rv.periodName) msgInner += '<br><span>' + PR.escapeHtml(rv.periodName) + '</span>';
          msgInner += '</div>';
        } else if (rv.planningKey === 'ete') {
          msgInner = '<div class="weekly-msg weekly-msg--indetermine"><strong>' +
            '<span class="indetermine-title-line">Planning estival</span><br>' +
            '<span class="indetermine-title-line">à&nbsp;déterminer</span></strong>';
          if (rv.periodName) msgInner += '<br><span class="weekly-msg-holiday">' + PR.escapeHtml(rv.periodName) + '</span>';
          msgInner += '<br><span class="weekly-msg-sub">Planning publié prochainement</span></div>';
        } else {
          msgInner = '<div class="weekly-msg weekly-msg--indetermine"><strong>' +
            '<span class="indetermine-title-line">Planning</span><br>' +
            '<span class="indetermine-title-line">à&nbsp;déterminer</span></strong>';
          if (rv.periodName) msgInner += '<br><span class="weekly-msg-holiday">' + PR.escapeHtml(rv.periodName) + '</span>';
          msgInner += '<br><span class="weekly-msg-sub">Planning publié prochainement</span></div>';
        }
        if (layout === 'centered') {
          return '<div class="weekly-msg-column weekly-msg-column--single" role="status">' + msgInner + '</div>';
        }
        var tr = '<div class="weekly-msg-tranche"><div class="weekly-msg-tranche-inner">' + msgInner + '</div></div>';
        return '<div class="weekly-msg-column" role="status">' + tr + tr + tr + '</div>';
      }

      function emitRowspanCell(ci) {
        col = columns[ci];
        var inner = weeklyStatusColumnHtml(col.rv);
        return '<td class="course-cell course-cell--status-msg" data-planning-key="' + PR.escapeHtml(col.pk) + '" data-ymd="' + col.ymd + '" rowspan="' + rowspanCols[ci] + '">' + inner + '</td>';
      }

      for (ri = 0; ri < bodyRows.length; ri++) {
        row = bodyRows[ri];
        if (row.kind === 'noon') {
          html += '<tr class="noon-separator">';
          html += '<td class="time-cell time-cell-grey"></td>';
          for (ci = 0; ci < columns.length; ci++) {
            if (rowspanCols[ci] > 0) {
              if (!rowspanDone[ci]) {
                rowspanDone[ci] = true;
                html += emitRowspanCell(ci);
              }
              continue;
            }
            col = columns[ci];
            html += '<td class="noon-separator-line course-cell" data-planning-key="' + PR.escapeHtml(col.pk) + '"></td>';
          }
          html += '</tr>';
          continue;
        }

        if (row.kind === 'placeholder') {
          html += '<tr class="course-row-white">';
          html += '<td class="time-cell time-cell-white"></td>';
          for (ci = 0; ci < columns.length; ci++) {
            col = columns[ci];
            html += '<td class="course-cell' + (col.rv.closed || col.rv.indetermine ? ' course-cell--status-msg' : '') + '" data-planning-key="' + PR.escapeHtml(col.pk) + '" data-ymd="' + col.ymd + '">';
            if (col.rv.closed || col.rv.indetermine) {
              html += weeklyStatusColumnHtml(col.rv);
            } else {
              html += '<span class="weekly-msg">—</span>';
            }
            html += '</td>';
          }
          html += '</tr>';
          break;
        }

        if (row.kind === 'weekAllStatus') {
          html += '<tr class="course-row-white weekly-row--week-all-status">';
          html += '<td class="time-cell time-cell-white time-cell--all-status-spacer" aria-hidden="true"></td>';
          for (ci = 0; ci < columns.length; ci++) {
            col = columns[ci];
            html += '<td class="course-cell course-cell--status-msg course-cell--status-msg-centered" data-planning-key="' + PR.escapeHtml(col.pk) + '" data-ymd="' + col.ymd + '">';
            html += weeklyStatusColumnHtml(col.rv, 'centered');
            html += '</td>';
          }
          html += '</tr>';
          break;
        }

        time = row.time;
        var rowClass = isWhiteRow ? 'course-row-white' : 'course-row-grey';
        var timeCellClass = isWhiteRow ? 'time-cell-white' : 'time-cell-grey';
        isWhiteRow = !isWhiteRow;

        html += '<tr class="' + rowClass + '">';
        html += '<td class="time-cell ' + timeCellClass + '">' + PR.escapeHtml(time) + '</td>';

        for (ci = 0; ci < columns.length; ci++) {
          if (rowspanCols[ci] > 0) {
            if (!rowspanDone[ci]) {
              rowspanDone[ci] = true;
              html += emitRowspanCell(ci);
            }
            continue;
          }

          col = columns[ci];
          html += '<td class="course-cell" data-planning-key="' + PR.escapeHtml(col.pk) + '" data-ymd="' + col.ymd + '">';
          var courses = scheduleByTimeAndDay[time] && scheduleByTimeAndDay[time][col.ymd];
          if (courses && courses.length > 0) {
            var c, course, courseDisplay, logoUrl, courseNameDisplay, coachImagesHtml, courseClasses;
            for (c = 0; c < courses.length; c++) {
              course = courses[c];
              courseDisplay = '';
              logoUrl = course.logo || '';
              if (SHOW_COURSE_IMAGES && logoUrl) {
                courseNameDisplay = '<img class="logo-cours" src="' + PR.escapeHtml(logoUrl) + '" alt="' + PR.escapeHtml(course.courseName) + ' Logo" draggable="false">';
              } else {
                courseNameDisplay = '<div class="course-name-text">' + PR.escapeHtml(course.courseName) + '</div>';
              }
              coachImagesHtml = '';
              if (course.coachs.length === 1) {
                var coachImageUrl = course.coachs[0].imageUrl || 'https://mcusercontent.com/74abea872abd45d46efed5d41/images/a340beeb-f8a3-d937-7eb8-e17882fc82ec.png';
                coachImagesHtml = '<div class="single-coach">' +
                  '<img src="' + PR.escapeHtml(coachImageUrl) + '" alt="' + PR.escapeHtml(course.coachs[0].name) + '" draggable="false">' +
                  '<span>' + PR.escapeHtml(course.coachs[0].name) + '</span></div>';
              } else if (course.coachs.length > 1) {
                coachImagesHtml = '<div class="multiple-coaches">';
                course.coachs.forEach(function(coach) {
                  if (coach.imageUrl) {
                    coachImagesHtml += '<img src="' + PR.escapeHtml(coach.imageUrl) + '" alt="" class="coach-image" draggable="false">';
                  }
                });
                coachImagesHtml += '</div>';
              }
              courseClasses = 'course-block';
              if (course.type === '100% Femmes') courseClasses += ' women-only';
              else courseClasses += ' mixte';
              if (course.studio.toLowerCase().indexOf('piscine') !== -1 || course.studio.toLowerCase().indexOf('aqua') !== -1) {
                courseClasses += ' piscine';
              }

              var targetD = PR.parseYmdLocal(col.ymd);
              var startTimeParts = course.startTime ? course.startTime.split(':') : ['00', '00'];
              var startHour = parseInt(startTimeParts[0], 10) || 0;
              var startMinute = parseInt(startTimeParts[1], 10) || 0;
              var courseStartMs = new Date(targetD.getFullYear(), targetD.getMonth(), targetD.getDate(), startHour, startMinute, 0, 0).getTime();
              var endMs;
              if (course.endTime) {
                var ep = course.endTime.split(':');
                endMs = new Date(targetD.getFullYear(), targetD.getMonth(), targetD.getDate(), parseInt(ep[0], 10) || 0, parseInt(ep[1], 10) || 0, 0, 0).getTime();
              } else {
                endMs = courseStartMs + (course.duration || 60) * 60 * 1000;
              }
              var isPastDay = col.ymd < todayYmdGen;
              var isPastToday = col.ymd === todayYmdGen && nowGen.getTime() >= endMs;
              var isPastCourse = isPastDay || isPastToday;
              var timeDifference = Math.floor((courseStartMs - nowGen.getTime()) / 1000);
              var isInProgress = !isPastCourse && col.ymd === todayYmdGen && nowGen.getTime() >= courseStartMs && nowGen.getTime() < endMs;
              var isStartingSoon = !isPastCourse && !isInProgress && col.ymd === todayYmdGen && timeDifference >= 0 && timeDifference <= 900;
              if (isPastCourse) courseClasses += ' past';
              else if (isStartingSoon) courseClasses += ' starting-soon';
              else if (isInProgress) courseClasses += ' current';

              courseDisplay += '<div class="' + courseClasses + '" data-ymd="' + col.ymd + '" data-coaches="' + PR.escapeHtml(course.coachs.map(function(x) { return x.name; }).join(',')) + '" data-start-time="' + PR.escapeHtml(course.startTime || '') + '" data-end-time="' + PR.escapeHtml(course.endTime || '') + '">';
              if (isStartingSoon) {
                courseDisplay += '<div class="countdown-pill starting-soon" data-time-diff="' + Math.floor(timeDifference) + '"></div>';
              }
              courseDisplay += '<div class="course-info">' + courseNameDisplay + '</div>';
              courseDisplay += coachImagesHtml;
              courseDisplay += '</div>';
              html += courseDisplay;
            }
          }
          html += '</td>';
        }
        html += '</tr>';
      }

      html += '</tbody></table>';
      return html;
    }

    /** Thème plein écran si « aujourd'hui » tombe dans la semaine affichée (aligné sur daily). */
    function applyWeeklyBodyPlanningTheme() {
      document.body.classList.remove('planning-ramadan');
      document.body.classList.remove('planning-ferie');
      document.body.classList.remove('planning-ete');
      var PR = getPR();
      if (!scheduleData || !weekMondayYmd || !PR) return;
      var todayYmd = PR.ymdFromDate(new Date());
      var di, ymd, rv;
      for (di = 0; di < 7; di++) {
        ymd = PR.addDaysToYmd(weekMondayYmd, di);
        if (ymd !== todayYmd) continue;
        rv = PR.resolveDailyView(ymd, scheduleData);
        document.body.classList.toggle('planning-ramadan', rv.planningKey === 'ramadan');
        document.body.classList.toggle('planning-ferie', rv.planningKey === 'ferie' || rv.planningKey === 'ferme');
        document.body.classList.toggle('planning-ete', rv.planningKey === 'ete');
        break;
      }
    }

    /** Aligne la barre sticky sur `scrollLeft` (évite décalage en-tête / grille après changement de semaine sans scroll). */
    function syncStickyHeaderToScrollLeft() {
      var wrap = document.getElementById('scheduleScrollWrapper');
      var sticky = document.getElementById('stickyHeaderContent');
      if (!wrap || !sticky) return;
      sticky.style.transform = 'translate3d(' + (-wrap.scrollLeft) + 'px,0,0)';
    }

    /**
     * Recolle les calques scroll/transformation (WebKit / Safari surtout) après re-render :
     * pastilles et blocs animés ne restent pas figés à l’ancienne position à l’écran.
     */
    function forceWeeklyVerticalScrollLayersSync() {
      var wrap = document.getElementById('scheduleScrollWrapper');
      if (!wrap) return;
      function runSync() {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            syncStickyHeaderToScrollLeft();
            void wrap.offsetHeight;
            var sl = wrap.scrollLeft;
            wrap.scrollLeft = sl;
          });
        });
      }
      runSync();
      setTimeout(runSync, 220);
    }

    function refreshPlanningDisplay() {
      var el = document.getElementById('weeklySchedule');
      if (!el) return;
      el.innerHTML = generateWeeklyScheduleHtml();
      applyWeeklyBodyPlanningTheme();
      updateNavButtonsStateWeek();
      if (scheduleData) renderPlanningViewSwitcher(scheduleData);

      var mainTable = document.querySelector('#weeklySchedule .weekly-schedule');
      var thead = mainTable && mainTable.querySelector('thead');
      var stickyContent = document.getElementById('stickyHeaderContent');
      var scheduleWrapper = document.getElementById('scheduleScrollWrapper');
      if (stickyContent) stickyContent.innerHTML = '';
      if (!thead || !stickyContent || !scheduleWrapper) {
        applyFilters();
        markMultilineCourseNames();
        refreshWeeklyFerieSparklesAfterLayout();
        return;
      }
      var colgroup = mainTable.querySelector('colgroup');
      var headerTable = document.createElement('table');
      headerTable.className = 'weekly-schedule weekly-schedule-header';
      headerTable.setAttribute('aria-hidden', 'true');
      if (colgroup) headerTable.appendChild(colgroup.cloneNode(true));
      headerTable.appendChild(thead.cloneNode(true));
      stickyContent.appendChild(headerTable);
      thead.remove();

      var rafId = null;
      var lastScrollLeft = -1;
      var lastApplied = -1;
      var sameCount = 0;
      function tick() {
        var current = scheduleWrapper.scrollLeft;
        if (current !== lastApplied) {
          lastApplied = current;
          stickyContent.style.transform = 'translate3d(' + (-current) + 'px,0,0)';
        }
        if (current === lastScrollLeft) {
          sameCount++;
          if (sameCount >= 3) {
            rafId = null;
            return;
          }
        } else {
          sameCount = 0;
          lastScrollLeft = current;
        }
        rafId = requestAnimationFrame(tick);
      }
      function onScroll() {
        if (rafId === null) {
          lastScrollLeft = scheduleWrapper.scrollLeft;
          lastApplied = -1;
          sameCount = 0;
          rafId = requestAnimationFrame(tick);
        }
      }
      scheduleWrapper.removeEventListener('scroll', onScroll);
      scheduleWrapper.addEventListener('scroll', onScroll, { passive: true });
      syncStickyHeaderToScrollLeft();
      scheduleWrapper.style.webkitOverflowScrolling = 'touch';

      applyFilters();
      markMultilineCourseNames();
      refreshWeeklyFerieSparklesAfterLayout();
      forceWeeklyVerticalScrollLayersSync();
    }

    function initializeWeeklyPage() {
      if (!window.PlanningResolve) {
        console.error('planning-resolve.js manquant');
        return;
      }
      weekMondayYmd = parseWeekFromUrl();
      updateUrlWeekParam();

      fetchWeeklyData().then(function(data) {
        scheduleData = data;
        var mb = document.querySelector('.modal-backdrop');
        var mc = document.querySelector('.modal-content');
        if (mb) mb.style.display = 'none';
        if (mc) mc.style.display = 'none';

        document.getElementById('weeklySchedule').innerHTML = generateWeeklyScheduleHtml();

        (function setupStickyDaysBar() {
          var mainTable = document.querySelector('#weeklySchedule .weekly-schedule');
          var thead = mainTable && mainTable.querySelector('thead');
          var stickyContent = document.getElementById('stickyHeaderContent');
          var scheduleWrapper = document.getElementById('scheduleScrollWrapper');
          if (!thead || !stickyContent || !scheduleWrapper) return;
          var colgroup = mainTable.querySelector('colgroup');
          var headerTable = document.createElement('table');
          headerTable.className = 'weekly-schedule weekly-schedule-header';
          headerTable.setAttribute('aria-hidden', 'true');
          if (colgroup) headerTable.appendChild(colgroup.cloneNode(true));
          headerTable.appendChild(thead.cloneNode(true));
          stickyContent.appendChild(headerTable);
          thead.remove();
          var rafId = null;
          var lastScrollLeft = -1;
          var lastApplied = -1;
          var sameCount = 0;
          function tick() {
            var current = scheduleWrapper.scrollLeft;
            if (current !== lastApplied) {
              lastApplied = current;
              stickyContent.style.transform = 'translate3d(' + (-current) + 'px,0,0)';
            }
            if (current === lastScrollLeft) {
              sameCount++;
              if (sameCount >= 3) {
                rafId = null;
                return;
              }
            } else {
              sameCount = 0;
              lastScrollLeft = current;
            }
            rafId = requestAnimationFrame(tick);
          }
          function onScroll() {
            if (rafId === null) {
              lastScrollLeft = scheduleWrapper.scrollLeft;
              lastApplied = -1;
              sameCount = 0;
              rafId = requestAnimationFrame(tick);
            }
          }
          scheduleWrapper.addEventListener('scroll', onScroll, { passive: true });
          syncStickyHeaderToScrollLeft();
          scheduleWrapper.style.webkitOverflowScrolling = 'touch';
        })();

        markMultilineCourseNames();
        refreshWeeklyFerieSparklesAfterLayout();
        forceWeeklyVerticalScrollLayersSync();
        applyWeeklyBodyPlanningTheme();
        renderPlanningViewSwitcher(data);
        updateNavButtonsStateWeek();

        (function setupScrollShadow() {
          var wrapper = document.getElementById('scheduleScrollWrapper');
          var shadowRight = document.getElementById('scrollShadowRight');
          var shadowLeft = document.getElementById('scrollShadowLeft');
          if (!wrapper || !shadowRight) return;
          function updateShadows() {
            var scrollLeft = wrapper.scrollLeft;
            if (scrollLeft + wrapper.clientWidth >= wrapper.scrollWidth - 2) {
              shadowRight.classList.add('at-end');
            } else {
              shadowRight.classList.remove('at-end');
            }
            if (shadowLeft) {
              var timeCell = document.querySelector('#weeklySchedule .weekly-schedule td.time-cell');
              var firstCellSticky = document.querySelector('.sticky-days-bar .weekly-schedule-header th:first-child');
              if (timeCell) {
                var rect = timeCell.getBoundingClientRect();
                shadowLeft.style.left = rect.right + 'px';
              }
              if (firstCellSticky) {
                var topRect = firstCellSticky.getBoundingClientRect();
                shadowLeft.style.top = topRect.bottom + 'px';
              } else {
                shadowLeft.style.top = '0';
              }
              if (scrollLeft > 0) shadowLeft.classList.add('visible');
              else shadowLeft.classList.remove('visible');
            }
          }
          wrapper.addEventListener('scroll', updateShadows, { passive: true });
          window.addEventListener('resize', updateShadows);
          updateShadows();
        })();

        var filterIds = ['filter-mixte', 'filter-women-only', 'filter-piscine', 'filter-coach'];
        filterIds.forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.addEventListener('change', applyFilters);
          var el2 = document.getElementById(id + '-sidebar');
          if (el2) el2.addEventListener('change', applyFilters);
        });

        populateCoachDropdown();

        applyFilters();
        setTimeout(function() { scrollToCurrentTime(); }, 500);
        updateCountdownCircles();
        setInterval(updateCountdownCircles, 1000);
        setInterval(checkCourseStates, 3000);
        setTimeout(checkCourseStates, 1000);

        window.addEventListener('resize', handleResize);
        handleResize();

        document.addEventListener('click', function(e) {
          var a = e.target.closest && e.target.closest('a[href*="prayer-times"]');
          if (!a || !a.getAttribute('href')) return;
          try {
            sessionStorage.setItem('planning_return_url', window.location.href);
            sessionStorage.setItem('planning_return_scroll', String(window.scrollY || window.pageYOffset || 0));
          } catch (err) {}
        }, true);
      }).catch(function(error) {
        console.error('Erreur lors de la récupération des données :', error);
      });
    }

    var selectedCoachesSet = null;

    function populateCoachDropdown() {
      var data = scheduleData;
      var coachDropdownContent = document.getElementById('coachDropdownContent');
      var coachDropdownButton = document.getElementById('coachDropdownButton');
      var coachDropdownText = document.getElementById('coachDropdownText');
      if (!data || !coachDropdownContent) return;

      var defaultCoachImage = 'https://mcusercontent.com/74abea872abd45d46efed5d41/images/8fd797c9-5e06-60a8-1720-128bcf9390cf.png';
      var coachsData = data.coachs || [];
      var uniqueCoachesMap = new Map();

      function scanPlanning(planning) {
        if (!planning) return;
        Object.values(planning).forEach(function(dayCourses) {
          (dayCourses || []).forEach(function(course) {
            (course.coachIds || []).forEach(function(coachId) {
              var coach = coachsData.find(function(c) { return c.id === coachId; });
              if (coach && !uniqueCoachesMap.has(coach.name)) {
                uniqueCoachesMap.set(coach.name, { name: coach.name, imageUrl: coach.imageUrl || defaultCoachImage });
              }
            });
          });
        });
      }
      scanPlanning(data.planning);
      scanPlanning(data.planningRamadan);

      coachDropdownContent.innerHTML = '';
      selectedCoachesSet = new Set();

      function updateCoachDropdownText() {
        if (!coachDropdownText) return;
        var n = selectedCoachesSet.size;
        var total = uniqueCoachesMap.size;
        if (n === 0 || n === total) coachDropdownText.textContent = 'Sélection coach';
        else coachDropdownText.textContent = n === 1 ? '1 coach' : n + ' coachs';
      }

      Array.from(uniqueCoachesMap.values()).sort(function(a, b) { return a.name.localeCompare(b.name); }).forEach(function(coachObj) {
        var option = document.createElement('div');
        option.className = 'coach-dropdown-option';
        var label = document.createElement('label');
        label.style.display = 'flex';
        label.style.justifyContent = 'space-between';
        label.style.alignItems = 'center';
        label.style.width = '100%';
        label.style.cursor = 'pointer';
        var img = document.createElement('img');
        img.className = 'coach-dropdown-option-photo';
        img.src = coachObj.imageUrl;
        img.alt = coachObj.name;
        var span = document.createElement('span');
        span.textContent = coachObj.name;
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = coachObj.name;
        checkbox.checked = false;
        var checkmark = document.createElement('span');
        checkmark.className = 'checkmark';
        checkmark.textContent = '✓';
        checkmark.style.display = 'none';
        checkbox.addEventListener('change', function() {
          if (checkbox.checked) selectedCoachesSet.add(coachObj.name);
          else selectedCoachesSet.delete(coachObj.name);
          checkmark.style.display = checkbox.checked ? 'inline' : 'none';
          updateCoachDropdownText();
          applyFilters();
        });
        option.addEventListener('click', function(e) {
          if (e.target !== checkbox) {
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        });
        label.appendChild(img);
        label.appendChild(span);
        label.appendChild(checkmark);
        label.appendChild(checkbox);
        option.appendChild(label);
        coachDropdownContent.appendChild(option);
      });

      updateCoachDropdownText();

      if (coachDropdownButton && !coachDropdownButton.dataset.bound) {
        coachDropdownButton.dataset.bound = '1';
        coachDropdownButton.addEventListener('click', function(e) {
          e.stopPropagation();
          var dropdown = coachDropdownButton.closest('.coach-dropdown');
          var content = document.getElementById('coachDropdownContent');
          dropdown.classList.toggle('open');
          if (dropdown.classList.contains('open')) {
            var buttonRect = coachDropdownButton.getBoundingClientRect();
            var spaceBelow = window.innerHeight - buttonRect.bottom;
            var spaceAbove = buttonRect.top;
            var contentHeight = 200;
            if (spaceBelow < contentHeight && spaceAbove > spaceBelow) content.classList.add('open-up');
            else content.classList.remove('open-up');
          } else {
            content.classList.remove('open-up');
          }
        });
        document.addEventListener('click', function(e) {
          if (!e.target.closest('.coach-dropdown')) {
            document.querySelectorAll('.coach-dropdown').forEach(function(dropdown) {
              dropdown.classList.remove('open');
            });
          }
        });
      }
    }

    function fetchWeeklyData() {
      const cacheKey = 'weeklyData';
      const cacheExpirationKey = 'weeklyDataExpiration';
      const cachedData = localStorage.getItem(cacheKey);
      const cacheExpiration = localStorage.getItem(cacheExpirationKey);
      const now = new Date().getTime();

      if (cachedData && cacheExpiration && now < parseInt(cacheExpiration, 10)) {
        return Promise.resolve(JSON.parse(cachedData));
      }

      return (async function() {
        let data = null;
        try {
          const localResp = await fetch('./planning-v2.json');
          if (localResp.ok) {
            data = await localResp.json();
          } else {
            throw new Error('Fichier local non disponible');
          }
        } catch (localError) {
          const remoteResp = await fetch('https://raw.githubusercontent.com/canalforme-official/app-data/main/planning-v2.json');
          if (!remoteResp.ok) throw new Error('Erreur HTTP: ' + remoteResp.status);
          data = await remoteResp.json();
        }
        return data;
      })().then(function(data) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheExpirationKey, String(now + 360000));
        return data;
      });
    }

    function applyFilters() {
      function chk(id) {
        var el = document.getElementById(id + '-sidebar') || document.getElementById(id);
        return el ? el.checked : true;
      }
      const showMixte = chk('filter-mixte');
      const showWomenOnly = chk('filter-women-only');
      const showPiscine = chk('filter-piscine');
      const showCoachImages = chk('filter-coach');
      const coachCheckboxes = document.querySelectorAll('#filtersSidebar #coachDropdownContent input[type="checkbox"], #coachDropdownContent input[type="checkbox"]');
      const selectedCoaches = Array.from(coachCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      const blocks = document.querySelectorAll('.course-block');
      const contentWrapper = document.querySelector('.content-wrapper');

      for (const block of blocks) {
        const dataCoaches = block.getAttribute('data-coaches') || '';
        const courseCoaches = dataCoaches.split(',').map(coach => coach.trim());
        const showByCoach = selectedCoaches.length === 0 ||
          courseCoaches.some(coach => selectedCoaches.includes(coach));
        const isPiscine = block.classList.contains('piscine');
        const courseType = block.classList;
        const showByType = (
          (courseType.contains('mixte') && showMixte) ||
          (courseType.contains('women-only') && showWomenOnly)
        );

        block.style.display = (showByCoach && showByType && (!isPiscine || showPiscine)) ? 'block' : 'none';
      }

      if (showCoachImages) {
        contentWrapper.classList.remove('hide-coaches');
      } else {
        contentWrapper.classList.add('hide-coaches');
      }
    }

    function updateCountdownCircles() {
      const badges = document.querySelectorAll('.countdown-pill');
      for (const badge of badges) {
        const timeDiff = parseInt(badge.getAttribute('data-time-diff'), 10);
        if (timeDiff >= 0) {
          const minutes = Math.floor(timeDiff / 60);
          const seconds = timeDiff % 60;
          const timeString = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
          badge.textContent = timeString;
          badge.setAttribute('data-time-diff', timeDiff - 1);
        } else {
          badge.parentElement.classList.remove('starting-soon');
          badge.remove();
        }
      }
    }

    function markMultilineCourseNames() {
      requestAnimationFrame(function() {
        var els = document.querySelectorAll('.course-info .course-name-text');
        var lineHeightPx = 14;
        els.forEach(function(el) {
          if (el.scrollHeight > lineHeightPx + 4) el.classList.add('multiline');
          else el.classList.remove('multiline');
        });
      });
    }

    var weeklyFerieSparkleResizeTimer = null;

    /** Même palette et logique que daily.html (spawnConfettiBurst / .confetti-piece), chute ~ un tiers de la fenêtre. */
    function buildWeeklyFerieSparkleParticlesHtml() {
      var colors = ['#1e5a8a', '#2a7ab8', '#87ceeb', '#4682b4', '#5a9fd4', '#3d7bb8'];
      var parts = '';
      var p;
      for (p = 0; p < 56; p++) {
        var leftPct = 8 + Math.random() * 84;
        var dur = (1.8 + Math.random() * 0.9).toFixed(2);
        var delay = (Math.random() * 0.45).toFixed(2);
        var drift = ((Math.random() - 0.5) * 220).toFixed(1);
        var rot = (360 + Math.random() * 720).toFixed(0);
        var bg = colors[p % colors.length];
        parts += '<span class="weekly-ferie-confetti-piece" style="left:' + leftPct + '%;background:' + bg +
          ';animation-duration:' + dur + 's;animation-delay:' + delay + 's;--dx:' + drift + 'px;--rot:' + rot + 'deg"></span>';
      }
      return parts;
    }

    /** Même ligne d’en-têtes que celle utilisée pour construire le tableau (sticky ou thead). */
    function getWeeklyScheduleHeaderRow() {
      var r = document.querySelector('.sticky-days-bar .weekly-schedule-header tr');
      if (r) return r;
      return document.querySelector('#weeklySchedule .weekly-schedule thead tr');
    }

    /**
     * Calque dans .content-wrapper : même arbre que le planning sous body transform (rotation 90° mobile weekly).
     */
    function getWeeklyFerieSparkleMountParent() {
      return document.querySelector('.content-wrapper') || document.body;
    }

    /** Clés d’en-tête pour lesquelles on affiche les confettis (férié ou fermeture). */
    function isWeeklyFerieHeaderKey(pk) {
      return pk === 'ferie' || pk === 'ferme';
    }

    /** Résout le <th> férié / fermé par data-ymd sur la ligne d’en-têtes (plus fiable que cellIndex seul). */
    function ferieThForColumn(headerRow, ymd, cellIndexHint) {
      if (!headerRow || !headerRow.cells || !ymd) return null;
      var y = String(ymd).trim();
      var k;
      for (k = 0; k < headerRow.cells.length; k++) {
        var cell = headerRow.cells[k];
        if (!isWeeklyFerieHeaderKey(cell.getAttribute('data-planning-key'))) continue;
        if (String(cell.getAttribute('data-ymd') || '').trim() === y) return cell;
      }
      if (typeof cellIndexHint === 'number' && !isNaN(cellIndexHint) && cellIndexHint >= 0 && headerRow.cells[cellIndexHint]) {
        var hintCell = headerRow.cells[cellIndexHint];
        if (isWeeklyFerieHeaderKey(hintCell.getAttribute('data-planning-key'))) return hintCell;
      }
      return null;
    }

    /**
     * Offset cumulé jusqu’à `ancestor` (repère layout, cohérent si body a une rotation / transform).
     * À éviter pour l’en-tête sticky weekly_vertical : le translate3d(-scrollLeft) n’y est pas reflété.
     */
    function cumulativeOffsetToAncestor(el, ancestor) {
      if (!el || !ancestor || !ancestor.contains(el)) return null;
      var x = 0;
      var y = 0;
      var cur = el;
      while (cur && cur !== ancestor) {
        x += cur.offsetLeft;
        y += cur.offsetTop;
        cur = cur.offsetParent;
      }
      if (cur !== ancestor) return null;
      return { x: x, y: y };
    }

    /** weekly_vertical : barre de jours sticky + scroll horizontal ; getBoundingClientRect tient compte du translate. */
    function weeklyFerieSparklesUseViewportPositioning() {
      var wrap = document.getElementById('scheduleScrollWrapper');
      if (!wrap) return false;
      return !!document.querySelector('.sticky-days-bar .weekly-schedule-header tr');
    }

    function syncWeeklyFerieLayerBox(host, layer) {
      if (!host || !layer) return;
      var h = Math.max(host.scrollHeight, host.clientHeight, 1);
      layer.style.minHeight = h + 'px';
    }

    function positionWeeklyFerieSparkles() {
      var layer = document.querySelector('.weekly-ferie-sparkle-layer');
      if (!layer) return;
      var host = layer.parentElement;
      if (!host) return;
      var headerRow = getWeeklyScheduleHeaderRow();
      if (!headerRow || !headerRow.cells || !headerRow.cells.length) return;
      syncWeeklyFerieLayerBox(host, layer);
      var hr = host.getBoundingClientRect();
      var vhThird = (typeof window !== 'undefined' && window.innerHeight) ? Math.round(window.innerHeight * 0.34) : 260;
      var useViewportRect = weeklyFerieSparklesUseViewportPositioning();
      var cols = layer.querySelectorAll('.weekly-ferie-sparkle-column');
      var i;
      for (i = 0; i < cols.length; i++) {
        var ymd = cols[i].getAttribute('data-ferie-ymd');
        if (!ymd) continue;
        var ci = parseInt(cols[i].getAttribute('data-ferie-cell-index'), 10);
        var th = ferieThForColumn(headerRow, ymd, isNaN(ci) ? -1 : ci);
        if (!th) {
          cols[i].style.display = 'none';
          continue;
        }
        cols[i].style.display = '';
        var left;
        var top;
        var colW;
        if (useViewportRect) {
          var tr = th.getBoundingClientRect();
          left = tr.left - hr.left + host.scrollLeft;
          top = tr.bottom - hr.top + host.scrollTop;
          colW = Math.max(8, tr.width);
        } else {
          /* weekly.html (souvent body en rotate(90deg) sur mobile) : repère viewport ≠ repère CSS local. */
          var off = cumulativeOffsetToAncestor(th, host);
          if (off) {
            left = off.x;
            top = off.y + th.offsetHeight;
            colW = Math.max(8, th.offsetWidth);
          } else {
            var tr2 = th.getBoundingClientRect();
            left = tr2.left - hr.left + host.scrollLeft;
            top = tr2.bottom - hr.top + host.scrollTop;
            colW = Math.max(8, tr2.width);
          }
        }
        cols[i].style.position = 'absolute';
        cols[i].style.top = top + 'px';
        cols[i].style.left = left + 'px';
        cols[i].style.width = colW + 'px';
        cols[i].style.height = vhThird + 'px';
        cols[i].style.zIndex = '1';
      }
    }

    function removeWeeklyFerieSparkleLayers() {
      var all = document.querySelectorAll('.weekly-ferie-sparkle-layer');
      for (var a = 0; a < all.length; a++) {
        all[a].remove();
      }
    }

    function refreshWeeklyFerieSparkles() {
      var scheduleEl = document.getElementById('weeklySchedule');
      if (!scheduleEl) return;
      removeWeeklyFerieSparkleLayers();

      var ferieThSel = '.sticky-days-bar .weekly-schedule-header th[data-planning-key="ferie"], .sticky-days-bar .weekly-schedule-header th[data-planning-key="ferme"]';
      var theadFerieSel = '#weeklySchedule .weekly-schedule thead th[data-planning-key="ferie"], #weeklySchedule .weekly-schedule thead th[data-planning-key="ferme"]';
      var stickyHeaders = document.querySelectorAll(ferieThSel);
      var theadHeaders = document.querySelectorAll(theadFerieSel);
      var headers = stickyHeaders.length ? stickyHeaders : theadHeaders;
      if (!headers.length) return;

      var layer = document.createElement('div');
      layer.className = 'weekly-ferie-sparkle-layer';
      layer.setAttribute('aria-hidden', 'true');

      var h;
      for (h = 0; h < headers.length; h++) {
        var thEl = headers[h];
        var ymd = thEl.getAttribute('data-ymd');
        if (!ymd) continue;
        var cellIndex = typeof thEl.cellIndex === 'number' ? thEl.cellIndex : -1;
        var col = document.createElement('div');
        col.className = 'weekly-ferie-sparkle-column';
        col.setAttribute('data-ferie-ymd', ymd);
        col.setAttribute('data-ferie-cell-index', String(cellIndex));
        col.innerHTML = buildWeeklyFerieSparkleParticlesHtml();
        layer.appendChild(col);
      }

      if (!layer.children.length) return;

      var mountParent = getWeeklyFerieSparkleMountParent();
      layer.style.position = 'absolute';
      layer.style.left = '0';
      layer.style.top = '0';
      layer.style.width = '100%';
      layer.style.pointerEvents = 'none';
      layer.style.zIndex = '850';
      layer.style.overflow = 'visible';
      mountParent.appendChild(layer);
      positionWeeklyFerieSparkles();

      if (!window._weeklyFerieSparkleListeners) {
        window._weeklyFerieSparkleListeners = true;
        function schedPos() {
          requestAnimationFrame(positionWeeklyFerieSparkles);
        }
        var wrap = document.getElementById('scheduleScrollWrapper');
        if (wrap) wrap.addEventListener('scroll', schedPos, { passive: true });
        var cw = document.querySelector('.content-wrapper');
        if (cw) cw.addEventListener('scroll', schedPos, { passive: true });
        window.addEventListener('scroll', schedPos, { passive: true });
        window.addEventListener('resize', function() {
          if (weeklyFerieSparkleResizeTimer) clearTimeout(weeklyFerieSparkleResizeTimer);
          weeklyFerieSparkleResizeTimer = setTimeout(function() {
            weeklyFerieSparkleResizeTimer = null;
            positionWeeklyFerieSparkles();
          }, 120);
        });
      }
    }

    function refreshWeeklyFerieSparklesAfterLayout() {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          refreshWeeklyFerieSparkles();
          setTimeout(positionWeeklyFerieSparkles, 200);
          setTimeout(positionWeeklyFerieSparkles, 550);
        });
      });
    }

    function scrollToCurrentTime() {
      setTimeout(function() {
        requestAnimationFrame(function() {
          const contentWrapper = document.querySelector('.content-wrapper');
          const scrollWrapper = document.getElementById('scheduleScrollWrapper');
          if (!contentWrapper) return;

          let targetRow = document.querySelector('.course-block.current')?.closest('tr');
          if (!targetRow) {
            targetRow = document.querySelector('.course-block.starting-soon')?.closest('tr');
          }
          if (!targetRow) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const times = document.querySelectorAll('.time-cell');
            for (let i = 0; i < times.length; i++) {
              const timeText = times[i].textContent.trim();
              if (!timeText) continue;
              const parts = timeText.split(':').map(Number);
              const hour = parts[0];
              const minute = parts[1] || 0;
              if (hour > currentHour || (hour === currentHour && minute >= currentMinutes)) {
                targetRow = times[i].parentElement;
                break;
              }
            }
          }

          if (targetRow) {
            const thead = document.querySelector('.weekly-schedule thead');
            const theadHeight = thead ? thead.offsetHeight : 0;
            const targetPosition = targetRow.offsetTop - theadHeight - 10;
            setTimeout(function() {
              contentWrapper.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }, 100);
          }

          if (scrollWrapper) {
            var todayTh = document.querySelector('.weekly-schedule thead th.today');
            if (todayTh) {
              var targetLeft = todayTh.offsetLeft - (scrollWrapper.clientWidth / 2) + (todayTh.offsetWidth / 2);
              if (targetLeft < 0) targetLeft = 0;
              var maxLeft = scrollWrapper.scrollWidth - scrollWrapper.clientWidth;
              if (targetLeft > maxLeft) targetLeft = maxLeft;
              setTimeout(function() {
                scrollWrapper.scrollTo({ left: targetLeft, behavior: 'smooth' });
              }, 300);
            }
          }
        });
      }, 500);
    }

    setInterval(scrollToCurrentTime, 900000);
    setInterval(function() { location.reload(); }, 3600000);

    function checkCourseStates() {
      const now = new Date();
      const PR = getPR();
      const todayYmd = PR.ymdFromDate(now);
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

      document.querySelectorAll('.course-block').forEach(function(block) {
        try {
          const ymd = block.getAttribute('data-ymd');
          if (!ymd) return;

          if (ymd < todayYmd) {
            block.classList.add('past');
            block.classList.remove('starting-soon', 'current');
            const cp = block.querySelector('.countdown-pill');
            if (cp) cp.remove();
            return;
          }

          if (ymd > todayYmd) {
            block.classList.remove('past', 'starting-soon', 'current');
            const cp = block.querySelector('.countdown-pill');
            if (cp) cp.remove();
            return;
          }

          const startTime = block.getAttribute('data-start-time') || '';
          const endTimeStr = block.getAttribute('data-end-time');
          if (!startTime) return;

          const startParts = startTime.split(':').map(Number);
          const startTimeInMinutes = startParts[0] * 60 + (startParts[1] || 0);
          let endTimeInMinutes = startTimeInMinutes + 60;
          if (endTimeStr) {
            const endParts = endTimeStr.split(':').map(Number);
            endTimeInMinutes = endParts[0] * 60 + (endParts[1] || 0);
          }

          const isPast = currentTimeInMinutes >= endTimeInMinutes;
          const isInProgress = !isPast && currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
          const timeDifferenceMin = startTimeInMinutes - currentTimeInMinutes;
          const isStartingSoon = !isPast && !isInProgress && timeDifferenceMin >= 0 && timeDifferenceMin <= 15;

          if (isPast) {
            block.classList.add('past');
            block.classList.remove('starting-soon', 'current');
            const countdownPill = block.querySelector('.countdown-pill');
            if (countdownPill) countdownPill.remove();
          } else if (isStartingSoon) {
            block.classList.add('starting-soon');
            block.classList.remove('current', 'past');
            let countdownPill = block.querySelector('.countdown-pill');
            if (!countdownPill) {
              countdownPill = document.createElement('div');
              countdownPill.className = 'countdown-pill starting-soon';
              block.insertBefore(countdownPill, block.firstChild);
            }
            countdownPill.setAttribute('data-time-diff', timeDifferenceMin * 60);
          } else if (isInProgress) {
            block.classList.add('current');
            block.classList.remove('starting-soon', 'past');
            const countdownPill = block.querySelector('.countdown-pill');
            if (countdownPill) countdownPill.remove();
          } else {
            block.classList.remove('starting-soon', 'current', 'past');
            const countdownPill = block.querySelector('.countdown-pill');
            if (countdownPill) countdownPill.remove();
          }
        } catch (error) {
          console.error('checkCourseStates', error);
        }
      });
    }

    function toggleFiltersSidebar(event) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
      const sidebar = document.getElementById('filtersSidebar');
      if (!sidebar) return;
      sidebar.classList.toggle('open');
    }

    document.addEventListener('click', function(event) {
      const sidebar = document.getElementById('filtersSidebar');
      const filterButton = document.querySelector('.filter-button');
      if (!sidebar || !sidebar.classList.contains('open')) return;
      if (!sidebar.contains(event.target) && filterButton && !filterButton.contains(event.target)) {
        sidebar.classList.remove('open');
      }
    });

    function returnToToday() {
      window.location.href = './daily.html';
    }

    function goToWeekly() {
      var q = weekMondayYmd ? ('?week=' + encodeURIComponent(weekMondayYmd)) : '';
      window.location.href = './weekly.html' + q;
    }

    function goToWeeklyVertical() {
      var q = weekMondayYmd ? ('?week=' + encodeURIComponent(weekMondayYmd)) : '';
      window.location.href = './weekly_vertical.html' + q;
    }

    (function initRotationButtonTapAnimation() {
      var el = document.getElementById('rotationViewButton');
      if (!el) return;
      function removeTapActive() {
        var target = el;
        setTimeout(function() { target.classList.remove('tap-active'); }, 320);
      }
      el.addEventListener('pointerdown', function() { el.classList.add('tap-active'); });
      el.addEventListener('pointerup', removeTapActive);
      el.addEventListener('pointerleave', removeTapActive);
      el.addEventListener('pointercancel', removeTapActive);
    })();

    /** Avant d’ouvrir les horaires de prière : mémoriser la page courante pour le lien Retour. */
    document.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[href*="prayer-times"]');
      if (!a) return;
      try {
        sessionStorage.setItem('planning_return_url', window.location.href);
      } catch (err) {}
    }, true);

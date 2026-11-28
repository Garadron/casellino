/*
 * Casellino - page behaviour.
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 * Each sub-zone has one route text (the source of truth). The strips, colours and
 * side panels are recomputed from it. The frame is read like a book: left to right,
 * top to bottom.
 */
(function () {
  'use strict';
  const C = window.CasellinoCore;
  const X = window.CasellinoXlsx;
  const EXAMPLE = window.CasellinoExample;
  const STORE_KEY = 'casellino.progetto';

  const state = {
    project: null,
    current: 0,          // index of the open sub-zone
    analysis: null,      // analyseSubzone() of the open sub-zone
    selected: null,      // { p: strip index, idx: cell index } chosen by tapping
    caret: null,         // { p, idx } of the pigeonhole under the text cursor
    els: {},
    mapQuery: '',
  };

  // ------------------------------------------------------------ helpers

  function $(id) { return document.getElementById(id); }

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') el.textContent = v;
        else if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (let i = 2; i < arguments.length; i++) {
      const kid = arguments[i];
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function debounce(fn, ms) {
    let t = null, args = null;
    const run = function () { t = null; fn.apply(null, args); };
    const later = function () { args = arguments; clearTimeout(t); t = setTimeout(run, ms); };
    // a call still waiting runs at once (with new arguments, if given)
    later.now = function () { if (!t) return; clearTimeout(t); if (arguments.length) args = arguments; run(); };
    return later;
  }

  function toast(text) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const el = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  function download(name, data, type) {
    const blob = new Blob([data], { type: type });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function fileBaseName() {
    const p = state.project;
    const z = (p.zone || p.subzones.map(function (s) { return s.name; }).filter(Boolean).join('-') || 'senza nome');
    return 'Casellino zona ' + String(z).replace(/[\\/:*?"<>|]/g, ' ').trim();
  }

  function sz() { return state.project.subzones[state.current]; }

  function stripTitle(s) { return (s.target ? 'nella ' + s.target + ', ' : '') + 'Fila ' + (s.i + 1) + ' · ' + C.MODULE_NAMES[s.m]; }

  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  // ------------------------------------------------------------ storage

  function storeLoad() {
    try {
      let raw = localStorage.getItem(STORE_KEY);
      if (!raw) {
        // work saved by versions before v0.5.0, under an older name
        for (let i = 0; i < localStorage.length && !raw; i++) {
          const k = localStorage.key(i);
          if (/^casell.*\.progetto\.v1$/.test(k)) raw = localStorage.getItem(k);
        }
      }
      return raw ? C.sanitizeProject(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  const storeSave = debounce(function () {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.project));
      const d = new Date();
      if (!account.token) $('saved').textContent = 'Salvato su questo dispositivo alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      $('saved').textContent = 'Non riesco a salvare su questo dispositivo: usa «Salva file»';
    }
  }, 400);

  function changed() {
    C.assignColors(state.project);
    if (account.token && state.project.cloud) state.project.cloud.pending = true;
    account.edits = (account.edits || 0) + 1;
    storeSave();
    if (typeof cloudSaveLater === 'function' && account.token) cloudSaveLater();
  }

  // ------------------------------------------------------------ top fields and tabs

  function renderProjectFields() {
    $('zone').value = state.project.zone;
    $('owner').value = state.project.owner;
    const da = state.project.depotAddr;
    $('depot-town').value = da.comune;
    $('depot-prov').value = da.provincia;
    $('depot-street').value = da.via;
    $('depot-number').value = da.civico;
    $('depot-name').value = state.project.depotName || '';
    renderDepotStatus();
  }

  function openSubzone(i) {
    state.current = i;
    state.selected = null;
    state.caret = null;
    renderTabs();
    renderSubzone();
    refreshSide();
    const total = $('route-total');
    if (total) total.textContent = '';
    showKnownRound();
  }

  function renderTabs() {
    const tabs = $('tabs');
    tabs.textContent = '';
    state.project.subzones.forEach(function (s, i) {
      tabs.append(h('button', {
        type: 'button', role: 'tab', 'aria-selected': i === state.current ? 'true' : 'false',
        onclick: function () { openSubzone(i); },
      }, 'Sottozona ' + (s.name || i + 1)));
    });
    tabs.append(h('button', {
      type: 'button',
      onclick: function () {
        const last = state.project.subzones[state.project.subzones.length - 1];
        const s = C.newSubzone('', last ? last.town : '');
        if (last) s.modules = Object.assign({}, last.modules);
        state.project.subzones.push(s);
        changed();
        openSubzone(state.project.subzones.length - 1);
        const name = document.querySelector('#subzone input.name');
        if (name) name.focus();
      },
    }, '+ Sottozona'));
  }

  function renderSubzone() {
    const s = sz();
    const box = $('subzone');
    box.textContent = '';
    const name = h('input', { class: 'name', value: s.name, placeholder: 'es. 2A', autocomplete: 'off' });
    name.addEventListener('input', function () { s.name = name.value; changed(); renderTabs(); });
    const town = h('input', { class: 'town', value: s.town, placeholder: 'es. Borgo Esempio', autocomplete: 'off', readonly: !!s.locked });
    town.addEventListener('input', function () { s.town = town.value; changed(); refreshRoute(); refreshSide(); });
    const pick = h('div', { class: 'modules-pick', role: 'group', 'aria-label': 'Moduli' });
    const drawn = !!state.project.wall;
    const labels = { alaA: 'Ala A (a sinistra)', casello: 'Casello', alaB: 'Ala B (a destra)' };
    C.MODULES.forEach(function (m) {
      const cb = h('input', { type: 'checkbox', checked: s.modules[m] });
      cb.addEventListener('change', function () {
        s.modules[m] = cb.checked;
        changed(); refreshRoute(); refreshSide();
      });
      pick.append(h('label', null, cb, labels[m] + ' · ' + C.MODULE_SLOTS[m]));
    });
    const modulesBox = drawn
      ? h('div', { class: 'grow' }, h('div', { class: 'small muted', style: 'margin-bottom:3px' }, 'Moduli'),
          h('p', { class: 'small', style: 'margin:0' }, 'Si scelgono nel ',
            h('button', { type: 'button', class: 'link', onclick: function () {
              const c = $('overview-card'); c.open = true; renderOverview(); c.scrollIntoView({ block: 'start', behavior: 'smooth' });
            } }, 'disegno del mobile'), '.'))
      : h('div', { class: 'grow' }, h('div', { class: 'small muted', style: 'margin-bottom:3px' }, 'Moduli, da sinistra a destra'), pick);
    box.append(
      h('label', null, 'Sottozona', name),
      h('label', { class: 'grow-m' }, 'Comune', town),
      modulesBox
    );
    if (state.project.subzones.length > 1) {
      box.append(h('button', {
        type: 'button', class: 'danger',
        onclick: function () {
          if (!confirm('Elimino la sottozona ' + (s.name || state.current + 1) + ' con tutto il suo giro?')) return;
          state.project.subzones.splice(state.current, 1);
          const w = state.project.wall;
          if (w) {
            const heir = state.project.subzones[0].id;
            w.modules.forEach(function (m) { if (m.owner === s.id) m.owner = heir; });
            w.marks = w.marks.filter(function (k) { return k.owner !== s.id; });
          }
          changed();
          openSubzone(Math.max(0, state.current - 1));
        },
      }, 'Elimina sottozona'));
    }
    renderRouteEditor();
  }

  // ------------------------------------------------------------ the route editor

  function renderRouteEditor() {
    const s = sz();
    const box = $('route');
    box.textContent = '';
    const ta = h('textarea', {
      class: 'route-text', spellcheck: 'false', autocapitalize: 'characters', autocomplete: 'off',
      'aria-label': 'Il giro della sottozona',
      placeholder: 'VIA DEI TIGLI: 1..15, 14..2\nVIA DELLE ROSE: 1/3, 5, 7 (2)\nCASCINA ALTA',
    });
    ta.value = s.route;
    ta.readOnly = !!s.locked;
    const els = {
      ta: ta,
      used: h('span', { class: 'used' }),
      meter: h('div', { class: 'meter' }, h('i')),
      warnings: h('ul', { class: 'warnings' }),
      here: h('div', { class: 'here' }),
      suggest: h('div', { class: 'suggest' }),
      nowTitle: h('div', { class: 'now-title' }),
      nowWrap: h('div', { class: 'strip-wrap' }),
      strips: $('strips'),
    };
    state.els = els;

    const onType = debounce(function () { refreshRoute(); refreshSide(); }, 150);
    els.band = h('div', { class: 'mark-band', 'aria-hidden': 'true' }, h('span', null, '🔖'));
    els.spot = h('div', { class: 'mark-spot', 'aria-hidden': 'true' }, h('span', null, '👇'));
    els.markBtn = h('button', { type: 'button', class: 'mark-btn', onclick: goToMark,
      title: 'Ti riporta alla riga cambiata per ultima, nel giro e nelle strisce' });
    ta.addEventListener('input', function () {
      s.route = ta.value;
      const where = caretContext(ta, s.town);   // the segnacasella moves here: the line, and the number written
      s.mark = { line: where.lineIndex, tok: where.skip || where.typingStreet ? null : where.tok, at: Date.now() };
      fitTextarea(ta);
      changed();
      onType();
      caretChangedLater();
      showMark();
    });
    ['click', 'keyup', 'focus'].forEach(function (ev) { ta.addEventListener(ev, caretChangedLater); });
    ta.addEventListener('scroll', showMark);

    const empty = !state.project.subzones.some(function (x) { return x.route.trim(); });
    box.append(
      h('div', { class: 'row-head' }, h('h2', null, 'Il giro' + (s.name ? ' della ' + s.name : '')), els.meter, els.used),
      s.locked
        ? h('p', { class: 'locked-banner' },
            '🔒 Giro controllato e bloccato (' + new Date(s.locked).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) +
            '): vie e civici non si cambiano per sbaglio. ',
            h('button', { type: 'button', onclick: function () {
              if (!confirm('Sblocco il giro della ' + (s.name || 'sottozona') + '? Potrai di nuovo cambiare vie e civici.')) return;
              s.locked = 0; changed(); renderSubzone();
            } }, 'Sblocca'), ' ',
            window.indexedDB ? h('button', { type: 'button', class: 'photos-view-btn', onclick: function () { openViewer(); } }, '🖼 Guarda le foto') : null, ' ',
            h('button', { type: 'button', class: 'anomalies-btn', onclick: checkAnomalies }, '🔎 Controllo anomalie'), ' ',
            h('button', { type: 'button', class: 'voice-btn', onclick: startVoice }, '🎤 Cambia una casella a voce'))
        : h('p', { class: 'route-actions' },
            h('button', { type: 'button', class: 'primary photo-btn', onclick: openPhotos }, '📷 Carica e leggi le foto delle strisce'),
            h('button', { type: 'button', class: 'primary voice-btn', onclick: startVoice }, '🎤 Detta il giro'),
            window.indexedDB ? h('button', { type: 'button', class: 'photos-view-btn', onclick: function () { openViewer(); } }, '🖼 Guarda le foto') : null,
            h('button', { type: 'button', title: 'I civici scelti (cursore o selezione) li consegna un collega, di un\'altra linea: nelle strisce la casella del numero è sottolineata. Premi di nuovo per togliere. Dal telefono: tocca la casella nella striscia.',
              onmousedown: function (e) { e.preventDefault(); }, onclick: toggleOtherLine }, '👥 Lo consegna un collega'),
            h('button', { type: 'button', class: 'anomalies-btn', onclick: checkAnomalies }, '🔎 Controllo anomalie'),
            h('button', { type: 'button', onclick: function () {
              if (!confirm('Hai controllato tutte le vie, le cascine e i civici di questo giro? Lo blocco: non si potrà cambiare per sbaglio. (Si sblocca quando vuoi.)')) return;
              s.locked = Date.now(); changed(); renderSubzone();
            } }, '🔒 Blocca il giro controllato')),
      h('p', { class: 'small muted hint' },
        (s.locked ? '' : 'Scrivi il giro dall\'inizio alla fine, una via per riga, oppure fallo scrivere dalle foto qui sopra. ') +
        'Le caselle si riempiono come le righe di un libro: ' +
        'da sinistra a destra e dall\'alto in basso (fila 1 di ogni modulo, poi fila 2…). ',
        h('button', { type: 'button', class: 'link', onclick: function () { $('dlg-help').showModal(); } }, 'Come si scrive'),
        empty ? ' · ' : null,
        empty ? h('button', { type: 'button', class: 'link', onclick: loadExample }, 'Guarda un esempio') : null),
      els.markBtn,
      h('div', { class: 'route-frame' }, ta, els.band, els.spot), els.suggest, els.here, els.warnings,
      h('div', { class: 'now' }, els.nowTitle, els.nowWrap));
    fitTextarea(ta);
    refreshRoute();
    showMark();
    renderPhotoButton();
    if ($('dlg-photos').open) openViewer(0);   // another sub-zone: its photos
  }

  /*
   * The segnacasella (Garadron, 25 November 2026): where the work stopped. It follows the line of the route changed
   * last, is kept in the work for each sub-zone, and shows in the text (a band with 🔖) and in the strips (the
   * pigeonholes of that line, with 🔖); its button brings back there.
   */
  // Where a piece of the text box (from, to) is drawn, with an invisible copy of it: { top, height } of all its
  // lines (wrapped pieces included), and { left, width, lineHeight } of its first line.
  function textPlace(ta, from, to) {
    const css = getComputedStyle(ta);
    const copy = document.createElement('div');
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingRight',
      'boxSizing', 'tabSize'].forEach(function (k) { copy.style[k] = css[k]; });
    Object.assign(copy.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
      wordBreak: css.wordBreak, width: ta.clientWidth + 'px', top: '0', left: '-9999px', border: '0' });
    const mark = document.createElement('span');
    mark.textContent = ta.value.slice(from, to) || ' ';
    copy.append(ta.value.slice(0, from), mark);
    document.body.append(copy);
    const first = mark.getClientRects()[0], base = copy.getBoundingClientRect();
    const place = { top: mark.offsetTop, height: mark.offsetHeight || parseFloat(css.lineHeight) || 20,
      left: first ? first.left - base.left : 0, width: first ? first.width : 0, lineHeight: first ? first.height : 20 };
    copy.remove();
    return place;
  }
  function linePlace(ta, line) {
    const lines = ta.value.split('\n');
    const from = lines.slice(0, line).join('\n').length + (line ? 1 : 0);
    return textPlace(ta, from, from + (lines[line] || '').length);
  }
  // Where the number written last is (the comma group tok of the line): its place, or null.
  function tokenPlace(ta, line, tok) {
    const lines = ta.value.split('\n');
    const text = lines[line] || '';
    const colon = text.indexOf(':');
    if (colon < 0) return null;
    const toks = text.slice(colon + 1).split(',');
    if (tok >= toks.length || !toks[tok].trim()) return null;
    let at = lines.slice(0, line).join('\n').length + (line ? 1 : 0) + colon + 1;
    for (let k = 0; k < tok; k++) at += toks[k].length + 1;
    at += /^\s*/.exec(toks[tok])[0].length;
    return textPlace(ta, at, at + toks[tok].trim().length);
  }
  function markOf(s) {
    const lines = String(s.route || '').split('\n').length;
    return s.mark && s.mark.line < lines ? s.mark : null;
  }
  function showMark() {
    const els = state.els;
    if (!els || !els.ta || !els.band) return;
    const m = markOf(sz());
    els.markBtn.hidden = !m;
    els.band.hidden = !m;
    els.spot.hidden = true;
    if (!m) return;
    els.markBtn.textContent = '🔖 Segnacasella · riga ' + (m.line + 1);
    const place = linePlace(els.ta, m.line);
    const top = place.top - els.ta.scrollTop;
    els.band.style.top = (els.ta.offsetTop + top) + 'px';
    els.band.style.height = place.height + 'px';
    els.band.style.visibility = top + place.height < 0 || top > els.ta.clientHeight ? 'hidden' : 'visible';
    // 👇 on the number written last
    const spot = m.tok === null || m.tok === undefined ? null : tokenPlace(els.ta, m.line, m.tok);
    if (!spot) return;
    const y = spot.top - els.ta.scrollTop;
    Object.assign(els.spot.style, { top: (els.ta.offsetTop + els.ta.clientTop + y) + 'px', height: spot.lineHeight + 'px',
      left: (els.ta.offsetLeft + els.ta.clientLeft + spot.left - els.ta.scrollLeft) + 'px', width: spot.width + 'px' });
    els.spot.hidden = y < 0 || y > els.ta.clientHeight - 8;
  }
  // Back to the segnacasella: the cursor on its line, and the strips on its pigeonholes.
  function goToMark() {
    const m = markOf(sz());
    if (!m) return;
    goToLine(m.line);
    setTimeout(function () {
      document.querySelectorAll('.cell.marked.mark-first').forEach(function (cell) {
        const wrap = cell.closest('.strip-wrap');
        if (wrap) wrap.scrollLeft = Math.max(0, cell.offsetLeft - wrap.clientWidth / 3);
      });
    }, 80);
  }

  // Grows with the text, wrapped lines included, up to most of the screen, then scrolls.
  function fitTextarea(ta) {
    ta.style.height = 'auto';
    const max = Math.max(240, Math.round(window.innerHeight * 0.6));
    ta.style.height = Math.min(ta.scrollHeight + 4, max) + 'px';
  }

  // Own strips, then the pieces of the next sub-zone where this route continues.
  function stripsOf(a) { return a ? a.strips.concat(a.spill || []) : []; }

  function refreshRoute() {
    const els = state.els;
    if (!els.ta) return;
    const a = C.analyseProject(state.project)[state.current];
    state.analysis = a;
    state.links = state.project.subzones.some(function (x) { return /@\s*\d/.test(x.route); }) ? C.linkGroups(state.project) : {};
    const over = a.overflow.length > 0;
    const ownUsed = a.used - a.spillUsed;
    els.used.textContent = ownUsed + ' / ' + a.capacity + ' caselle' +
      (a.spillUsed ? ' + ' + a.spillUsed + ' nella ' + a.spill[0].target : '');
    els.used.classList.toggle('over', over);
    els.meter.classList.toggle('over', over);
    els.meter.classList.toggle('full', !over && ownUsed >= a.capacity);
    els.meter.firstChild.style.width = (a.capacity ? Math.min(100, ownUsed / a.capacity * 100) : 0) + '%';

    els.warnings.textContent = '';
    a.warnings.slice(0, 12).forEach(function (w) {
      els.warnings.append(h('li', { class: w.soft ? 'soft' : '' },
        w.line >= 0 ? h('button', { type: 'button', class: 'link', onclick: function () { goToLine(w.line); } }, w.text) : w.text));
    });
    if (a.warnings.length > 12) els.warnings.append(h('li', { class: 'soft' }, 'e altri ' + (a.warnings.length - 12) + ' avvisi'));
    // pigeonholes with two numbers against the way of the street: one button puts them all right
    const turned = sz().locked ? [] : C.pairOrderFixes(sz().route, sz().town);
    if (turned.length) {
      const note = h('li', { class: 'soft' },
        turned.length + (turned.length === 1 ? ' casella con due numeri sembra' : ' caselle con due numeri sembrano') + ' al contrario del verso della via: ');
      turned.slice(0, 4).forEach(function (f, k) {
        note.append(k ? ', ' : '', h('button', { type: 'button', class: 'link', onclick: function () { goToLine(f.line); } }, f.from + ' → ' + f.to));
      });
      els.warnings.append(note);
      note.append(turned.length > 4 ? '… ' : ' ',
        h('button', { type: 'button', class: 'pin-btn', onclick: function () {
          const r = C.fixPairOrder(sz().route, sz().town);
          sz().route = r.text;
          const ta = state.els.ta;
          if (ta) { const top = ta.scrollTop; ta.value = r.text; ta.scrollTop = top; }
          changed();
          refreshRoute();
          refreshSide();
          toast(r.fixes.length === 1 ? 'Messa in ordine 1 casella.' : 'Messe in ordine ' + r.fixes.length + ' caselle.');
        } }, '↕ Mettile in ordine'));
    }
    const unsure = C.allCells(a).filter(function (c) { return /\?/.test(c.top + c.second + c.street); }).length;
    if (unsure) els.warnings.append(h('li', { class: 'soft' }, unsure + (unsure === 1 ? ' casella da controllare' : ' caselle da controllare') + ' (hanno un «?», sono segnate in rosso).'));

    renderAllStrips(a);
    renderNow();
    renderOverviewLater();
  }

  function stripBox(s, p) {
    const strip = h('div', { class: 'strip', style: '--n:' + s.capacity });
    renderStrip(strip, s, p);
    const others = s.cells.filter(function (c) { return c.foreign; });
    const from = others.length ? ' · ' + others.reduce(function (a, c) { return a + c.span; }, 0) + ' caselle sono della ' + others[0].foreign : '';
    return [
      h('div', { class: 'strip-head' },
        h('b', null, C.MODULE_NAMES[s.m] + (s.target ? ' della ' + s.target : '')),
        h('span', { class: 'used' + (s.used === s.capacity ? ' full' : '') }, s.used + ' / ' + s.capacity + from)),
      h('div', { class: 'strip-wrap' }, strip),
    ];
  }

  function renderAllStrips(a) {
    const box = state.els.strips;
    box.textContent = '';
    if (!a.strips.length) {
      box.append(h('p', { class: 'muted' }, 'Accendi almeno un modulo (Casello o Ala) per vedere le strisce.'));
      return;
    }
    for (let i = 0; i < C.ROWS_PER_MODULE; i++) {
      const row = a.strips.map(function (s, p) { return { s: s, p: p }; }).filter(function (x) { return x.s.i === i; });
      if (!row.length) continue;
      const sec = h('section', { class: 'fila' }, h('h3', null, 'Fila ' + (i + 1)));
      row.forEach(function (x) { stripBox(x.s, x.p).forEach(function (e) { sec.append(e); }); });
      box.append(sec);
    }
    if (a.spill.length) {
      const sec = h('section', { class: 'fila' }, h('h3', null, 'Il giro continua nella sottozona ' + a.spill[0].target +
        ', fila ' + (a.spill[0].i + 1)));
      a.spill.forEach(function (s, j) { stripBox(s, a.strips.length + j).forEach(function (e) { sec.append(e); }); });
      box.append(sec);
    }
    if (a.overflow.length) {
      box.append(h('p', { class: 'bad' }, 'Non entrano nei moduli: ' + a.overflow.map(function (c) {
        return (c.street ? c.street + ' ' : '') + (c.top || '');
      }).join(', ')));
    }
  }

  // Font size (px) that keeps every word inside its box: nothing written is ever cut.
  function fitPx(text, widthPx, maxPx, lines) {
    const n = Math.max(1, String(text).length);
    return Math.max(5, Math.min(maxPx, Math.floor((widthPx - 4) * (lines || 1) / (n * 0.62))));
  }
  // Two numbers split by a "/" diagonal: the largest size that keeps both clear of the line.
  function diagPx(a, b, widthPx, heightPx) {
    for (let s = 12; s >= 5; s--) {
      const w = Math.max(String(a).length, String(b).length) * 0.6 * s;
      if ((2 + w) / widthPx <= 1 - (3 + s) / heightPx) return s;
    }
    return 5;
  }
  // Light writing gets a black outline only where it stands out too little on its colour (Garadron, 25 November
  // 2026): on dark colours the white is clear already, and the outline would only make it thinner.
  function outline(ink, bg) {
    return C.needsOutline(ink, bg) ? ';text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 0 2px #000' : '';
  }
  function slotPx() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot')) || 30;
  }

  // view: a strip that is not the route's (the dictation's preview, the examples): { project, links, fresh: [cells] }
  function renderStrip(el, s, p, focusIdx, view) {
    const proj = view ? view.project : state.project;
    const links = view ? view.links : state.links;
    const slot = slotPx();
    el.textContent = '';
    const sel = !view && state.selected && state.selected.p === p ? state.selected.idx : -1;
    const mk = view ? null : markOf(sz());
    let firstMark = true, fingerAt = null, startAt = null;
    s.cells.forEach(function (c, idx) {
      const bg = '#' + C.colorOf(proj, c.key);
      const ink = '#' + C.textColorOf(proj, c.key);
      const unsure = /\?/.test(c.top + c.second + c.street);
      const tip = (c.foreign ? 'Della ' + c.foreign + ' · ' : '') + (c.street || 'senza via') + (c.top ? ' · ' + c.top : '') +
        (c.second ? ' / ' + c.second : '') + ' · casella ' + (c.start + 1) + (c.span > 1 ? '-' + (c.end + 1) : '') +
        ' · riga ' + (c.line + 1) + ' del giro' + (c.other ? ' · per un\'altra linea' : '') +
        (c.link ? ' · simbolino ' + c.link : '');
      const pick = view ? null : function () { tap(p, idx); };
      const g = c.link && links && links[c.link];
      const marked = mk && !c.foreign && c.line === mk.line;
      const mark = (idx === sel ? ' sel' : '') + (idx === focusIdx ? ' here-cell' : '') + (c.foreign ? ' foreign' : '') +
        (marked ? ' marked' + (firstMark ? ' mark-first' : '') : '');
      if (marked && firstMark) startAt = c;
      if (marked) firstMark = false;
      if (marked && fingerAt === null && mk.tok !== null && mk.tok !== undefined && c.tok === mk.tok) fingerAt = c;
      const width = c.span * slot;
      let inside, size, cls = '', paint = 'background-color:' + bg;
      const two = C.twoStreets(proj, c);
      if (two && two.side) {   // two streets, two numbers side by side: each half with its street's colour
        size = Math.min(fitPx(two.left, width / 2, 13), fitPx(two.right, width / 2, 13));
        inside = [h('span', { class: 'h1', style: 'background:#' + two.color + ';color:#' + two.ink + outline(two.ink, two.color) }, two.left),
          h('span', { class: 'h2', style: 'background:#' + two.color2 + ';color:#' + two.ink2 + outline(two.ink2, two.color2) }, two.right)];
        cls = ' halves';
      } else if (c.second) {
        size = diagPx(c.top, c.second, width, 32);
        inside = [h('span', { class: 'd1' }, c.top), h('span', two ? { class: 'd2', style: 'color:#' + two.ink2 + outline(two.ink2, two.color2) } : { class: 'd2' }, c.second)];
        cls = ' diag';
        // two streets: the upper-left triangle has the first street's colour, the lower-right one the second's
        if (two) paint += ';background-image:linear-gradient(to bottom right, transparent calc(50% - 0.75px), ' + ink + ' 50%, transparent calc(50% + 0.75px)),' +
          'linear-gradient(to bottom right, #' + two.color + ' 50%, #' + two.color2 + ' 50%)';
      } else {
        const long = /\s/.test(c.top) && c.top.length > 4 * c.span;
        size = long ? fitPx(c.top, width, 10, 2) : fitPx(c.top, width, 13);
        inside = [c.top];
        cls = long ? ' long' : '';
      }
      el.append(h.apply(null, ['div', {
        class: 'cell top' + cls + (unsure ? ' unsure' : '') + (c.other ? ' other' : '') + (g ? ' linked' : '') + mark + (view && view.fresh && view.fresh.indexOf(c) >= 0 ? ' fresh' : ''),
        style: 'grid-column:' + (c.start + 1) + ' / ' + (c.end + 2) + ';' + paint + ';color:' + ink + outline(ink, two && c.second ? two.color : bg) +
          ';--ink:' + ink + ';font-size:' + size + 'px',
        title: tip, onclick: pick, 'data-idx': idx,
      }].concat(inside, g ? [linkSymbol(g)] : [])));
    });
    s.runs.forEach(function (r) {
      const idx = s.cells.findIndex(function (c) { return c.start === r.start; });
      const width = (r.end - r.start + 1) * slot;
      const two = !!r.street2;
      if (two && r.key2) {   // two streets: the line split in two, each name on its street's colour
        const px = Math.min(fitPx(r.street, width, 8), fitPx(r.street2, width, 8));
        el.append(h('div', {
          class: 'cell run two halves', title: r.street + ' / ' + r.street2 + (r.town ? ' · ' + r.town : ''),
          style: 'grid-column:' + (r.start + 1) + ' / ' + (r.end + 2) + ';font-size:' + px + 'px',
          onclick: view ? null : function () { tap(p, idx); },
        }, h('div', { class: 'half', style: 'background:#' + C.colorOf(proj, r.key) + ';color:#' + C.textColorOf(proj, r.key) + outline(C.textColorOf(proj, r.key), C.colorOf(proj, r.key)) },
          h('span', { class: 'run-name' }, r.street)),
        h('div', { class: 'half', style: 'background:#' + C.colorOf(proj, r.key2) + ';color:#' + C.textColorOf(proj, r.key2) + outline(C.textColorOf(proj, r.key2), C.colorOf(proj, r.key2)) },
          h('span', { class: 'run-name' }, r.street2))));
        return;
      }
      el.append(h('div', {
        class: 'cell run' + (two ? ' two' : ''), title: r.street + (two ? ' / ' + r.street2 : '') + (r.town ? ' · ' + r.town : ''),
        style: 'grid-column:' + (r.start + 1) + ' / ' + (r.end + 2) + ';background:#' + C.colorOf(proj, r.key) +
          ';color:#' + C.textColorOf(proj, r.key) + outline(C.textColorOf(proj, r.key), C.colorOf(proj, r.key)) + ';font-size:' +
          (two ? Math.min(fitPx(r.street, width, 8), fitPx(r.street2, width, 8)) : fitPx(r.street, width, 11)) + 'px',
        onclick: view ? null : function () { tap(p, idx); },
      }, h('span', { class: 'run-name' }, r.street, two ? h('br') : null, two ? r.street2 : null)));
    });
    // over the strip, in the free space (no number covered): 🔖 where the line starts, 👇 on the pigeonhole written last
    if (startAt) {
      el.append(h('div', { class: 'mark-start', title: 'Segnacasella: la riga cambiata per ultima comincia qui',
        style: 'left:calc(' + startAt.start + ' * var(--slot))' }, '🔖'));
    }
    if (fingerAt) {
      el.append(h('div', { class: 'mark-finger', title: 'Segnacasella: qui hai scritto per ultimo',
        style: 'left:calc(' + ((fingerAt.start + fingerAt.end + 1) / 2) + ' * var(--slot))' }, '👇'));
    }
    for (let k = C.SLOTS_PER_PAGE; k < s.capacity; k += C.SLOTS_PER_PAGE) {
      el.append(h('div', { class: 'cut', style: 'left:calc(' + k + ' * var(--slot) - 1px)', title: 'Qui finisce un foglio A4' }));
    }
    s.boundaries.forEach(function (b) {
      el.append(h('div', { class: 'boundary', style: 'left:calc(' + b.at + ' * var(--slot) - 1px)' }, h('span', null, b.label || 'confine')));
    });
  }

  // The strip where the text cursor is, with its pigeonhole highlighted.
  function renderNow() {
    const els = state.els;
    const a = state.analysis;
    els.nowWrap.textContent = '';
    const target = state.caret || state.selected;
    const list = stripsOf(a);
    if (!a || !target || !list[target.p]) {
      els.nowTitle.textContent = a && a.strips.length ? 'Tocca una riga del giro o una casella: qui vedi la sua striscia.' : '';
      return;
    }
    const s = list[target.p];
    const c = s.cells[target.idx];
    els.nowTitle.textContent = 'Sei qui: ' + stripTitle(s) + (c ? ' · casella ' + (c.start + 1) + ' di ' + s.capacity +
      ' · foglio ' + (Math.floor(c.start / C.SLOTS_PER_PAGE) + 1) : '');
    const strip = h('div', { class: 'strip', style: '--n:' + s.capacity });
    renderStrip(strip, s, target.p, target.idx);
    els.nowWrap.append(strip);
    const cell = strip.querySelector('[data-idx="' + target.idx + '"]');
    if (cell) {
      requestAnimationFrame(function () {
        els.nowWrap.scrollLeft = Math.max(0, cell.offsetLeft - els.nowWrap.clientWidth / 2 + cell.offsetWidth / 2);
      });
    }
  }

  // ------------------------------------------------------------ caret, suggestions, map

  function caretContext(ta, baseTown) {
    const pos = ta.selectionStart || 0;
    const text = ta.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd < 0) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd);
    const before = text.slice(0, lineStart).split('\n');
    const lineIndex = before.length - 1;
    let town = baseTown;
    before.forEach(function (l) {
      const m = /^\s*comune\s*:(.*)$/i.exec(l);
      if (m) town = m[1].trim() || baseTown;
    });
    const ctx = { line: line, lineIndex: lineIndex, lineStart: lineStart, lineEnd: lineEnd, town: town, street: '', token: '', tok: 0, typingStreet: false, skip: false };
    const t = line.trim();
    if (!t || t[0] === '#' || /^(comune|confine)\s*:?/i.test(t) || /^vuot[ae]\b/i.test(t) || /^(fine\s+(striscia|fila)|striscia\s+vuota)/i.test(t)) {
      ctx.skip = true;
      return ctx;
    }
    const colon = line.indexOf(':');
    const col = pos - lineStart;
    if (colon < 0) {
      ctx.street = t.replace(/\(\s*\d+\s*\)\s*$/, '').trim();
      ctx.typingStreet = true;
      return ctx;
    }
    ctx.street = line.slice(0, colon).trim();
    ctx.typingStreet = col <= colon;
    if (col > colon) {
      const left = line.slice(colon + 1, col);
      const right = line.slice(col);
      const a = left.lastIndexOf(',');
      const b = right.indexOf(',');
      ctx.token = (left.slice(a + 1) + (b < 0 ? right : right.slice(0, b))).trim();
      ctx.tok = left.split(',').length - 1;
    }
    return ctx;
  }

  function firstTop(token) {
    if (!token) return '';
    const r = C.parseToken(token);
    return r.cells && r.cells.length ? r.cells[0].top : '';
  }

  // Finds the pigeonhole written at a line (and comma group) of the route.
  function findCell(line, tok) {
    const a = state.analysis;
    if (!a) return null;
    let firstOfLine = null;
    const list = stripsOf(a);
    for (let p = 0; p < list.length; p++) {
      const cells = list[p].cells;
      for (let idx = 0; idx < cells.length; idx++) {
        if (cells[idx].foreign || cells[idx].line !== line) continue;
        if (cells[idx].tok === tok) return { p: p, idx: idx };
        if (!firstOfLine) firstOfLine = { p: p, idx: idx };
      }
    }
    return firstOfLine;
  }

  const caretChangedLater = debounce(caretChanged, 60);

  function caretChanged() {
    const els = state.els;
    if (!els.ta) return;
    const ctx = caretContext(els.ta, sz().town);
    showSuggestions(ctx);
    state.caret = ctx.skip ? null : findCell(ctx.lineIndex, ctx.tok);
    renderNow();
    if (ctx.skip || !ctx.street) { els.here.textContent = ''; return; }
    const q = C.mapQuery(ctx.street, firstTop(ctx.token), ctx.town);
    showHere(els.here, q);
    setMapLater(q);
  }

  function showHere(el, q) {
    el.textContent = '';
    if (!q) return;
    el.append('📍 ' + q + ' · ', h('a', { href: mapsLink(q), target: '_blank', rel: 'noopener' }, 'Google Maps'));
  }

  function knownStreets(town) {
    const set = {};
    const list = state.project.streetLists[C.norm(town)] || [];
    list.forEach(function (n) { set[C.norm(n)] = n; });
    Object.keys(state.project.streets).forEach(function (k) {
      const parts = k.split('|');
      if (parts[1] === C.norm(town)) set[parts[0]] = set[parts[0]] || parts[0];
    });
    return Object.keys(set).map(function (k) { return set[k]; });
  }

  function showSuggestions(ctx) {
    const els = state.els;
    els.suggest.textContent = '';
    if (!ctx.typingStreet || ctx.street.length < 2) return;
    const q = C.norm(ctx.street);
    const words = q.split(' ');
    const found = knownStreets(ctx.town).filter(function (n) {
      const nn = C.norm(n);
      return nn !== q && words.every(function (w) { return nn.indexOf(w) >= 0; });
    }).slice(0, 8);
    found.forEach(function (name) {
      els.suggest.append(h('button', {
        type: 'button',
        onmousedown: function (e) { e.preventDefault(); },
        onclick: function () {
          const ta = els.ta;
          const ctx2 = caretContext(ta, sz().town);
          const colon = ctx2.line.indexOf(':');
          const newLine = C.norm(name) + (colon >= 0 ? ctx2.line.slice(colon) : ': ');
          ta.value = ta.value.slice(0, ctx2.lineStart) + newLine + ta.value.slice(ctx2.lineEnd);
          const caret = ctx2.lineStart + newLine.length;
          ta.focus();
          ta.setSelectionRange(caret, caret);
          ta.dispatchEvent(new Event('input'));
        },
      }, name));
    });
  }

  function mapsLink(q) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  function setMap(q) {
    if (!q || q === state.mapQuery) return;
    state.mapQuery = q;
    $('map-where').textContent = q;
    const box = $('map-box');
    box.textContent = '';
    box.append(h('iframe', {
      title: 'Mappa di ' + q, loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=17&output=embed',
    }));
    const link = $('map-link');
    link.href = mapsLink(q);
    link.hidden = false;
  }
  const setMapLater = debounce(setMap, 700);

  // ------------------------------------------------------------ selection

  function select(p, idx) {
    state.selected = { p: p, idx: idx };
    state.caret = null;
    renderAllStrips(state.analysis);
    renderNow();
    const s = stripsOf(state.analysis)[p];
    const c = s && s.cells[idx];
    const card = $('selection-card');
    const box = $('selection');
    box.textContent = '';
    if (!c) { card.hidden = true; return; }
    card.hidden = false;
    if (c.foreign) {
      box.append(h('div', { class: 'sel-info' },
        h('p', null, h('b', null, c.street || 'Senza via'), ' · ' + [c.top, c.second].filter(Boolean).join(' / ')),
        h('p', null, 'Questa casella è del giro della ' + c.foreign + ' (riga ' + (c.line + 1) + '): continua qui, nella fila ' + (c.i + 1) + '.'),
        h('p', { class: 'actions-inline' }, h('button', { type: 'button', onclick: function () {
          openSubzone(c.fromIndex);
          setTimeout(function () { goToLine(c.line); }, 50);
        } }, 'Apri il giro della ' + c.foreign))));
      return;
    }
    const what = [c.top, c.second].filter(Boolean).join(' / ') || '(vuota)';
    const q = C.mapQuery(c.street, c.top, c.town);
    box.append(
      h('div', { class: 'sel-info' },
        h('p', null, h('b', null, c.street || 'Senza via'), c.town ? ' · ' + c.town : ''),
        h('p', null, 'Scritto nella casella: ', h('b', null, what)),
        h('p', { class: 'muted small' }, stripTitle(s) + ', casella ' + (c.start + 1) +
          (c.span > 1 ? ' – ' + (c.end + 1) + ' (larga ' + c.span + ')' : '') + ' · foglio ' +
          (Math.floor(c.start / C.SLOTS_PER_PAGE) + 1) + ' · riga ' + (c.line + 1) + ' del giro'),
        c.other ? h('p', { class: 'small' }, '👥 La posta di questa casella la consegna un collega: nelle strisce il numero è sottolineato.') : null,
        linkInfo(c),
        h('p', { class: 'actions-inline' },
          c.top || c.street ? h('button', { type: 'button', class: 'colleague-btn' + (c.other ? ' on' : ''), 'aria-pressed': c.other ? 'true' : 'false',
            onclick: function () { toggleColleague(c); } }, c.other ? '👥 La consegna un collega ✓' : '👥 Lo consegna un collega') : null,
          c.top || c.street ? h('button', { type: 'button', class: 'tie-btn', onclick: function () { startLink(c); } },
            c.link ? '🔗 Lega anche un\'altra casella' : '🔗 Lega a un\'altra casella') : null,
          c.link ? h('button', { type: 'button', class: 'unlink-btn', onclick: function () { unlink(c); } }, '✖ Togli il simbolino') : null,
          sz().locked ? null : h('button', { type: 'button', onclick: function () { voiceFrom(c, false); } }, '🎤 Detta da qui'),
          h('button', { type: 'button', onclick: function () { voiceFrom(c, true); } }, '🎤 Cambiala a voce'),
          h('button', { type: 'button', onclick: function () { goToLine(c.line); } }, 'Vai alla riga del giro'),
          q ? h('a', { class: 'btn', href: mapsLink(q), target: '_blank', rel: 'noopener' }, 'Apri in Google Maps') : null)));
    if (q) setMap(q);
    if (isTouch) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /*
   * "Altra linea": the numbers at the cursor (or in the selection) get a "*" (mail for another line,
   * underlined on the strips); if they all have it already, it is taken away.
   */
  function toggleOtherLine() {
    const ta = state.els.ta;
    if (!ta || sz().locked) return;
    const a = ta.selectionStart, b = ta.selectionEnd;
    const found = [];
    let pos = 0;
    ta.value.split('\n').forEach(function (line) {
      const plain = line.trim();
      const special = !plain || plain[0] === '#' || /^(comune|confine)\b/i.test(plain) || /^(fine\s+striscia|fine\s+fila|striscia\s+vuota|vuot[ae](\s+\d+)?)\.?$/i.test(plain);
      if (!special) {
        const colon = line.indexOf(':');
        let st = pos + colon + 1;   // a name alone (no colon) is one piece, from the start of the line
        (colon < 0 ? [line] : line.slice(colon + 1).split(',')).forEach(function (piece) {
          const en = st + piece.length;
          const hit = a === b ? st <= a && a <= en : st < b && en > a;
          if (piece.trim() && hit && !(a === b && found.length)) found.push({ start: st, end: en, text: piece });
          st = en + 1;
        });
      }
      pos += line.length + 1;
    });
    if (!found.length) { toast('Metti il cursore su un civico, o seleziona i civici, e premi «Lo consegna un collega». Dal telefono: tocca la casella nella striscia.'); return; }
    const all = found.every(function (f) { return /\*/.test(f.text); });
    let text = ta.value;
    found.slice().reverse().forEach(function (f) {
      const end = f.text.replace(/\s+$/, '');
      const piece = all ? end.replace(/\s*\*/g, '') : (/\*/.test(end) ? end : end + '*');
      text = text.slice(0, f.start) + piece + f.text.slice(end.length) + text.slice(f.end);
    });
    const top = ta.scrollTop;
    ta.value = text;
    ta.scrollTop = top;
    sz().route = text;
    changed();
    refreshRoute();
    toast(all ? 'Tolto: li consegni tu.' : (found.length === 1 ? 'Segnato: lo consegna un collega (casella sottolineata).' : found.length + ' civici segnati: li consegna un collega (caselle sottolineate).'));
  }

  // The same for the pigeonhole tapped on a strip (easy from the phone): "*" on its number in the text.
  // A series like "7..15" is written out ("7, 9, 11*, 13, 15") so that only that pigeonhole is marked.
  function toggleColleague(c) {
    if (!applyMarks([{ zone: state.current, cell: c, marks: { other: !c.other } }])) return;
    toast(c.other ? 'Tolto: la consegni tu.' : 'Segnata: la consegna un collega (casella sottolineata).');
  }

  /*
   * Changes pigeonholes in the text of their sub-zones: [{ zone, cell, marks }] (see Core.setCellMarks). The ones
   * further down a text are changed first, so that writing out a series does not move the others. False if locked.
   */
  function applyMarks(edits) {
    const locked = edits.find(function (e) { return state.project.subzones[e.zone].locked; });
    if (locked) { toast('Il giro della ' + (state.project.subzones[locked.zone].name || 'sottozona') + ' è bloccato: sbloccalo per cambiarlo.'); return false; }
    edits.slice().sort(function (a, b) { return b.zone - a.zone || b.cell.line - a.cell.line || b.cell.tok - a.cell.tok; })
      .forEach(function (e) {
        const s = state.project.subzones[e.zone];
        s.route = C.setCellMarks(s.route, e.cell, e.marks);
      });
    const ta = state.els.ta;
    if (ta) { const top = ta.scrollTop; ta.value = sz().route; ta.scrollTop = top; }
    changed();
    const keep = state.selected;
    refreshRoute();
    if (keep) select(keep.p, keep.idx);
    return true;
  }

  /*
   * The link symbols (Garadron, 25 November 2026): two or more pigeonholes, even of different streets, get the same
   * symbol, because the mail of one goes to the other (the owners of a bar get theirs at the bar).
   */
  function linkSymbol(g, size) {
    const pts = C.linkShapePoints(g.shape, 0, 0, 5).map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');
    const el = h('span', { class: 'link-sym', 'aria-hidden': 'true' });
    el.innerHTML = '<svg viewBox="-6.5 -6.5 13 13"><polygon points="' + pts + '" fill="#' + g.color + '" stroke="#' + g.edge +
      '" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    return el;
  }
  function cellName(c) {
    return (c.street || 'senza via') + (c.top ? ' ' + c.top : '') + (c.second ? '/' + c.second : '');
  }
  function linkInfo(c) {
    const g = c.link && state.links && state.links[c.link];
    if (!g) return null;
    const others = g.cells.filter(function (x) { return !(x.zone === state.current && x.cell.line === c.line && x.cell.tok === c.tok && x.cell.top === c.top && x.cell.second === c.second); });
    return h('p', { class: 'small' }, linkSymbol(g), 'Simbolino ' + g.n + ' (' + g.shape + ', colore ' + g.colorName + '): ',
      others.length ? 'legata a ' + others.map(function (x) {
        return cellName(x.cell) + (x.zone !== state.current ? ' (' + (state.project.subzones[x.zone].name || 'altra sottozona') + ')' : '');
      }).join(', ') + '.' : 'è da sola. Premi «🔗 Lega a un\'altra casella» e tocca l\'altra.');
  }
  function startLink(c) {
    if (sz().locked) { toast('Il giro è bloccato: sbloccalo per cambiarlo.'); return; }
    state.linking = { zone: state.current, cell: c };
    const old = document.querySelector('.link-bar');
    if (old) old.remove();
    document.body.append(h('div', { class: 'link-bar', role: 'status' },
      h('p', null, '🔗 Ora tocca nella striscia la casella dove porti la posta di ', h('b', null, cellName(c)), ' (anche di un\'altra via o sottozona).'),
      h('button', { type: 'button', onclick: stopLink }, 'Annulla')));
  }
  function stopLink() {
    state.linking = null;
    const bar = document.querySelector('.link-bar');
    if (bar) bar.remove();
  }
  // A tap on a strip: it picks the pigeonhole, or finishes the link started from another one.
  function tap(p, idx) {
    if (state.voicePick) {
      const v = (stripsOf(state.analysis)[p] || { cells: [] }).cells[idx];
      if (!v || v.foreign) { toast('Tocca una casella di questa sottozona.'); return; }
      const mode = state.voicePick;
      stopVoicePick();
      voiceFrom(v, mode === 'change');
      return;
    }
    const L = state.linking;
    if (!L) { select(p, idx); return; }
    const c = (stripsOf(state.analysis)[p] || { cells: [] }).cells[idx];
    if (!c || c.foreign || !(c.top || c.street)) { toast('Tocca una casella con un civico o un nome, di questa sottozona.'); return; }
    if (L.zone === state.current && c.line === L.cell.line && c.tok === L.cell.tok && c.top === L.cell.top && c.second === L.cell.second) {
      toast('È la stessa casella: tocca l\'altra.');
      return;
    }
    const n = L.cell.link || c.link || C.nextLink(state.project);
    const edits = [];
    if (L.cell.link !== n) edits.push({ zone: L.zone, cell: L.cell, marks: { link: n } });
    if (c.link !== n) edits.push({ zone: state.current, cell: c, marks: { link: n } });
    stopLink();
    state.selected = { p: p, idx: idx };
    if (edits.length && !applyMarks(edits)) return;
    if (!edits.length) select(p, idx);
    const g = state.links[n];
    toast('🔗 Legate: ' + cellName(L.cell) + ' e ' + cellName(c) + ' hanno lo stesso simbolino' + (g ? ' (' + g.shape + ', colore ' + g.colorName + ')' : '') + '.');
  }
  // Takes the symbol away; when only one pigeonhole would keep it, from that one too.
  function unlink(c) {
    const g = state.links[c.link];
    const edits = [{ zone: state.current, cell: c, marks: { link: 0 } }];
    if (g && g.cells.length === 2) {
      g.cells.forEach(function (x) {
        const same = x.zone === state.current && x.cell.line === c.line && x.cell.tok === c.tok && x.cell.top === c.top && x.cell.second === c.second;
        if (!same) edits.push({ zone: x.zone, cell: x.cell, marks: { link: 0 } });
      });
    }
    if (applyMarks(edits)) toast(edits.length > 1 ? 'Simbolino tolto da tutte e due le caselle.' : 'Simbolino tolto da questa casella.');
  }

  function goToLine(line) {
    const ta = state.els.ta;
    if (!ta) return;
    const lines = ta.value.split('\n');
    let start = 0;
    for (let k = 0; k < line && k < lines.length; k++) start += lines[k].length + 1;
    ta.focus();
    ta.setSelectionRange(start, start + (lines[line] || '').length);
    // put the line in view inside the text box
    ta.scrollTop = Math.max(0, linePlace(ta, line).top - ta.clientHeight / 3);
    ta.scrollIntoView({ block: 'center', behavior: 'smooth' });
    caretChanged();
  }

  // ------------------------------------------------------------ side panel

  const refreshSide = debounce(function () {
    renderStreets();
    renderDuplicates();
  }, 250);

  // The streets of the open sub-zone only (also the pigeonholes it fills in another sub-zone's frame).
  function renderStreets() {
    const p = state.project;
    const cur = state.current;
    const usage = {};
    const order = [];
    const count = function (key, street, c, zi, own) {
      if (!usage[key]) { usage[key] = { street: street, town: c.town, n: 0, zones: {} }; order.push(key); }
      if (zi === cur) usage[key].n += c.span;
      usage[key].zones[zi] = true;
      if (own) usage[key].own = true;
      else usage[key].with = usage[key].with || { street: c.street, key: c.key };   // shares a pigeonhole with that one
    };
    C.analyseProject(p).forEach(function (a, zi) {
      C.allCells(a).forEach(function (c) {
        if (!c.key) return;
        count(c.key, c.street, c, zi, true);
        if (c.key2) count(c.key2, c.street2, c, zi, false);
      });
    });
    const mine = order.filter(function (k) { return usage[k].zones[cur]; });
    const byTown = {};
    mine.forEach(function (k) {
      const t = usage[k].town || '';
      (byTown[t] = byTown[t] || []).push(k);
    });
    const towns = Object.keys(byTown);
    if (sz().town && !towns.some(function (t) { return C.norm(t) === C.norm(sz().town); })) towns.push(sz().town);
    $('streets-zone').textContent = sz().name ? 'della ' + sz().name : '';

    const lists = $('town-lists');
    lists.textContent = '';
    towns.filter(Boolean).forEach(function (t) {
      const list = p.streetLists[C.norm(t)] || [];
      lists.append(h('div', { class: 'town-list-line' },
        h('span', null, 'Elenco vie di ' + t + ': ' + (list.length ? list.length + ' nomi' : 'non c\'è')),
        h('button', { type: 'button', class: 'link', onclick: function () { openList(t); } }, list.length ? 'cambia' : 'aggiungi')));
    });

    const ul = $('streets');
    ul.textContent = '';
    $('streets-count').textContent = mine.length ? '(' + mine.length + ')' : '';
    if (!mine.length) {
      ul.append(h('li', { class: 'muted' }, 'Le vie che scrivi compaiono qui, con il loro colore.'));
      return;
    }
    const near = C.streetNeighbours(p).map;
    const groups = C.subzoneStreets(p);
    Object.keys(byTown).forEach(function (t) {
      if (Object.keys(byTown).length > 1) ul.append(h('li', { class: 'town-head' }, t || 'Comune non scritto'));
      const official = (p.streetLists[C.norm(t)] || []).map(comparable);
      byTown[t].sort(function (a, b) { return usage[a].street.localeCompare(usage[b].street, 'it'); }).forEach(function (k) {
        const u = usage[k];
        const color = u.own ? C.colorOf(p, k) : C.colorOf(p, u.with.key);   // only in a shared pigeonhole: its colour
        const sel = h('select', { 'aria-label': 'Colore di ' + u.street });
        const others = Object.keys(near[k] || {});
        const sameZone = Object.keys(C.sameZoneStreets(groups, k));
        const nameOf = function (o) { return usage[o] ? usage[o].street : "un'altra via"; };
        C.PALETTE.forEach(function (c) {
          const taken = sameZone.find(function (o) { return C.colorOf(p, o) === c.hex; });
          const clash = !taken && others.find(function (o) { return C.similarColors(C.colorOf(p, o), c.hex); });
          const why = taken ? ' (già usato da ' + nameOf(taken) + ')' : (clash ? ' (troppo simile a ' + nameOf(clash) + ', vicina)' : '');
          sel.append(h('option', { value: c.hex, selected: c.hex === color, disabled: !!(taken || clash) && c.hex !== color }, c.name + why));
        });
        sel.addEventListener('change', function () {
          p.streets[k] = { color: sel.value };
          changed(); refreshRoute(); renderStreets();
        });
        const unknown = official.length && official.indexOf(comparable(u.street)) < 0;
        let li = null;
        const fix = function () { editStreetName(li, k, u, usage); };
        li = h('li', null,
          u.own ? h('span', { class: 'sw', style: 'background:#' + color + ';color:#' + C.textColorOf(p, k), title: 'Cambia colore: ' + C.paletteName(color) }, 'A', sel)
            : h('span', { class: 'sw', style: 'background:#' + color + ';color:#' + C.textColorOf(p, u.with.key), title: 'Ha il colore di ' + u.with.street + ', con cui divide la casella' }, 'A'),
          h('button', { type: 'button', class: 'nm', title: 'Tocca per correggere il nome: ' + u.street, onclick: fix }, u.street,
            u.own ? null : h('span', { class: 'small muted' }, ' (con ' + u.with.street + ')')),
          unknown ? h('span', { class: 'flag', title: 'Questo nome non è nell\'elenco delle vie del comune' }, 'non in elenco') : null,
          h('span', { class: 'n' }, u.n),
          h('button', { type: 'button', class: 'pen', title: 'Correggi il nome', 'aria-label': 'Correggi il nome di ' + u.street, onclick: fix }, '✏️'));
        ul.append(li);
      });
    });
  }

  // Correcting a name from the list: it changes in every line of the round, the numbers stay.
  function editStreetName(li, key, u, usage) {
    const p = state.project;
    const official = p.streetLists[C.norm(u.town)] || [];
    const input = h('input', { value: u.street, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Nome giusto di ' + u.street,
      list: official.length ? 'official-streets' : null });
    const form = h('form', { class: 'rename-street' }, input,
      official.length ? h('datalist', { id: 'official-streets' }, official.map(function (n) { return h('option', { value: n }); })) : null,
      h('button', { type: 'submit', class: 'primary' }, 'Salva'),
      h('button', { type: 'button', onclick: renderStreets }, 'Annulla'));
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') renderStreets(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = input.value.replace(/\s+/g, ' ').trim();
      if (!name || name === u.street) { renderStreets(); return; }
      const newKey = C.streetKey(name, u.town);
      const same = newKey !== key && usage[newKey];
      if (same && !confirm('«' + usage[newKey].street + '» c\'è già: le unisco in una via sola, con il suo colore?')) return;
      const locked = Object.keys(u.zones).map(Number).filter(function (i) { return p.subzones[i].locked; });
      if (locked.length && !confirm('Il giro della ' + locked.map(function (i) { return p.subzones[i].name || 'sottozona ' + (i + 1); }).join(' e della ') +
        ' è bloccato (controllato). Correggo il nome anche lì? Cambia solo il nome, non i civici.')) return;
      const r = C.renameStreet(p, key, name);
      const ta = state.els.ta;
      if (ta) { const top = ta.scrollTop; ta.value = sz().route; fitTextarea(ta); ta.scrollTop = top; }
      changed();
      refreshRoute();
      renderStreets();
      renderDuplicates();
      const also = r.zones.filter(function (i) { return i !== state.current; }).map(function (i) { return p.subzones[i].name || 'sottozona ' + (i + 1); });
      toast('Nome corretto in ' + r.lines + (r.lines === 1 ? ' riga' : ' righe') + (also.length ? ', anche nel giro della ' + also.join(' e della ') : ' del giro') +
        (same ? ', e unito a quello che c\'era già.' : '.'));
    });
    li.textContent = '';
    li.append(form);
    input.focus();
    input.select();
  }

  // Same street written as "C.NA X" or "CASCINA X", "V. X" or "VIA X".
  function comparable(name) {
    return C.norm(C.mapQuery(name, '', '')).replace(/[.'’]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function renderDuplicates() {
    const d = C.findDuplicates(state.project);
    const card = $('dups-card');
    const ul = $('dups');
    ul.textContent = '';
    card.hidden = !d.length;
    d.slice(0, 60).forEach(function (x) {
      ul.append(h('li', null, h('b', null, x.street + ' ' + x.number), ' · ' + x.where.join('; ')));
    });
    if (d.length > 60) ul.append(h('li', { class: 'muted' }, 'e altri ' + (d.length - 60)));
  }

  // ------------------------------------------------------------ drawing of the whole frame

  // One colour per sub-zone for the line under its pigeonholes (not a street colour).
  const ZONE_TINTS = ['#1565C0', '#E65100', '#2E7D32', '#6A1B9A', '#AD1457', '#00838F'];
  let overviewBig = false;
  let pencil = null; // null = off, 'erase', or a sub-zone id
  let overviewGeo = null;

  function tintOf(id) {
    const k = state.project.subzones.findIndex(function (s) { return s.id === id; });
    return ZONE_TINTS[(k < 0 ? 0 : k) % ZONE_TINTS.length];
  }

  // The frame as drawn by the user, or the one that matches the sub-zones as they are.
  function currentWall() { return state.project.wall || C.wallFromSubzones(state.project); }

  // From now on the drawn frame decides (the first time something is changed in the drawing).
  function ownWall() {
    if (!state.project.wall) state.project.wall = C.wallFromSubzones(state.project);
    return state.project.wall;
  }

  function wallChanged() {
    changed();
    renderSubzone();
    renderOverview();
    refreshSide();
  }

  function overviewSvg() {
    const p = state.project;
    const wall = currentWall();
    const view = Object.assign({}, p, { wall: wall });
    const all = C.analyseProject(view);
    const strips = {};
    all.forEach(function (a) { a.strips.forEach(function (s) { strips[s.i + ':' + s.wi] = s; }); });
    const U = 10, TOP = 16, BOT = 10, BAR = 4, ROWH = TOP + BOT + BAR, GAPR = 12, GAPM = 8, HEAD = 36, LEFT = 22;
    const xs = [];
    let x = LEFT;
    wall.modules.forEach(function (mod, wi) {
      if (wi) x += GAPM + (mod.owner !== wall.modules[wi - 1].owner ? 26 : 0);
      xs.push(x);
      x += C.WALL_SLOTS[mod.type] * U;
    });
    const width = x + 6;
    const height = HEAD + C.ROWS_PER_MODULE * (ROWH + GAPR) + 2;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('font-family', 'Arial, sans-serif');
    svg.setAttribute('font-weight', '700');
    const add = function (parent, tag, attrs, text) {
      const e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (text !== undefined) e.textContent = text;
      parent.append(e);
      return e;
    };
    add(svg, 'rect', { x: 0, y: 0, width: width, height: height, fill: '#ffffff' });
    for (let i = 0; i < C.ROWS_PER_MODULE; i++) {
      add(svg, 'text', { x: 4, y: HEAD + i * (ROWH + GAPR) + 17, 'font-size': 11, fill: '#555' }, String(i + 1));
    }
    // headers: one for each run of modules of the same sub-zone
    let g0 = 0;
    wall.modules.forEach(function (mod, wi) {
      const last = wi === wall.modules.length - 1 || wall.modules[wi + 1].owner !== mod.owner;
      if (!last) return;
      const sz0 = p.subzones.find(function (s) { return s.id === mod.owner; }) || {};
      const x0 = xs[g0], x1 = xs[wi] + C.WALL_SLOTS[mod.type] * U;
      add(svg, 'rect', { x: x0, y: 2, width: x1 - x0, height: 16, rx: 3, fill: tintOf(mod.owner) });
      add(svg, 'text', { x: x0 + 6, y: 14, 'font-size': 11, fill: '#ffffff' },
        'Sottozona ' + (sz0.name || '?') + (sz0.town ? ' · ' + sz0.town : ''));
      g0 = wi + 1;
    });
    let fingerDone = false;
    wall.modules.forEach(function (mod, wi) {
      const mx = xs[wi];
      const cap = C.WALL_SLOTS[mod.type];
      add(svg, 'text', { x: mx, y: 31, 'font-size': 9, fill: '#555' }, (mod.type === 'casello' ? 'Casello' : 'Ala') + ' · ' + cap);
      for (let i = 0; i < C.ROWS_PER_MODULE; i++) {
        const y = HEAD + i * (ROWH + GAPR);
        const st = strips[i + ':' + wi];
        add(svg, 'rect', { x: mx, y: y, width: cap * U, height: TOP + BOT, fill: '#f1f1f1', stroke: '#b5b5b5', 'stroke-width': 0.5 });
        if (!st) continue;
        // who owns each slot: a coloured line under it, and a red line where it changes
        let s = 0;
        while (s < cap) {
          let e = s;
          while (e + 1 < cap && st.owners[e + 1] === st.owners[s]) e++;
          add(svg, 'rect', { x: mx + s * U, y: y + TOP + BOT, width: (e - s + 1) * U, height: BAR, fill: tintOf(st.owners[s]) });
          if (s > 0) add(svg, 'line', { x1: mx + s * U, y1: y - 4, x2: mx + s * U, y2: y + ROWH + 4, stroke: '#d93025', 'stroke-width': 2.5 });
          s = e + 1;
        }
        st.cells.forEach(function (c) {
          if (c.start >= cap) return;
          const zm = c.fromIndex === undefined && p.subzones.findIndex(function (z) { return z.id === mod.owner; }) === state.current ? markOf(sz()) : null;
          if (zm && zm.tok !== null && zm.tok !== undefined && c.line === zm.line && c.tok === zm.tok && !fingerDone) {
            fingerDone = true;   // 👇 over the pigeonhole written last, in the gap above the row
            add(svg, 'text', { x: mx + (c.start + Math.min(c.end, cap - 1) + 1) / 2 * U, y: y - 1.5, 'font-size': 10, 'text-anchor': 'middle' }, '👇');
          }
          const end = Math.min(c.end, cap - 1);
          const cx = mx + c.start * U, cw = (end - c.start + 1) * U;
          const ownerIndex = c.fromIndex !== undefined ? c.fromIndex : p.subzones.findIndex(function (z) { return z.id === mod.owner; });
          const bg = '#' + C.colorOf(p, c.key), ink = '#' + C.textColorOf(p, c.key);
          const g = add(svg, 'g', { 'data-k': ownerIndex, 'data-line': c.line });
          add(g, 'title', {}, (c.street || 'senza via') + (c.top ? ' ' + c.top : '') + (c.second ? '/' + c.second : '') +
            ' · ' + ((p.subzones[ownerIndex] || {}).name || '') + ' · fila ' + (i + 1) + ' casella ' + (c.start + 1));
          add(g, 'rect', { x: cx, y: y, width: cw, height: TOP, fill: bg, stroke: '#333', 'stroke-width': 0.4 });
          const label = c.second ? c.top + '/' + c.second : c.top;
          if (label && label.length * 3.8 <= cw - 1) {
            add(g, 'text', { x: cx + cw / 2, y: y + 11, 'font-size': 6.5, 'text-anchor': 'middle', fill: ink }, label);
          }
        });
        st.runs.forEach(function (r) {
          const rx = mx + r.start * U, rw = (r.end - r.start + 1) * U;
          add(svg, 'rect', { x: rx, y: y + TOP, width: rw, height: BOT, fill: '#' + C.colorOf(p, r.key), stroke: '#333', 'stroke-width': 0.3 });
          if (r.street.length * 3.4 <= rw - 2) {
            add(svg, 'text', { x: rx + rw / 2, y: y + TOP + 7.5, 'font-size': 6, 'text-anchor': 'middle', fill: '#' + C.textColorOf(p, r.key) }, r.street);
          }
        });
      }
    });
    overviewGeo = { xs: xs, U: U, HEAD: HEAD, ROWH: ROWH, GAPR: GAPR, wall: wall };
    return { svg: svg, width: width, height: height, modules: wall.modules.length };
  }

  // Where a tap falls on the drawing: { row, wi, slot } or null.
  function slotAt(svg, evt) {
    if (!overviewGeo || !svg.getScreenCTM) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    const G = overviewGeo;
    const row = Math.floor((q.y - G.HEAD) / (G.ROWH + G.GAPR));
    if (row < 0 || row >= C.ROWS_PER_MODULE || q.y - G.HEAD - row * (G.ROWH + G.GAPR) > G.ROWH) return null;
    for (let wi = 0; wi < G.wall.modules.length; wi++) {
      const cap = C.WALL_SLOTS[G.wall.modules[wi].type];
      const slot = Math.floor((q.x - G.xs[wi]) / G.U);
      if (slot >= 0 && slot < cap) return { row: row, wi: wi, slot: slot };
    }
    return null;
  }

  function renderWallTools() {
    const box = $('wall-tools');
    if (!box) return;
    box.textContent = '';
    const p = state.project;
    const wall = currentWall();
    const chips = h('div', { class: 'wall-chips' });
    wall.modules.forEach(function (mod, wi) {
      const owner = h('select', { 'aria-label': 'Sottozona del modulo ' + (wi + 1) });
      p.subzones.forEach(function (s) { owner.append(h('option', { value: s.id, selected: s.id === mod.owner }, s.name || 'senza nome')); });
      owner.addEventListener('change', function () { ownWall().modules[wi].owner = owner.value; wallChanged(); });
      const move = function (d) {
        const w = ownWall();
        const j = wi + d;
        if (j < 0 || j >= w.modules.length) return;
        const t = w.modules[wi]; w.modules[wi] = w.modules[j]; w.modules[j] = t;
        w.marks.forEach(function (k) { if (k.module === wi) k.module = j; else if (k.module === j) k.module = wi; });
        wallChanged();
      };
      chips.append(h('div', { class: 'wall-chip', style: 'border-color:' + tintOf(mod.owner) },
        h('b', { style: 'color:' + tintOf(mod.owner) }, (wi + 1) + '. ' + (mod.type === 'casello' ? 'Casello · 91' : 'Ala · 33')),
        owner,
        h('span', { class: 'chip-buttons' },
          h('button', { type: 'button', title: 'Sposta a sinistra', 'aria-label': 'Sposta a sinistra', onclick: function () { move(-1); } }, '◀'),
          h('button', { type: 'button', title: 'Sposta a destra', 'aria-label': 'Sposta a destra', onclick: function () { move(1); } }, '▶'),
          h('button', { type: 'button', title: 'Togli questo modulo', 'aria-label': 'Togli questo modulo', onclick: function () {
            const w = ownWall();
            if (w.modules.length < 2 || !confirm('Tolgo il modulo ' + (wi + 1) + ' dal disegno?')) return;
            w.modules.splice(wi, 1);
            w.marks = w.marks.filter(function (k) { return k.module !== wi; });
            w.marks.forEach(function (k) { if (k.module > wi) k.module--; });
            wallChanged();
          } }, '✕'))));
    });
    const addModule = function (type) {
      ownWall().modules.push({ type: type, owner: sz().id });
      wallChanged();
    };
    const pens = h('div', { class: 'pens' }, h('span', { class: 'small' }, 'Matita:'));
    p.subzones.forEach(function (s) {
      pens.append(h('button', { type: 'button', class: 'pen' + (pencil === s.id ? ' on' : ''), style: '--pen:' + tintOf(s.id),
        onclick: function () { pencil = pencil === s.id ? null : s.id; renderWallTools(); } }, h('i'), s.name || 'senza nome'));
    });
    pens.append(h('button', { type: 'button', class: 'pen' + (pencil === 'erase' ? ' on' : ''),
      onclick: function () { pencil = pencil === 'erase' ? null : 'erase'; renderWallTools(); } }, 'Gomma'));
    box.append(
      h('p', { class: 'small muted' }, 'I moduli del mobile da sinistra a destra, come sono davvero. Scegli di quale sottozona è ogni modulo e mettili nell\'ordine giusto (ala, casello, ala, casello…).'),
      chips,
      h('p', { class: 'actions-inline' },
        h('button', { type: 'button', onclick: function () { addModule('casello'); } }, '+ Casello'),
        h('button', { type: 'button', onclick: function () { addModule('ala'); } }, '+ Ala'),
        p.wall ? h('button', { type: 'button', onclick: function () {
          if (!confirm('Torno al mobile automatico (i moduli scelti in ogni sottozona)? I segni della matita si perdono.')) return;
          p.wall = null; pencil = null; wallChanged();
        } }, 'Torna automatico') : null),
      pens,
      h('p', { class: 'small muted' }, pencil === null ? 'Per segnare dove una sottozona entra nell\'altra, scegli una matita e tocca nel disegno la casella da cui comincia: da lì verso destra, fino al segno dopo, quella fila è sua.' :
        (pencil === 'erase' ? 'Gomma: tocca una casella per togliere il segno che la decide.' : 'Matita accesa: tocca nel disegno la prima casella della sottozona scelta.')));
  }

  function renderOverview() {
    const card = $('overview-card');
    if (!card || !card.open) return;
    renderWallTools();
    const box = $('overview');
    box.textContent = '';
    const d = overviewSvg();
    if (!d.modules) { box.append(h('p', { class: 'muted' }, 'Non c\'è ancora niente da disegnare.')); return; }
    d.svg.setAttribute('width', overviewBig ? String(Math.round(d.width * 1.6)) : '100%');
    if (overviewBig) d.svg.setAttribute('height', String(Math.round(d.height * 1.6)));
    if (pencil) d.svg.classList.add('pencil');
    d.svg.addEventListener('click', function (e) {
      if (pencil) {
        const at = slotAt(d.svg, e);
        if (!at) return;
        const w = ownWall();
        if (pencil === 'erase') C.removeWallMark(w, at.row, at.wi, at.slot);
        else C.setWallMark(w, at.row, at.wi, at.slot, pencil);
        changed();
        refreshRoute();
        renderOverview();
        refreshSide();
        return;
      }
      const g = e.target.closest && e.target.closest('g[data-k]');
      if (!g) return;
      const k = +g.getAttribute('data-k'), line = +g.getAttribute('data-line');
      if (k >= 0 && k !== state.current) openSubzone(k);
      setTimeout(function () { goToLine(line); }, 50);
    });
    box.append(d.svg);
    const legend = $('overview-legend');
    legend.textContent = '';
    state.project.subzones.forEach(function (s) {
      legend.append(h('span', { class: 'zone-key' }, h('i', { style: 'background:' + tintOf(s.id) }), 'Sottozona ' + (s.name || '?')));
    });
    legend.append(h('span', { class: 'zone-key' }, h('i', { style: 'background:#d93025;width:4px' }),
      'confine tra due sottozone dentro una fila'));
  }
  const renderOverviewLater = debounce(renderOverview, 400);

  function downloadOverview() {
    const d = overviewSvg();
    const scale = 2;
    d.svg.setAttribute('width', String(d.width * scale));
    d.svg.setAttribute('height', String(d.height * scale));
    const xml = new XMLSerializer().serializeToString(d.svg);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = function () {
      const canvas = h('canvas', { width: d.width * scale, height: d.height * scale });
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) { download(fileBaseName() + ' - disegno.png', blob, 'image/png'); });
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('Non riesco a creare l\'immagine.'); };
    img.src = url;
  }

  // ------------------------------------------------------------ the round on the map (free: OpenStreetMap)

  let leafletReady = null;
  let routeMap = null, routeLayer = null;
  let routeBusy = false;
  let lastAsk = 0;
  const pause = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function loadLeaflet() {
    if (leafletReady) return leafletReady;
    leafletReady = new Promise(function (resolve, reject) {
      document.head.append(h('link', { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }));
      const js = h('script', { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      js.onload = function () { resolve(window.L); };
      js.onerror = function () { leafletReady = null; reject(new Error('la mappa non si carica')); };
      document.head.append(js);
    });
    return leafletReady;
  }

  // Asks OpenStreetMap where an address is: one request per second at most (their rule).
  async function nominatim(path) {
    const wait = 1100 - (Date.now() - lastAsk);
    if (wait > 0) await pause(wait);
    lastAsk = Date.now();
    // no extra headers: a plain request needs no cross-site pre-check
    const res = await fetch('https://nominatim.openstreetmap.org/' + path + '&format=jsonv2&accept-language=it');
    if (!res.ok) throw new Error('il servizio delle mappe non risponde (' + res.status + ')');
    return res.json();
  }
  /*
   * Where an address is, only inside its town (Garadron, 23 November 2026: points put in another town, far from the
   * round). First the street and the town asked apart, then the whole text; a result counts only if the map says it is
   * in that town, or if it is within 6 km of the town's centre (hamlets). Otherwise: not found, and it is put by hand.
   */
  const placeNames = function (a) {
    return [a.city, a.town, a.village, a.municipality, a.hamlet, a.suburb, a.city_district].filter(Boolean).map(C.norm);
  };
  async function townCentre(town) {
    const key = 'COMUNE|' + C.norm(town);
    const geo = state.project.geo;
    if (!geo[key]) {
      const j = await nominatim('search?limit=1&countrycodes=it&city=' + encodeURIComponent(town));
      geo[key] = j.length ? { lat: +j[0].lat, lon: +j[0].lon, found: 'via' } : { found: 'no' };
    }
    return geo[key].found === 'no' ? null : geo[key];
  }
  async function geocode(q, town) {
    const centre = town ? await townCentre(town) : null;
    const inTown = function (r) {
      return !town || placeNames(r.address || {}).indexOf(C.norm(town)) >= 0 || (centre && C.airKm(centre, { lat: +r.lat, lon: +r.lon }) <= 6);
    };
    const pick = function (list) { const r = (list || []).find(inTown); return r ? { lat: +r.lat, lon: +r.lon } : null; };
    if (town) {
      const r = pick(await nominatim('search?limit=5&countrycodes=it&addressdetails=1&street=' + encodeURIComponent(q.split(',')[0].trim()) +
        '&city=' + encodeURIComponent(town)));
      if (r) return r;
    }
    return pick(await nominatim('search?limit=5&countrycodes=it&addressdetails=1&q=' + encodeURIComponent(q)));
  }
  // The address of a point: { via, civico, comune }, or null if there is no street there.
  async function addressOf(p) {
    const a = (await nominatim('reverse?zoom=18&lat=' + p.lat + '&lon=' + p.lon)).address || {};
    if (!a.road) return null;
    return { via: a.road, civico: /^\d{1,4}\s?[a-z]?$/i.test(a.house_number || '') ? a.house_number : '',
      comune: a.village || a.town || a.city || a.municipality || a.hamlet || '' };
  }

  // The streets of a town on OpenStreetMap (also farms and places), free. [] if the town is not found.
  // With the province (two letters) a town is looked for only there: some towns share their name.
  async function osmStreetNames(town, province) {
    // the name with any capitals; characters that are not letters match anything
    const name = '^' + town.trim().replace(/[^\p{L}\p{N}' -]/gu, '.') + '$';
    const area = province
      ? 'area["boundary"="administrative"]["admin_level"="6"]["ref"="' + province + '"]->.p;' +
        'rel(area.p)["boundary"="administrative"]["admin_level"="8"]["name"~"' + name + '",i];map_to_area->.a;'
      : 'area["boundary"="administrative"]["admin_level"="8"]["name"~"' + name + '",i]->.a;';
    const json = await overpass('[out:json][timeout:40];' + area +
      '(way["highway"]["name"](area.a);' +
      'node["place"]["name"](area.a);way["place"]["name"](area.a);' +
      'node["name"~"^(cascina|cascine|contrada|localit)",i](area.a);way["name"~"^(cascina|cascine|contrada|localit)",i](area.a););' +
      'out tags;');
    const names = {};
    (json.elements || []).forEach(function (e) { if (e.tags && e.tags.name) names[e.tags.name] = true; });
    return Object.keys(names).sort(function (a, b) { return a.localeCompare(b, 'it'); });
  }
  // The free OpenStreetMap servers, one after the other: the main one is often full, the others are slower.
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'];
  async function overpass(query) {
    let last = null;
    for (let i = 0; i < OVERPASS.length; i++) {
      const stop = new AbortController();
      const timer = setTimeout(function () { stop.abort(); }, 25000);
      try {
        const res = await fetch(OVERPASS[i], { method: 'POST', body: 'data=' + encodeURIComponent(query), signal: stop.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (res.ok) return await res.json();
        last = new Error('HTTP ' + res.status);
      } catch (e) {
        last = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw last || new Error('nessun server risponde');
  }

  // The point of a stop: first with the house number, then the street alone. Found points stay
  // saved in the work (project.geo), so they are not asked again.
  async function locate(stop) {
    const geo = state.project.geo;
    for (let i = 0; i < stop.queries.length; i++) {
      const q = stop.queries[i];
      const known = geo[q];
      if (known && known.found !== 'no') return known;
      if (known) continue;
      const g = await geocode(q, stop.town);
      geo[q] = g ? { lat: g.lat, lon: g.lon, found: i === 0 && stop.queries.length > 1 ? 'civico' : 'via' } : { found: 'no' };
      storeSave();
      if (g) return geo[q];
    }
    return null;
  }

  function knownPoint(stop) { return C.stopPoint(state.project, stop); }

  // The road route between the points, by car, with the free OSRM service (80 points at a time).
  async function roadRoute(points) {
    let km = 0, minutes = 0, line = [], onRoads = true;
    for (let a = 0; a < points.length - 1; a += 79) {
      const chunk = points.slice(a, a + 80);
      if (chunk.length < 2) break;
      try {
        const coords = chunk.map(function (x) { return x.lon.toFixed(6) + ',' + x.lat.toFixed(6); }).join(';');
        const res = await fetch('https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=full&geometries=geojson');
        const j = await res.json();
        if (!res.ok || j.code !== 'Ok') throw new Error('percorso non trovato');
        km += j.routes[0].distance / 1000;
        minutes += j.routes[0].duration / 60;
        line = line.concat(j.routes[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; }));
      } catch (e) {
        onRoads = false;
        for (let i = 1; i < chunk.length; i++) km += C.airKm(chunk[i - 1], chunk[i]);
        line = line.concat(chunk.map(function (x) { return [x.lat, x.lon]; }));
      }
    }
    return { km: km, minutes: minutes, line: line, onRoads: onRoads };
  }

  // The stops of the open sub-zone on the map, and where the office is.
  const round = { stops: [], depot: null, placing: null };

  // The office: its address as written, and the same without "(...)" and " - " that the map search does not like.
  function depotQueries() {
    const a = state.project.depotAddr;
    if (!a.via.trim() || !a.comune.trim()) return [];
    const where = [a.comune.trim(), C.provinceName(a.provincia)].filter(Boolean).join(', ');
    return (a.civico.trim() ? [a.via.trim() + ' ' + a.civico.trim() + ', ' + where] : []).concat([a.via.trim() + ', ' + where]);
  }
  // The streets of the office's town, to choose the street from them (kept while the page is open).
  const depotStreets = { town: '', names: null, busy: false };
  const depotTownKey = function () { return C.norm(state.project.depotAddr.comune) + '|' + state.project.depotAddr.provincia; };
  async function loadDepotStreets() {
    const town = state.project.depotAddr.comune.trim(), key = depotTownKey();
    if (!town || (depotStreets.town === key && (depotStreets.names || depotStreets.busy))) return;
    depotStreets.town = key;
    depotStreets.names = null;
    depotStreets.busy = true;
    $('depot-streets-note').textContent = '(carico le vie di ' + town + '…)';
    // a list found once stays on the device: the free servers can be slow
    const store = 'casellino.vie.' + key;
    let names = null;
    try { names = JSON.parse(localStorage.getItem(store) || 'null'); } catch (e) { /* not saved */ }
    if (!names) {
      try {
        names = await osmStreetNames(town, state.project.depotAddr.provincia);
        if (names.length) try { localStorage.setItem(store, JSON.stringify(names)); } catch (e) { /* only a convenience */ }
      } catch (e) { /* no list: the street is written by hand */ }
    }
    if (depotStreets.town !== key) return;   // the town changed meanwhile
    depotStreets.busy = false;
    depotStreets.names = names;
    const list = $('depot-streets');
    list.textContent = '';
    (names || []).forEach(function (n) { list.append(h('option', { value: n })); });
    $('depot-streets-note').textContent = names === null ? '(elenco delle vie non disponibile ora)'
      : (names.length ? '(' + names.length + ' vie sulla mappa)' : '(comune non trovato: controlla il nome' + (state.project.depotAddr.provincia ? ' e la provincia)' : ')'));
    renderDepotStatus();
  }
  // Is the street of the office missing from the free map? (only when the list of the town is known)
  function depotStreetMissing() {
    const via = state.project.depotAddr.via.trim();
    return !!(via && depotStreets.names && depotStreets.names.length && depotStreets.town === depotTownKey() &&
      !depotStreets.names.some(function (n) { return comparable(n) === comparable(via); }));
  }
  // Where the office is: put by hand or with the position, or found from the address.
  function depotPoint() {
    if (state.project.depotPoint) return state.project.depotPoint;
    const qs = depotQueries();
    for (let i = 0; i < qs.length; i++) {
      const g = state.project.geo[qs[i]];
      if (g && g.found !== 'no') return g;
    }
    return null;
  }
  const depotTapText = function () {
    return 'Tocca sulla mappa il punto ' + (state.project.depotName ? 'di «' + state.project.depotName + '»' : 'dell\'ufficio') + ' (prima puoi ingrandire e spostare la mappa).';
  };
  const depotWord = function () { return state.project.depotName ? '«' + state.project.depotName + '»' : 'l\'ufficio'; };
  const toDepot = function () { return state.project.depotName ? 'a «' + state.project.depotName + '»' : 'all\'ufficio'; };

  function renderDepotStatus() {
    const el = $('depot-status');
    if (!el) return;
    const p = depotPoint(), qs = depotQueries();
    const notFound = !p && qs.length > 0 && qs.every(function (q) { return state.project.geo[q]; });
    el.className = notFound ? 'bad' : 'muted';
    const missing = !p && depotStreetMissing();
    el.className = notFound || missing ? 'bad' : 'muted';
    if (p) el.textContent = '📍 Sulla mappa: ' + ({ mano: 'messo a mano', gps: 'dalla tua posizione', via: 'trovata la via, senza il numero' }[p.found] || 'trovato');
    else if (missing) el.textContent = '«' + state.project.depotAddr.via.trim() + '» non c\'è sulla mappa gratuita di ' + state.project.depotAddr.comune.trim() +
      ': metti il punto con «Scegli sulla mappa» o «Usa la mia posizione». Basta una volta, poi resta salvato.';
    else el.textContent = notFound ? 'Questo indirizzo non c\'è sulla mappa gratuita: metti il punto con «Scegli sulla mappa» o «Usa la mia posizione». Basta una volta, poi resta salvato.' : 'Non ancora sulla mappa.';
    $('btn-depot-find').textContent = state.project.depotPoint ? '🔎 Cerca dall\'indirizzo' : '🔎 Cerca sulla mappa';
    renderDepotSummary(p);
    // not on the free map: the other ways stand out, and Google Maps can give the coordinates
    const lost = !p && (notFound || missing);
    $('btn-depot-map').classList.toggle('on', lost);
    $('depot-coords').hidden = !lost;
    if (lost) $('depot-gmaps').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.addressText(state.project.depotAddr));
  }

  // The line of the closed "Centro di partenza": what is chosen, or that nothing is.
  function renderDepotSummary(point) {
    const da = state.project.depotAddr || {};
    const t = function (v) { return String(v || '').trim(); };
    const name = t(state.project.depotName);
    const addr = [t(da.via) + (t(da.via) && t(da.civico) ? ' ' + t(da.civico) : ''), t(da.comune)].filter(Boolean).join(', ');
    $('depot-summary').textContent = name || addr
      ? (name || addr) + (point === undefined ? '' : point ? ' · 📍 sulla mappa' : ' · non ancora sulla mappa')
      : 'Non ancora scelto: serve per la cartina del giro.';
  }

  // The office from its address (a point put by hand is replaced only when asked with the button).
  async function findDepot(asked) {
    const el = $('depot-status');
    if (!depotQueries().length) { el.textContent = 'Scrivi prima comune e via, oppure scegli il punto sulla mappa.'; return; }
    if (state.project.depotPoint && !asked) return;
    if (asked) {
      state.project.depotPoint = null;
      depotQueries().forEach(function (q) { if (state.project.geo[q] && state.project.geo[q].found === 'no') delete state.project.geo[q]; });
    }
    el.className = 'muted';
    el.textContent = 'Cerco l\'indirizzo sulla mappa…';
    try {
      round.depot = await locate({ queries: depotQueries(), town: state.project.depotAddr.comune.trim() });
      changed();
    } catch (e) {
      el.textContent = 'Non riesco a cercare: serve internet.';
      return;
    }
    renderDepotStatus();
    if (routeMap) redraw(null, false);
  }

  // The office put on the map, by hand or with the device position. Without an address, the address of the point is written.
  async function setDepotPoint(latlng, how) {
    state.project.depotPoint = { lat: latlng.lat, lon: latlng.lng, found: how };
    round.depot = state.project.depotPoint;
    changed();
    renderDepotStatus();
    if (routeMap) redraw(null, false);
    if (state.project.depotAddr.via.trim()) return;
    try {
      const a = await addressOf(round.depot);
      if (a && !state.project.depotAddr.via.trim()) {
        state.project.depotAddr = a;
        state.project.depot = C.addressText(a);
        renderProjectFields();
        changed();
        toast('Ho scritto l\'indirizzo del punto: controllalo.');
      }
    } catch (e) { /* the point is enough */ }
  }

  async function pickDepotOnMap() {
    const card = $('map-card');
    card.open = true;  // its "toggle" shows the stops already found
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { await ensureMap(); } catch (e) { $('route-status').textContent = 'La mappa si vede solo con internet.'; return; }
    round.placing = 'depot';
    renderStopList();
    if (round.depot) routeMap.setView([round.depot.lat, round.depot.lon], 16);
    else if (state.project.depotAddr.comune.trim()) {   // the map opens on the office's town
      try {
        const g = await locate({ queries: [state.project.depotAddr.comune.trim() + ', Italia'] });
        if (g && round.placing === 'depot') routeMap.setView([g.lat, g.lon], 15);
      } catch (e) { /* the map stays where it is */ }
    }
    $('route-status').textContent = depotTapText();
  }

  function useMyPosition() {
    const el = $('depot-status');
    if (!navigator.geolocation) { el.textContent = 'Questo dispositivo non dà la posizione: scegli il punto sulla mappa.'; return; }
    el.className = 'muted';
    el.textContent = 'Chiedo la posizione al dispositivo…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      setDepotPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps');
      toast('Centro messo dove sei adesso. Se non eri lì, trascinalo sulla mappa.');
    }, function () {
      el.className = 'bad';
      el.textContent = 'Posizione non disponibile (permesso negato o GPS spento): scegli il punto sulla mappa.';
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  }

  function renderStopList() {
    const ol = $('route-stops');
    ol.textContent = '';
    round.stops.forEach(function (s, i) {
      const g = s.point;
      // a point found long ago far from the office (before the town check): to be looked at
      const far = g && g.found !== 'mano' && round.depot ? C.airKm(g, round.depot) : 0;
      const how = far > 15 ? 'lontana dall\'ufficio (' + kmText(far) + '): controllala'
        : g ? ({ civico: 'trovata con il civico', via: 'trovata la via', mano: 'messa a mano' })[g.found] || 'trovata'
          : (s.asked ? 'non trovata' : 'da cercare');
      const placing = round.placing === s;
      ol.append(h('li', { class: far > 15 ? 'bad' : (g ? '' : (s.asked ? 'bad' : 'muted')) },
        h('button', { type: 'button', class: 'link', onclick: function () {
          if (g && routeMap) routeMap.setView([g.lat, g.lon], 17);
          goToLine(s.line);
        } }, (i + 1) + '. ' + s.queries[0]), ' · ' + how + ' ',
        h('button', { type: 'button', class: 'pin-btn' + (placing ? ' on' : ''), onclick: function () {
          round.placing = placing ? null : s;
          renderStopList();
          $('route-status').textContent = round.placing ? 'Tocca sulla mappa il punto giusto di «' + s.queries[0] + '».' : '';
        } }, placing ? 'tocca la mappa…' : (g ? '📍 sposta' : '📍 mettila sulla mappa'))));
    });
  }

  async function ensureMap() {
    const L = await loadLeaflet();
    if (!routeMap) {
      routeMap = L.map($('route-map'), { zoomControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(routeMap);
      routeMap.setView([45.46, 9.19], 10);
      // a stop chosen in the list (or the office) goes where the map is tapped
      routeMap.on('click', function (e) {
        if (!round.placing) return;
        if (round.placing === 'depot') setDepotPoint(e.latlng, 'mano');
        else setPoint(round.placing, e.latlng);
        round.placing = null;
        renderStopList();
      });
    }
    if (!routeLayer) routeLayer = L.layerGroup().addTo(routeMap);
    setTimeout(function () { routeMap.invalidateSize(); }, 50);
    return L;
  }

  // A point corrected by hand: saved for that street and number, used from now on (round, optimization).
  function setPoint(stop, latlng) {
    state.project.pins[stop.pin] = { lat: latlng.lat, lon: latlng.lng };
    changed();
    round.stops.forEach(function (s) { s.point = knownPoint(s); });
    round.depot = depotPoint();
    redraw(null, false);
    renderStopList();
    $('route-status').textContent = 'Punto corretto e salvato. Ricalcola il giro o l\'ottimizzazione per i chilometri.';
  }

  function redraw(line, fit, better) {
    loadLeaflet().then(function (L) {
      routeLayer.clearLayers();
      const bounds = [];
      if (line && line.length > 1) L.polyline(line, { color: '#2c6db3', weight: 4, opacity: 0.75 }).addTo(routeLayer);
      if (better && better.length > 1) L.polyline(better, { color: '#2e7d32', weight: 5, opacity: 0.85, dashArray: '8 6' }).addTo(routeLayer);
      if (round.depot) {
        L.marker([round.depot.lat, round.depot.lon], { draggable: true,
          icon: L.divIcon({ className: 'stop-pin depot', html: 'U', iconSize: [24, 24] }) })
          .bindTooltip((state.project.depotName || 'Ufficio di partenza') + ' (trascinalo per correggerlo)')
          .on('dragend', function (e) { setDepotPoint(e.target.getLatLng(), 'mano'); })
          .addTo(routeLayer);
        bounds.push([round.depot.lat, round.depot.lon]);
      }
      round.stops.forEach(function (s, i) {
        if (!s.point) return;
        const html = '<span style="background:#' + C.colorOf(state.project, s.key) + ';color:#' + C.textColorOf(state.project, s.key) + '">' + (i + 1) + '</span>';
        L.marker([s.point.lat, s.point.lon], { draggable: true, icon: L.divIcon({ className: 'stop-pin', html: html, iconSize: [26, 20] }) })
          .bindTooltip((i + 1) + '. ' + s.queries[0] + ' (trascinala per correggerla)')
          .on('dragend', function (e) { setPoint(s, e.target.getLatLng()); })
          .addTo(routeLayer);
        bounds.push([s.point.lat, s.point.lon]);
      });
      if (fit !== false && bounds.length) routeMap.fitBounds(bounds, { padding: [20, 20] });
    });
  }

  function loadStops() {
    round.stops = C.routeStops(state.project, state.current);
    let moved = false;
    round.stops.forEach(function (s) {
      // a point put right by hand before v0.39.0 (kept under the text asked to the map): now by street and number
      const old = s.queries.map(function (q) { return state.project.geo[q]; }).find(function (g) { return g && g.found === 'mano'; });
      if (old && !state.project.pins[s.pin]) { state.project.pins[s.pin] = { lat: old.lat, lon: old.lon }; moved = true; }
      s.point = knownPoint(s);
      s.asked = s.queries.every(function (q) { return state.project.geo[q]; });
    });
    if (moved) changed();
    round.depot = depotPoint();
    if (round.placing !== 'depot') round.placing = null; // the stops are new objects; waiting for the office's point stays
  }

  // Shows on the map the points already found, without asking anything on the internet.
  async function showKnownRound() {
    const card = $('map-card');
    if (!card || !card.open) return;
    $('map-title').textContent = 'Cartina del giro' + (sz().name ? ' della ' + sz().name : '');
    loadStops();
    renderStopList();
    renderOptimizeUndo();
    const found = round.stops.filter(function (s) { return s.point; }).length;
    $('route-status').textContent = round.stops.length ? found + ' tappe su ' + round.stops.length + ' già sulla mappa.' : 'Scrivi prima il giro.';
    if (round.placing === 'depot') $('route-status').textContent = depotTapText();
    try {
      await ensureMap();
      redraw(null);
    } catch (e) {
      $('route-status').textContent = 'La mappa si vede solo con internet.';
    }
  }

  // Finds on the map the office and every stop not found yet (one per second, OpenStreetMap's rule).
  async function locateAll(k) {
    const status = $('route-status');
    loadStops();
    if (depotQueries().length && !round.depot) {
      status.textContent = 'Cerco ' + depotWord() + '…';
      round.depot = await locate({ queries: depotQueries(), town: state.project.depotAddr.comune.trim() });
      renderDepotStatus();
    }
    for (let i = 0; i < round.stops.length; i++) {
      if (state.current !== k) return false; // another sub-zone was opened
      const s = round.stops[i];
      if (!s.point) {
        status.textContent = 'Cerco ' + (i + 1) + ' di ' + round.stops.length + ': ' + s.queries[0];
        s.point = await locate(s);
      }
      s.asked = true;
      if (i % 5 === 0 || i === round.stops.length - 1) renderStopList();
    }
    renderStopList();
    return true;
  }

  const kmText = function (km) { return km.toFixed(1).replace('.', ',') + ' km'; };

  async function calcRound() {
    if (routeBusy) return;
    routeBusy = true;
    const status = $('route-status');
    const total = $('route-total');
    const k = state.current;
    try {
      if (!C.routeStops(state.project, k).length) { status.textContent = 'Scrivi prima il giro.'; return; }
      await ensureMap();
      if (!(await locateAll(k))) return;
      const points = round.stops.filter(function (s) { return s.point; }).map(function (s) { return s.point; });
      if (round.depot) { points.unshift(round.depot); points.push(round.depot); }
      status.textContent = 'Calcolo il percorso…';
      const r = await roadRoute(points);
      round.line = r.line;   // kept, to compare it with the shortest one
      redraw(r.line);
      const found = round.stops.filter(function (s) { return s.point; }).length;
      total.textContent = 'Giro' + (sz().name ? ' della ' + sz().name : '') + ': ' + kmText(r.km) +
        (r.onRoads ? ' su strada, circa ' + Math.round(r.minutes) + ' minuti di guida senza le fermate' : ' in linea d\'aria (il calcolo su strada non ha risposto)') +
        (round.depot ? ', partendo e tornando ' + toDepot() : ', senza l\'ufficio (scrivilo in alto)') + '. Tappe sulla mappa: ' + found + ' su ' + round.stops.length + '.';
      status.textContent = found < round.stops.length
        ? 'Le tappe in rosso non sono state trovate: con «📍 mettila sulla mappa» le metti tu.'
        : 'Fatto. Se una tappa è nel posto sbagliato, trascinala dove va.';
      changed();
    } catch (e) {
      status.textContent = 'Non riesco a calcolare il giro: ' + e.message + '. Serve internet.';
    } finally {
      routeBusy = false;
    }
  }

  // Road distances (metres) between every pair of points, free OSRM service; straight line x 1.3 if it does not answer.
  async function distanceMatrix(points) {
    if (points.length <= 100) {
      try {
        const coords = points.map(function (x) { return x.lon.toFixed(6) + ',' + x.lat.toFixed(6); }).join(';');
        const res = await fetch('https://router.project-osrm.org/table/v1/driving/' + coords + '?annotations=distance');
        const j = await res.json();
        if (res.ok && j.code === 'Ok' && j.distances) {
          return { onRoads: true, dist: j.distances.map(function (row, a) {
            return row.map(function (d, b) { return d === null ? C.airKm(points[a], points[b]) * 1300 : d; });
          }) };
        }
      } catch (e) { /* below: straight lines */ }
    }
    return { onRoads: false, dist: points.map(function (a) { return points.map(function (b) { return C.airKm(a, b) * 1300; }); }) };
  }

  // "Ottimizzazione gita": the order of the streets with the fewest kilometres, from the office and back.
  async function optimizeRound() {
    if (routeBusy) return;
    routeBusy = true;
    const status = $('route-status');
    const box = $('optimize-result');
    const k = state.current;
    box.textContent = '';
    try {
      if (!depotQueries().length && !state.project.depotPoint) {
        status.textContent = 'Scrivi prima in alto il centro di partenza (l\'ho aperto), o mettilo sulla mappa: il giro parte e torna lì.';
        $('depot-fold').open = true;
        return;
      }
      if (!C.routeStops(state.project, k).length) { status.textContent = 'Scrivi prima il giro.'; return; }
      await ensureMap();
      if (!(await locateAll(k))) return;
      if (!round.depot) { status.textContent = 'Non trovo ' + depotWord() + ' sulla mappa: in alto usa «Scegli sulla mappa» o «Usa la mia posizione».'; return; }
      const missing = round.stops.filter(function (s) { return !s.point; });
      if (missing.length) {
        status.textContent = 'Prima metti sulla mappa le tappe in rosso (' + missing.length + '): con «📍 mettila sulla mappa».';
        return;
      }
      status.textContent = 'Calcolo le distanze fra tutte le tappe…';
      // stops at the same point (pieces of the same street) are asked once: up to 100 points the distances are on roads
      const same = function (a, b) { return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6; };
      const places = [round.depot];
      const placeOf = round.stops.map(function (s) {
        let k = places.findIndex(function (q) { return same(q, s.point); });
        if (k < 0) { places.push(s.point); k = places.length - 1; }
        return k;
      });
      const pm = await distanceMatrix(places);
      const idx = [0].concat(placeOf);
      const m = { onRoads: pm.onRoads, dist: idx.map(function (a) { return idx.map(function (b) { return pm.dist[a][b]; }); }) };
      const now = round.stops.map(function (_, i) { return i + 1; });
      status.textContent = 'Cerco l\'ordine migliore…';
      await pause(30);
      const best = C.optimizeOrder(m.dist);
      const before = C.tourCost(m.dist, now) / 1000, after = C.tourCost(m.dist, best) / 1000;
      const order = best.map(function (x) { return x - 1; });
      const line = await roadRoute([round.depot].concat(order.map(function (i) { return round.stops[i].point; }), [round.depot]));
      redraw(round.line || null, true, line.line);
      const saved = before - after;
      status.textContent = m.onRoads ? 'Fatto, con le distanze su strada.' : 'Fatto, con le distanze in linea d\'aria (il calcolo su strada non ha risposto).';
      // only to know (Garadron, 23 November 2026): the round of the frame does not change
      const list = h('ol', { class: 'small better-order' });
      order.forEach(function (i) { list.append(h('li', null, round.stops[i].queries[0])); });
      box.append(
        h('p', null, h('b', null, 'Gita di adesso: ' + kmText(before) + ' · Gita più corta: ' + kmText(after)),
          saved > 0.05 ? ' (' + kmText(saved) + ' in meno, −' + Math.round(saved / before * 100) + '%)' : ' (la gita di adesso è già la più corta)'),
        h('p', { class: 'small muted' }, 'Solo per sapere: il giro del casello non cambia. Sulla mappa la gita più corta è la linea ' +
          'verde tratteggiata, partendo e tornando ' + toDepot() + '.'),
        saved > 0.05 ? h('details', null, h('summary', null, 'L\'ordine della gita più corta (' + order.length + ' tappe)'), list) : null);
    } catch (e) {
      status.textContent = 'Non riesco a ottimizzare: ' + e.message + '. Serve internet.';
    } finally {
      routeBusy = false;
    }
  }

  function renderOptimizeUndo() {
    const s = sz();
    const box = $('optimize-undo');
    box.textContent = '';
    if (!s.routeBefore) return;
    box.append(h('button', { type: 'button', onclick: function () {
      if (!confirm('Rimetto il giro com\'era prima dell\'ultima ottimizzazione?')) return;
      const now = s.route;
      s.route = s.routeBefore;
      s.routeBefore = now;
      changed(); renderSubzone(); refreshSide(); showKnownRound();
    } }, '↩ Torna al giro di prima'));
  }

  // ------------------------------------------------------------ reading strips from photos (free, on the device)

  const F = window.CasellinoFoto;
  /*
   * The photos chosen and, for each, its rectangle on the strip (parts of the photo, 0..1: found by
   * itself, changed by hand), its angle and whether it was read; what was read so far, to leave out
   * the piece two photos one after the other have in common.
   */
  const photo = { files: [], index: 0, image: null, rects: [], angles: [], done: [], kind: {}, items: [], sheet: [], view: null, worker: null, busy: false, stop: false,
    first: '', zone: '', signAt: 0, signWait: null };
  let tesseractReady = null;

  function loadTesseract() {
    if (tesseractReady) return tesseractReady;
    tesseractReady = new Promise(function (resolve, reject) {
      const js = h('script', { src: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js' });
      js.onload = function () { resolve(window.Tesseract); };
      js.onerror = function () { tesseractReady = null; reject(new Error('il lettore di foto non si scarica (serve internet la prima volta)')); };
      document.head.append(js);
    });
    return tesseractReady;
  }

  async function ocrWorker() {
    if (photo.worker) return photo.worker;
    const T = await loadTesseract();
    $('foto-status').textContent = 'Preparo il lettore (la prima volta scarica qualche MB)…';
    photo.worker = await T.createWorker('ita', 1);
    return photo.worker;
  }

  function imageToCanvas(w, hgt) {
    const c = document.createElement('canvas');
    c.width = w; c.height = hgt;
    return c;
  }

  // A photo turned by its angle, at a given scale, on a canvas.
  function turned(img, angle, scale) {
    const a = (angle || 0) * Math.PI / 180;
    const w = img.naturalWidth * scale, hh = img.naturalHeight * scale;
    const W = Math.ceil(Math.abs(w * Math.cos(a)) + Math.abs(hh * Math.sin(a)));
    const H = Math.ceil(Math.abs(w * Math.sin(a)) + Math.abs(hh * Math.cos(a)));
    const c = imageToCanvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2);
    g.rotate(a);
    g.drawImage(img, -w / 2, -hh / 2, w, hh);
    return c;
  }

  // A canvas made smaller by halves, then to `width`: in one big step thin lines (the border of a letter) break up.
  function halved(c, width) {
    while (c.width / 2 >= width) {
      const half = imageToCanvas(Math.round(c.width / 2), Math.round(c.height / 2));
      half.getContext('2d').drawImage(c, 0, 0, half.width, half.height);
      c = half;
    }
    if (c.width <= width) return c;
    const out = imageToCanvas(width, Math.round(c.height * width / c.width));
    out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
    return out;
  }

  function loadImage(i) {
    return new Promise(function (ok, ko) {
      const img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ko(new Error('la foto ' + (i + 1) + ' non si apre')); };
      img.src = URL.createObjectURL(photo.files[i]);
    });
  }

  // The strip of a photo, found by itself on a small copy (parts of the photo, 0..1), or null.
  function autoRect(img) {
    const w = 600, hgt = Math.max(1, Math.round(600 * img.naturalHeight / img.naturalWidth));
    const c = imageToCanvas(w, hgt);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, w, hgt);
    const d = g.getImageData(0, 0, w, hgt);
    try { return F.findStrip({ width: w, height: hgt, data: d.data }); } catch (e) { return null; }
  }

  // The rectangle of the photo shown, in points of the canvas; its 8 handles (corners and sides).
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  function rectPx() {
    const r = photo.rects[photo.index], c = $('foto-canvas');
    return r ? { x0: r.x0 * c.width, y0: r.y0 * c.height, x1: r.x1 * c.width, y1: r.y1 * c.height } : null;
  }
  function handlePoints(r) {
    const mx = (r.x0 + r.x1) / 2, my = (r.y0 + r.y1) / 2;
    return { nw: [r.x0, r.y0], n: [mx, r.y0], ne: [r.x1, r.y0], e: [r.x1, my], se: [r.x1, r.y1], s: [mx, r.y1], sw: [r.x0, r.y1], w: [r.x0, my] };
  }
  // canvas points for one point on the screen (the canvas is shown smaller on a phone)
  function pointsPerScreen() {
    const c = $('foto-canvas');
    const shown = c.getBoundingClientRect().width;
    return shown ? c.width / shown : 1;
  }

  function drawPhoto() {
    const stage = $('foto-canvas');
    if (!photo.image) { stage.width = stage.height = 0; return; }
    const box = $('foto-stage');
    const scale = Math.min(1, (box.clientWidth || 800) / photo.image.naturalWidth);
    const c = turned(photo.image, photo.angles[photo.index], scale);
    stage.width = c.width; stage.height = c.height;
    const g = stage.getContext('2d');
    g.drawImage(c, 0, 0);
    photo.view = { scale: scale };
    const r = rectPx();
    const k = pointsPerScreen();
    if (r) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, stage.width, r.y0);
      g.fillRect(0, r.y1, stage.width, stage.height - r.y1);
      g.fillRect(0, r.y0, r.x0, r.y1 - r.y0);
      g.fillRect(r.x1, r.y0, stage.width - r.x1, r.y1 - r.y0);
      g.strokeStyle = '#d93025'; g.lineWidth = 2 * k;
      g.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      // the handles to make it bigger or smaller
      const hp = handlePoints(r), s = 11 * k;
      HANDLES.forEach(function (n) {
        g.fillStyle = '#fff'; g.fillRect(hp[n][0] - s / 2, hp[n][1] - s / 2, s, s);
        g.strokeStyle = '#d93025'; g.lineWidth = 2 * k; g.strokeRect(hp[n][0] - s / 2, hp[n][1] - s / 2, s, s);
      });
    } else {
      // no rectangle: say what to do, on the photo itself
      const fs = Math.max(13, Math.round(stage.width / 28));
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, 0, stage.width, fs * 2.2);
      g.fillStyle = '#fff'; g.font = 'bold ' + fs + 'px Arial'; g.textBaseline = 'middle';
      g.fillText('Trascina un rettangolo intorno a una sola striscia', fs * 0.6, fs * 1.1, stage.width - fs * 1.2);
    }
    $('foto-count').textContent = 'Foto ' + (photo.index + 1) + ' di ' + photo.files.length;
    const kind = { itinerario: '📋 itinerario', mobile: '🖼 tutto il mobile' }[photo.kind[photo.index]];
    $('foto-state').textContent = kind ||
      (photo.done[photo.index] ? '✓ letta' : (photo.rects[photo.index] ? 'striscia trovata: controlla il riquadro' : ''));
  }

  // Shows photo i (waits for it), with its rectangle found by itself the first time.
  async function showPhoto(i) {
    photo.index = Math.max(0, i);
    if (!photo.busy) {   // the arrows only where there is a photo to go to
      $('foto-prev').disabled = photo.index <= 0;
      $('foto-next').disabled = photo.index >= photo.files.length - 1;
    }
    if (photo.index >= photo.files.length) {
      photo.image = null;
      drawPhoto();
      $('foto-count').textContent = photo.files.length ? 'Foto finite: controlla il testo e premi «Aggiungi al giro».' : 'Scegli le foto.';
      $('foto-state').textContent = '';
      return;
    }
    const at = photo.index;
    $('foto-rot').value = String(photo.angles[at] || 0);
    const img = await loadImage(at);
    if (photo.index !== at) return;   // another photo was asked meanwhile
    photo.image = img;
    if (photo.rects[at] === undefined) photo.rects[at] = autoRect(img);
    drawPhoto();
  }

  function stagePoint(e) {
    const c = $('foto-canvas');
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height };
  }

  /*
   * Reads photo i: its rectangle (or the strip found by itself; the whole photo if none). With no house
   * numbers, it may be the photo of the sign of a sub-zone ("2A"): then { zone }.
   */
  async function readOne(i, progress) {
    const w = await ocrWorker();
    const img = i === photo.index && photo.image ? photo.image : await loadImage(i);
    if (photo.rects[i] === undefined) photo.rects[i] = autoRect(img);
    const full = turned(img, photo.angles[i], 1);
    const r = photo.rects[i] || { x0: 0, y0: 0, x1: 1, y1: 1 };
    const x0 = Math.max(0, Math.round(r.x0 * full.width)), y0 = Math.max(0, Math.round(r.y0 * full.height));
    const cw = Math.max(1, Math.min(full.width - x0, Math.round((r.x1 - r.x0) * full.width)));
    const ch = Math.max(1, Math.min(full.height - y0, Math.round((r.y1 - r.y0) * full.height)));
    const data = full.getContext('2d').getImageData(x0, y0, cw, ch);   // at the size of the photo: each pigeonhole is enlarged in foto.js
    // test mode (localStorage casellino.prova = 1): the piece given to the reader is kept, to look at it
    if (testMode()) {
      const keep = imageToCanvas(cw, ch);
      keep.getContext('2d').putImageData(data, 0, 0);
      (window.CasellinoProva = window.CasellinoProva || []).push({ foto: i + 1, rect: r, ritaglio: keep.toDataURL('image/png') });
    }
    const toCanvas = function (band) {
      const c = imageToCanvas(band.width, band.height);
      c.getContext('2d').putImageData(new ImageData(band.data, band.width, band.height), 0, 0);
      return c;
    };
    // the reading itself is in foto.js (straightened, pigeonhole by pigeonhole); here only Tesseract and the progress
    const res = await F.readStrip({ width: data.width, height: data.height, data: data.data }, async function (band, mode, whitelist) {
      await w.setParameters({ tessedit_pageseg_mode: mode, tessedit_char_whitelist: whitelist });
      return (await w.recognize(toCanvas(band))).data;
    }, progress);
    const unsure = res.cells.filter(function (c) { return c.unsure; }).length;
    if (res.cells.length >= 5 && unsure < res.cells.length * 0.6) return res;
    // few numbers, or almost all uncertain: maybe the photo of the sign of a sub-zone ("2A", written big)
    const seen = await wordsOf(i);
    const zone = await signName(i, seen);
    if (!zone || zone === photo.zone) return res;   // the same sign again, above a strip: not a new sub-zone
    keepSheet(seen.words);   // the itinerary may be next to the sign
    return { cells: [], phrases: [], zone: zone };
  }

  // What photo i read goes at the end of the text: without the piece the photo before showed too.
  function addReading(i, res) {
    const out = $('foto-result');
    const add = function (text) { out.value += (out.value && !/\n$/.test(out.value) ? '\n' : '') + text + '\n'; out.scrollTop = out.scrollHeight; };
    const known = knownStreets();
    const items = F.routeItems(res.cells, res.phrases).map(function (it) { return { street: F.snapStreet(it.street, known), tok: it.tok }; });
    const repeat = F.repeatsEarlier(photo.items, items);
    const fresh = F.withoutOverlap(photo.items, items);
    const again = F.repeatedItems(photo.items, fresh);
    photo.items = photo.items.concat(fresh);
    const same = items.length - fresh.length;
    add('# foto ' + (i + 1) + (repeat ? ': questa striscia c\'era già in una foto prima, non la riscrivo'
      : ' (letta in automatico: da controllare)' + (same ? ' · ' + same + (same === 1 ? ' casella uguale' : ' caselle uguali') + ' alla foto prima, non ripetute' : '')));
    // two numbers in one pigeonhole follow the way of the street (read "7/5" between 4 and 6: it is 5/7)
    if (fresh.length) add(C.fixPairOrder(F.itemLines(fresh).join('\n'), sz().town).text);
    // the same number further on: maybe the same pigeonhole seen twice, maybe a number read wrong
    if (again.length) {
      add('# attenzione: ' + again.map(function (it) { return it.street + ' ' + it.tok; }).join(', ') + (again.length === 1 ? ' c\'era' : ' c\'erano') +
        ' già in una foto prima: se è la stessa casella, cancellalo qui sopra');
    }
  }

  // Test mode (localStorage casellino.prova = 1): what was given to the reader is kept, to look at it.
  function testMode() {
    try { return localStorage.getItem('casellino.prova') === '1'; } catch (e) { return false; }
  }

  // The words of photo i, at most `wide` points wide (2600: the writing on the sheet is small).
  async function wordsOf(i, wide) {
    const w = await ocrWorker();
    const img = i === photo.index && photo.image ? photo.image : await loadImage(i);
    const small = turned(img, photo.angles[i] || 0, Math.min(1, (wide || 2600) / img.naturalWidth));
    await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' });
    return { words: (await w.recognize(small)).data.words, height: small.height };
  }
  // The name on the sign ("2A"); letters very big are read better on a smaller copy of the photo.
  async function signName(i, seen) {
    const name = F.zoneSign(seen.words, state.project.subzones.map(function (s) { return s.name; }), seen.height * 0.06);
    if (name) return name;
    // on the whole photo the reader misses big letters: they are found, cut out and read by themselves
    const img = i === photo.index && photo.image ? photo.image : await loadImage(i);
    const small = halved(turned(img, photo.angles[i] || 0, 1), 1000);
    const boxes = F.signBoxes(small.getContext('2d').getImageData(0, 0, small.width, small.height));
    if (testMode()) (window.CasellinoSegni = window.CasellinoSegni || []).push({ foto: i + 1, piccola: small.toDataURL('image/png'), riquadri: boxes });
    if (!boxes.length) return '';
    const big = turned(img, photo.angles[i] || 0, Math.min(1, 2600 / img.naturalWidth));
    const w = await ocrWorker();
    for (let b = 0; b < boxes.length; b++) {
      const r = boxes[b];
      const x0 = Math.round(r.x0 * big.width), y0 = Math.round(r.y0 * big.height);
      const cw = Math.max(1, Math.round((r.x1 - r.x0) * big.width)), ch = Math.max(1, Math.round((r.y1 - r.y0) * big.height));
      for (const tall of [140, 80]) {
        const k = Math.min(1, tall / ch);
        const cut = imageToCanvas(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)));
        const g = cut.getContext('2d');
        g.drawImage(big, x0, y0, cw, ch, 0, 0, cut.width, cut.height);
        const ink = F.signInk(g.getImageData(0, 0, cut.width, cut.height));
        g.putImageData(new ImageData(ink.data, ink.width, ink.height), 0, 0);
        for (const mode of ['11', '7', '8']) {
          await w.setParameters({ tessedit_pageseg_mode: mode, tessedit_char_whitelist: '0123456789ABCDEFGHILMNOPQRSTUVZ' });
          const text = (await w.recognize(cut)).data.text;
          if (testMode()) (window.CasellinoSegni = window.CasellinoSegni || []).push({ foto: i + 1, box: r, alta: tall, modo: mode, testo: text, ritaglio: cut.toDataURL('image/png') });
          const found = F.signText(text, r.y1 - r.y0 >= 0.15);   // big letters: a photo of the sign itself
          if (found) return found;
        }
      }
    }
    return '';
  }
  function keepSheet(words) {
    F.sheetStreets(words).forEach(function (n) { if (photo.sheet.indexOf(n) < 0) photo.sheet.push(n); });
  }
  // The streets already known: of the itineraries photographed, of the work, of the official lists.
  function knownStreets() {
    const names = {};
    photo.sheet.forEach(function (n) { names[n] = true; });
    state.project.subzones.forEach(function (s) {
      C.parseRoute(s.route, s.town).items.forEach(function (it) { if (it.street) names[String(it.street).toUpperCase()] = true; });
    });
    Object.keys(state.project.streetLists || {}).forEach(function (t) { (state.project.streetLists[t] || []).forEach(function (n) { names[String(n).toUpperCase()] = true; }); });
    return Object.keys(names);
  }
  const clearWords = function (words) { return words.filter(function (x) { return x.confidence > 70 && /[A-Za-zÀ-ù]{3}/.test(x.text); }).length; };
  const SHEET_OK = 'L\'itinerario si legge bene. ';
  const SHEET_POOR = 'L\'itinerario si legge poco: se puoi, rifai la foto più vicina e dritta, con tutto il foglio. ';

  /*
   * The photo of the sign of a sub-zone ("2A"): the first one, or one in the middle (another sub-zone).
   * The person looks at it and confirms the name. The itinerary (the sheet with the list of the streets)
   * is in the same photo or, ticked, in the one after it, which then is not read as a strip.
   */
  function showSignPanel(i, first) {
    photo.signAt = i;
    $('foto-first-title').textContent = 'Foto ' + (i + 1) + (first ? ': il cartello della sottozona.' : ': il cartello di un\'altra sottozona.');
    $('foto-whole-row').hidden = !first;
    $('foto-first-whole').disabled = photo.files.length < 2;
    $('foto-first-name').value = '';
    $('foto-first-msg').textContent = '';
    $('foto-sheet-msg').textContent = '';
    $('foto-first-sheet').checked = false;
    $('foto-first-sheet').disabled = i + 1 >= photo.files.length;
    $('foto-first-next').textContent = 'la foto ' + (i + 2);
    $('foto-first-redo').hidden = !first;
    $('foto-first-skip').textContent = first ? 'non ho questa foto' : 'non è un cartello';
    $('foto-first').hidden = false;
  }

  // The first photos: the whole mobile (ticked, or found: no name on photo 1 but on photo 2), then the sign.
  async function checkFirst(guess) {
    let at = $('foto-first-whole').checked && photo.files.length > 1 ? 1 : 0;
    showSignPanel(at, true);
    const msg = $('foto-first-msg');
    msg.textContent = 'La controllo…';
    try {
      let seen = await wordsOf(at);
      keepSheet(seen.words);
      let name = await signName(at, seen);
      if (!name && !at && guess && photo.files.length > 2) {
        const next = await wordsOf(1);
        const there = await signName(1, next);
        if (there) { $('foto-first-whole').checked = true; at = 1; seen = next; name = there; keepSheet(next.words); showSignPanel(1, true); await showPhoto(1); }
      }
      if (at !== photo.signAt) return;   // changed meanwhile
      $('foto-first-name').value = name;
      const sheet = clearWords(seen.words) >= 15 ? SHEET_OK
        : (photo.files.length > at + 1 ? 'Qui l\'itinerario non si legge: se l\'hai fotografato a parte, spunta la casella qui sotto. ' : SHEET_POOR);
      msg.textContent = (at ? 'La foto 1 è tutto il mobile. ' : '') + (name ? 'Sul cartello leggo «' + name + '». ' : 'Non leggo il nome sul cartello: scrivilo tu (per esempio 2A). ') + sheet + 'Guarda la foto e conferma.';
    } catch (e) {
      msg.textContent = 'Non riesco a controllarla (' + e.message + '): scrivi tu la sottozona e conferma.';
    }
  }

  // A sign found in the middle of the photos: the reading waits until the person confirms it.
  function askSign(i, name) {
    showSignPanel(i, false);
    $('foto-first-name').value = name;
    $('foto-first-msg').textContent = 'Sul cartello leggo «' + name + '». Guarda la foto e conferma; se l\'itinerario è nella foto dopo, spunta la casella.';
    $('foto-status').textContent = 'Aspetto la conferma del cartello (foto ' + (i + 1) + ').';
    return new Promise(function (resolve) { photo.signWait = resolve; });
  }
  function answerSign(ok) {
    const go = photo.signWait;
    photo.signWait = null;
    if (go) go(ok);
    return !!go;
  }

  // Ticked: the photo after the sign is shown, and checked whether the itinerary in it can be read.
  async function checkSheet() {
    const i = photo.signAt, box = $('foto-sheet-msg');
    if (!$('foto-first-sheet').checked) { box.textContent = ''; await showPhoto(i); return; }
    await showPhoto(i + 1);
    $('foto-state').textContent = '📋 itinerario?';
    box.textContent = 'La controllo…';
    try {
      const seen = await wordsOf(i + 1);
      keepSheet(seen.words);
      box.textContent = clearWords(seen.words) >= 15 ? SHEET_OK : SHEET_POOR;
    } catch (e) { box.textContent = ''; }
  }

  // The sub-zone chosen in the list at the bottom: one of the work, or a new one with that name.
  function setTarget(name) {
    const sel = $('foto-target');
    let opt = Array.prototype.find.call(sel.options, function (o) { return C.norm(o.dataset.name || o.textContent) === C.norm(name); });
    if (!opt) { opt = h('option', { value: 'nuova:' + name, 'data-name': name }, name + ' (nuova)'); sel.append(opt); }
    sel.value = opt.value;
  }

  // The sign confirmed: its line in the text and the sub-zone chosen; the itinerary photo is not read.
  function confirmFirst() {
    const name = $('foto-first-name').value.toUpperCase().replace(/\s+/g, '');
    if (!name) { $('foto-first-msg').textContent = 'Scrivi la sottozona (per esempio 2A), poi «Va bene».'; return; }
    const i = photo.signAt;
    const first = !$('foto-whole-row').hidden;
    const whole = first && i === 1;
    const sheet = $('foto-first-sheet').checked && i + 1 < photo.files.length;
    const lines = (whole ? '# foto 1: tutto il mobile (non si legge)\n' : '') + '# sottozona ' + name + ' (cartello nella foto ' + (i + 1) + ')\n' +
      (sheet ? '# foto ' + (i + 2) + ': itinerario della ' + name + ' (non è una striscia: non si legge)\n' : '');
    const out = $('foto-result');
    if (first) out.value = lines + out.value.replace(/^(# foto 1: tutto il mobile.*\n)?# sottozona .*\(cartello nella foto [12]\)\n(# foto [23]: itinerario.*\n)?/, '');
    else out.value += (out.value && !/\n$/.test(out.value) ? '\n' : '') + lines;
    photo.done[i] = true;
    if (whole) { photo.done[0] = true; photo.kind[0] = 'mobile'; }
    if (sheet) { photo.done[i + 1] = true; photo.kind[i + 1] = 'itinerario'; }
    photo.items = [];   // a new sub-zone: nothing in common with the photos before
    photo.zone = name;
    if (first) photo.first = name;
    setTarget(name);
    $('foto-first').hidden = true;
    if (answerSign(true)) return;   // the reading goes on by itself
    $('foto-status').textContent = 'Cartello confermato: sottozona ' + name + (sheet ? ', itinerario nella foto ' + (i + 2) : '') + '. Ora «📚 Leggi tutte le foto».';
    showPhoto(i + (sheet ? 2 : 1));
  }

  function setBusy(on) {
    $('foto-all').textContent = on ? '⏹ Ferma' : '📚 Leggi tutte le foto';
    ['foto-read', 'foto-files'].forEach(function (id) { $(id).disabled = on; });
    $('foto-prev').disabled = on || photo.index <= 0;
    $('foto-next').disabled = on || photo.index >= photo.files.length - 1;
  }
  const NOTHING = 'Non ho trovato civici in questa foto. Allarga o stringi il riquadro rosso sulla sola striscia (dal bordo sopra i numeri al bordo sotto le vie), raddrizzala se è storta, e premi «Leggi solo questa».';

  async function readCurrent() {
    if (photo.busy || !photo.image) return;
    photo.busy = true; setBusy(true);
    const status = $('foto-status');
    const i = photo.index;
    try {
      const res = await readOne(i, function (k, n) { status.textContent = 'Leggo i civici: ' + (k + 1) + ' di ' + n + '…'; });
      if (res.zone) {
        photo.busy = false; setBusy(false);
        if (!(await askSign(i, res.zone))) { status.textContent = NOTHING; return; }
        status.textContent = 'Foto ' + (i + 1) + ': cartello della ' + $('foto-first-name').value.toUpperCase().trim() + '.';
        await showPhoto(i + (photo.kind[i + 1] === 'itinerario' ? 2 : 1));
        return;
      }
      if (!res.cells.length) { status.textContent = NOTHING; return; }
      addReading(i, res);
      photo.done[i] = true;
      status.textContent = res.cells.length + ' civici letti nella foto ' + (i + 1) + '.';
      photo.busy = false; setBusy(false);
      await showPhoto(i + 1);
    } catch (e) {
      status.textContent = 'Non riesco a leggere: ' + e.message;
      note('lettura foto ' + (i + 1) + ': ' + e.message);
    } finally {
      photo.busy = false; setBusy(false);
    }
  }

  // All the photos not read yet, one after the other ("Ferma" stops after the photo being read).
  async function readAll() {
    if (photo.busy) { photo.stop = true; $('foto-all').textContent = 'Mi fermo dopo questa foto…'; return; }
    if (!photo.files.length) { $('foto-status').textContent = 'Scegli prima le foto.'; return; }
    if (!$('foto-first').hidden) { $('foto-status').textContent = 'Prima conferma la prima foto (il cartello della zona), qui sopra.'; return; }
    photo.busy = true; photo.stop = false; setBusy(true);
    const status = $('foto-status');
    let read = 0;
    const empty = [];
    try {
      for (let i = 0; i < photo.files.length && !photo.stop; i++) {
        if (photo.done[i]) continue;
        await showPhoto(i);
        const res = await readOne(i, function (k, n) { status.textContent = 'Foto ' + (i + 1) + ' di ' + photo.files.length + ': civici ' + (k + 1) + ' di ' + n + '…'; });
        if (res.zone) {
          drawPhoto();
          if (await askSign(i, res.zone)) read++; else empty.push(i + 1);
          continue;
        }
        if (!res.cells.length) { empty.push(i + 1); note('foto ' + (i + 1) + ' di ' + photo.files.length + ': nessun civico letto'); continue; }
        addReading(i, res);
        photo.done[i] = true;
        read++;
        drawPhoto();
      }
      status.textContent = (photo.stop ? 'Fermato. ' : 'Fatto. ') + 'Foto lette: ' + read + '.' +
        (empty.length ? ' Senza civici: foto ' + empty.join(', ') + '. Sistema il riquadro e premi «Leggi solo questa».' : ' Controlla il testo e premi «Aggiungi al giro».');
      if (empty.length) { photo.busy = false; await showPhoto(empty[0] - 1); }
    } catch (e) {
      status.textContent = 'Non riesco a leggere: ' + e.message;
    } finally {
      photo.busy = false; photo.stop = false; setBusy(false);
    }
  }

  // The sub-zone with that name ("2A"): one of the work, the empty one of a new work, or a new one.
  function subzoneNamed(name) {
    const subs = state.project.subzones;
    let k = subs.findIndex(function (s) { return C.norm(s.name) === C.norm(name); });
    if (k < 0) k = subs.findIndex(function (s) { return !s.name.trim() && !s.route.trim(); });
    if (k >= 0) { subs[k].name = subs[k].name.trim() || name; }
    else {
      const last = subs[subs.length - 1];
      const s = C.newSubzone(name, last ? last.town : '');
      if (last) s.modules = Object.assign({}, last.modules);
      subs.push(s);
      k = subs.length - 1;
    }
    const zone = /^(\d+)[A-Z]$/i.exec(name);
    if (zone && !String(state.project.zone || '').trim()) { state.project.zone = zone[1]; renderProjectFields(); }   // "2A": zone 2
    return k;
  }

  /*
   * The phone gives the photos in the order they were chosen. If that is not the order they were taken
   * in, a button puts them in that order (not by itself: a photo taken again later may be chosen in its place).
   */
  function byTime() {
    return photo.files.slice().sort(function (a, b) { return (a.lastModified || 0) - (b.lastModified || 0); });
  }
  function offerTimeOrder() {
    const sorted = byTime();
    $('foto-sort').hidden = !sorted.some(function (f, k) { return f !== photo.files[k]; });
  }

  // ------------------------------------------------------------ the tutorial: a comic, one page at a time
  let tutPage = 0;
  let tutorialAfterAccount = false;   // a new account: the tutorial opens when the account window is closed
  const tutPages = function () { return Array.prototype.slice.call(document.querySelectorAll('#dlg-tutorial .tut-page')); };
  function showTutPage(k) {
    const pages = tutPages();
    tutPage = Math.max(0, Math.min(pages.length - 1, k));
    pages.forEach(function (p, i) { p.hidden = i !== tutPage; });
    const last = tutPage === pages.length - 1;
    $('tut-count').textContent = (tutPage + 1) + ' di ' + pages.length;
    $('tut-back').hidden = tutPage === 0;
    $('tut-skip').style.visibility = last ? 'hidden' : '';
    $('tut-next').textContent = last ? 'Ho capito ✓' : 'Continua ▶';
  }
  function openTutorial() {
    try { localStorage.setItem('casellino.tutorial', '1'); } catch (e) { /* only a convenience */ }
    showTutPage(0);
    if (!$('dlg-tutorial').open) $('dlg-tutorial').showModal();
    $('tut-next').focus();
  }
  /*
   * The preview (window.CASELLINO_ANTEPRIMA, put in by `build.py --anteprima`): its note on top and the sun / moon
   * switch, fixed on screen. The theme follows the phone; on a computer it starts light (set before the page is
   * drawn, in the preview's head). The choice made with the switch is kept on the device.
   */
  /*
   * Day and night (World Rule, 16 November 2026): at first the page follows the device; the sun / moon button fixes
   * a choice, kept on the device (read again in the page's head before it is drawn).
   */
  function wireTheme() {
    const root = document.documentElement;
    const darkSystem = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const isDark = function () { return root.dataset.theme ? root.dataset.theme === 'dark' : !!(darkSystem && darkSystem.matches); };
    const sw = $('btn-theme');
    const show = function () {
      sw.classList.toggle('dark', isDark());
      sw.setAttribute('aria-label', isDark() ? 'Modalità notte: tocca per il giorno' : 'Modalità giorno: tocca per la notte');
      sw.title = sw.getAttribute('aria-label');
    };
    sw.addEventListener('click', function () {
      const next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('casellino.tema', next); } catch (e) { /* only for this time */ }
      show();
    });
    if (darkSystem && darkSystem.addEventListener) darkSystem.addEventListener('change', show);
    show();
  }

  /*
   * Condividi (World Rule, 16 November 2026): one link, always the same. On a phone the system's share (WhatsApp,
   * e-mail…); on a computer the link is copied and its QR code shown, to frame with the phone.
   */
  const SITE_URL = 'https://garadron.github.io/casellino/';
  function share() {
    document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
    const phone = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (phone && navigator.share) {
      navigator.share({ title: 'Casellino', text: 'Casellino: scrivi il giro e stampa le strisce del casello. Gratis, anche dal telefono.', url: SITE_URL })
        .catch(function (e) { if (!e || e.name !== 'AbortError') openShare(); });
      return;
    }
    openShare();
  }
  function openShare() {
    const box = $('share-qr');
    const qr = window.qrcode(0, 'M');
    qr.addData(SITE_URL);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true, alt: 'Codice QR del link di Casellino' });
    $('share-link').value = SITE_URL;
    $('share-msg').textContent = '';
    $('dlg-share').showModal();
    copyShareLink();
  }
  function copyShareLink() {
    const done = function () { $('share-msg').textContent = '✅ Link copiato: incollalo dove vuoi (WhatsApp, email…).'; };
    const byHand = function () {
      const input = $('share-link');
      input.focus(); input.select();
      try { if (document.execCommand('copy')) return done(); } catch (e) { /* below */ }
      $('share-msg').textContent = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
        ? 'Tieni premuto il link e scegli «Copia».' : 'Il link è selezionato: copialo con Ctrl+C.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(SITE_URL).then(done, byHand);
    else byHand();
  }

  function wirePreview() {
    const preview = window.CASELLINO_ANTEPRIMA;
    if (!preview) return;
    if (preview.testo) {
      const note = h('div', { class: 'preview-note', role: 'note' }, h('p', null, preview.testo),
        h('button', { type: 'button', 'aria-label': 'Chiudi la nota', onclick: function () { note.remove(); } }, '✕'));
      document.body.prepend(note);
    }
    if (preview.logo) {  // the logo of the company the preview is for (an SVG from the private proposal folder, cleaned by hand)
      const logo = h('span', { class: 'preview-logo' });
      logo.innerHTML = preview.logo;
      document.querySelector('.brand').prepend(logo);
    }
    if (preview.termini && preview.termini.length) previewWords(preview.termini);
  }

  /*
   * The words of the company the preview is for (pairs [words, theirs], from the private termini.txt, in that
   * order: a few words first, e.g. to add an article, then the single word): they replace ours in everything the
   * page shows, now and later, with the same capital letters. What the person writes (the route text) stays as it
   * is: the program reads both words.
   */
  function previewWords(pairs) {
    const rules = pairs.map(function (p) { return [new RegExp('\\b' + p[0].replace(/ /g, '\\s+') + '\\b', 'gi'), p[1]]; });
    const sameCase = function (found, word) {
      if (found === found.toUpperCase()) return word.toUpperCase();
      return found[0] === found[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
    };
    const swap = function (text) {
      rules.forEach(function (r) { text = text.replace(r[0], function (found) { return sameCase(found, r[1]); }); });
      return text;
    };
    const skip = 'textarea, script, style';
    const fix = function (node) {
      if (node.nodeType === 3) {
        if (node.parentElement && !node.parentElement.closest(skip)) {
          const t = swap(node.nodeValue);
          if (t !== node.nodeValue) node.nodeValue = t;
        }
      } else if (node.nodeType === 1 && !node.matches(skip)) {
        ['placeholder', 'title', 'aria-label'].forEach(function (a) {
          const v = node.getAttribute(a);
          if (v && swap(v) !== v) node.setAttribute(a, swap(v));
        });
        node.childNodes.forEach(fix);
      }
    };
    fix(document.body);
    document.title = swap(document.title);
    new MutationObserver(function (changes) {
      changes.forEach(function (c) {
        if (c.type === 'childList') c.addedNodes.forEach(fix);
        else fix(c.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }

  function wireTutorial() {
    const dlg = $('dlg-tutorial');
    $('tut-next').addEventListener('click', function () { if (tutPage >= tutPages().length - 1) dlg.close(); else showTutPage(tutPage + 1); });
    $('tut-back').addEventListener('click', function () { showTutPage(tutPage - 1); });
    $('tut-skip').addEventListener('click', function () { dlg.close(); });
    $('tut-help').addEventListener('click', function () { dlg.close(); $('dlg-help').showModal(); });
    $('btn-tutorial').addEventListener('click', openTutorial);
    // a swipe turns the page too
    let from = null;
    $('tut-pages').addEventListener('pointerdown', function (e) { from = e.clientX; });
    $('tut-pages').addEventListener('pointerup', function (e) {
      if (from === null) return;
      const dx = e.clientX - from;
      from = null;
      if (Math.abs(dx) > 60) showTutPage(tutPage + (dx < 0 ? 1 : -1));
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') showTutPage(tutPage + 1);
      if (e.key === 'ArrowLeft') showTutPage(tutPage - 1);
    });
    $('dlg-account').addEventListener('close', function () {
      if (tutorialAfterAccount) { tutorialAfterAccount = false; openTutorial(); }
    });
  }

  function openPhotos() {
    $('foto-result').value = '';
    $('foto-status').textContent = '';
    Object.assign(photo, { files: [], rects: [], angles: [], done: [], kind: {}, items: [], sheet: [], zone: '', image: null });
    const sel = $('foto-target');
    sel.textContent = '';
    state.project.subzones.forEach(function (s, k) {
      sel.append(h('option', { value: String(k), selected: k === state.current, 'data-name': s.name }, s.name || 'sottozona ' + (k + 1)));
    });
    $('foto-first').hidden = true;
    photo.first = '';
    showPhoto(0);
    $('dlg-foto').showModal();
    let seen = true;
    try { seen = localStorage.getItem('casellino.tutorial') === '1'; } catch (e) { /* not shown by itself */ }
    if (!seen) openTutorial();
  }

  function wirePhotos() {
    $('foto-files').addEventListener('change', function (e) {
      Object.assign(photo, { files: Array.prototype.slice.call(e.target.files || []), rects: [], angles: [], done: [], kind: {}, items: [], sheet: [], zone: '', first: '' });
      $('foto-first-whole').checked = false;
      if (photo.files.length) { showPhoto(0); checkFirst(true); }
      offerTimeOrder();
      // kept on the device to look at later; if it is full, said (the reading goes on anyway)
      if (photo.files.length && window.indexedDB) {
        keepPhotos(photo.files).then(renderPhotoButton).catch(function (err) {
          toast('Le foto si leggono, ma non riesco a tenerle sul dispositivo' + (err && err.name === 'QuotaExceededError' ? ': lo spazio è pieno.' : '.'));
        });
      }
    });
    $('foto-rot').addEventListener('input', function (e) { photo.angles[photo.index] = +e.target.value; drawPhoto(); });
    // the red rectangle: drag a handle to make it bigger or smaller, drag inside to move it, elsewhere to draw a new one
    const stage = $('foto-canvas');
    let drag = null;
    stage.addEventListener('pointerdown', function (e) {
      if (!photo.image || photo.busy) return;
      const p = stagePoint(e), r = rectPx(), k = pointsPerScreen();
      let mode = 'new';
      if (r) {
        const hp = handlePoints(r);
        const near = HANDLES.find(function (n) { return Math.abs(p.x - hp[n][0]) < 22 * k && Math.abs(p.y - hp[n][1]) < 22 * k; });
        if (near) mode = near;
        else if (p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) mode = 'move';
      }
      drag = { mode: mode, start: p, rect0: r };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      const p = stagePoint(e), W = stage.width, H = stage.height;
      let r;
      if (drag.mode === 'new') r = { x0: drag.start.x, y0: drag.start.y, x1: p.x, y1: p.y };
      else if (drag.mode === 'move') {
        const r0 = drag.rect0;
        const dx = Math.max(-r0.x0, Math.min(W - r0.x1, p.x - drag.start.x)), dy = Math.max(-r0.y0, Math.min(H - r0.y1, p.y - drag.start.y));
        r = { x0: r0.x0 + dx, y0: r0.y0 + dy, x1: r0.x1 + dx, y1: r0.y1 + dy };
      } else {
        r = Object.assign({}, drag.rect0);
        if (drag.mode.indexOf('n') >= 0) r.y0 = p.y;
        if (drag.mode.indexOf('s') >= 0) r.y1 = p.y;
        if (drag.mode.indexOf('w') >= 0) r.x0 = p.x;
        if (drag.mode.indexOf('e') >= 0) r.x1 = p.x;
      }
      const cut = function (v, most) { return Math.max(0, Math.min(most, v)); };
      const x0 = cut(Math.min(r.x0, r.x1), W), x1 = cut(Math.max(r.x0, r.x1), W), y0 = cut(Math.min(r.y0, r.y1), H), y1 = cut(Math.max(r.y0, r.y1), H);
      photo.rects[photo.index] = { x0: x0 / W, y0: y0 / H, x1: x1 / W, y1: y1 / H };
      drawPhoto();
    });
    stage.addEventListener('pointerup', function () {
      if (!drag) return;
      drag = null;
      const r = rectPx();
      if (r && (r.x1 - r.x0 < 20 || r.y1 - r.y0 < 10)) { photo.rects[photo.index] = null; drawPhoto(); }
    });
    $('foto-first-ok').addEventListener('click', confirmFirst);
    $('foto-first-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); confirmFirst(); } });
    $('foto-first-redo').addEventListener('click', function () {
      $('foto-files').value = '';
      Object.assign(photo, { files: [], rects: [], angles: [], done: [], kind: {}, items: [], sheet: [], zone: '', first: '', image: null });
      $('foto-first').hidden = true;
      showPhoto(0);
      $('foto-status').textContent = 'Rifai la prima foto: il cartello intero, vicino e dritto (e l\'itinerario, anche in una foto a parte). Poi scegli di nuovo le foto.';
    });
    $('foto-first-sheet').addEventListener('change', checkSheet);
    $('foto-first-whole').addEventListener('change', function () { showPhoto($('foto-first-whole').checked ? 1 : 0); checkFirst(false); });
    $('foto-sort').addEventListener('click', function () {
      if (photo.busy || photo.done.some(Boolean)) { $('foto-status').textContent = 'Le foto sono già in lettura: scegli di nuovo le foto per metterle in ordine.'; return; }
      Object.assign(photo, { files: byTime(), rects: [], angles: [], done: [], kind: {}, items: [], sheet: [], zone: '' });
      $('foto-sort').hidden = true;
      $('foto-first-whole').checked = false;
      showPhoto(0); checkFirst(true);
      $('foto-status').textContent = 'Foto messe in ordine di scatto.';
    });
    $('foto-guide').addEventListener('click', openTutorial);
    $('foto-first-skip').addEventListener('click', function () {
      $('foto-first').hidden = true;
      if (answerSign(false)) return;   // not a sign: the reading goes on
      $('foto-status').textContent = 'Senza la foto del cartello: scegli qui sotto in quale sottozona vanno le vie lette.';
    });
    $('foto-read').addEventListener('click', readCurrent);
    $('foto-all').addEventListener('click', readAll);
    $('foto-prev').addEventListener('click', function () { if (photo.index > 0) showPhoto(photo.index - 1); });
    $('foto-next').addEventListener('click', function () { if (photo.index < photo.files.length - 1) showPhoto(photo.index + 1); });
    $('dlg-foto').addEventListener('close', function () {
      photo.stop = true;   // a reading going on stops after its photo
      answerSign(false);
      if ($('dlg-foto').returnValue !== 'ok') return;
      const text = $('foto-result').value.trim();
      if (!text) return;
      // the lines go to the chosen sub-zone; those after "# sottozona 2B" (a sign in the photos) to that one
      const parts = {};
      const before = state.project.subzones.length;
      const target = String($('foto-target').value);
      let to = target.indexOf('nuova:') === 0 ? subzoneNamed(target.slice(6)) : +target || 0;
      let named = '', waiting = [];   // a sign: its sub-zone is made when a line of its own follows (not for notes only)
      text.split('\n').forEach(function (line) {
        const m = /^#\s*sottozona\s+(\S+)/i.exec(line.trim());
        if (m) { named = m[1]; waiting = []; return; }
        if (named && (!line.trim() || line.trim()[0] === '#')) { waiting.push(line); return; }
        if (named) { to = subzoneNamed(named); named = ''; }
        if (!parts[to]) parts[to] = [];
        parts[to].push.apply(parts[to], waiting.concat([line]));
        waiting = [];
      });
      if (state.project.subzones.length !== before) renderTabs();
      const added = [], locked = [];
      Object.keys(parts).forEach(function (k) {
        const s = state.project.subzones[k];
        const t = parts[k].join('\n').trim();
        const name = s.name || 'sottozona ' + (+k + 1);
        if (!t) return;
        if (s.locked) { locked.push(name); return; }
        s.route = s.route.replace(/\s+$/, '') + (s.route.trim() ? '\n' : '') + t + '\n';
        added.push(name);
      });
      if (state.els.ta) { state.els.ta.value = sz().route; fitTextarea(state.els.ta); }
      changed();
      refreshRoute();
      refreshSide();
      toast((added.length ? 'Aggiunto in fondo al giro della ' + added.join(' e della ') + ': controlla le righe con «?».' : '') +
        (locked.length ? ' Il giro della ' + locked.join(' e della ') + ' è bloccato: lì non ho aggiunto niente.' : ''));
    });
  }

  // ------------------------------------------------------------ the photos of the strips, to look at while writing

  /*
   * The photos chosen for a sub-zone stay on this device only (IndexedDB, smaller copies), never in the
   * account or on the internet: they show the real strips. The viewer stays open beside the route
   * (on the phone, in the top half), so the numbers can be copied while looking at them.
   */
  const viewer = { list: [], index: 0, zoom: 1, url: null };
  let photoDbReady = null;
  function photoDb() {
    if (!window.indexedDB) return Promise.reject(new Error('questo browser non tiene le foto'));
    if (!photoDbReady) {
      photoDbReady = new Promise(function (ok, ko) {
        const r = indexedDB.open('casellino-foto', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('foto', { keyPath: 'id', autoIncrement: true }).createIndex('sz', 'sz'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { photoDbReady = null; ko(r.error); };
      });
    }
    return photoDbReady;
  }
  function photoStore(mode) { return photoDb().then(function (db) { return db.transaction('foto', mode).objectStore('foto'); }); }
  const ask = function (req) { return new Promise(function (ok, ko) { req.onsuccess = function () { ok(req.result); }; req.onerror = function () { ko(req.error); }; }); };

  async function photosOf(szId) {
    const list = await ask((await photoStore('readonly')).index('sz').getAll(szId));
    return list.sort(function (a, b) { return a.order - b.order; });
  }
  // A smaller copy (at most 2400 px on the long side): sharp enough to read, light on the device.
  // A photo the browser cannot open here (HEIC on some phones) is kept as it is.
  async function smallCopy(file) {
    let img;
    try { img = await createImageBitmap(file); } catch (e) { return file; }
    const k = Math.min(1, 2400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();   // a whole photo takes tens of MB: freed at once, or a phone with many photos runs out of memory
    const blob = await new Promise(function (ok) { c.toBlob(function (b) { ok(b || file); }, 'image/jpeg', 0.85); });
    c.width = c.height = 0;
    return blob;
  }
  // The fingerprint of what is in the photo: the same photo with another name (sent by WhatsApp, copied) is the same.
  async function photoPrint(file) {
    try {
      if (!window.crypto || !crypto.subtle) return '';
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      return Array.prototype.map.call(d.slice(0, 16), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    } catch (e) { return ''; }
  }
  // Keeps the photos of the open sub-zone (the same photo twice is kept once, also with another name). One keeping at
  // a time: two choices of photos one right after the other do not both see the photos as new.
  let keeping = Promise.resolve();
  function keepPhotos(files) {
    const run = keeping.then(function () { return keepPhotosNow(files); });
    keeping = run.catch(function () { /* the next one goes on */ });
    return run;
  }
  async function keepPhotosNow(files) {
    const szId = sz().id;
    // the browser is asked not to clear the photos by itself when the device is short of space
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* only a wish */ }
    const have = await photosOf(szId);
    let order = have.length ? have[have.length - 1].order + 1 : 0, added = 0;
    for (const f of files) {
      const sign = f.name + '|' + f.size + '|' + f.lastModified;
      const print = await photoPrint(f);
      if (have.some(function (x) { return x.sign === sign || (print && x.print === print); })) continue;
      const blob = await smallCopy(f);
      const item = { sz: szId, sign: sign, print: print, name: f.name, blob: blob, order: order++, added: Date.now() };
      await ask((await photoStore('readwrite')).add(item));
      have.push(item);   // the same photo twice in one choice: kept once
      added++;
    }
    return added;
  }

  async function openViewer(at) {
    const dlg = $('dlg-photos');
    try { viewer.list = await photosOf(sz().id); } catch (e) { toast('Le foto non si possono tenere su questo browser: ' + e.message); return; }
    viewer.index = Math.max(0, Math.min(at === undefined ? viewer.index : at, viewer.list.length - 1));
    viewer.zoom = 1;
    if (!dlg.open) dlg.show();   // not modal: the route can be written while looking
    document.body.classList.add('viewer-open');
    showViewer();
  }
  function showViewer() {
    const n = viewer.list.length;
    const img = $('pv-img');
    if (viewer.url) { URL.revokeObjectURL(viewer.url); viewer.url = null; }
    $('pv-title').textContent = 'Foto delle strisce' + (sz().name ? ' della ' + sz().name : '');
    $('pv-count').textContent = n ? (viewer.index + 1) + ' di ' + n : '';
    $('pv-empty').hidden = n > 0;
    img.hidden = !n;
    ['pv-prev', 'pv-next', 'pv-del', 'pv-zoom-in', 'pv-zoom-out'].forEach(function (id) { $(id).disabled = !n; });
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) $('pv-zoom-tip').textContent = 'Doppio tocco per ingrandire.';
    if (!n) return;
    $('pv-prev').disabled = viewer.index === 0;
    $('pv-next').disabled = viewer.index === n - 1;
    viewer.url = URL.createObjectURL(viewer.list[viewer.index].blob);
    img.src = viewer.url;
    img.style.width = (viewer.zoom * 100) + '%';
  }
  function zoomViewer(z) {
    const stage = $('pv-stage');
    const cx = (stage.scrollLeft + stage.clientWidth / 2) / (stage.scrollWidth || 1);
    const cy = (stage.scrollTop + stage.clientHeight / 2) / (stage.scrollHeight || 1);
    viewer.zoom = Math.max(1, Math.min(5, z));
    $('pv-img').style.width = (viewer.zoom * 100) + '%';
    stage.scrollLeft = cx * stage.scrollWidth - stage.clientWidth / 2;   // the same spot stays in the middle
    stage.scrollTop = cy * stage.scrollHeight - stage.clientHeight / 2;
  }
  function renderPhotoButton() {
    const b = document.querySelector('.photos-view-btn');
    if (!b || !window.indexedDB) return;
    photosOf(sz().id).then(function (list) { b.textContent = '🖼 Guarda le foto' + (list.length ? ' (' + list.length + ')' : ''); }).catch(function () { /* none */ });
  }
  async function forgetAllPhotos() {
    if (!window.indexedDB) return;
    try { (await photoStore('readwrite')).clear(); } catch (e) { /* nothing kept */ }
  }

  function wireViewer() {
    $('pv-close').addEventListener('click', function () { $('dlg-photos').close(); });
    $('dlg-photos').addEventListener('close', function () { document.body.classList.remove('viewer-open'); });
    $('pv-prev').addEventListener('click', function () { viewer.index--; viewer.zoom = 1; showViewer(); });
    $('pv-next').addEventListener('click', function () { viewer.index++; viewer.zoom = 1; showViewer(); });
    $('pv-zoom-in').addEventListener('click', function () { zoomViewer(viewer.zoom * 1.5); });
    $('pv-zoom-out').addEventListener('click', function () { zoomViewer(viewer.zoom / 1.5); });
    $('pv-img').addEventListener('dblclick', function () { zoomViewer(viewer.zoom > 1 ? 1 : 2.5); });
    $('pv-add').addEventListener('change', async function (e) {
      const files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      $('pv-count').textContent = 'Salvo le foto…';
      try {
        const added = await keepPhotos(files);
        await openViewer(viewer.list.length);
        renderPhotoButton();
        toast(added ? (added === 1 ? 'Foto aggiunta.' : added + ' foto aggiunte.') : 'Queste foto c\'erano già.');
      } catch (err) { toast('Non riesco a tenere le foto: ' + err.message); showViewer(); }
    });
    $('pv-del').addEventListener('click', async function () {
      const f = viewer.list[viewer.index];
      if (!f || !confirm('Tolgo questa foto da questo dispositivo? (L\'originale nella galleria del telefono resta.)')) return;
      await ask((await photoStore('readwrite')).delete(f.id));
      await openViewer(Math.min(viewer.index, viewer.list.length - 2));
      renderPhotoButton();
    });
  }

  // ------------------------------------------------------------ problems: the diary of errors and the report

  // The last problems the program met (shown to nobody: they go with a report, to understand it).
  const diary = [];
  function note(text) {
    diary.push(new Date().toLocaleString('it-IT') + ' · ' + String(text).slice(0, 300));
    if (diary.length > 30) diary.shift();
  }
  window.addEventListener('error', function (e) { note('errore: ' + e.message + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '')); });
  window.addEventListener('unhandledrejection', function (e) { note('errore: ' + ((e.reason && e.reason.message) || e.reason)); });

  // The operating system, from what the browser says ("Android 13", "iOS 18.1", "Windows 10/11").
  function systemName() {
    const ua = navigator.userAgent || '';
    let m = /Android\s([\d.]+)/.exec(ua);
    if (m) return 'Android ' + m[1];
    m = /(?:iPhone|iPad).*?OS\s([\d_]+)/.exec(ua);
    if (m) return 'iOS ' + m[1].replace(/_/g, '.');
    if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return '';
  }

  async function openReport() {
    document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
    if (!account.token) { toast('Per segnalare un problema accedi al tuo account (è gratis).'); openAccount(); return; }
    $('bug-msg').textContent = '';
    $('bug-text').value = '';
    $('bug-image').value = '';
    $('bug-system').value = systemName();
    $('bug-phone').value = '';
    $('dlg-bug').showModal();
    // Chrome on Android can say the model of the phone: written for the person to check
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const v = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
        if (v.model && !$('bug-phone').value) $('bug-phone').value = v.model;
      }
    } catch (e) { /* not said: the person writes it, if they remember it */ }
  }

  // The screenshot made small (JPEG, at most 1600 points wide): it travels fast and fits the free server.
  async function smallScreenshot(file) {
    const img = await createImageBitmap(file);
    for (const [wide, quality] of [[1600, 0.75], [1200, 0.6], [900, 0.5]]) {
      const k = Math.min(1, wide / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', quality);
      if (url.length < 1400000) return url;
    }
    throw new Error('lo screenshot è troppo grande');
  }

  async function sendReport() {
    const btn = $('bug-send'), msg = $('bug-msg');
    btn.disabled = true;
    msg.textContent = 'Invio…';
    try {
      const f = $('bug-image').files[0];
      const image = f ? await smallScreenshot(f) : '';
      const details = {
        versione: window.CASELLINO_VERSION || '', browser: navigator.userAgent, lingua: navigator.language,
        schermo: screen.width + '×' + screen.height + ' (finestra ' + window.innerWidth + '×' + window.innerHeight + ')',
        installata: window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false,
        sottozone: state.project.subzones.length, errori: diary.slice(),
      };
      await api('POST', '/api/segnala', { testo: $('bug-text').value, sistema: $('bug-system').value, telefono: $('bug-phone').value,
        dettagli: JSON.stringify(details), immagine: image });
      $('dlg-bug').close();
      toast('Segnalazione inviata: grazie! Arriva a chi fa Casellino.');
    } catch (e) {
      msg.textContent = e.status === 404 ? "Le segnalazioni non sono ancora attive sul server: riprova tra un po'." : 'Non inviata: ' + e.message;
      note('segnalazione non inviata: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /*
   * «Metti Casellino nella Home» (Garadron, 26 November 2026, said in the chat of the Ricettario, where the page was
   * born: «vale anche per il casellino [...] da scrivere appunto nel tutorial o da qualche parte che sia visibile»).
   * Until Casellino is in the stores: the steps for the device in use, chosen already, the others a tap away. On iPhone
   * it goes through Safari (Brave, Chrome, Firefox often lack the entry): «Copia il link» carries the page there.
   * The link #nella-home opens this window by itself, also before signing in.
   */
  const HOME_LINK = SITE_URL + '#nella-home';
  const inHome = function () {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  };
  const UA = navigator.userAgent || '';
  const HOME_OS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1)
    ? 'ios' : (/Android/.test(UA) ? 'android' : 'computer');
  const HOME_STEPS = {
    ios: [
      'Serve Safari, la bussola blu. Se stai usando un altro browser (Brave, Chrome, Firefox…), tocca qui sotto «Copia il link». Se sei già in Safari, vai al passo 3.',
      'Apri Safari, tieni il dito sulla barra dell\'indirizzo e scegli «Incolla e vai».',
      'Tocca «Condividi», il quadrato con la freccia in su. Se non lo vedi, tocca prima i tre puntini accanto all\'indirizzo.',
      'Scorri e tocca «Aggiungi alla schermata Home». Se non c\'è, in fondo all\'elenco tocca «Modifica azioni» e aggiungila.',
      'Lascia attivo «Apri come app web» e tocca «Aggiungi». L\'icona di Casellino è nella Home.'],
    android: [
      'Apri il menu del browser: i tre puntini in alto a destra. In Samsung Internet sono le tre righe in basso.',
      'Tocca «Installa app» oppure «Aggiungi a schermata Home». In Samsung Internet: «Aggiungi pagina a», poi «Schermata Home».',
      'Conferma con «Installa» o «Aggiungi». L\'icona di Casellino è nella Home.'],
    computer: [
      'Con Chrome o Edge: a destra nella barra dell\'indirizzo tocca l\'icona «Installa», uno schermo con la freccia.',
      'Se non la vedi, apri il menu (i tre puntini): in Chrome «Trasmetti, salva e condividi», poi «Installa pagina come app»; in Edge «App», poi «Installa questo sito come app».',
      'Con Safari sul Mac: menu «File», poi «Aggiungi al Dock».'],
  };
  const HOME_NOTES = {
    ios: '',
    android: 'Non trovi la voce? Copia il link e aprilo con Chrome.',
    computer: 'Firefox sul computer non lo permette: copia il link e aprilo con Chrome o Edge.',
  };
  let installAsk = null;   // Chrome and Edge (Android and computer): the installation with one tap
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installAsk = e; });

  function showHomeOs(os) {
    Array.prototype.forEach.call(document.querySelectorAll('#home-os button'), function (b) {
      b.setAttribute('aria-selected', b.dataset.os === os ? 'true' : 'false');
    });
    const ol = $('home-steps');
    ol.textContent = '';
    HOME_STEPS[os].forEach(function (s) { ol.append(h('li', null, s)); });
    $('home-note').textContent = HOME_NOTES[os];
    $('home-note').hidden = !HOME_NOTES[os];
    $('home-install').hidden = !(installAsk && os !== 'ios' && !inHome());
  }
  function openHome() {
    document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
    $('home-already').hidden = !inHome();
    $('home-file').hidden = location.protocol !== 'file:';
    $('home-copy').textContent = '📋 Copia il link';
    showHomeOs(HOME_OS);
    if (!$('dlg-home').open) $('dlg-home').showModal();
  }
  function copyHomeLink() {
    const done = function () { $('home-copy').textContent = '✓ Link copiato'; };
    const byHand = function () { window.prompt('Copia il link', HOME_LINK); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(HOME_LINK).then(done, byHand);
    else byHand();
  }
  function wireHome() {
    ['btn-home', 'gate-home', 'help-home'].forEach(function (id) {
      $(id).addEventListener('click', function () { if ($('dlg-help').open) $('dlg-help').close(); openHome(); });
    });
    $('tut-home').addEventListener('click', function () { $('dlg-tutorial').close(); openHome(); });
    Array.prototype.forEach.call(document.querySelectorAll('#home-os button'), function (b) {
      b.addEventListener('click', function () { showHomeOs(b.dataset.os); });
    });
    $('home-copy').addEventListener('click', copyHomeLink);
    $('home-install-btn').addEventListener('click', function () {
      if (!installAsk) return;
      installAsk.prompt();
      installAsk = null;
      $('home-install').hidden = true;
    });
    $('home-support').addEventListener('click', function () { $('dlg-home').close(); openSupport(); });
    // already in the Home: the buttons that lead here are not needed
    if (inHome()) Array.prototype.forEach.call(document.querySelectorAll('.home-btn'), function (el) { el.hidden = true; });
  }

  // ------------------------------------------------------------ the news (Garadron, 26 November 2026)
  // Only the essentials of each version, newest first. Shown once by itself, on entering or signing in after an
  // update; always there from «🆕 Novità». A version with nothing new to see adds nothing here.
  const NEWS = [
    { v: '0.51.0', data: '28 novembre 2026', cose: [
      'Icone nuove, a linea, tutte uguali: si leggono meglio, di giorno e di notte.',
      'Le condizioni d\'uso in poche righe: si accettano una volta sola, con la spunta. Casellino è per chi ha almeno 18 anni.'] },
    { v: '0.50.0', data: '27 novembre 2026', cose: [
      '📲 Metti Casellino nella Home: i passi per iPhone, Android e computer, e «Copia il link» per passare a Safari. È nella pagina d\'accesso, in «Altro» e nel tutorial.'] },
    { v: '0.49.0', data: '26 novembre 2026', cose: [
      'Si entra con il tuo account: senza accesso non si vede niente, così i tuoi giri li vedi solo tu.',
      'Le novità di ogni aggiornamento compaiono una volta sola appena entri. Le rileggi quando vuoi da «🆕 Novità», in alto.'] },
    { v: '0.48.0', data: '26 novembre 2026', cose: [
      '🎤 Detta il giro: dici la via e i civici, e Casellino scrive le caselle mentre parli. Si detta in silenzio.',
      'Puoi continuare dalla fine, aggiungere da un punto o cambiare una casella a voce. Le frasi sono nel tutorial del dettato.'] },
    { v: '0.47.0', data: '26 novembre 2026', cose: ['🔎 Il controllo anomalie trova anche i civici scritti due volte.'] },
    { v: '0.46.0', data: '26 novembre 2026', cose: ['🔎 Controllo anomalie: guarda l\'ordine dei civici di ogni via e piazza, senza cambiare niente.'] },
    { v: '0.45.0', data: '25 novembre 2026', cose: [
      '🔗 I simbolini: due caselle, anche di vie diverse, con lo stesso simbolino.',
      'Tieni premuto un tasto per sapere a che cosa serve.'] },
    { v: '0.44.0', data: '25 novembre 2026', cose: ['☀️ 🌙 Giorno e notte, e 📤 Condividi per mandare Casellino ai colleghi.'] },
  ];
  const NEWS_KEY = 'casellino.novita';
  const vnum = function (v) { return String(v || '').split('.').reduce(function (a, n) { return a * 1000 + (+n || 0); }, 0); };
  function newsSeen() { try { return localStorage.getItem(NEWS_KEY) || ''; } catch (e) { return NEWS[0].v; } }
  function newsMarkSeen() { try { localStorage.setItem(NEWS_KEY, NEWS[0].v); } catch (e) { /* only a convenience */ } }
  // all = the whole list (the button); otherwise what was not seen yet, and nothing if it was all seen.
  function showNews(all) {
    const seen = newsSeen();
    const list = all ? NEWS : (seen ? NEWS.filter(function (n) { return vnum(n.v) > vnum(seen); }) : NEWS.slice(0, 1));
    if (!list.length) return false;
    newsMarkSeen();
    const body = $('news-body');
    body.textContent = '';
    list.forEach(function (n) {
      const ul = h('ul');
      n.cose.forEach(function (c) { ul.append(h('li', null, c)); });
      body.append(h('section', { class: 'news-version' }, h('h3', null, 'Versione ' + n.v + ' · ' + n.data), ul));
    });
    $('news-title').textContent = all ? '🆕 Le ultime novità' : '🆕 Novità in Casellino';
    $('news-all').hidden = all || list.length >= NEWS.length;
    if (!$('dlg-news').open) $('dlg-news').showModal();
    return true;
  }
  let worksAfterNews = false;   // a new device: after the news, the list of the works in the account
  function wireNews() {
    $('btn-news').addEventListener('click', function () { showNews(true); });
    $('news-all').addEventListener('click', function () { showNews(true); });
    $('dlg-news').addEventListener('close', function () {
      if (worksAfterNews) { worksAfterNews = false; openAccount(); }
    });
  }

  /*
   * Entering is always with the account (Garadron, 26 November 2026: «Deve sempre loggare»): without it the page
   * shows only the sign-in, nothing of the work. Not in the preview for the company, which is a demo.
   */
  const gated = function () { return document.body.classList.contains('gated'); };
  function setGate(on) {
    document.body.classList.toggle('gated', on);
    $('gate').hidden = !on;
    if (!on) return;
    Array.prototype.forEach.call(document.querySelectorAll('dialog[open]'), function (d) {
      if (d.id !== 'dlg-support' && d.id !== 'dlg-tutorial') d.close();
    });
    $('gate-kept').hidden = isEmptyProject();
    renderAccountDialog();
  }

  // Signing out keeping the work: it waits on the device for the same account, and no one else sees it.
  const PARK_KEY = 'casellino.parcheggio';
  function parked() {
    try { return JSON.parse(localStorage.getItem(PARK_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function parkWork() {
    if (!account.utente || isEmptyProject()) return;
    const park = parked();
    park[account.utente.toLowerCase()] = state.project;
    try { localStorage.setItem(PARK_KEY, JSON.stringify(park)); } catch (e) { /* full: the work is in the account anyway */ }
  }
  function unparkWork() {
    const park = parked(), key = account.utente.toLowerCase(), p = park[key];
    if (!p) return;
    delete park[key];
    try {
      if (Object.keys(park).length) localStorage.setItem(PARK_KEY, JSON.stringify(park));
      else localStorage.removeItem(PARK_KEY);
    } catch (e) { /* nothing to tidy */ }
    if (!isEmptyProject()) return;
    const back = C.sanitizeProject(p);
    back.cloud = p.cloud || null;
    state.project = back;
    state.current = 0;
    C.assignColors(state.project);
    changed();
    renderAll();
  }
  // Out of the account (signed out, or the server says the entry is no longer valid): the page shows only the sign-in.
  function lockOut(note) {
    parkWork();
    account.token = '';
    accountStore();
    renderAccountButton();
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nothing saved */ }
    state.project = C.newProject();
    state.current = 0;
    state.selected = null;
    renderAll();
    savedLine('Non ancora salvato');
    accountNote = note || '';
    setGate(true);
  }

  /*
   * The conditions, accepted once (World Rule «Le condizioni si accettano una volta», Garadron, 28 November 2026:
   * «bisogna accettare 1 tantum [...] le condizioni essenziali»). Who registers ticks them before writing anything;
   * who already has an account sees them at the first entry after the update. They are asked again only when TERMS
   * changes in something important, and TERMS_CHANGES says what. Casellino is a work app: from 18 years.
   * The server keeps the version accepted and when (the proof); an older server does not know it yet, so the
   * acceptance waits on the device and is sent later.
   */
  const TERMS = '2026-11-28';
  const TERMS_CHANGES = '';
  const TERMS_KEY = 'casellino.condizioni';   // {utente: version accepted, '!utente': version still to send}
  let termsForNew = false;   // the sign-up: conditions ticked at its first step
  function termsLocal() {
    try { return JSON.parse(localStorage.getItem(TERMS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function termsAccepted() { return termsLocal()[account.utente.toLowerCase()] === TERMS; }
  function termsMark(toSend) {
    const t = termsLocal(), k = account.utente.toLowerCase();
    t[k] = TERMS;
    if (toSend) t['!' + k] = TERMS; else delete t['!' + k];
    try { localStorage.setItem(TERMS_KEY, JSON.stringify(t)); } catch (e) { /* private window: asked again next time */ }
  }
  async function termsSend() {
    if (!account.token || termsLocal()['!' + account.utente.toLowerCase()] !== TERMS) return;
    try { await api('POST', '/api/condizioni', { versione: TERMS }); termsMark(false); } catch (e) { /* tried again next time */ }
  }
  // What the server says this account accepted (in the sign-in answer and in /api/io; an older server says nothing).
  function termsFromServer(r) {
    if (!r || r.condizioni === undefined) return;
    if (r.condizioni === TERMS) termsMark(false);
    else if (termsAccepted()) { termsMark(true); termsSend(); }   // accepted on this device without internet
  }
  function termsBox(box, onOk, forNew) {
    const tick = h('input', { type: 'checkbox', id: 'terms-tick' });
    const go = h('button', { type: 'button', class: 'primary', id: 'terms-ok', disabled: '' }, forNew ? 'Avanti' : 'Accetto e continuo');
    tick.addEventListener('change', function () { go.disabled = !tick.checked; });
    go.addEventListener('click', function () { if (tick.checked) onOk(); });
    const link = function (page, text) { return h('a', { href: SITE_URL + page, target: '_blank', rel: 'noopener' }, text); };
    box.append(h('div', { class: 'terms' },
      h('h3', null, forNew ? 'Prima di creare l\'account' : 'Le condizioni di Casellino'),
      forNew ? null : h('p', { class: 'small hint' }, TERMS_CHANGES ? 'Che cosa è cambiato: ' + TERMS_CHANGES
        : 'Una volta sola: le accetti e Casellino non te le chiede più.'),
      h('ul', { class: 'terms-list' },
        h('li', null, 'Casellino è gratis e per uso non commerciale. È un aiuto per il lavoro: serve avere almeno 18 anni.'),
        h('li', null, 'Nell\'account si salvano il nome utente, l\'email (nascosta) e i tuoi lavori. Niente pubblicità e niente tracciamento.'),
        h('li', null, 'Il giro lo controlli tu prima di stamparlo: Casellino aiuta, ma la responsabilità del lavoro resta tua.'),
        h('li', null, 'Puoi eliminare l\'account e i tuoi dati quando vuoi, dall\'app.')),
      h('p', { class: 'small' }, 'Per intero: le ', link('condizioni.html', 'condizioni d\'uso'), ' e l\'',
        link('privacy.html', 'informativa sulla privacy'), '.'),
      h('label', { class: 'terms-tick' }, tick, h('span', null, 'Ho almeno 18 anni, ho letto l\'informativa e accetto le condizioni')),
      h('p', { class: 'actions-inline' }, go)));
  }
  // Signed in, conditions not accepted yet: the page stays closed until they are, or the person goes out.
  function termsGate(then) {
    document.body.classList.add('gated');
    $('gate').hidden = false;
    $('gate-intro').hidden = true;
    $('gate-kept').hidden = true;
    const box = $('gate-body');
    box.textContent = '';
    termsBox(box, function () {
      termsMark(true);
      termsSend();
      $('gate-intro').hidden = false;
      then();
    }, false);
    box.append(h('p', { class: 'small' }, h('button', { type: 'button', class: 'link-btn', onclick: function () {
      api('POST', '/api/esci', {}).catch(function () { /* out on this device anyway */ });
      $('gate-intro').hidden = false;
      lockOut('Senza accettare le condizioni non si può usare l\'account. Il tuo lavoro non si perde.');
    } }, 'Non accetto: esco dall\'account')));
  }

  // ------------------------------------------------------------ account: works saved online (free, Cloudflare)

  const API = window.CASELLINO_API || 'https://casellino.ricettaio-mannisi.workers.dev';
  const ACCOUNT_KEY = 'casellino.account';
  const account = { token: '', utente: '', saving: false, again: false, lastError: '' };

  function accountLoad() {
    try {
      const a = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null');
      if (a && a.token) { account.token = a.token; account.utente = a.utente || ''; }
    } catch (e) { /* no account on this device */ }
  }

  function accountStore() {
    try {
      if (account.token) localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ token: account.token, utente: account.utente }));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) { /* private window: the account lasts until the page is closed */ }
  }

  async function api(method, path, body, leaving) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (account.token) headers.Authorization = 'Bearer ' + account.token;
    let res;
    try {
      const text = body === undefined ? undefined : JSON.stringify(body);
      // leaving the page: "keepalive" lets the request finish after it closes (only up to 64 KB)
      res = await fetch(API + path, { method: method, headers: headers, body: text, keepalive: !!leaving && (text || '').length < 60000 });
    } catch (e) {
      const err = new Error('Senza internet: il lavoro resta su questo dispositivo e si salva nell\'account appena torna la rete.');
      err.offline = true;
      throw err;
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty answer */ }
    if (res.status === 401 && account.token && path !== '/api/accedi' && path !== '/api/recupera') {
      if (window.CASELLINO_ANTEPRIMA) { account.token = ''; accountStore(); renderAccountButton(); }
      else lockOut((data.errore || 'Sei uscito dal tuo account') + ' Il tuo lavoro non si perde: lo ritrovi appena entri.');
    }
    if (!res.ok) {
      const err = new Error(data.errore || ('Errore ' + res.status));
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  function workName(p) {
    const subs = p.subzones.map(function (s) { return s.name; }).filter(Boolean).join(', ');
    return (p.zone ? 'Zona ' + p.zone : 'Senza zona') + (subs ? ' (' + subs + ')' : '');
  }

  function newWorkId() {
    const b = crypto.getRandomValues(new Uint8Array(12));
    let s = '';
    b.forEach(function (x) { s += String.fromCharCode(x); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function savedLine(text) { $('saved').textContent = text; }
  const hhmm = function (t) { return new Date(t || Date.now()).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };
  const when = function (t) { return new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  // Is the copy of the open work in the account newer than the one on this device?
  const newer = function (w) { const c = state.project.cloud; return !!(c && c.id === w.id && w.versione > (c.versione || 0)); };

  /*
   * When the page opens and when it comes back on screen: if another device saved the open work
   * after this one, its copy is opened (asking first if this device has changes not yet saved).
   * Changes left here and never sent (for example without internet) are sent now.
   */
  async function syncFromAccount() {
    const p = state.project;
    if (!account.token || !p.cloud || !p.cloud.id || account.saving || account.syncing) return;
    account.syncing = true;
    try {
      let list;
      try { list = (await api('GET', '/api/lavori')).lavori; } catch (e) { return; }
      const w = list.find(function (x) { return x.id === p.cloud.id; });
      if (!w || state.project !== p) return;
      if (!newer(w)) { if (p.cloud.pending) cloudSave(false); return; }
      if (p.cloud.pending && !confirm('Nell\'account c\'è una versione più nuova di «' + w.nome + '», salvata il ' + when(w.aggiornato_il) +
        ' da un altro dispositivo. Anche qui ci sono modifiche non ancora salvate.\n\nOK = apri quella dell\'account\nAnnulla = tieni questa (prenderà il posto dell\'altra)')) {
        cloudSave(true);
        return;
      }
      await openWork(w.id, true);
      savedLine('Aggiornato dall\'account: salvato il ' + when(w.aggiornato_il));
      toast('Ho aperto la versione più nuova, salvata il ' + when(w.aggiornato_il) + ' su un altro dispositivo.');
    } finally {
      account.syncing = false;
    }
  }

  // Saves the open work in the account (empty works are not saved). One save at a time.
  async function cloudSave(force, leaving) {
    if (!account.token || isEmptyProject()) return;
    if (account.saving) { account.again = true; return; }
    account.saving = true;
    const p = state.project;
    if (!p.cloud) p.cloud = { id: newWorkId(), versione: 0, aggiornato_il: 0 };
    const data = Object.assign({}, p, { cloud: null });
    const edits = account.edits;
    try {
      const r = await api('PUT', '/api/lavori/' + p.cloud.id, { nome: workName(p), dati: JSON.stringify(data), versione: p.cloud.versione, forza: !!force }, leaving);
      if (state.project === p) {
        p.cloud.versione = r.versione;
        p.cloud.aggiornato_il = r.aggiornato_il;
        if (account.edits === edits) delete p.cloud.pending;   // nothing changed while saving
        try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* local copy is optional */ }
        savedLine('Salvato nel tuo account alle ' + hhmm(r.aggiornato_il));
      }
      account.lastError = '';
    } catch (e) {
      if (e.status === 409 && e.data && e.data.versione) {
        const keepMine = confirm('Questo lavoro è stato cambiato da un altro dispositivo alle ' + hhmm(e.data.aggiornato_il) + '.\n\n' +
          'OK = tieni quello di questo dispositivo (sostituisce l\'altro)\nAnnulla = apri quello salvato nell\'account');
        account.saving = false;
        if (keepMine) return cloudSave(true);
        return openWork(p.cloud.id, true);
      }
      account.lastError = e.message;
      note('salvataggio nell\'account: ' + e.message);
      savedLine(e.offline ? 'Senza internet: salvato su questo dispositivo' : 'Non salvato nell\'account: ' + e.message);
    } finally {
      account.saving = false;
    }
    if (account.again) { account.again = false; cloudSave(); }
  }
  const cloudSaveLater = debounce(function (leaving) { cloudSave(false, leaving); }, 2500);

  // Closing the app or going to another one: what is waiting is saved at once, here and in the account.
  function saveBeforeLeaving() {
    storeSave.now();
    cloudSaveLater.now(true);
  }

  async function openWork(id, quiet) {
    try {
      const r = await api('GET', '/api/lavori/' + id);
      const p = C.sanitizeProject(JSON.parse(r.dati));
      p.cloud = { id: r.id, versione: r.versione, aggiornato_il: r.aggiornato_il };
      state.project = p;
      state.current = 0; state.selected = null; state.caret = null;
      C.assignColors(p);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* optional */ }
      renderAll();
      savedLine('Aperto dal tuo account (salvato alle ' + hhmm(r.aggiornato_il) + ')');
      if (!quiet) toast('Aperto: ' + r.nome);
    } catch (e) {
      toast('Non riesco ad aprirlo: ' + e.message);
    }
  }

  function renderAccountButton() {
    const b = $('btn-account');
    if (!b) return;
    b.textContent = account.token ? '👤 ' + account.utente : 'Accedi';
    b.classList.toggle('primary-soft', !account.token);
  }

  // The account window: sign in / register / forgotten password, or the list of saved works.
  let accountMode = 'accedi';
  let mailSent = null;        // { addr, email, prova } once the code has gone (addr: the e-mail written, email: hidden)
  let accountNote = '';       // a message for the next form (e.g. e-mails not active yet)
  let typedUser = '';         // the user name stays when the form changes tab
  function accountForm(box) {
    const modes = { accedi: 'Accedi', registrati: 'Registrati', recupera: 'Password dimenticata' };
    const tabs = h('div', { class: 'tabs' });
    Object.keys(modes).forEach(function (m) {
      tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': m === accountMode ? 'true' : 'false',
        onclick: function () { accountMode = m; renderAccountDialog(); } }, modes[m]));
    });
    const user = h('input', { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'es. mario.rossi',
      oninput: function () { typedUser = user.value; } });
    user.value = typedUser;
    const pass = h('input', { type: 'password', autocomplete: accountMode === 'accedi' ? 'current-password' : 'new-password' });
    const email = h('input', { type: 'email', autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false', placeholder: 'es. nome@gmail.com' });
    const mailCode = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '7', placeholder: '123456' });
    const msg = h('p', { class: 'small bad' }, accountNote);
    accountNote = '';
    const fresh = accountMode === 'registrati';
    const recovering = accountMode === 'recupera';
    if (fresh && !termsForNew) {   // first step of the sign-up: the conditions, before writing anything
      box.append(tabs);
      termsBox(box, function () { termsForNew = true; renderAccountDialog(); }, true);
      return;
    }
    const asking = recovering && !mailSent;   // first step: the e-mail of the account, then the code goes there
    if (recovering && mailSent) mailCode.value = mailSent.prova || '';
    const go = h('button', { type: 'submit', class: 'primary' },
      accountMode === 'accedi' ? 'Accedi' : (fresh ? 'Crea l\'account' : (asking ? 'Mandami il codice' : 'Cambia la password')));
    const switchTo = function (label, onclick) { return h('button', { type: 'button', class: 'link-btn', onclick: onclick }, label); };
    const form = h('form', { class: 'account-form' },
      recovering ? null : h('label', null, fresh ? 'Nome utente' : 'Nome utente o email (maiuscole o minuscole, è uguale)', user),
      fresh ? h('p', { class: 'small hint' }, USER_TIP) : null,
      fresh || asking ? h('label', null, fresh ? 'La tua email (serve se dimentichi la password e per le risposte del supporto)' : 'L\'email del tuo account', email) : null,
      recovering && mailSent ? h('p', { class: 'small hint' }, 'Ti ho mandato un codice di 6 cifre a ' + mailSent.email +
        '. Se non lo vedi, guarda nella posta indesiderata.') : null,
      recovering && mailSent ? h('label', null, 'Codice dall\'email (6 cifre)', mailCode) : null,
      asking ? null : h('label', null, recovering ? 'Password nuova (almeno 8 caratteri)' : 'Password' + (fresh ? ' (almeno 8 caratteri)' : ''), pass),
      fresh ? h('p', { class: 'small hint' }, 'Hai accettato le condizioni d\'uso e l\'informativa sulla privacy.') : null,
      msg, h('p', { class: 'actions-inline' }, go),
      recovering ? h('p', { class: 'small' },
        mailSent ? switchTo('Mandami un altro codice', function () { mailSent = null; renderAccountDialog(); }) : null,
        switchTo('Non ho più quell\'email: scrivo al supporto', function () { if ($('dlg-account').open) $('dlg-account').close(); openSupport(); })) : null);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      msg.textContent = '';
      go.disabled = true;
      try {
        if (asking) {
          const sent = await api('POST', '/api/codice-email', { email: email.value });
          mailSent = { addr: email.value.trim(), email: sent.email, prova: sent.prova };
          renderAccountDialog();
          return;
        }
        const path = accountMode === 'accedi' ? '/api/accedi' : (fresh ? '/api/registrati' : '/api/recupera');
        const data = { utente: recovering ? mailSent.addr : user.value, password: pass.value, email: email.value };
        if (recovering) data.codice = mailCode.value;
        if (fresh) data.condizioni = TERMS;
        const r = await api('POST', path, data);
        mailSent = null; typedUser = '';
        account.token = r.token; account.utente = r.utente;
        accountStore();
        renderAccountButton();
        if (fresh) termsMark(r.condizioni !== TERMS);   // ticked at the first step; an older server gets it later
        else termsFromServer(r);
        afterSignIn(accountMode);
      } catch (err) {
        msg.textContent = err.data && err.data.motivo === 'posta_spenta'
          ? 'Le email non sono ancora attive: per ora la password dimenticata non si può recuperare. Scrivi al supporto.' : err.message;
      } finally {
        go.disabled = false;
      }
    });
    if (!gated()) box.append(h('p', null, 'Con un account i tuoi lavori si salvano da soli mentre scrivi e li ritrovi da qualsiasi telefono o computer. È gratis.'));
    box.append(tabs, form,
      h('p', { class: 'small muted' }, 'Se dimentichi la password ti mando un codice all\'email dell\'account. ' +
        'L\'email nel server resta nascosta: nessuno la può leggere, nemmeno da lì. Nell\'account si salvano solo i tuoi lavori.'));
    // on the sign-in page of a phone the keyboard does not jump out by itself
    if (!(gated() && isTouch)) setTimeout(function () { (mailSent ? mailCode : (recovering ? email : user)).focus(); }, 30);
  }
  const USER_TIP = 'Usa pure il tuo stesso nome utente che usi nel palmare se ti viene più facile da ricordare. Ma non la stessa password.';

  // Name and e-mail of the account, each with «Cambia»: a small form that asks the password again.
  async function accountDetails(box) {
    const part = h('div', { class: 'account-details' }, h('h3', null, 'Nome utente ed email'));
    box.append(part);
    let me = { utente: account.utente, email: '', prossimoCambioNome: 0 };
    try { me = await api('GET', '/api/io'); } catch (e) { /* shown without the e-mail */ }
    if (!('email' in me)) { part.remove(); return; }  // a server older than v0.17.0: no changes yet
    const rows = h('div');
    part.append(rows);
    const show = function () {
      rows.textContent = '';
      const next = me.prossimoCambioNome ? new Date(me.prossimoCambioNome).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '';
      rows.append(
        detailRow('Nome utente', me.utente, next ? 'si può cambiare di nuovo dal ' + next : 'si cambia una volta a settimana', !next && function (slot) {
          changeForm(slot, 'Nome utente nuovo', { autocapitalize: 'none', spellcheck: 'false' }, USER_TIP, async function (value, password) {
            const r = await api('POST', '/api/cambia-nome', { utente: value, password: password });
            account.utente = r.utente; accountStore(); renderAccountButton();
            $('account-title').textContent = 'Account: ' + r.utente;
            me = await api('GET', '/api/io');
            show();
            toast('Ora il tuo nome utente è «' + r.utente + '».');
          });
        }),
        detailRow('Email', me.email || 'non ancora scritta', '', function (slot) {
          changeForm(slot, 'Email nuova', { type: 'email', autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false' }, '', async function (value, password) {
            const r = await api('POST', '/api/cambia-email', { email: value, password: password });
            me.email = r.email;
            show();
            toast('Email salvata.');
          });
        }, me.email ? 'Cambia' : 'Aggiungi'));
    };
    show();
    if (!me.email) {   // an account from before the e-mail was required: it adds it now
      part.prepend(h('p', { class: 'recovery' }, h('b', null, 'Aggiungi la tua email: '),
        'serve se dimentichi la password e per le risposte del supporto.'));
      const add = rows.querySelectorAll('.detail-row')[1];
      if (add) add.querySelector('.link-btn').click();
    }
  }
  function detailRow(label, value, note, onChange, button) {
    const slot = h('div');
    return h('div', { class: 'detail-row' },
      h('div', null, h('span', { class: 'small muted' }, label + ': '), h('b', null, value),
        onChange ? h('button', { type: 'button', class: 'link-btn', onclick: function () { onChange(slot); } }, button || 'Cambia') : null,
        note ? h('div', { class: 'small muted' }, note) : null),
      slot);
  }
  function changeForm(slot, label, attrs, tip, save) {
    slot.textContent = '';
    const value = h('input', attrs);
    const password = h('input', { type: 'password', autocomplete: 'current-password' });
    const msg = h('p', { class: 'small bad' });
    const go = h('button', { type: 'submit', class: 'primary' }, 'Salva');
    const form = h('form', { class: 'account-form' }, h('label', null, label, value), tip ? h('p', { class: 'small hint' }, tip) : null,
      h('label', null, 'La tua password, per conferma', password), msg,
      h('p', { class: 'actions-inline' }, go, h('button', { type: 'button', onclick: function () { slot.textContent = ''; } }, 'Annulla')));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      msg.textContent = '';
      go.disabled = true;
      try { await save(value.value, password.value); } catch (err) { msg.textContent = err.message; go.disabled = false; }
    });
    slot.append(form);
    value.focus();
  }

  // After signing in: the code to keep (new account or new password), then the works.
  async function afterSignIn(mode) {
    if (!window.CASELLINO_ANTEPRIMA && !termsAccepted()) {   // the conditions first, once
      if ($('dlg-account').open) $('dlg-account').close();
      termsGate(function () { afterSignIn(mode); });
      return;
    }
    termsSend();
    const fromGate = gated();
    if (fromGate) setGate(false);
    unparkWork();
    if (!state.project.cloud && !isEmptyProject()) {
      await cloudSave(false);
      if (state.project.cloud) toast('Il lavoro aperto ora è salvato anche nel tuo account.');
    } else if (state.project.cloud) syncFromAccount();
    if (!fromGate) {
      if (mode === 'registrati') tutorialAfterAccount = true;
      renderAccountDialog({ done: mode === 'registrati' ? 'Account creato.' : (mode === 'recupera' ? 'Password cambiata: gli altri dispositivi sono usciti.' : '') });
      return;
    }
    if (mode === 'registrati') {   // someone new: the tutorial, and the news are already in it
      newsMarkSeen();
      toast('Account creato: ora sei dentro');
      openTutorial();
      return;
    }
    if (mode === 'recupera') toast('Password cambiata: gli altri dispositivi sono usciti.');
    else toast('Sei dentro come ' + account.utente);
    const empty = isEmptyProject();   // a new device: the works saved in the account
    if (showNews(false)) worksAfterNews = empty;
    else if (empty) openAccount();
  }

  async function worksList(box) {
    const list = h('ul', { class: 'works' }, h('li', { class: 'muted' }, 'Carico i tuoi lavori…'));
    box.append(h('h3', null, 'I tuoi lavori'), list,
      h('p', { class: 'actions-inline' },
        h('button', { type: 'button', onclick: function () {
          $('dlg-account').close();
          if (!isEmptyProject() && !confirm('Comincio un lavoro nuovo? Quello aperto resta salvato nel tuo account.')) return;
          setProject(C.newProject());
        } }, '+ Lavoro nuovo')));
    try {
      const r = await api('GET', '/api/lavori');
      list.textContent = '';
      if (!r.lavori.length) list.append(h('li', { class: 'muted' }, 'Ancora nessuno: il lavoro che scrivi si salva qui da solo.'));
      r.lavori.forEach(function (w) {
        const open = state.project.cloud && state.project.cloud.id === w.id;
        list.append(h('li', { class: open ? 'open' : '' },
          h('div', null, h('b', null, w.nome), h('div', { class: 'small muted' },
            'salvato il ' + new Date(w.aggiornato_il).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) +
            (open ? ' · è quello aperto' : '') + (newer(w) ? ' · nell\'account c\'è una versione più nuova' : ''))),
          h('span', { class: 'actions-inline' },
            open && !newer(w) ? null : h('button', { type: 'button', class: newer(w) ? 'primary' : '', onclick: function () { $('dlg-account').close(); openWork(w.id); } },
              newer(w) ? '↻ Apri la più nuova' : 'Apri'),
            h('button', { type: 'button', class: 'danger', onclick: async function () {
              if (!confirm('Elimino «' + w.nome + '» dal tuo account? Non si torna indietro.')) return;
              try {
                await api('DELETE', '/api/lavori/' + w.id);
                if (open) state.project.cloud = null;
                renderAccountDialog();
              } catch (e) { toast(e.message); }
            } }, 'Elimina'))));
      });
    } catch (e) {
      list.textContent = '';
      list.append(h('li', { class: 'bad' }, e.message));
    }
  }

  // The support (Garadron, 16 November 2026): opens also without an account; the message goes through the server.
  function openSupport() {
    $('support-msg').textContent = '';
    $('dlg-support').showModal();
    setTimeout(function () { $($('support-email').value ? 'support-text' : 'support-email').focus(); }, 30);
  }
  async function sendSupport() {
    const btn = $('support-send');
    $('support-msg').textContent = '';
    btn.disabled = true;
    try {
      await api('POST', '/api/supporto', { email: $('support-email').value, testo: $('support-text').value,
        versione: window.CASELLINO_VERSION || '', dispositivo: navigator.userAgent });
      $('support-text').value = '';
      $('dlg-support').close();
      toast('Messaggio mandato: la risposta arriva alla tua email.');
    } catch (e) {
      $('support-msg').textContent = e.data && e.data.motivo === 'posta_spenta'
        ? 'Da qui i messaggi non partono ancora: scrivi direttamente a supporto.casellino@gmail.com.' : e.message;
    } finally {
      btn.disabled = false;
    }
  }

  function renderAccountDialog(extra) {
    const box = $('account-body');
    box.textContent = '';
    if (!account.token) {
      $('account-title').textContent = 'Il tuo account';
      const into = gated() ? $('gate-body') : box;
      into.textContent = '';
      accountForm(into);
      return;
    }
    $('account-title').textContent = 'Account: ' + account.utente;
    if (extra && extra.done) box.append(h('p', { class: 'done-note' }, extra.done));
    worksList(box);
    accountDetails(box);
    box.append(h('p', { class: 'actions-inline account-end' },
      h('button', { type: 'button', onclick: openReport }, '🐞 Segnala un problema'),
      h('button', { type: 'button', onclick: signOut }, 'Esci'),
      h('button', { type: 'button', class: 'danger', onclick: deleteAccount }, 'Elimina l\'account')));
  }

  async function signOut() {
    const forget = confirm('Esco dall\'account.\n\nOK = tolgo anche il lavoro e le foto da questo dispositivo (consigliato se il computer non è tuo, per esempio in ufficio)\nAnnulla = restano qui, ma li ritrovi solo tu quando rientri');
    if (account.saving || (state.project.cloud && !isEmptyProject())) await cloudSave(false);
    try { await api('POST', '/api/esci', {}); } catch (e) { /* signed out anyway on this device */ }
    $('dlg-account').close();
    if (forget) {
      forgetAllPhotos();
      state.project = C.newProject();
    }
    lockOut('');
    account.utente = '';
    toast('Sei uscito dal tuo account.');
  }

  async function deleteAccount() {
    const pw = prompt('Per eliminare l\'account e tutti i lavori salvati lì e su questo dispositivo, scrivi la tua password. ' +
      'Non si torna indietro: se vuoi tenerne una copia, prima usa «Salva file».');
    if (!pw) return;
    try {
      await api('POST', '/api/elimina-account', { password: pw });
      $('dlg-account').close();
      forgetAllPhotos();
      state.project = C.newProject();
      lockOut('');
      account.utente = '';
      toast('Account eliminato.');
    } catch (e) { toast(e.message); }
  }

  function openAccount() {
    renderAccountDialog();
    $('dlg-account').showModal();
  }

  // ------------------------------------------------------------ official street lists

  function openList(town) {
    const dlg = $('dlg-list');
    $('list-town').textContent = town;
    $('list-text').value = (state.project.streetLists[C.norm(town)] || []).join('\n');
    $('osm-status').textContent = '';
    dlg.dataset.town = town;
    dlg.showModal();
  }

  async function downloadFromOsm() {
    const town = $('dlg-list').dataset.town;
    const status = $('osm-status');
    status.textContent = 'Scarico l\'elenco…';
    try {
      const names = {};
      (await osmStreetNames(town)).forEach(function (n) { names[C.norm(n)] = true; });
      const list = Object.keys(names).sort(function (a, b) { return a.localeCompare(b, 'it'); });
      if (!list.length) {
        status.textContent = 'Non ho trovato vie per «' + town + '». Controlla che il nome del comune sia scritto giusto.';
        return;
      }
      const ta = $('list-text');
      const merged = {};
      ta.value.split('\n').map(function (x) { return C.norm(x); }).filter(Boolean).concat(list)
        .forEach(function (n) { merged[n] = true; });
      ta.value = Object.keys(merged).sort(function (a, b) { return a.localeCompare(b, 'it'); }).join('\n');
      status.textContent = 'Trovati ' + list.length + ' nomi. Controllali e poi «Salva l\'elenco».';
    } catch (e) {
      status.textContent = 'Non riesco a scaricare l\'elenco: serve la connessione a internet. Puoi anche incollarlo a mano.';
    }
  }

  // ------------------------------------------------------------ files

  // Printing: PDF and compact Excel fill the A4 sheet with strips ('moduli': the 4 rows of a module
  // together, like the template; 'piani': one shelf row per line); the template Excel keeps one module per sheet.
  const LAYOUT_KEY = 'casellino.stampa';
  function printLayout() {
    const on = document.querySelector('input[name="print-layout"]:checked');
    return on ? on.value : 'moduli';
  }
  function exportPrint(kind) {
    document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
    try {
      const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      let sheets;
      if (kind === 'pdf') {
        const r = window.CasellinoPdf.buildPdf(state.project, fileBaseName(), printLayout());
        download(fileBaseName() + '.pdf', r.bytes, 'application/pdf');
        sheets = r.pages;
      } else if (kind === 'excel') {
        const r = X.buildCompactFiles(state.project, printLayout());
        download(fileBaseName() + '.xlsx', X.zip(r.files), xlsxType);
        sheets = r.pages;
      } else {
        download(fileBaseName() + ' - come il modello.xlsx', X.buildXlsx(state.project), xlsxType);
      }
      changed();
      const apart = state.project.linkPrint === 'adesivi' && hasLinks() ? downloadStickers(true) : 0;
      toast((sheets ? sheets + (sheets === 1 ? ' foglio' : ' fogli') + ' A4. ' : '') +
        'Stampa su A4 orizzontale a dimensioni reali (100%), senza «adatta alla pagina».' +
        (apart ? ' In più il PDF dei simbolini adesivi (A4 verticale): se il browser chiede, consenti i due file.' : ''));
    } catch (e) {
      toast('Non sono riuscito a crearlo: ' + e.message);
      note('stampa ' + kind + ': ' + e.message);
    }
  }

  /*
   * Controllo anomalie (Garadron, 26 November 2026): the numbers out of order in every street and square of every
   * sub-zone. It only shows them, with a button to the line: nothing is changed.
   */
  // "l'1", "l'8", "l'11", "dell'1"…: the article of a number as it is read
  const VOWEL_NUMBER = /^(8|1(\D|$)|11(\D|$))/;
  function theNumber(t) { return (VOWEL_NUMBER.test(t) ? 'l\'' : 'il ') + t; }
  function ofNumber(t) { return (VOWEL_NUMBER.test(t) ? 'dell\'' : 'del ') + t; }
  function checkAnomalies() {
    document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
    const box = $('anomalies-list');
    box.textContent = '';
    let total = 0, streets = 0;
    state.project.subzones.forEach(function (s, zi) {
      const list = C.orderAnomalies(s.route, s.town);
      if (!list.length) return;
      const sec = h('section', null, h('h3', null, 'Sottozona ' + (s.name || zi + 1)));
      list.forEach(function (a) {
        total += a.bad.length;
        streets++;
        const seq = h('p', { class: 'anom-seq' });
        a.seq.forEach(function (x, i) {
          if (i) seq.append(', ');
          seq.append(x.bad ? h('mark', null, x.text) : x.text);
        });
        const card = h('div', { class: 'anom' },
          h('p', null, h('b', null, a.street), ' · riga ' + (a.line + 1) + ' del giro · ' +
            (a.square ? 'piazza: i numeri uno dopo l\'altro, ' : 'i ' + a.parity + ' ') + a.way),
          seq);
        a.bad.forEach(function (b) {
          const where = b.before && b.after ? 'sta tra ' + theNumber(b.before) + ' e ' + theNumber(b.after)
            : b.before ? 'viene dopo ' + theNumber(b.before) : 'viene prima ' + ofNumber(b.after);
          card.append(h('p', { class: 'small' }, '⚠️ ' + theNumber(b.text).replace(/^./, function (x) { return x.toUpperCase(); }) + ' è fuori posto: ' + where + '.'));
        });
        card.append(h('p', null, h('button', { type: 'button', onclick: function () {
          $('dlg-anomalies').close();
          if (zi !== state.current) openSubzone(zi);
          setTimeout(function () { goToLine(a.line); }, 50);
        } }, 'Vai alla riga')));
        sec.append(card);
      });
      box.append(sec);
    });
    // the same number of the same street written more than once (Garadron, 26 November 2026)
    const dups = C.findDuplicates(state.project);
    if (dups.length) {
      const sec = h('section', null, h('h3', null, 'Civici ripetuti'));
      dups.forEach(function (d) {
        const card = h('div', { class: 'anom' },
          h('p', null, '⚠️ ', h('b', null, d.places[0].street + ' ' + d.places[0].number), ' è scritto ' + d.places.length + ' volte:'));
        d.places.forEach(function (x) {
          card.append(h('p', { class: 'small' }, '• ' + x.text + ' · riga ' + (x.line + 1) + ' del giro ',
            h('button', { type: 'button', onclick: function () {
              $('dlg-anomalies').close();
              if (x.zone !== state.current) openSubzone(x.zone);
              setTimeout(function () { goToLine(x.line); }, 50);
            } }, 'Vai alla riga')));
        });
        sec.append(card);
      });
      box.append(sec);
    }
    const said = [];
    if (total) said.push(total + (total === 1 ? ' civico fuori posto' : ' civici fuori posto') + ' in ' + streets + (streets === 1 ? ' riga' : ' righe') + ' (in giallo)');
    if (dups.length) said.push(dups.length + (dups.length === 1 ? ' civico ripetuto' : ' civici ripetuti'));
    $('anomalies-sum').textContent = said.length ? '⚠️ ' + said.join(' e ') + '.'
      : '✅ Nessuna anomalia: in tutte le vie e le piazze i civici sono in ordine e nessuno è ripetuto.';
    $('dlg-anomalies').showModal();
  }

  function hasLinks() { return state.project.subzones.some(function (x) { return /@\s*\d/.test(x.route); }); }
  // The PDF of the link symbols to stick on: one sticker per pigeonhole, as wide as the pigeonhole.
  function downloadStickers(quiet) {
    const r = window.CasellinoPdf.buildStickers(state.project, fileBaseName());
    if (!r) { if (!quiet) toast('Nessuna casella ha un simbolino: tocca una casella nella striscia e premi «🔗 Lega a un\'altra casella».'); return 0; }
    download(fileBaseName() + ' - simbolini adesivi.pdf', r.bytes, 'application/pdf');
    if (!quiet) toast(r.stickers + ' simbolini su ' + r.pages + (r.pages === 1 ? ' foglio' : ' fogli') + ' A4 verticale: stampa a dimensioni reali (100%) sulla carta adesiva e ritaglia lungo il tratteggio.');
    return r.stickers;
  }
  function wireLinkPrint() {
    const box = $('link-print');
    const show = function () {
      box.hidden = !hasLinks();
      const on = box.querySelector('input[value="' + (state.project.linkPrint === 'adesivi' ? 'adesivi' : 'strisce') + '"]');
      if (on) on.checked = true;
    };
    document.querySelector('.print-menu').addEventListener('toggle', show);
    box.addEventListener('change', function (e) {
      if (e.target.name !== 'link-print') return;
      state.project.linkPrint = e.target.value === 'adesivi' ? 'adesivi' : 'strisce';
      changed();
    });
    $('btn-stickers').addEventListener('click', function () {
      document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
      downloadStickers(false);
    });
  }

  /*
   * Long press (Garadron, 25 November 2026): holding a button, a menu or a pigeonhole opens a little window that says
   * what it is, what it is for and how it works. Each entry: [what it is on, title, what, why, how]; "what it is on"
   * is a selector or the start of the button's text. Without an entry, the button's own explanation (title).
   */
  // ------------------------------------------------------------ the dictation (Garadron, 26 November 2026)
  /*
   * «🎤 Detta il giro»: the route said aloud. The words go in the box at the bottom (from the voice recognition of the
   * phone or browser, or from the keyboard's microphone), CasellinoVoce turns them into lines of the route, and the
   * preview shows the strip as it grows. Nothing changes in the route until «✔ Fatto»: it is a draft. It adds at the
   * end, after a pigeonhole, or in place of one pigeonhole; it never takes away anything else.
   */
  const V = window.CasellinoVoce;
  const Recognizer = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const voice = { at: null, rec: null, want: false, interim: '', pending: null, ok: false, rulesDone: false };
  // What to say and what it is for; the example strip is drawn from the words by the real translator.
  const VOICE_RULES = [
    ['via Rossi 1 3 5 7', 'Dì la via, poi i civici uno dopo l\'altro: una casella per civico. Per cambiare via, dì la via nuova.'],
    ['via Rossi 41 due caselle', 'Una casella larga due. Anche «tre caselle».'],
    ['via Rossi 41 collega', 'Lo consegna un collega: riga spessa sotto il numero.'],
    ['via Rossi 41 due caselle collega', 'Tutte e due le cose insieme, nella stessa frase.'],
    ['via Rossi dal 9 al 15', 'Dal 9 al 15 sullo stesso lato della via: 9, 11, 13, 15.'],
    ['via Rossi dal 2 al 6 tutti', 'Tutti i numeri: 2, 3, 4, 5, 6.'],
    ['via Rossi dal 10 al 4', 'All\'indietro: 10, 8, 6, 4.'],
    ['via Rossi 2 barra 4', 'Una casella divisa dalla riga obliqua: 2 sopra, 4 sotto.'],
    ['via Rossi 35 A 35 B', 'Il civico con la lettera.'],
    ['via Rossi 7 via dei Gelsi 37 via Rossi 9', 'Una casella di un\'altra via in mezzo: dì l\'altra via, poi torna alla prima.'],
    ['nome Bar del Ponte due caselle', 'Una casella con un nome sotto (un bar, una ditta). Le cascine anche senza «nome»: «cascina Alta».'],
    ['nome Bar del Ponte simbolino 1 via Rossi 38 simbolino 1', 'Lo stesso simbolino lega due caselle: la posta del 38 la porti al bar.'],
    ['via Rossi 1 vuota 3 tre vuote', 'Caselle vuote: «vuota» per una, «tre vuote» per tre.'],
    ['via Rossi 1 3 fine fila', '«Fine fila»: il resto della fila resta vuoto e si continua sulla fila sotto. Anche «fine striscia».'],
    ['via Rossi 5 da controllare', 'La casella resta segnata in rosso, da guardare dopo.'],
    ['via Rossi 41 41 43', 'Ripetuto per sbaglio? Si scrive una volta sola.'],
    ['via Rossi 43 no 45', '«No» o «anzi» cambiano l\'ultimo numero.'],
    ['via Rossi 1 3 7 cancella 5', '«Cancella» toglie l\'ultima casella detta.'],
  ];
  const VOICE_DEMO = 'via Rossi 1 3 5 41 41 due caselle collega via dei Gelsi 37 via Rossi 43 no 45 nome Bar del Ponte simbolino 1 47 simbolino 1';

  function voiceAccepted() {
    if (voice.ok) return true;
    try { return localStorage.getItem('casellino.dettato') === '1'; } catch (e) { return false; }
  }
  // First the warning (once): then `then(first)`, first = true the first time.
  function needVoiceOk(then) {
    if (voiceAccepted()) { then(false); return; }
    voice.pending = then;
    $('dlg-voice-warn').showModal();
  }

  // A short strip drawn from some words said: the example of a rule.
  function voiceExample(said) {
    const p = C.newProject();
    const z = p.subzones[0];
    z.modules = { alaA: true, casello: false, alaB: false };
    z.route = V.translate(said).lines.join('\n');
    C.assignColors(p);
    const s = C.analyseProject(p)[0].strips[0];
    const used = s.cells.reduce(function (m, c) { return Math.max(m, c.end + 1); }, 0);
    const strip = Object.assign({}, s, { capacity: Math.max(used, 1), boundaries: [] });
    const el = h('div', { class: 'strip', style: '--n:' + strip.capacity });
    renderStrip(el, strip, -1, -1, { project: p, links: C.linkGroups(p) });
    return h('div', { class: 'strip-wrap voice-ex' }, el);
  }
  function voiceRule(r) {
    return h('div', { class: 'voice-rule' },
      h('p', null, h('b', null, '«' + r[0] + '»')), h('p', { class: 'small muted' }, r[1]), voiceExample(r[0]));
  }
  function renderVoiceRules() {
    if (voice.rulesDone) return;
    const box = $('voice-rules');
    box.textContent = '';
    box.append(h('h3', null, 'Come si detta'),
      h('p', { class: 'small muted' }, 'Parla come se lo dicessi a chi scrive. Quando una fila è piena si va avanti da soli sulla fila sotto; i colori si mettono da soli.'));
    VOICE_RULES.forEach(function (r) { box.append(voiceRule(r)); });
    voice.rulesDone = true;
  }

  // Where the new pigeonholes go, and the route with them: the draft.
  function voiceDraft() {
    const s = sz();
    const cells = C.allCells(state.analysis);
    const at = voice.at;
    const ins = at ? cells.findIndex(function (x) { return !x.foreign && x.line === at.cell.line && x.tok === at.cell.tok && x.top === at.cell.top && x.second === at.cell.second; })
      : cells.length - 1;
    let street = '';   // the numbers said first go to the street of the pigeonhole before
    for (let k = ins; k >= 0; k--) if (cells[k].top && cells[k].street) { street = cells[k].street; break; }
    const said = ($('voice-text').value + (voice.interim ? ' ' + voice.interim : '')).trim();
    const tr = V.translate(said, { street: street, streets: knownStreets(s.town).concat(cells.map(function (c) { return c.street; })) });
    const res = V.insertLines(s.route, at ? { line: at.cell.line, tok: at.cell.tok, top: at.cell.top, second: at.cell.second, replace: at.replace } : null, tr.lines);
    const n = C.parseRoute(tr.lines.join('\n'), s.town).items.filter(function (it) { return it.kind === 'cell'; }).length;
    return { tr: tr, res: res, n: n, ins: ins, cells: cells, at: at, said: said };
  }

  function voicePreview() {
    if (!$('dlg-voice').open) return;
    const d = voiceDraft();
    const clone = JSON.parse(JSON.stringify(state.project));
    clone.subzones[state.current].route = d.res.text;
    C.assignColors(clone);
    const a = C.analyseProject(clone)[state.current];
    const cells = C.allCells(a);
    const first = d.at && d.at.replace ? d.ins : d.ins + 1;
    const fresh = cells.slice(first, first + d.n);
    const focus = fresh[fresh.length - 1] || cells[Math.max(0, Math.min(first, cells.length - 1))];
    const strip = focus ? stripsOf(a).find(function (st) { return st.cells.indexOf(focus) >= 0; }) : null;
    const wrap = $('voice-strip');
    wrap.textContent = '';
    $('voice-strip-title').textContent = strip ? 'Anteprima · ' + stripTitle(strip) + ' · casella ' + (focus.start + 1) + ' di ' + strip.capacity
      : (focus ? '⚠️ Non entra più nei moduli' : 'Anteprima: qui vedi la striscia che cresce.');
    if (strip) {
      const el = h('div', { class: 'strip', style: '--n:' + strip.capacity });
      renderStrip(el, strip, -1, strip.cells.indexOf(focus), { project: clone, links: C.linkGroups(clone), fresh: fresh });
      wrap.append(el);
      const cell = el.querySelector('[data-idx="' + strip.cells.indexOf(focus) + '"]');
      if (cell) requestAnimationFrame(function () { wrap.scrollLeft = Math.max(0, cell.offsetLeft - wrap.clientWidth / 2 + cell.offsetWidth / 2); });
    }
    // what moves: the pigeonholes after the new ones
    const info = [];
    const removed = d.at && d.at.replace ? 1 : 0;
    if (!d.said) info.push(Recognizer ? 'Premi «🎤 Ascolta» e dì la via e i civici, come negli esempi qui sopra.' : 'Tocca la casella qui sotto e usa il 🎤 della tastiera: dì la via e i civici, come negli esempi qui sopra.');
    else if (!d.n) info.push('Ancora nessuna casella: dì un civico.');
    else info.push(d.at && d.at.replace ? 'Questa casella diventa: ' + d.tr.lines.join(' · ') : '➕ ' + d.n + (d.n === 1 ? ' casella nuova' : ' caselle nuove') + ' · nel giro: ' + d.tr.lines.join(' · '));
    const after = d.cells.slice(d.ins + 1);
    if (after.length && d.n - removed) {
      let rows = 0;
      after.forEach(function (c, k) { const nc = cells[first + d.n + k]; if (nc && (nc.m !== c.m || nc.i !== c.i)) rows++; });
      info.push('↪ ' + (after.length === 1 ? 'La casella dopo si sposta' : 'Le ' + after.length + ' caselle dopo si spostano') +
        (d.n - removed > 0 ? ' più avanti' : ' indietro') + (rows ? ' (' + rows + ' passano a un\'altra fila)' : '') + '.');
    }
    if (a.overflow.length > state.analysis.overflow.length) info.push('⚠️ ' + a.overflow.length + (a.overflow.length === 1 ? ' casella non entra' : ' caselle non entrano') + ' più nei moduli.');
    $('voice-info').textContent = info.join(' ');
    const notes = d.tr.notes.slice();
    if (d.tr.unknown.length) notes.push('Non ho capito «' + d.tr.unknown.join(' ') + '»: non l\'ho scritto.');
    $('voice-notes').textContent = notes.join(' ');
    $('voice-undo').disabled = !d.tr.entries.length;
  }
  const voicePreviewLater = debounce(voicePreview, 120);

  function voiceButtons() {
    const mic = $('voice-mic');
    mic.textContent = voice.want ? '⏸ Pausa' : '🎤 Ascolta';
    mic.classList.toggle('on', voice.want);
    mic.setAttribute('aria-pressed', voice.want ? 'true' : 'false');
  }
  function listen(on) {
    if (!Recognizer) return;
    if (!on) {
      voice.want = false;
      const r = voice.rec;
      voice.rec = null;
      try { if (r) r.stop(); } catch (e) { /* already stopped */ }
      voice.interim = '';
      $('voice-interim').textContent = '';
      voiceButtons();
      voicePreviewLater();
      return;
    }
    $('voice-text').blur();   // the keyboard goes down
    const r = new Recognizer();
    r.lang = 'it-IT';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = function (e) {
      if (voice.rec !== r) return;
      let rest = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) voiceSaid(e.results[i][0].transcript);
        else rest += e.results[i][0].transcript;
      }
      voice.interim = rest.trim();
      $('voice-interim').textContent = voice.interim;
      voicePreviewLater();
    };
    r.onerror = function (e) {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      voice.want = false;
      voice.rec = null;
      voiceButtons();
      $('voice-interim').textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Il browser non lascia usare il microfono: permettilo nelle impostazioni, poi riprova. Puoi usare anche il 🎤 della tastiera.'
        : 'Non riesco ad ascoltare adesso: riprova, oppure usa il 🎤 della tastiera.';
    };
    // the phone stops by itself after a silence: it starts again, until «Pausa»
    r.onend = function () {
      if (!voice.want || voice.rec !== r) return;
      try { r.start(); } catch (e) { voice.want = false; voice.rec = null; voiceButtons(); }
    };
    voice.rec = r;
    voice.want = true;
    try { r.start(); } catch (e) { voice.want = false; voice.rec = null; }
    voiceButtons();
  }
  function voiceSaid(text) {
    const ta = $('voice-text');
    ta.value = (ta.value.replace(/\s+$/, '') + ' ' + String(text).trim()).trim();
    ta.scrollTop = ta.scrollHeight;
    voice.interim = '';
  }

  function startVoice() {
    document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
    needVoiceOk(function (first) {
      const s = sz();
      if (!s.route.trim()) { openVoice(null, first); return; }
      const n = C.allCells(state.analysis).length;
      $('voice-from-end').disabled = !!s.locked;
      $('voice-from-point').disabled = !!s.locked;
      $('voice-start-note').textContent = s.locked
        ? '🔒 Il giro è bloccato: a voce puoi solo cambiare una casella. Per aggiungere, prima sbloccalo.'
        : 'Il giro ha già ' + n + (n === 1 ? ' casella' : ' caselle') + '. Di solito si continua dalla fine. Niente cambia finché non premi «✔ Fatto».';
      $('dlg-voice-start').dataset.first = first ? '1' : '';
      $('dlg-voice-start').showModal();
    });
  }
  function voiceFrom(c, replace) {
    needVoiceOk(function (first) { openVoice({ cell: c, replace: replace }, first); });
  }
  function startVoicePick(mode) {
    stopLink();
    state.voicePick = mode;
    document.body.append(h('div', { class: 'link-bar', role: 'status' },
      h('p', null, mode === 'change' ? '✏️ Tocca nella striscia la casella da cambiare a voce.' : '➕ Tocca nella striscia la casella dopo cui aggiungere.'),
      h('button', { type: 'button', onclick: stopVoicePick }, 'Annulla')));
    if (state.els.strips) state.els.strips.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function stopVoicePick() {
    state.voicePick = null;
    const bar = document.querySelector('.link-bar');
    if (bar) bar.remove();
  }

  function openVoice(at, first) {
    const s = sz();
    if (s.locked && !(at && at.replace)) { toast('Il giro è bloccato: a voce puoi solo cambiare una casella. Per aggiungere, prima sbloccalo.'); return; }
    voice.at = at;
    voice.interim = '';
    $('voice-text').value = '';
    $('voice-interim').textContent = '';
    $('voice-where').textContent = at ? (at.replace ? '✏️ Cambi: ' : '➕ Dopo: ') + cellName(at.cell)
      : (s.route.trim() ? '▶ Continui dalla fine del giro' : '▶ Il giro comincia qui') + (s.name ? ' della ' + s.name : '');
    $('voice-mic').hidden = !Recognizer;
    $('voice-nomic').hidden = !!Recognizer;
    renderVoiceRules();
    $('dlg-voice').showModal();
    voiceButtons();
    voicePreview();
    if (first) openVoiceTutorial(1);
    else if (Recognizer) listen(true);
  }
  function voiceUndo() {
    const d = voiceDraft();
    const last = d.tr.entries[d.tr.entries.length - 1];
    if (!last) return;
    const ta = $('voice-text');
    ta.value = ta.value.slice(0, last.from).replace(/\s+$/, '');
    voice.interim = '';
    voicePreview();
  }
  function voiceCancel() {
    if ($('voice-text').value.trim() && !confirm('Butto via quello che hai dettato? Il giro resta com\'era.')) return;
    listen(false);
    $('dlg-voice').close();
  }
  function voiceDone() {
    listen(false);
    const d = voiceDraft();
    if (!d.n) {
      $('dlg-voice').close();
      if (d.said) toast(d.at && d.at.replace ? 'Non hai detto un civico: la casella resta com\'era.' : 'Non hai detto nessun civico: il giro resta com\'era.');
      return;
    }
    const s = sz();
    s.route = d.res.text;
    s.mark = { line: d.res.first, tok: null, at: Date.now() };
    if (state.els.ta) { state.els.ta.value = s.route; fitTextarea(state.els.ta); }
    changed();
    refreshRoute();
    refreshSide();
    showMark();
    $('dlg-voice').close();
    toast(d.at && d.at.replace ? '✏️ Casella cambiata.' : '🎤 ' + (d.n === 1 ? 'Aggiunta 1 casella' : 'Aggiunte ' + d.n + ' caselle') + ' al giro. Alla fine premi «🔎 Controllo anomalie».');
  }

  // ---- the tutorial of the dictation: the warning first, then the rules with their strips, and a try to watch
  let vtPage = 0, vtDemo = null;
  const VOICE_TUT = [
    ['🤫 Prima di tutto: il silenzio', null, 'warn'],
    ['1 · Come si comincia', 'Premi <b>«🎤 Detta il giro»</b>. Dì la <b>via</b> e poi i <b>civici</b>, uno dopo l\'altro. Quando cambia via, dì la via nuova e continua con i numeri. Le file vanno avanti da sole, i colori si mettono da soli.', [0]],
    ['2 · Caselle larghe e collega', 'Quello che dici <b>dopo un civico</b> è per quella casella.', [1, 2, 3]],
    ['3 · Tanti numeri insieme', '«dal … al …»: sullo stesso lato, tutti, o all\'indietro.', [4, 5, 6]],
    ['4 · Barra e lettere', null, [7, 8]],
    ['5 · Un\'altra via in mezzo, nomi e simbolini', null, [9, 10, 11]],
    ['6 · Vuote, fine fila, da controllare', null, [12, 13, 14]],
    ['7 · Se ti impappini', 'Succede a tutti: Casellino sbroglia.', [15, 16, 17]],
    ['8 · Pausa e correzioni', 'In basso c\'è sempre quello che hai detto. <b>«⏸ Pausa»</b> ferma l\'ascolto: tocca il testo, si apre la tastiera e correggi. Premi <b>«🎤 Ascolta»</b>: la tastiera si chiude e si riparte. <b>«↶ Togli l\'ultima»</b> toglie l\'ultima casella detta. Sotto vedi l\'anteprima della striscia, con le caselle nuove contornate.', null],
    ['9 · Da dove partire', 'Se il giro ha già qualcosa, Casellino chiede da dove: <b>«▶ Continua dalla fine»</b> (il solito), <b>«➕ Aggiungi da un punto»</b> (tocchi una casella: quello che detti va subito dopo) o <b>«✏️ Cambia una casella»</b> (la detti come deve essere: cambia solo quella). Anche dalla casella toccata: «🎤 Detta da qui» e «🎤 Cambiala a voce». <b>Il dettato non cancella mai niente</b>, e finché non premi «✔ Fatto» il giro resta com\'era. Su un giro bloccato 🔒 si può solo cambiare una casella.', null],
    ['10 · Guarda una prova', 'Ecco un pezzo di giro dettato, parola per parola, con la striscia che cresce.', 'demo'],
    ['Fatto', 'Premi <b>«✔ Fatto»</b>: tutto va nel giro. Poi un giro di <b>«🔎 Controllo anomalie»</b>. Le frasi le ritrovi sempre nella finestra del dettato, sopra, e questo tutorial in «❔ Come si detta» e in «Altro».', null],
  ];
  function stopVoiceDemo() { clearInterval(vtDemo && vtDemo.timer); vtDemo = null; }
  function voiceDemo(box) {
    const words = VOICE_DEMO.split(' ');
    const said = h('p', { class: 'vt-said' });
    const strip = h('div');
    const play = h('button', { type: 'button', class: 'primary' }, '⏸ Pausa');
    const again = h('button', { type: 'button' }, '↺ Da capo');
    let k = 0;
    const show = function () {
      const text = words.slice(0, k).join(' ');
      said.textContent = text ? '🎤 «' + text + '»' : '🎤 …';
      strip.textContent = '';
      if (text) strip.append(voiceExample(text));
    };
    const run = function () {
      stopVoiceDemo();
      vtDemo = { timer: setInterval(function () {
        if (k >= words.length) { stopVoiceDemo(); play.textContent = '▶ Riguarda'; return; }
        k++;
        show();
      }, 650) };
      play.textContent = '⏸ Pausa';
    };
    play.addEventListener('click', function () {
      if (vtDemo) { stopVoiceDemo(); play.textContent = '▶ Riprendi'; return; }
      if (k >= words.length) k = 0;
      run();
    });
    again.addEventListener('click', function () { k = 0; show(); run(); });
    box.append(said, strip, h('p', { class: 'actions-inline' }, play, again));
    show();
    run();
  }
  function showVoiceTutorial(k) {
    stopVoiceDemo();
    vtPage = Math.max(0, Math.min(VOICE_TUT.length - 1, k));
    const page = VOICE_TUT[vtPage];
    const box = $('vt-pages');
    box.textContent = '';
    box.scrollTop = 0;
    box.append(h('h3', null, page[0]));
    if (page[2] === 'warn') {
      const warn = $('voice-warn-text').cloneNode(true);
      warn.removeAttribute('id');
      box.append(warn);
    }
    if (page[1]) {
      const p = h('p');
      p.innerHTML = page[1];
      box.append(p);
    }
    if (Array.isArray(page[2])) page[2].forEach(function (i) { box.append(voiceRule(VOICE_RULES[i])); });
    if (page[2] === 'demo') voiceDemo(box);
    $('vt-count').textContent = (vtPage + 1) + ' di ' + VOICE_TUT.length;
    $('vt-back').disabled = vtPage === 0;
    $('vt-next').textContent = vtPage === VOICE_TUT.length - 1 ? 'Ho capito ✓' : 'Avanti ▶';
  }
  function openVoiceTutorial(k) {
    document.querySelectorAll('.menu').forEach(function (m) { m.open = false; });
    listen(false);
    showVoiceTutorial(k || 0);
    if (!$('dlg-voice-tut').open) $('dlg-voice-tut').showModal();
  }

  function wireVoice() {
    $('btn-voice-menu').addEventListener('click', startVoice);
    $('btn-voice-tut').addEventListener('click', function () { openVoiceTutorial(0); });
    $('help-voice-tut').addEventListener('click', function () { $('dlg-help').close(); openVoiceTutorial(0); });
    $('tut-voice').addEventListener('click', function () { $('dlg-tutorial').close(); openVoiceTutorial(0); });
    $('dlg-voice-warn').addEventListener('close', function () {
      const then = voice.pending;
      voice.pending = null;
      if ($('dlg-voice-warn').returnValue !== 'ok') return;
      const first = !voiceAccepted();
      voice.ok = true;
      try { localStorage.setItem('casellino.dettato', '1'); } catch (e) { /* only a convenience */ }
      if (then) then(first);
    });
    $('dlg-voice-start').addEventListener('close', function () {
      const dlg = $('dlg-voice-start'), v = dlg.returnValue;
      if (v === 'end') openVoice(null, dlg.dataset.first === '1');
      else if (v === 'after' || v === 'change') startVoicePick(v);
    });
    $('voice-mic').addEventListener('click', function () { listen(!voice.want); });
    $('voice-undo').addEventListener('click', voiceUndo);
    $('voice-cancel').addEventListener('click', voiceCancel);
    $('voice-done').addEventListener('click', voiceDone);
    $('voice-quiet').addEventListener('click', function () { voice.pending = null; listen(false); $('dlg-voice-warn').showModal(); });
    $('voice-tut').addEventListener('click', function () { openVoiceTutorial(1); });
    const ta = $('voice-text');
    ta.addEventListener('focus', function () { if (voice.want) listen(false); });   // to correct by hand: the listening pauses
    ta.addEventListener('input', voicePreviewLater);
    const dlg = $('dlg-voice');
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); voiceCancel(); });
    dlg.addEventListener('close', function () { listen(false); });
    $('vt-next').addEventListener('click', function () {
      if (vtPage >= VOICE_TUT.length - 1) $('dlg-voice-tut').close(); else showVoiceTutorial(vtPage + 1);
    });
    $('vt-back').addEventListener('click', function () { showVoiceTutorial(vtPage - 1); });
    $('vt-exit').addEventListener('click', function () { $('dlg-voice-tut').close(); });
    $('dlg-voice-tut').addEventListener('close', stopVoiceDemo);
  }

  const HINTS = [
    ['.voice-btn, #btn-voice-menu', '🎤 Detta il giro', 'Scrivi il giro a voce: dici la via e i civici, Casellino li scrive.', 'È il modo più veloce e più lineare dopo le foto: niente da ricopiare a mano.', 'La prima volta leggi l\'avviso (si detta in silenzio). Se il giro ha già qualcosa, scegli da dove: dalla fine, da un punto o una casella sola. Niente cambia finché non premi «✔ Fatto».'],
    ['#btn-voice-tut, #voice-tut, #tut-voice, #help-voice-tut', '❔ Come si detta', 'Il tutorial del dettato.', 'Per vedere tutte le frasi da dire, ognuna con la sua striscia, e una prova dal vivo.', 'Si sfoglia con «Avanti» e «Indietro»; «Esci» lo chiude.'],
    ['#voice-mic', '🎤 Ascolta / ⏸ Pausa', 'Accende e spegne l\'ascolto.', 'In pausa puoi correggere il testo con la tastiera.', 'Premi per ascoltare: la tastiera si chiude. Premi di nuovo per la pausa, poi tocca il testo per correggere.'],
    ['#voice-undo', '↶ Togli l\'ultima', 'Toglie l\'ultima casella detta.', 'Se Casellino ha capito male l\'ultima cosa.', 'Taglia il testo dove comincia l\'ultima casella. Anche a voce: «cancella».'],
    ['#voice-done', '✔ Fatto', 'Mette nel giro quello che hai dettato.', 'Fino a qui era tutto una bozza: il giro non cambiava.', 'Le caselle vanno dove hai scelto (alla fine, dopo una casella o al posto di una). Poi premi «🔎 Controllo anomalie».'],
    ['#voice-quiet', '🤫 Silenzio intorno?', 'Il promemoria dell\'avviso del dettato.', 'Con rumore o colleghi che parlano, Casellino scrive anche quello che non è un civico.', 'Toccalo per rileggere l\'avviso.'],
    [/^🎤 Detta da qui/, '🎤 Detta da qui', 'Aggiunge a voce delle caselle subito dopo questa.', 'Per inserire un pezzo dimenticato senza riscrivere il resto.', 'Le caselle dopo si spostano più avanti: l\'anteprima ti dice quante, prima di «✔ Fatto».'],
    [/^🎤 Cambiala a voce/, '🎤 Cambiala a voce', 'Riscrive a voce solo questa casella.', 'Per correggere una casella senza toccare le altre, anche su un giro bloccato.', 'Detta come deve essere, per esempio «41 due caselle collega», poi «✔ Fatto».'],
    ['#btn-theme', '☀️/🌙 Giorno e notte', 'L\'interruttore tra pagina chiara e pagina scura.', 'Di sera o al buio la pagina scura stanca meno gli occhi.', 'All\'inizio segue il telefono o il computer. Toccalo per scegliere tu: la scelta resta, anche quando riapri.'],
    ['#btn-home, #gate-home', '📲 Metti Casellino nella Home', 'I passi per avere Casellino nella Home, con la sua icona.', 'Così si apre come un\'app, anche senza internet.', 'Il tuo telefono è già scelto: segui i passi. Su iPhone si passa da Safari: «Copia il link» ti porta lì.'],
    ['#btn-share, #btn-share-menu', '📤 Condividi', 'Il link di Casellino da mandare ai colleghi.', 'Così anche loro scrivono il giro e stampano le strisce, gratis.', 'Sul telefono si apre la condivisione (WhatsApp, email…). Sul computer il link si copia e compare il codice QR da inquadrare.'],
    ['#btn-tutorial', '📖 Tutorial', 'Il giro guidato di Casellino, a fumetti.', 'Per imparare a fare le foto del casello e a usare i tasti.', 'Si sfoglia con «Continua» e ◀; «Salta» lo chiude. Si riapre quando vuoi da qui.'],
    ['#btn-account', '👤 Il tuo account', 'Il tuo account di Casellino: i tuoi lavori, il nome, l\'email, Esci.', 'Per ritrovare il tuo giro su un altro telefono o computer.', 'Senza account Casellino non si apre: così i tuoi giri li vedi solo tu.'],
    ['#btn-news', '🆕 Novità', 'Le ultime novità di Casellino, solo le essenziali.', 'Per sapere che cosa c\'è di nuovo dopo un aggiornamento.', 'Compaiono da sole una volta, appena entri dopo un aggiornamento. Da qui le rileggi quando vuoi.'],
    ['#btn-open', 'Apri', 'Apre un file di Casellino salvato prima (o un Excel o un testo).', 'Per riprendere un giro salvato in un file o arrivato da un collega.', 'Scegli il file: il giro che c\'era sullo schermo viene sostituito.'],
    ['#btn-save', 'Salva file', 'Salva tutto il lavoro in un file sul dispositivo.', 'È la copia di sicurezza: si riapre con «Apri», anche su un altro dispositivo.', 'Il file finisce nei download. Dal computer anche con Ctrl+S.'],
    ['.print-menu > summary', 'Stampa', 'Il menu per stampare le strisce.', 'Per avere le strisce di carta da mettere sotto le file del casello.', 'Scegli come mettere le strisce sul foglio, poi il PDF (consigliato) o l\'Excel. Stampa sempre a dimensioni reali (100%).'],
    ['#btn-pdf', '📄 PDF da stampare', 'Il file delle strisce pronto per la stampante.', 'Le caselle escono della misura giusta, uguali al modello.', 'Si apre e si stampa su A4 orizzontale, a dimensioni reali (100%), senza «adatta alla pagina».'],
    ['#btn-excel', '📊 Excel', 'Le strisce in un file Excel, tante per foglio.', 'Se vuoi ritoccarle a mano prima di stamparle.', 'Aprilo con Excel e stampa a dimensioni reali (100%).'],
    ['#btn-excel-model', '📊 Excel come il modello', 'Le strisce nell\'Excel uguale al modello: un modulo per foglio.', 'Per chi è abituato al modello di sempre.', 'Ogni foglio dell\'Excel è un modulo (casello o ala) con le sue 4 file.'],
    ['#link-print', '🔗 I simbolini', 'Dove stampare i simbolini delle caselle legate.', '«Dentro le strisce» restano per sempre; «a parte» sono adesivi che si staccano quando qualcuno cambia casa.', 'Scegli una delle due: con «a parte», insieme alle strisce arriva un PDF in più da stampare su carta adesiva e ritagliare.'],
    ['#btn-stickers', '🔗 PDF dei simbolini adesivi', 'Solo i simbolini da attaccare, senza le strisce.', 'Per ristampare gli adesivi senza rifare tutto.', 'Ogni adesivo è largo come la sua casella. Stampa a dimensioni reali (100%) sulla carta adesiva e ritaglia lungo il tratteggio; sotto c\'è scritto dove va.'],
    ['.menu:not(.print-menu) > summary', 'Altro', 'Gli altri comandi di Casellino.', 'Per le cose che si fanno ogni tanto.', 'Ricominciare, leggere le foto, aprire un Excel, «Come si scrive», segnalare un problema, il Supporto, condividere.'],
    ['#btn-new', 'Comincia da capo', 'Un giro nuovo, vuoto.', 'Per scrivere un\'altra zona.', 'Prima chiede se sei sicuro: salva il file se vuoi tenere quello di adesso.'],
    ['#btn-photos, .photo-btn', '📷 Le foto delle strisce', 'Casellino legge le foto del casello e scrive il giro da solo.', 'Per non ricopiare a mano centinaia di civici.', 'Scegli le foto nell\'ordine in cui le hai scattate, conferma il cartello, controlla i «?» e premi «Aggiungi al giro».'],
    ['#btn-open-excel', '📥 Apri un Excel già fatto', 'Prende il giro da un Excel delle strisce.', 'Se le strisce le hai già fatte in Excel.', 'Scegli il file: Casellino legge vie e civici.'],
    [/^(📝 )?Come si scrive/, 'Come si scrive', 'La spiegazione di come si scrive il giro a mano.', 'Per scrivere vie, civici, caselle larghe, numeri con la lettera o con la barra.', 'Si apre una pagina con gli esempi.'],
    ['#btn-bug', '🐞 Segnala un problema', 'Manda a chi fa Casellino una segnalazione.', 'Se qualcosa non va, così si sistema.', 'Scrivi che cosa è successo; puoi aggiungere una foto dello schermo.'],
    ['#btn-support', '✉️ Supporto', 'Scrivi a chi fa Casellino.', 'Per una domanda o un consiglio.', 'Scrivi il messaggio e la tua email: la risposta arriva lì.'],
    [/^👥/, '👥 Lo consegna un collega', 'Segna le caselle che porta un collega di un\'altra linea.', 'Chi smista vede subito che quella posta non è tua.', 'Tocca la casella nella striscia e premi il tasto: sotto il numero compare una riga spessa, anche nella stampa. Premi di nuovo per toglierla. Dal computer anche con il cursore sul civico nel giro.'],
    [/^🔗 Lega/, '🔗 Lega a un\'altra casella', 'Dà lo stesso simbolino (cerchio, stella, luna…) a due o più caselle, anche di vie diverse.', 'Quando la posta di chi abita lì la porti in un altro posto: per esempio i padroni di un bar, a cui la porti al bar.', 'Premi il tasto e poi tocca l\'altra casella nella striscia. Il simbolino ha un colore che si vede bene sulle vie di tutte e due. In «Stampa» scegli se averli dentro le strisce o su carta adesiva.'],
    [/^✖ Togli il simbolino/, '✖ Togli il simbolino', 'Toglie il simbolino da questa casella.', 'Quando qualcuno cambia casa e la posta torna a casa sua.', 'Se restava una casella sola con quel simbolino, lo toglie anche da lì.'],
    [/^🔎 Controllo anomalie/, '🔎 Controllo anomalie', 'Controlla l\'ordine dei civici in ogni via e piazza di tutto il casello, e i civici ripetuti.', 'Per trovare i numeri scritti fuori posto (per fretta, o aggiunti dopo), come 1, 3, 5, 9, 7, e quelli scritti più volte.', 'Mostra in giallo i civici fuori posto, riga per riga, con «Vai alla riga». Non cambia niente: un disordine voluto lo lasci, uno sbagliato lo correggi tu nel giro.'],
    [/^🔒 Blocca/, '🔒 Blocca il giro controllato', 'Blocca vie e civici di questa sottozona.', 'Così non si cambiano per sbaglio dopo averli controllati.', 'Si sblocca quando vuoi con «Sblocca».'],
    ['.cell.top', 'Una casella', 'Una casella del casello, con il suo civico.', 'Qui vedi come uscirà la striscia stampata.', 'Toccala per vedere via e civico e per i tasti: collega 👥, simbolino 🔗, mappa. Riga spessa sotto il numero: la porta un collega. Simbolino nell\'angolo: è legata ad altre caselle con lo stesso simbolino.'],
    ['.cell.run', 'Il nome della via', 'La riga di sotto della striscia, con il nome della via.', 'Il nome sta sotto tutte le caselle della sua via, nel suo colore.', 'Toccala per vedere la prima casella della via. Il colore si cambia nell\'elenco delle vie.'],
  ];
  function hintFor(el) {
    const target = el.closest('button, summary, a, .cell, fieldset, .mark-start, .mark-finger');
    if (!target) return null;
    const text = target.textContent.trim();
    const hit = HINTS.find(function (x) { return typeof x[0] === 'string' ? target.matches(x[0]) : x[0].test(text); });
    if (hit) return { title: hit[1], parts: [['Che cos\'è', hit[2]], ['A che serve', hit[3]], ['Come funziona', hit[4]]] };
    const own = target.getAttribute('title') || target.getAttribute('aria-label');
    return own ? { title: text.slice(0, 40) || 'Che cos\'è', parts: [['', own]] } : null;
  }
  function showHint(hint) {
    $('hint-title').textContent = hint.title;
    const box = $('hint-text');
    box.textContent = '';
    hint.parts.forEach(function (x) {
      if (x[0]) box.append(h('h3', null, x[0]));
      box.append(h('p', null, x[1]));
    });
    $('dlg-hint').showModal();
  }
  function wireHints() {
    let timer = null, start = null, shownAt = 0;
    const cancel = function () { clearTimeout(timer); timer = null; };
    document.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || $('dlg-hint').open) return;
      const hint = hintFor(e.target);
      if (!hint) return;
      start = { x: e.clientX, y: e.clientY };
      cancel();
      timer = setTimeout(function () { timer = null; shownAt = Date.now(); showHint(hint); }, 550);
    }, true);
    document.addEventListener('pointermove', function (e) {
      if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
    }, true);
    ['pointerup', 'pointercancel', 'scroll'].forEach(function (ev) { document.addEventListener(ev, cancel, true); });
    // the tap that ends a long press does not also press the button
    document.addEventListener('click', function (e) {
      if (Date.now() - shownAt < 900 && !e.target.closest('#dlg-hint')) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('contextmenu', function (e) {
      if (timer || Date.now() - shownAt < 900) e.preventDefault();
    }, true);
  }

  function saveFile() {
    download(fileBaseName() + '.json', JSON.stringify(state.project, null, 1), 'application/json');
    toast('File salvato. Riaprilo con «Apri» su questo o su un altro dispositivo.');
  }

  function openFile(file) {
    if (/\.xls[xm]?$/i.test(file.name)) { openExcel(file); return; }
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || '');
      let p = null;
      try { p = C.sanitizeProject(JSON.parse(text)); } catch (e) { p = C.textToProject(text); }
      setProject(p);
      toast('Aperto: ' + file.name);
    };
    reader.onerror = function () { toast('Non riesco a leggere il file.'); };
    reader.readAsText(file, 'utf-8');
  }

  // An Excel of strips made with the template (or by Casellino): it becomes the route of each sheet.
  async function openExcel(file) {
    if (/\.xls$/i.test(file.name)) { toast('Questo è un Excel vecchio (.xls): aprilo in Excel e salvalo come .xlsx, poi riprova.'); return; }
    if (!isEmptyProject() && !confirm("Apro l'Excel «" + file.name + '» al posto del lavoro aperto? Se ti serve, prima usa «Salva file».')) return;
    try {
      const r = await window.CasellinoImporta.importExcel(new Uint8Array(await file.arrayBuffer()));
      setProject(r.project);
      toast('Letto «' + file.name + '»: ' + r.project.subzones.length + (r.project.subzones.length === 1 ? ' sottozona' : ' sottozone') +
        '. Scrivi il comune di ognuna e controlla il giro.' + (r.skipped.length ? ' Fogli vuoti saltati: ' + r.skipped.join(', ') + '.' : ''));
    } catch (e) {
      toast(typeof DecompressionStream === 'undefined'
        ? 'Questo browser è troppo vecchio per leggere gli Excel: aggiornalo o usa un altro browser.'
        : "Non riesco a leggere l'Excel: " + e.message + '.');
    }
  }

  function setProject(p) {
    p.cloud = null;
    state.project = p;
    state.current = 0;
    state.selected = null;
    state.caret = null;
    changed();
    renderAll();
  }

  function isEmptyProject() {
    return state.project.subzones.every(function (s) { return !s.route.trim(); });
  }

  function loadExample() {
    if (!isEmptyProject() && !confirm('Carico l\'esempio al posto del lavoro aperto? Se ti serve, prima usa «Salva file».')) return;
    setProject(C.textToProject(EXAMPLE));
  }

  function renderAll() {
    renderProjectFields();
    renderTabs();
    renderSubzone();
    renderStreets();
    renderDuplicates();
    $('selection-card').hidden = true;
  }

  // ------------------------------------------------------------ start

  function wire() {
    $('zone').addEventListener('input', function (e) { state.project.zone = e.target.value; changed(); });
    $('owner').addEventListener('input', function (e) { state.project.owner = e.target.value; changed(); });
    $('btn-pdf').addEventListener('click', function () { exportPrint('pdf'); });
    $('btn-excel').addEventListener('click', function () { exportPrint('excel'); });
    $('btn-excel-model').addEventListener('click', function () { exportPrint('model'); });
    try {   // the last layout chosen on this device
      const saved = localStorage.getItem(LAYOUT_KEY);
      const radio = saved && document.querySelector('input[name="print-layout"][value="' + saved + '"]');
      if (radio) radio.checked = true;
    } catch (e) { /* storage blocked: the default stays */ }
    document.querySelectorAll('input[name="print-layout"]').forEach(function (r) {
      r.addEventListener('change', function () { try { localStorage.setItem(LAYOUT_KEY, r.value); } catch (e) { /* optional */ } });
    });
    $('btn-save').addEventListener('click', saveFile);
    $('btn-open').addEventListener('click', function () { $('file-input').click(); });
    $('file-input').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) openFile(f);
      e.target.value = '';
    });
    const closeMenu = function () { document.querySelectorAll('.menu').forEach(function (m) { m.open = false; }); };
    $('btn-new').addEventListener('click', function () {
      closeMenu();
      if (!isEmptyProject() && !confirm('Comincio da capo? Il lavoro aperto si perde, se non l\'hai salvato con «Salva file».')) return;
      setProject(C.newProject());
    });
    $('btn-import').addEventListener('click', function () { closeMenu(); $('import-text').value = ''; $('dlg-import').showModal(); });
    $('btn-export-text').addEventListener('click', function () {
      closeMenu();
      download(fileBaseName() + '.txt', C.projectToText(state.project), 'text/plain;charset=utf-8');
    });
    $('btn-example').addEventListener('click', function () { closeMenu(); loadExample(); });
    $('btn-help').addEventListener('click', function () { closeMenu(); $('dlg-help').showModal(); });
    $('btn-photos').addEventListener('click', function () { closeMenu(); openPhotos(); });
    $('btn-bug').addEventListener('click', openReport);
    $('btn-support').addEventListener('click', function () { closeMenu(); openSupport(); });
    wireLinkPrint();
    $('btn-anomalies-menu').addEventListener('click', checkAnomalies);
    wireHints();
    wireVoice();
    $('btn-share').addEventListener('click', share);
    $('btn-share-menu').addEventListener('click', share);
    $('share-copy').addEventListener('click', copyShareLink);
    wireTheme();
    $('support-send').addEventListener('click', sendSupport);
    $('bug-send').addEventListener('click', sendReport);
    $('btn-open-excel').addEventListener('click', function () { closeMenu(); $('file-input').click(); });
    $('dlg-import').addEventListener('close', function () {
      if ($('dlg-import').returnValue !== 'ok') return;
      const text = $('import-text').value;
      if (!text.trim()) return;
      setProject(C.textToProject(text));
      toast('Testo importato.');
    });
    $('btn-osm').addEventListener('click', downloadFromOsm);
    $('dlg-list').addEventListener('close', function () {
      const dlg = $('dlg-list');
      if (dlg.returnValue !== 'ok') return;
      const list = $('list-text').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      const key = C.norm(dlg.dataset.town);
      if (list.length) state.project.streetLists[key] = list; else delete state.project.streetLists[key];
      changed(); renderStreets();
    });
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.menu').forEach(function (menu) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    });
    // A menu opens all inside the screen: on a phone "Altro" can end up alone at the left of a row.
    document.querySelectorAll('.menu').forEach(function (menu) {
      menu.addEventListener('toggle', function () {
        const list = menu.querySelector('.menu-list');
        list.style.left = ''; list.style.right = '';
        if (!menu.open || !list.getBoundingClientRect) return;
        const box = menu.getBoundingClientRect();
        const width = list.getBoundingClientRect().width;
        const screen = document.documentElement.clientWidth;
        const left = Math.max(8, Math.min(box.right - width, screen - 8 - width));
        list.style.right = 'auto';
        list.style.left = Math.round(left - box.left) + 'px';
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
      // Ctrl+S saves the work as a file (the browser would save the page instead)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        $('btn-save').click();
      }
    });
    // A dialog opens at its beginning: the browser scrolls to its first button, often the last thing in it.
    document.querySelectorAll('dialog').forEach(function (dlg) {
      new MutationObserver(function () { if (dlg.open) dlg.scrollTop = 0; }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
    });
    window.addEventListener('resize', debounce(function () { if (state.els.ta) { fitTextarea(state.els.ta); showMark(); } }, 200));
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveBeforeLeaving();
      else syncFromAccount();   // back on screen: maybe another device saved meanwhile
    });
    window.addEventListener('pagehide', saveBeforeLeaving);
    $('overview-card').addEventListener('toggle', renderOverview);
    $('btn-ov-fit').addEventListener('click', function () { overviewBig = false; renderOverview(); });
    $('btn-ov-big').addEventListener('click', function () { overviewBig = true; renderOverview(); });
    $('btn-ov-png').addEventListener('click', downloadOverview);
    $('map-card').addEventListener('toggle', showKnownRound);
    $('btn-route').addEventListener('click', calcRound);
    $('btn-optimize').addEventListener('click', optimizeRound);
    wirePhotos();
    wireTutorial();
    wirePreview();
    wireViewer();
    $('btn-account').addEventListener('click', openAccount);
    $('gate-support').addEventListener('click', openSupport);
    wireNews();
    wireHome();
    window.addEventListener('online', function () { if (account.token) cloudSave(false); });
    [['depot-town', 'comune'], ['depot-prov', 'provincia'], ['depot-street', 'via'], ['depot-number', 'civico']].forEach(function (f) {
      $(f[0]).addEventListener('input', function (e) {
        if (f[1] === 'provincia') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        state.project.depotAddr[f[1]] = e.target.value;
        state.project.depot = C.addressText(state.project.depotAddr);
        changed();
        renderDepotStatus();
      });
      $(f[0]).addEventListener('change', function () { findDepot(false); });  // once written, it is looked for on the map
    });
    $('depot-town').addEventListener('change', loadDepotStreets);
    $('depot-prov').addEventListener('change', loadDepotStreets);
    $('depot-coords-in').addEventListener('input', function (e) {
      const c = C.parseCoordinates(e.target.value);
      if (!c) return;
      e.target.value = '';
      setDepotPoint({ lat: c.lat, lng: c.lon }, 'mano');
      toast('Centro messo alle coordinate incollate. Guardalo sulla cartina: se serve, trascinalo.');
    });
    $('depot-street').addEventListener('focus', loadDepotStreets);
    $('depot-name').addEventListener('input', function (e) { state.project.depotName = e.target.value; changed(); });
    $('depot-fold').addEventListener('input', function () { renderDepotSummary(); });
    $('btn-depot-find').addEventListener('click', function () { findDepot(true); });
    $('btn-depot-map').addEventListener('click', pickDepotOnMap);
    $('btn-depot-gps').addEventListener('click', useMyPosition);
  }

  // Offline use and "add to home screen" when the page is served from a web address.
  function registerOffline() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    const hadOne = !!navigator.serviceWorker.controller;   // the first visit is not an update
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // look for a new version now and then, and when the page comes back on screen
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    }).catch(function () { /* works online anyway */ });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadOne) return;
      newVersion();
    });
  }

  /*
   * A new version arrived (Regola Mondiale of 15 November 2026): with nothing going on, the page reloads by itself
   * (the work is saved first); while something is going on (reading photos, a window open, writing), a note with
   * a button, and the person chooses when.
   */
  function newVersion() {
    const busy = function () {
      const a = document.activeElement;
      return photo.busy || !!document.querySelector('dialog[open]') ||
        (document.visibilityState === 'visible' && a && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName));
    };
    const reload = function () { saveBeforeLeaving(); location.reload(); };
    if (!busy()) { reload(); return; }
    if ($('update-note')) return;
    document.body.append(h('div', { class: 'update-note', id: 'update-note', role: 'status' },
      h('span', null, 'C\'è un aggiornamento di Casellino: ricarica per vedere le novità. Il lavoro resta salvato.'),
      h('button', { type: 'button', class: 'primary', onclick: reload }, 'Ricarica ora')));
  }

  function start() {
    if (window.CasellinoIcone) window.CasellinoIcone.start(document);   // the emoji drawn as line icons
    accountLoad();
    renderAccountButton();
    wire();
    const stored = storeLoad();
    const p = location.hash === '#esempio' ? C.textToProject(EXAMPLE) : stored;
    state.project = p || C.newProject();
    C.assignColors(state.project);
    renderAll();
    if (stored && p === stored) $('saved').textContent = 'Ripreso da questo dispositivo';
    const enter = function () {
      if (gated()) setGate(false);
      if (stored && p === stored) syncFromAccount();   // the account may have a newer copy (saved on another device)
      if (!window.CASELLINO_ANTEPRIMA) showNews(false);
    };
    if (!account.token && !window.CASELLINO_ANTEPRIMA) setGate(true);   // first the sign-in, then the work
    else if (!window.CASELLINO_ANTEPRIMA && !termsAccepted()) {
      termsGate(enter);   // signed in before the conditions existed: they come first, once
      api('GET', '/api/io').then(function (r) {   // already accepted on another device: no need to ask
        termsFromServer(r);
        if (termsAccepted() && gated() && account.token) { $('gate-intro').hidden = false; enter(); }
      }).catch(function () { /* no internet: the conditions stay on screen */ });
    } else {
      termsSend();
      enter();
    }
    const v = $('version');
    if (v && window.CASELLINO_VERSION) v.textContent = 'Versione ' + window.CASELLINO_VERSION;
    registerOffline();
    if (location.hash === '#nella-home') openHome();
  }

  start();
})();

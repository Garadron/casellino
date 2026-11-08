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
    ta.addEventListener('input', function () {
      s.route = ta.value;
      fitTextarea(ta);
      changed();
      onType();
      caretChangedLater();
    });
    ['click', 'keyup', 'focus'].forEach(function (ev) { ta.addEventListener(ev, caretChangedLater); });

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
            } }, 'Sblocca'))
        : h('p', { class: 'route-actions' },
            h('button', { type: 'button', class: 'primary photo-btn', onclick: openPhotos }, '📷 Carica e leggi le foto delle strisce'),
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
      ta, els.suggest, els.here, els.warnings,
      h('div', { class: 'now' }, els.nowTitle, els.nowWrap));
    fitTextarea(ta);
    refreshRoute();
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
  function slotPx() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot')) || 30;
  }

  function renderStrip(el, s, p, focusIdx) {
    const proj = state.project;
    const slot = slotPx();
    el.textContent = '';
    const sel = state.selected && state.selected.p === p ? state.selected.idx : -1;
    s.cells.forEach(function (c, idx) {
      const bg = '#' + C.colorOf(proj, c.key);
      const ink = '#' + C.textColorOf(proj, c.key);
      const unsure = /\?/.test(c.top + c.second + c.street);
      const tip = (c.foreign ? 'Della ' + c.foreign + ' · ' : '') + (c.street || 'senza via') + (c.top ? ' · ' + c.top : '') +
        (c.second ? ' / ' + c.second : '') + ' · casella ' + (c.start + 1) + (c.span > 1 ? '-' + (c.end + 1) : '') +
        ' · riga ' + (c.line + 1) + ' del giro';
      const pick = function () { select(p, idx); };
      const mark = (idx === sel ? ' sel' : '') + (idx === focusIdx ? ' here-cell' : '') + (c.foreign ? ' foreign' : '');
      const width = c.span * slot;
      let inside, size, cls = '';
      if (c.second) {
        size = diagPx(c.top, c.second, width, 32);
        inside = [h('span', { class: 'd1' }, c.top), h('span', { class: 'd2' }, c.second)];
        cls = ' diag';
      } else {
        const long = /\s/.test(c.top) && c.top.length > 4 * c.span;
        size = long ? fitPx(c.top, width, 10, 2) : fitPx(c.top, width, 13);
        inside = [c.top];
        cls = long ? ' long' : '';
      }
      el.append(h.apply(null, ['div', {
        class: 'cell top' + cls + (unsure ? ' unsure' : '') + mark,
        style: 'grid-column:' + (c.start + 1) + ' / ' + (c.end + 2) + ';background-color:' + bg + ';color:' + ink +
          ';--ink:' + ink + ';font-size:' + size + 'px',
        title: tip, onclick: pick, 'data-idx': idx,
      }].concat(inside)));
    });
    s.runs.forEach(function (r) {
      const idx = s.cells.findIndex(function (c) { return c.start === r.start; });
      const width = (r.end - r.start + 1) * slot;
      el.append(h('div', {
        class: 'cell run', title: r.street + (r.town ? ' · ' + r.town : ''),
        style: 'grid-column:' + (r.start + 1) + ' / ' + (r.end + 2) + ';background:#' + C.colorOf(proj, r.key) +
          ';color:#' + C.textColorOf(proj, r.key) + ';font-size:' + fitPx(r.street, width, 11) + 'px',
        onclick: function () { select(p, idx); },
      }, r.street));
    });
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
        h('p', { class: 'actions-inline' },
          h('button', { type: 'button', onclick: function () { goToLine(c.line); } }, 'Vai alla riga del giro'),
          q ? h('a', { class: 'btn', href: mapsLink(q), target: '_blank', rel: 'noopener' }, 'Apri in Google Maps') : null)));
    if (q) setMap(q);
    if (isTouch) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 21;
    ta.scrollTop = Math.max(0, line * lineHeight - ta.clientHeight / 3);
    ta.scrollIntoView({ block: 'center', behavior: 'smooth' });
    caretChanged();
  }

  // ------------------------------------------------------------ side panel

  const refreshSide = debounce(function () {
    renderStreets();
    renderDuplicates();
  }, 250);

  function renderStreets() {
    const p = state.project;
    const usage = {};
    const order = [];
    C.analyseProject(p).forEach(function (a, zi) {
      C.allCells(a).forEach(function (c) {
        if (!c.key) return;
        if (!usage[c.key]) { usage[c.key] = { street: c.street, town: c.town, n: 0, zones: {} }; order.push(c.key); }
        usage[c.key].n += c.span;
        usage[c.key].zones[zi] = true;
      });
    });
    const byTown = {};
    order.forEach(function (k) {
      const t = usage[k].town || '';
      (byTown[t] = byTown[t] || []).push(k);
    });
    const towns = Object.keys(byTown);
    p.subzones.forEach(function (s) {
      if (s.town && !towns.some(function (t) { return C.norm(t) === C.norm(s.town); })) towns.push(s.town);
    });

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
    $('streets-count').textContent = order.length ? '(' + order.length + ')' : '';
    if (!order.length) {
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
        const color = C.colorOf(p, k);
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
          h('span', { class: 'sw', style: 'background:#' + color + ';color:#' + C.textColorOf(p, k), title: 'Cambia colore: ' + C.paletteName(color) }, 'A', sel),
          h('button', { type: 'button', class: 'nm', title: 'Tocca per correggere il nome: ' + u.street, onclick: fix }, u.street),
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
      toast('Nome corretto in ' + r.lines + (r.lines === 1 ? ' riga' : ' righe') + ' del giro' + (same ? ', e unito a quello che c\'era già.' : '.'));
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
  async function geocode(q) {
    const j = await nominatim('search?limit=1&countrycodes=it&q=' + encodeURIComponent(q));
    return j.length ? { lat: +j[0].lat, lon: +j[0].lon } : null;
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
      const g = await geocode(q);
      geo[q] = g ? { lat: g.lat, lon: g.lon, found: i === 0 && stop.queries.length > 1 ? 'civico' : 'via' } : { found: 'no' };
      storeSave();
      if (g) return geo[q];
    }
    return null;
  }

  function knownPoint(stop) {
    for (let i = 0; i < stop.queries.length; i++) {
      const g = state.project.geo[stop.queries[i]];
      if (g && g.found !== 'no') return g;
    }
    return null;
  }

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
  const depotTapText = function () { return 'Tocca sulla mappa il punto di ' + depotWord() + ' (prima puoi ingrandire e spostare la mappa).'; };
  const depotWord = function () { return state.project.depotName ? '«' + state.project.depotName + '»' : 'l\'ufficio'; };

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
    // not on the free map: the other ways stand out, and Google Maps can give the coordinates
    const lost = !p && (notFound || missing);
    $('btn-depot-map').classList.toggle('on', lost);
    $('depot-coords').hidden = !lost;
    if (lost) $('depot-gmaps').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.addressText(state.project.depotAddr));
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
      round.depot = await locate({ queries: depotQueries() });
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
      const how = g ? ({ civico: 'trovata con il civico', via: 'trovata la via', mano: 'messa a mano' })[g.found] || 'trovata'
        : (s.asked ? 'non trovata' : 'da cercare');
      const placing = round.placing === s;
      ol.append(h('li', { class: g ? '' : (s.asked ? 'bad' : 'muted') },
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
        else setPoint(round.placing.queries[0], e.latlng);
        round.placing = null;
        renderStopList();
      });
    }
    if (!routeLayer) routeLayer = L.layerGroup().addTo(routeMap);
    setTimeout(function () { routeMap.invalidateSize(); }, 50);
    return L;
  }

  // A point corrected by hand: saved for that address, used from now on (round, optimization).
  function setPoint(query, latlng) {
    state.project.geo[query] = { lat: latlng.lat, lon: latlng.lng, found: 'mano' };
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
          .on('dragend', function (e) { setPoint(s.queries[0], e.target.getLatLng()); })
          .addTo(routeLayer);
        bounds.push([s.point.lat, s.point.lon]);
      });
      if (fit !== false && bounds.length) routeMap.fitBounds(bounds, { padding: [20, 20] });
    });
  }

  function loadStops() {
    round.stops = C.routeStops(state.project, state.current);
    round.stops.forEach(function (s) { s.point = knownPoint(s); s.asked = s.queries.every(function (q) { return state.project.geo[q]; }); });
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
      round.depot = await locate({ queries: depotQueries() });
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
      redraw(r.line);
      const found = round.stops.filter(function (s) { return s.point; }).length;
      total.textContent = 'Giro' + (sz().name ? ' della ' + sz().name : '') + ': ' + kmText(r.km) +
        (r.onRoads ? ' su strada, circa ' + Math.round(r.minutes) + ' minuti di guida senza le fermate' : ' in linea d\'aria (il calcolo su strada non ha risposto)') +
        (round.depot ? ', partendo e tornando a ' + depotWord() : ', senza l\'ufficio (scrivilo in alto)') + '. Tappe sulla mappa: ' + found + ' su ' + round.stops.length + '.';
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
      if (!depotQueries().length && !state.project.depotPoint) { status.textContent = 'Scrivi prima in alto il centro di partenza, o mettilo sulla mappa: il giro parte e torna lì.'; return; }
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
      const points = [round.depot].concat(round.stops.map(function (s) { return s.point; }));
      const m = await distanceMatrix(points);
      const now = round.stops.map(function (_, i) { return i + 1; });
      status.textContent = 'Cerco l\'ordine migliore…';
      await pause(30);
      const best = C.optimizeOrder(m.dist);
      const before = C.tourCost(m.dist, now) / 1000, after = C.tourCost(m.dist, best) / 1000;
      const order = best.map(function (x) { return x - 1; });
      const line = await roadRoute([round.depot].concat(order.map(function (i) { return round.stops[i].point; }), [round.depot]));
      redraw(null, true, line.line);
      const saved = before - after;
      status.textContent = m.onRoads ? 'Fatto, con le distanze su strada.' : 'Fatto, con le distanze in linea d\'aria (il calcolo su strada non ha risposto).';
      box.append(
        h('p', null, h('b', null, 'Giro di adesso: ' + kmText(before) + ' · Ottimizzato: ' + kmText(after)),
          saved > 0.05 ? ' (' + kmText(saved) + ' in meno, −' + Math.round(saved / before * 100) + '%)' : ' (il giro è già buono)'),
        h('p', { class: 'small muted' }, 'Sulla mappa il percorso ottimizzato è la linea verde tratteggiata. Ordine nuovo: ' +
          order.slice(0, 12).map(function (i) { return round.stops[i].street; }).join(' → ') + (order.length > 12 ? ' → …' : '')),
        saved > 0.05 ? h('p', { class: 'actions-inline' },
          h('button', { type: 'button', class: 'primary', onclick: function () { applyOrder(order); } }, 'Applica il nuovo ordine al giro')) : null);
    } catch (e) {
      status.textContent = 'Non riesco a ottimizzare: ' + e.message + '. Serve internet.';
    } finally {
      routeBusy = false;
    }
  }

  function applyOrder(order) {
    const s = sz();
    const warn = s.locked ? '\n\nIl giro è bloccato: cambio solo l\'ordine delle vie, i civici restano quelli controllati.' : '';
    if (!confirm('Riordino il giro della ' + (s.name || 'sottozona') + ' come l\'ottimizzazione? Cambia il posto delle vie nelle caselle. ' +
      'Il giro di adesso resta salvato: «Torna al giro di prima» lo rimette.' + warn)) return;
    const r = C.reorderRoute(s, round.stops, order);
    s.routeBefore = s.route;
    s.route = r.route;
    changed();
    renderSubzone();
    refreshSide();
    $('optimize-result').textContent = '';
    showKnownRound();
    toast('Giro riordinato.' + (r.dropped.length ? ' Ho tolto le righe delle caselle vuote (' + r.dropped.join(', ') + '): rimettile dove servono.' : ''));
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
  const photo = { files: [], index: 0, image: null, angle: 0, rect: null, view: null, worker: null, busy: false };
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

  // The photo turned by the chosen angle, at a given scale, on a canvas.
  function turned(scale) {
    const img = photo.image;
    const a = photo.angle * Math.PI / 180;
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

  function drawPhoto() {
    const stage = $('foto-canvas');
    if (!photo.image) { stage.width = stage.height = 0; return; }
    const box = $('foto-stage');
    const scale = Math.min(1, (box.clientWidth || 800) / photo.image.naturalWidth);
    const c = turned(scale);
    stage.width = c.width; stage.height = c.height;
    const g = stage.getContext('2d');
    g.drawImage(c, 0, 0);
    photo.view = { scale: scale };
    if (photo.rect) {
      const r = photo.rect;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, stage.width, r.y0);
      g.fillRect(0, r.y1, stage.width, stage.height - r.y1);
      g.fillRect(0, r.y0, r.x0, r.y1 - r.y0);
      g.fillRect(r.x1, r.y0, stage.width - r.x1, r.y1 - r.y0);
      g.strokeStyle = '#d93025'; g.lineWidth = 2;
      g.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    }
    $('foto-count').textContent = 'Foto ' + (photo.index + 1) + ' di ' + photo.files.length;
  }

  function showPhoto(i) {
    photo.index = i;
    photo.rect = null;
    photo.angle = 0;
    $('foto-rot').value = '0';
    if (i >= photo.files.length) {
      photo.image = null;
      drawPhoto();
      $('foto-count').textContent = 'Foto finite: controlla il testo e premi «Aggiungi al giro».';
      return;
    }
    const url = URL.createObjectURL(photo.files[i]);
    const img = new Image();
    img.onload = function () { photo.image = img; drawPhoto(); };
    img.src = url;
  }

  function stagePoint(e) {
    const c = $('foto-canvas');
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height };
  }

  async function readPhoto() {
    if (photo.busy || !photo.image) return;
    photo.busy = true;
    const status = $('foto-status');
    try {
      const w = await ocrWorker();
      // the chosen part at full size (or all the photo)
      const full = turned(1);
      const k = 1 / photo.view.scale;
      const r = photo.rect || { x0: 0, y0: 0, x1: full.width * photo.view.scale, y1: full.height * photo.view.scale };
      const x0 = Math.max(0, Math.round(r.x0 * k)), y0 = Math.max(0, Math.round(r.y0 * k));
      const cw = Math.min(full.width - x0, Math.round((r.x1 - r.x0) * k)), ch = Math.min(full.height - y0, Math.round((r.y1 - r.y0) * k));
      const data = full.getContext('2d').getImageData(x0, y0, cw, ch);
      const img = { width: data.width, height: data.height, data: data.data };
      const seg = F.segmentStrip(img);
      const S = 2;
      const up = F.cleanBand(img, seg.top, seg.split, S);
      const low = F.cleanBand(img, seg.split, seg.bottom, S, true);
      const toCanvas = function (band) {
        const c = imageToCanvas(band.width, band.height);
        c.getContext('2d').putImageData(new ImageData(band.data, band.width, band.height), 0, 0);
        return c;
      };
      const clusters = F.inkClusters(up);
      await w.setParameters({ tessedit_pageseg_mode: '8', tessedit_char_whitelist: '0123456789ABCDEFGHILMNOPQRSTUVZ/\\-' });
      const cells = [];
      for (let i = 0; i < clusters.length; i++) {
        status.textContent = 'Leggo i civici: ' + (i + 1) + ' di ' + clusters.length + '…';
        const res = await w.recognize(toCanvas(F.cropBand(up, clusters[i], 10)));
        const t = F.cleanNumber(res.data.text);
        if (t) cells.push({ x0: clusters[i].x0 / S, x1: clusters[i].x1 / S, top: t, unsure: res.data.confidence < 70, span: 1 });
      }
      status.textContent = 'Leggo i nomi delle vie…';
      await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' });
      const rn = await w.recognize(toCanvas(low));
      const phrases = F.streetPhrases(rn.data.words).map(function (p) { return { text: p.text, x0: p.x0 / S, x1: p.x1 / S }; });
      const lines = F.routeLines(cells, phrases);
      const out = $('foto-result');
      out.value += (out.value && !/\n$/.test(out.value) ? '\n' : '') + '# foto ' + (photo.index + 1) + ' (letta in automatico: da controllare)\n' +
        (lines.length ? lines.join('\n') : '# non ho letto niente: prova a raddrizzarla o a stringere il rettangolo') + '\n';
      status.textContent = cells.length + ' civici letti nella foto ' + (photo.index + 1) + '.';
      showPhoto(photo.index + 1);
    } catch (e) {
      status.textContent = 'Non riesco a leggere: ' + e.message;
    } finally {
      photo.busy = false;
    }
  }

  function openPhotos() {
    $('foto-result').value = '';
    $('foto-status').textContent = '';
    photo.files = [];
    showPhoto(0);
    $('foto-count').textContent = 'Scegli le foto.';
    $('dlg-foto').showModal();
  }

  function wirePhotos() {
    $('foto-files').addEventListener('change', function (e) {
      photo.files = Array.prototype.slice.call(e.target.files || []);
      if (photo.files.length) showPhoto(0);
    });
    $('foto-rot').addEventListener('input', function (e) { photo.angle = +e.target.value; photo.rect = null; drawPhoto(); });
    const stage = $('foto-canvas');
    let start = null;
    stage.addEventListener('pointerdown', function (e) { if (!photo.image) return; start = stagePoint(e); stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) {
      if (!start) return;
      const p = stagePoint(e);
      photo.rect = { x0: Math.min(start.x, p.x), y0: Math.min(start.y, p.y), x1: Math.max(start.x, p.x), y1: Math.max(start.y, p.y) };
      drawPhoto();
    });
    stage.addEventListener('pointerup', function () {
      start = null;
      if (photo.rect && (photo.rect.x1 - photo.rect.x0 < 20 || photo.rect.y1 - photo.rect.y0 < 10)) { photo.rect = null; drawPhoto(); }
    });
    $('foto-read').addEventListener('click', readPhoto);
    $('foto-skip').addEventListener('click', function () { showPhoto(photo.index + 1); });
    $('dlg-foto').addEventListener('close', function () {
      if ($('dlg-foto').returnValue !== 'ok') return;
      const text = $('foto-result').value.trim();
      if (!text) return;
      const s = sz();
      if (s.locked) { toast('Il giro è bloccato: sbloccalo per aggiungere quello letto dalle foto.'); return; }
      s.route = (s.route.replace(/\s+$/, '') + (s.route.trim() ? '\n' : '') + text + '\n');
      state.els.ta.value = s.route;
      fitTextarea(state.els.ta);
      changed();
      refreshRoute();
      refreshSide();
      toast('Aggiunto in fondo al giro: controlla le righe con «?».');
    });
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
      account.token = ''; accountStore(); renderAccountButton();
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

  // Saves the open work in the account (empty works are not saved). One save at a time.
  async function cloudSave(force, leaving) {
    if (!account.token || isEmptyProject()) return;
    if (account.saving) { account.again = true; return; }
    account.saving = true;
    const p = state.project;
    if (!p.cloud) p.cloud = { id: newWorkId(), versione: 0, aggiornato_il: 0 };
    const data = Object.assign({}, p, { cloud: null });
    try {
      const r = await api('PUT', '/api/lavori/' + p.cloud.id, { nome: workName(p), dati: JSON.stringify(data), versione: p.cloud.versione, forza: !!force }, leaving);
      if (state.project === p) {
        p.cloud.versione = r.versione;
        p.cloud.aggiornato_il = r.aggiornato_il;
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
  function accountForm(box) {
    const modes = { accedi: 'Accedi', registrati: 'Registrati', recupera: 'Password dimenticata' };
    const tabs = h('div', { class: 'tabs' });
    Object.keys(modes).forEach(function (m) {
      tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': m === accountMode ? 'true' : 'false',
        onclick: function () { accountMode = m; renderAccountDialog(); } }, modes[m]));
    });
    const user = h('input', { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'es. mario.rossi' });
    const pass = h('input', { type: 'password', autocomplete: accountMode === 'accedi' ? 'current-password' : 'new-password' });
    const code = h('input', { autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX-XXXX' });
    const email = h('input', { type: 'email', autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false', placeholder: 'es. nome@gmail.com' });
    const msg = h('p', { class: 'small bad' });
    const go = h('button', { type: 'submit', class: 'primary' },
      accountMode === 'accedi' ? 'Accedi' : (accountMode === 'registrati' ? 'Crea l\'account' : 'Cambia la password'));
    const fresh = accountMode === 'registrati';
    const form = h('form', { class: 'account-form' },
      h('label', null, 'Nome utente' + (fresh ? '' : ' (maiuscole o minuscole, è uguale)'), user),
      fresh ? h('p', { class: 'small hint' }, USER_TIP) : null,
      fresh ? h('label', null, 'La tua email', email) : null,
      accountMode === 'recupera' ? h('label', null, 'Codice di recupero (te l\'ho dato quando hai creato l\'account)', code) : null,
      h('label', null, accountMode === 'recupera' ? 'Password nuova (almeno 8 caratteri)' : 'Password' + (fresh ? ' (almeno 8 caratteri)' : ''), pass),
      msg, h('p', { class: 'actions-inline' }, go));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      msg.textContent = '';
      go.disabled = true;
      try {
        const path = accountMode === 'accedi' ? '/api/accedi' : (fresh ? '/api/registrati' : '/api/recupera');
        const r = await api('POST', path, { utente: user.value, password: pass.value, recupero: code.value, email: email.value });
        account.token = r.token; account.utente = r.utente;
        accountStore();
        renderAccountButton();
        afterSignIn(r.recupero, accountMode);
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        go.disabled = false;
      }
    });
    box.append(
      h('p', null, 'Con un account i tuoi lavori si salvano da soli mentre scrivi e li ritrovi da qualsiasi telefono o computer. È gratis.'),
      tabs, form,
      h('p', { class: 'small muted' }, 'Quando crei l\'account ti do un codice di recupero: scrivilo da qualche parte, serve se dimentichi la password. ' +
        'L\'email nel server resta nascosta: nessuno la può leggere, nemmeno da lì. Nell\'account si salvano solo i tuoi lavori.'));
    setTimeout(function () { user.focus(); }, 30);
  }
  const USER_TIP = 'Usa pure il tuo stesso nome utente che usi nel palmare se ti viene più facile da ricordare. Ma non la stessa password!';

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
  async function afterSignIn(recovery, mode) {
    if (!state.project.cloud && !isEmptyProject()) {
      await cloudSave(false);
      if (state.project.cloud) toast('Il lavoro aperto ora è salvato anche nel tuo account.');
    }
    renderAccountDialog(recovery ? { recovery: recovery, fresh: mode === 'registrati' } : null);
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
            (open ? ' · è quello aperto' : ''))),
          h('span', { class: 'actions-inline' },
            open ? null : h('button', { type: 'button', onclick: function () { $('dlg-account').close(); openWork(w.id); } }, 'Apri'),
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

  function renderAccountDialog(extra) {
    const box = $('account-body');
    box.textContent = '';
    if (!account.token) { $('account-title').textContent = 'Il tuo account'; accountForm(box); return; }
    $('account-title').textContent = 'Account: ' + account.utente;
    if (extra && extra.recovery) {
      box.append(h('div', { class: 'recovery' },
        h('p', null, h('b', null, extra.fresh ? 'Account creato. ' : 'Password cambiata. '), 'Questo è il tuo codice di recupero:'),
        h('p', { class: 'code' }, extra.recovery),
        h('p', { class: 'small' }, 'Scrivilo o fai una foto: serve se dimentichi la password. Non lo vedrai più.'),
        h('button', { type: 'button', onclick: function () {
          if (navigator.clipboard) navigator.clipboard.writeText(extra.recovery).then(function () { toast('Codice copiato.'); });
        } }, 'Copia il codice')));
    }
    worksList(box);
    accountDetails(box);
    box.append(h('p', { class: 'actions-inline account-end' },
      h('button', { type: 'button', onclick: signOut }, 'Esci'),
      h('button', { type: 'button', class: 'danger', onclick: deleteAccount }, 'Elimina l\'account')));
  }

  async function signOut() {
    const forget = confirm('Esco dall\'account.\n\nOK = tolgo anche il lavoro da questo dispositivo (consigliato se il computer non è tuo, per esempio in ufficio)\nAnnulla = il lavoro resta qui');
    if (account.saving || (state.project.cloud && !isEmptyProject())) await cloudSave(false);
    try { await api('POST', '/api/esci', {}); } catch (e) { /* signed out anyway on this device */ }
    account.token = ''; account.utente = '';
    accountStore();
    renderAccountButton();
    if (forget) {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nothing saved */ }
      state.project = C.newProject();
      state.current = 0;
      renderAll();
      savedLine('Uscito: su questo dispositivo non c\'è più niente');
    } else {
      state.project.cloud = null;
      changed();
    }
    $('dlg-account').close();
    toast('Sei uscito dal tuo account.');
  }

  async function deleteAccount() {
    const pw = prompt('Per eliminare l\'account e tutti i lavori salvati lì, scrivi la tua password. Non si torna indietro.');
    if (!pw) return;
    try {
      await api('POST', '/api/elimina-account', { password: pw });
      account.token = ''; account.utente = '';
      accountStore();
      state.project.cloud = null;
      changed();
      renderAccountButton();
      $('dlg-account').close();
      toast('Account eliminato. Il lavoro aperto resta su questo dispositivo.');
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
      toast((sheets ? sheets + (sheets === 1 ? ' foglio' : ' fogli') + ' A4. ' : '') +
        'Stampa su A4 orizzontale a dimensioni reali (100%), senza «adatta alla pagina».');
    } catch (e) {
      toast('Non sono riuscito a crearlo: ' + e.message);
    }
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
    window.addEventListener('resize', debounce(function () { if (state.els.ta) fitTextarea(state.els.ta); }, 200));
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveBeforeLeaving(); });
    window.addEventListener('pagehide', saveBeforeLeaving);
    $('overview-card').addEventListener('toggle', renderOverview);
    $('btn-ov-fit').addEventListener('click', function () { overviewBig = false; renderOverview(); });
    $('btn-ov-big').addEventListener('click', function () { overviewBig = true; renderOverview(); });
    $('btn-ov-png').addEventListener('click', downloadOverview);
    $('map-card').addEventListener('toggle', showKnownRound);
    $('btn-route').addEventListener('click', calcRound);
    $('btn-optimize').addEventListener('click', optimizeRound);
    wirePhotos();
    $('btn-account').addEventListener('click', openAccount);
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
    $('btn-depot-find').addEventListener('click', function () { findDepot(true); });
    $('btn-depot-map').addEventListener('click', pickDepotOnMap);
    $('btn-depot-gps').addEventListener('click', useMyPosition);
  }

  // Offline use and "add to home screen" when the page is served from a web address.
  function registerOffline() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* works online anyway */ });
  }

  function start() {
    accountLoad();
    renderAccountButton();
    wire();
    const stored = storeLoad();
    const p = location.hash === '#esempio' ? C.textToProject(EXAMPLE) : stored;
    state.project = p || C.newProject();
    C.assignColors(state.project);
    renderAll();
    if (stored && p === stored) $('saved').textContent = 'Ripreso da questo dispositivo';
    const v = $('version');
    if (v && window.CASELLINO_VERSION) v.textContent = 'Versione ' + window.CASELLINO_VERSION;
    registerOffline();
  }

  start();
})();

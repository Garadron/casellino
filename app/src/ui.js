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
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
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
      $('saved').textContent = 'Salvato su questo dispositivo alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      $('saved').textContent = 'Non riesco a salvare su questo dispositivo: usa «Salva file»';
    }
  }, 400);

  function changed() {
    C.assignColors(state.project);
    storeSave();
  }

  // ------------------------------------------------------------ top fields and tabs

  function renderProjectFields() {
    $('zone').value = state.project.zone;
    $('owner').value = state.project.owner;
  }

  function openSubzone(i) {
    state.current = i;
    state.selected = null;
    state.caret = null;
    renderTabs();
    renderSubzone();
    refreshSide();
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
    const town = h('input', { class: 'town', value: s.town, placeholder: 'es. Borgo Esempio', autocomplete: 'off' });
    town.addEventListener('input', function () { s.town = town.value; changed(); refreshRoute(); refreshSide(); });
    const pick = h('div', { class: 'modules-pick', role: 'group', 'aria-label': 'Moduli' });
    const labels = { alaA: 'Ala A (a sinistra)', casello: 'Casello', alaB: 'Ala B (a destra)' };
    C.MODULES.forEach(function (m) {
      const cb = h('input', { type: 'checkbox', checked: s.modules[m] });
      cb.addEventListener('change', function () {
        s.modules[m] = cb.checked;
        changed(); refreshRoute(); refreshSide();
      });
      pick.append(h('label', null, cb, labels[m] + ' · ' + C.MODULE_SLOTS[m]));
    });
    box.append(
      h('label', null, 'Sottozona', name),
      h('label', { class: 'grow-m' }, 'Comune', town),
      h('div', { class: 'grow' }, h('div', { class: 'small muted', style: 'margin-bottom:3px' }, 'Moduli, da sinistra a destra'), pick)
    );
    if (state.project.subzones.length > 1) {
      box.append(h('button', {
        type: 'button', class: 'danger',
        onclick: function () {
          if (!confirm('Elimino la sottozona ' + (s.name || state.current + 1) + ' con tutto il suo giro?')) return;
          state.project.subzones.splice(state.current, 1);
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
      h('p', { class: 'small muted hint' },
        'Scrivi il giro dall\'inizio alla fine, una via per riga. Le caselle si riempiono come le righe di un libro: ' +
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
  }

  function stripBox(s, p) {
    const strip = h('div', { class: 'strip', style: '--n:' + s.capacity });
    renderStrip(strip, s, p);
    const from = s.reserved ? ' · le prime ' + s.reserved + ' sono della ' + s.cells[0].foreign : '';
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
    C.analyseProject(p).forEach(function (a) {
      C.allCells(a).forEach(function (c) {
        if (!c.key) return;
        if (!usage[c.key]) { usage[c.key] = { street: c.street, town: c.town, n: 0 }; order.push(c.key); }
        usage[c.key].n += c.span;
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
    Object.keys(byTown).forEach(function (t) {
      if (Object.keys(byTown).length > 1) ul.append(h('li', { class: 'town-head' }, t || 'Comune non scritto'));
      const official = (p.streetLists[C.norm(t)] || []).map(comparable);
      byTown[t].sort(function (a, b) { return usage[a].street.localeCompare(usage[b].street, 'it'); }).forEach(function (k) {
        const u = usage[k];
        const color = C.colorOf(p, k);
        const sel = h('select', { 'aria-label': 'Colore di ' + u.street });
        const others = Object.keys(near[k] || {});
        C.PALETTE.forEach(function (c) {
          const clash = others.find(function (o) { return C.similarColors(C.colorOf(p, o), c.hex); });
          const clashName = clash && usage[clash] ? usage[clash].street : '';
          sel.append(h('option', { value: c.hex, selected: c.hex === color, disabled: !!clash && c.hex !== color },
            c.name + (clash ? ' (troppo simile a ' + (clashName || 'una via vicina') + ')' : '')));
        });
        sel.addEventListener('change', function () {
          p.streets[k] = { color: sel.value };
          changed(); refreshRoute(); renderStreets();
        });
        const unknown = official.length && official.indexOf(comparable(u.street)) < 0;
        ul.append(h('li', null,
          h('span', { class: 'sw', style: 'background:#' + color + ';color:#' + C.textColorOf(p, k), title: 'Cambia colore: ' + C.paletteName(color) }, 'A', sel),
          h('span', { class: 'nm', title: u.street }, u.street),
          unknown ? h('span', { class: 'flag', title: 'Questo nome non è nell\'elenco delle vie del comune' }, 'non in elenco') : null,
          h('span', { class: 'n' }, u.n)));
      });
    });
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
    const safe = town.replace(/\\/g, '').replace(/"/g, '\\"');
    const query = '[out:json][timeout:40];' +
      'area["boundary"="administrative"]["admin_level"="8"]["name"="' + safe + '"]->.a;' +
      '(way["highway"]["name"](area.a);' +
      'node["place"]["name"](area.a);way["place"]["name"](area.a);' +
      'node["name"~"^(cascina|cascine|contrada|localit)",i](area.a);way["name"~"^(cascina|cascine|contrada|localit)",i](area.a););' +
      'out tags;';
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const names = {};
      (json.elements || []).forEach(function (e) {
        const n = e.tags && e.tags.name;
        if (n) names[C.norm(n)] = true;
      });
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

  function exportExcel() {
    try {
      const bytes = X.buildXlsx(state.project);
      download(fileBaseName() + '.xlsx', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      changed();
      toast('Excel creato: stampalo su A4 orizzontale, al 100%, senza «adatta alla pagina».');
    } catch (e) {
      toast('Non sono riuscito a creare l\'Excel: ' + e.message);
    }
  }

  function saveFile() {
    download(fileBaseName() + '.json', JSON.stringify(state.project, null, 1), 'application/json');
    toast('File salvato. Riaprilo con «Apri» su questo o su un altro dispositivo.');
  }

  function openFile(file) {
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

  function setProject(p) {
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
    $('btn-excel').addEventListener('click', exportExcel);
    $('btn-save').addEventListener('click', saveFile);
    $('btn-open').addEventListener('click', function () { $('file-input').click(); });
    $('file-input').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) openFile(f);
      e.target.value = '';
    });
    const closeMenu = function () { document.querySelector('.menu').open = false; };
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
      const menu = document.querySelector('.menu');
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    window.addEventListener('resize', debounce(function () { if (state.els.ta) fitTextarea(state.els.ta); }, 200));
  }

  // Offline use and "add to home screen" when the page is served from a web address.
  function registerOffline() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* works online anyway */ });
  }

  function start() {
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

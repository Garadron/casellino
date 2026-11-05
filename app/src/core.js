/*
 * Casellino - core logic (no DOM).
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 *
 * A sub-zone is written as one "route" text, from the first pigeonhole to the last.
 * The sorting frame is always read like a page of a book: left to right, top to bottom.
 * So the route fills row 1 of every module from left to right (Ala A, Casello, Ala B),
 * then row 2, and so on. Each (row, module) pair is one printed paper strip.
 *
 * Works in the browser (window.CasellinoCore) and in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CasellinoCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Modules of a sorting frame, left to right, with their number of slots.
  // The numbers come from the official blank template and must not change.
  const MODULES = ['alaA', 'casello', 'alaB'];
  const MODULE_SLOTS = { alaA: 33, casello: 91, alaB: 33 };
  const MODULE_NAMES = { alaA: 'Ala A', casello: 'Casello', alaB: 'Ala B', ala: 'Ala' };
  const ROWS_PER_MODULE = 4;
  // Landscape A4 holds 23 slot columns of 1.244 cm on paper, but printers keep a small
  // margin and Excel then fits 22 (seen in a real export). The workbook sets a page break
  // every 22 slots, so the cut is always in the same place.
  const SLOTS_PER_PAGE = 22;
  const MAX_RANGE_ITEMS = 300;
  // Italian house-number letters skip J, K, W, X, Y (e.g. 20I, 20L, 20M).
  const IT_LETTERS = 'ABCDEFGHILMNOPQRSTUVZ';
  const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Colours for the strips: 71, the most different ones first (so a small zone gets very
  // distinct colours). Each one has the writing that reads best on it (contrast at least 7:1).
  // No colour is used twice in the same sub-zone; streets next to each other never get colours
  // that look alike (see similarColors).
  const PALETTE = [
    { name: 'giallo', hex: 'FFE135', text: '111111', dark: false },
    { name: 'blu', hex: '1F4E9E', text: 'FFFFFF', dark: true },
    { name: 'verde chiaro', hex: '8ED16B', text: '111111', dark: false },
    { name: 'rosso scuro', hex: '8B1A1A', text: 'FFF6C2', dark: true },
    { name: 'azzurro', hex: '6CCFF6', text: '111111', dark: false },
    { name: 'viola', hex: '5B2A94', text: 'FFFFFF', dark: true },
    { name: 'arancione', hex: 'FF9A2E', text: '111111', dark: false },
    { name: 'verde scuro', hex: '166136', text: 'FFFFFF', dark: true },
    { name: 'rosa', hex: 'F7A1CF', text: '111111', dark: false },
    { name: 'nero', hex: '151515', text: 'FFFFFF', dark: true },
    { name: 'grigio', hex: 'CFCFCF', text: '111111', dark: false },
    { name: 'marrone', hex: '6A3F22', text: 'FFFFFF', dark: true },
    { name: 'bianco', hex: 'FFFFFF', text: '111111', dark: false },
    { name: 'fucsia', hex: 'A11773', text: 'FFFFFF', dark: true },
    { name: 'indaco', hex: '1F1FD6', text: 'FFFFFF', dark: true },
    { name: 'verde', hex: '1FD61F', text: '111111', dark: false },
    { name: 'verde acqua chiaro', hex: '75F0D1', text: '111111', dark: false },
    { name: 'corallo chiaro', hex: 'F08E75', text: '111111', dark: false },
    { name: 'magenta', hex: '9517A1', text: 'FFFFFF', dark: true },
    { name: 'fucsia scuro', hex: '791558', text: 'FFFFFF', dark: true },
    { name: 'celeste scuro', hex: '155B79', text: 'FFFFFF', dark: true },
    { name: 'ambra chiaro', hex: 'F0C775', text: '111111', dark: false },
    { name: 'lampone', hex: 'A71848', text: 'FFFFFF', dark: true },
    { name: 'lime scuro', hex: '4B5F10', text: 'FFFFFF', dark: true },
    { name: 'blu chiaro', hex: '759EF0', text: '111111', dark: false },
    { name: 'rosso', hex: 'AE1919', text: 'FFFFFF', dark: true },
    { name: 'lime', hex: 'A8D61F', text: '111111', dark: false },
    { name: 'indaco chiaro', hex: '9898F4', text: '111111', dark: false },
    { name: 'magenta chiaro', hex: 'E575F0', text: '111111', dark: false },
    { name: 'blu notte', hex: '0F2350', text: 'FFFFFF', dark: true },
    { name: 'smeraldo', hex: '1FD66B', text: '111111', dark: false },
    { name: 'grigio scuro', hex: '555555', text: 'FFFFFF', dark: true },
    { name: 'indaco pastello', hex: 'C1C1F6', text: '111111', dark: false },
    { name: 'verde bosco', hex: '126512', text: 'FFFFFF', dark: true },
    { name: 'oro pastello', hex: 'F6EDC1', text: '111111', dark: false },
    { name: 'nocciola', hex: 'C2956E', text: '111111', dark: false },
    { name: 'fucsia chiaro', hex: 'F075C7', text: '111111', dark: false },
    { name: 'turchese', hex: '1FD0D6', text: '111111', dark: false },
    { name: 'verde pastello', hex: 'C1F6C1', text: '111111', dark: false },
    { name: 'turchese scuro', hex: '126365', text: 'FFFFFF', dark: true },
    { name: 'smeraldo chiaro', hex: '75F0A8', text: '111111', dark: false },
    { name: 'lime chiaro', hex: 'D1F075', text: '111111', dark: false },
    { name: 'rosa scuro', hex: '791537', text: 'FFFFFF', dark: true },
    { name: 'verde acqua pastello', hex: 'C1F6E9', text: '111111', dark: false },
    { name: 'rosa chiaro', hex: 'F0759E', text: '111111', dark: false },
    { name: 'rosso pastello', hex: 'F6C1C1', text: '111111', dark: false },
    { name: 'celeste', hex: '2CAAE0', text: '111111', dark: false },
    { name: 'ambra scuro', hex: '725314', text: 'FFFFFF', dark: true },
    { name: 'ambra', hex: 'D6991F', text: '111111', dark: false },
    { name: 'grigio medio', hex: '9E9E9E', text: '111111', dark: false },
    { name: 'marrone scuro', hex: '3E2414', text: 'FFFFFF', dark: true },
    { name: 'magenta pastello', hex: 'F2C1F6', text: '111111', dark: false },
    { name: 'verde acqua', hex: '1FD6A8', text: '111111', dark: false },
    { name: 'oro', hex: 'D6B81F', text: '111111', dark: false },
    { name: 'arancio', hex: 'E28839', text: '111111', dark: false },
    { name: 'arancio chiaro', hex: 'F0AE75', text: '111111', dark: false },
    { name: 'indaco scuro', hex: '151579', text: 'FFFFFF', dark: true },
    { name: 'magenta scuro', hex: '711579', text: 'FFFFFF', dark: true },
    { name: 'celeste pastello', hex: 'C1E6F6', text: '111111', dark: false },
    { name: 'rosso chiaro', hex: 'F17C7C', text: '111111', dark: false },
    { name: 'blu intenso', hex: '1B51BB', text: 'FFFFFF', dark: true },
    { name: 'verde menta', hex: '75F075', text: '111111', dark: false },
    { name: 'verde acqua scuro', hex: '105F4B', text: 'FFFFFF', dark: true },
    { name: 'viola chiaro', hex: 'B58AF2', text: '111111', dark: false },
    { name: 'viola intenso', hex: '6B1FD6', text: 'FFFFFF', dark: true },
    { name: 'oro chiaro', hex: 'F0DB75', text: '111111', dark: false },
    { name: 'arancio pastello', hex: 'F6DAC1', text: '111111', dark: false },
    { name: 'turchese chiaro', hex: '75ECF0', text: '111111', dark: false },
    { name: 'corallo scuro', hex: '792915', text: 'FFFFFF', dark: true },
    { name: 'blu pastello', hex: 'C1D2F6', text: '111111', dark: false },
    { name: 'blu scuro', hex: '153779', text: 'FFFFFF', dark: true },
  ];

  function norm(text) {
    return String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  // The same street written as "C.NA ALTA" or "CASCINA ALTA", or with a "?", is one street
  // (one colour, one line in the list of streets).
  const KEY_WORDS = [
    [/^C\.?\s*NA\b\.?\s*/, 'CASCINA '], [/^CNA\b\.?\s*/, 'CASCINA '], [/^V\.\s*LE\b\.?\s*/, 'VIALE '],
    [/^P\.\s*Z?ZA\b\.?\s*/, 'PIAZZA '], [/^V\.\s*/, 'VIA '], [/^LOC\.\s*/, 'LOCALITA '], [/\bF\.\s*LLI\b\.?/, 'FRATELLI'],
  ];
  function streetName(street) {
    let k = norm(street).replace(/\?/g, '');
    KEY_WORDS.forEach(function (w) { k = k.replace(w[0], w[1]); });
    return k.replace(/\s+/g, ' ').trim();
  }

  function streetKey(street, town) {
    return streetName(street) + '|' + norm(town);
  }

  function newSubzone(name, town) {
    return {
      id: 'sz' + Math.random().toString(36).slice(2, 9),
      name: name || '',
      town: town || '',
      modules: { alaA: false, casello: true, alaB: true },
      route: '',
    };
  }

  function newProject() {
    return {
      app: 'casellino',
      version: 2,
      zone: '',
      owner: '',
      subzones: [newSubzone('', '')],
      streets: {},      // streetKey -> { color: 'RRGGBB' }
      streetLists: {},  // norm(town) -> [street names] (official list, optional)
      geo: {},          // map query -> { lat, lon, found: 'civico' | 'via' } or { found: 'no' }
      depot: '',        // where the round starts and ends (the office), optional
      wall: null,       // the frame drawn by the user (modules left to right, pencil marks), optional
    };
  }

  // Files written before v0.5.0 used an older word for the big module: any key starting
  // with "casell" means "casello".
  function renameBigModule(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(function (k) { out[/^casell/i.test(k) ? 'casello' : k] = obj[k]; });
    return out;
  }

  // Makes an object loaded from a file safe to use (missing fields, wrong types).
  // Files of version 1 had one text per strip ("rows"): they become one route.
  function sanitizeProject(p) {
    const out = newProject();
    if (!p || typeof p !== 'object') return out;
    out.zone = String(p.zone || '');
    out.owner = String(p.owner || '');
    if (Array.isArray(p.subzones) && p.subzones.length) {
      out.subzones = p.subzones.map(function (s) {
        const sz = newSubzone(String(s && s.name || ''), String(s && s.town || ''));
        if (s && s.id) sz.id = String(s.id);
        const mods = renameBigModule(s && s.modules);
        MODULES.forEach(function (m) {
          if (typeof mods[m] === 'boolean') sz.modules[m] = mods[m];
        });
        if (s && typeof s.route === 'string') sz.route = s.route;
        else if (s && s.rows) sz.route = rowsToRoute(renameBigModule(s.rows), sz.modules, sz.town);
        return sz;
      });
    }
    if (p.streets && typeof p.streets === 'object') {
      Object.keys(p.streets).forEach(function (k) {
        const c = p.streets[k] && String(p.streets[k].color || '').replace('#', '').toUpperCase();
        if (/^[0-9A-F]{6}$/.test(c)) out.streets[k] = { color: c };
      });
    }
    if (p.geo && typeof p.geo === 'object') {
      Object.keys(p.geo).forEach(function (q) {
        const g = p.geo[q];
        if (g && g.found === 'no') out.geo[q] = { found: 'no' };
        else if (g && isFinite(g.lat) && isFinite(g.lon)) out.geo[q] = { lat: +g.lat, lon: +g.lon, found: g.found === 'via' ? 'via' : 'civico' };
      });
    }
    out.depot = String(p.depot || '');
    out.wall = sanitizeWall(p.wall, out.subzones);
    if (p.streetLists && typeof p.streetLists === 'object') {
      Object.keys(p.streetLists).forEach(function (k) {
        if (Array.isArray(p.streetLists[k])) out.streetLists[norm(k)] = p.streetLists[k].map(String);
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- parsing

  function expandNumberRange(a, b, step) {
    const out = [];
    const dir = a <= b ? 1 : -1;
    for (let n = a; dir > 0 ? n <= b : n >= b; n += dir * step) {
      out.push(String(n));
      if (out.length > MAX_RANGE_ITEMS) return null;
    }
    return out;
  }

  function expandLetters(num, from, to) {
    const f = from.toUpperCase(), t = to.toUpperCase();
    const alphabet = IT_LETTERS.indexOf(f) >= 0 && IT_LETTERS.indexOf(t) >= 0 ? IT_LETTERS : ALL_LETTERS;
    const i = alphabet.indexOf(f), j = alphabet.indexOf(t);
    if (i < 0 || j < 0) return null;
    const out = [];
    const dir = i <= j ? 1 : -1;
    for (let k = i; dir > 0 ? k <= j : k >= j; k += dir) out.push(num + alphabet[k]);
    return out;
  }

  // One comma-separated token -> list of pigeonholes, or { error }.
  function parseToken(token) {
    let t = token.trim();
    let span = 1;
    const spanMatch = /\(\s*(\d{1,2})\s*\)\s*$/.exec(t);
    if (spanMatch) {
      span = parseInt(spanMatch[1], 10);
      if (span < 1) return { error: 'una casella non può essere larga 0' };
      t = t.slice(0, spanMatch.index).trim();
    }
    // second: a second number in the same pigeonhole, split by a diagonal line ("2/4")
    const cell = function (top, second) { return { top: top, second: second || '', span: span }; };

    if (t === '' || /^(vuota|vuoto|_)$/i.test(t)) return { cells: [cell('')] };

    let m = /^(\d+)\s*\.\.\s*(\d+)$/.exec(t);
    if (m) {
      const a = +m[1], b = +m[2];
      const list = expandNumberRange(a, b, a % 2 === b % 2 ? 2 : 1);
      if (!list) return { error: '«' + t + '» fa troppi numeri' };
      return { cells: list.map(function (n) { return cell(n); }) };
    }
    m = /^(\d+)\s*-\s*(\d+)\s+(pari|dispari|tutti)$/i.exec(t);
    if (m) {
      let a = +m[1];
      const b = +m[2], kind = m[3].toLowerCase();
      const dir = a <= b ? 1 : -1;
      if (kind === 'pari' && a % 2 !== 0) a += dir;
      if (kind === 'dispari' && a % 2 === 0) a += dir;
      const list = expandNumberRange(a, b, kind === 'tutti' ? 1 : 2);
      if (!list) return { error: '«' + t + '» fa troppi numeri' };
      return { cells: list.map(function (n) { return cell(n); }) };
    }
    m = /^(\d+)\s*([A-Za-z])\s*\.\.\s*(\d+)?\s*([A-Za-z])$/.exec(t);
    if (m && (!m[3] || m[3] === m[1])) {
      const list = expandLetters(m[1], m[2], m[4]);
      if (list) return { cells: list.map(function (n) { return cell(n); }) };
    }

    const parts = t.split('/');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return { cells: [cell(parts[0].trim(), parts[1].trim())] };
    }
    return { cells: [cell(t)] };
  }

  const BREAKS = [
    [/^fine\s+striscia\.?$/i, 'strip'],
    [/^fine\s+fila\.?$/i, 'row'],
    [/^striscia\s+vuota\.?$/i, 'skip'],
  ];

  /*
   * Parses a route text. Returns { items, warnings }; items are, in order:
   *   { kind:'cell', street, town, key, top, second, span, line, tok }
   *   { kind:'boundary', label, line }          (CONFINE: 2B, not printed)
   *   { kind:'break', mode:'strip'|'row'|'skip', line }
   */
  function parseRoute(text, baseTown) {
    const items = [];
    const warnings = [];
    let town = baseTown || '';
    const lines = String(text || '').split(/\r?\n/);
    lines.forEach(function (raw, lineIndex) {
      const line = raw.trim();
      if (!line || line[0] === '#') return;
      let m = /^comune\s*:(.*)$/i.exec(line);
      if (m) { town = m[1].trim() || baseTown || ''; return; }
      m = /^confine\s*:?(.*)$/i.exec(line);
      if (m) { items.push({ kind: 'boundary', label: m[1].trim(), line: lineIndex }); return; }
      const br = BREAKS.find(function (b) { return b[0].test(line); });
      if (br) { items.push({ kind: 'break', mode: br[1], line: lineIndex }); return; }
      m = /^vuot[ae](?:\s+(\d{1,3}))?$/i.exec(line);
      if (m) {
        const n = m[1] ? parseInt(m[1], 10) : 1;
        for (let i = 0; i < n; i++) {
          items.push({ kind: 'cell', street: '', town: town, key: '', top: '', second: '', span: 1, line: lineIndex, tok: 0 });
        }
        return;
      }
      const colon = line.indexOf(':');
      if (colon < 0) {
        // A name alone takes one pigeonhole with the name on the street line (e.g. a farmhouse).
        let name = line, span = 1;
        const sm = /\(\s*(\d{1,2})\s*\)\s*$/.exec(name);
        if (sm) { span = Math.max(1, parseInt(sm[1], 10)); name = name.slice(0, sm.index).trim(); }
        items.push({ kind: 'cell', street: name, town: town, key: streetKey(name, town), top: '', second: '', span: span, line: lineIndex, tok: 0 });
        return;
      }
      const street = line.slice(0, colon).trim();
      const rest = line.slice(colon + 1);
      if (!street) warnings.push({ line: lineIndex, text: 'Riga ' + (lineIndex + 1) + ': manca il nome della via prima dei due punti.' });
      const tokens = rest.split(',');
      if (tokens.length > 1 && tokens[tokens.length - 1].trim() === '') tokens.pop();
      tokens.forEach(function (tok, tokIndex) {
        const r = parseToken(tok);
        if (r.error) {
          warnings.push({ line: lineIndex, text: 'Riga ' + (lineIndex + 1) + ': ' + r.error + '.' });
          return;
        }
        r.cells.forEach(function (c) {
          items.push({ kind: 'cell', street: street, town: town, key: street ? streetKey(street, town) : '', top: c.top, second: c.second, span: c.span, line: lineIndex, tok: tokIndex });
        });
      });
    });
    return { items: items, warnings: warnings };
  }

  // The strips of a sub-zone in reading order: row 1 left to right, then row 2...
  function stripOrder(sz) {
    const out = [];
    for (let i = 0; i < ROWS_PER_MODULE; i++) {
      MODULES.forEach(function (m) {
        if (sz.modules[m]) out.push({ m: m, i: i, capacity: MODULE_SLOTS[m], cells: [], boundaries: [], used: 0 });
      });
    }
    return out;
  }

  /*
   * Fills the strips with the route items, in reading order.
   * A pigeonhole that does not fit at the end of a strip moves whole to the next one.
   * Returns { strips, overflow, notes }.
   */
  function layoutRoute(items, strips) {
    // a strip may start with slots already taken ("reserved") by the end of the previous sub-zone;
    // a piece of a drawn frame goes from slot `from` to slot `to`
    const first = function (k) {
      if (k >= strips.length) return 0;
      return strips[k].from !== undefined ? strips[k].from : (strips[k].reserved || 0);
    };
    const limit = function (k) { return strips[k].to !== undefined ? strips[k].to + 1 : strips[k].capacity; };
    let p = 0, pos = first(0);
    const overflow = [];
    const notes = [];
    function next() { p++; pos = first(p); }
    function rowStart() { return pos === first(p) && (p === 0 || p >= strips.length || strips[p].i !== strips[p - 1].i); }
    items.forEach(function (it) {
      if (it.kind === 'boundary') {
        if (p < strips.length) strips[p].boundaries.push({ label: it.label, at: pos, line: it.line });
        return;
      }
      if (it.kind === 'break') {
        if (it.mode === 'strip') { if (pos > first(p)) next(); }
        else if (it.mode === 'row') {
          if (!rowStart() && p < strips.length) {
            const row = strips[p].i;
            while (p < strips.length && strips[p].i === row) p++;
            pos = first(p);
          }
        } else if (it.mode === 'skip') { if (pos > first(p)) next(); next(); }
        return;
      }
      if (p >= strips.length) { overflow.push(it); return; }
      if (it.span > limit(p) - first(p) && !strips.slice(p).some(function (x, j) { return it.span <= limit(p + j) - first(p + j); })) {
        notes.push({ line: it.line, text: 'Riga ' + (it.line + 1) + ': una casella larga ' + it.span + ' non entra in nessuna striscia.' });
        return;
      }
      if (pos + it.span > limit(p)) {
        notes.push({ line: it.line, soft: true, text: 'Riga ' + (it.line + 1) + ': «' + (it.top || it.street) + '» non entrava alla fine della striscia ed è passata alla striscia dopo.' });
        next();
        while (p < strips.length && pos + it.span > limit(p)) next();
        if (p >= strips.length) { overflow.push(it); return; }
      }
      const s = strips[p];
      s.cells.push(Object.assign({}, it, { m: s.m, i: s.i, wi: s.wi, start: pos, end: pos + it.span - 1 }));
      pos += it.span;
      s.used = pos;
      if (pos === limit(p)) next();
    });
    strips.forEach(function (s) { s.runs = streetRuns(s.cells, s.capacity); });
    return { strips: strips, overflow: overflow, notes: notes };
  }

  /*
   * Street-name runs on the lower line: consecutive pigeonholes of the same street.
   * The lower line only ever holds street names; numbers stay in the pigeonholes above. Runs are cut at page edges so that every
   * printed piece of strip still shows the street name.
   */
  function streetRuns(cells, capacity) {
    const runs = [];
    let cur = null;
    cells.forEach(function (c) {
      if (c.start >= capacity) { cur = null; return; }
      const free = !!c.key;
      const sameRun = cur && free && cur.key === c.key && cur.end + 1 === c.start &&
        Math.floor(c.start / SLOTS_PER_PAGE) === Math.floor(cur.start / SLOTS_PER_PAGE) &&
        Math.floor(c.end / SLOTS_PER_PAGE) === Math.floor(cur.start / SLOTS_PER_PAGE);
      if (sameRun) { cur.end = c.end; return; }
      if (free) {
        cur = { key: c.key, street: c.street, town: c.town, start: c.start, end: Math.min(c.end, capacity - 1) };
        runs.push(cur);
      } else cur = null;
    });
    return runs;
  }

  function emptyLayout(m) {
    return { m: m, cells: [], boundaries: [], runs: [], used: 0, capacity: MODULE_SLOTS[m] };
  }

  /*
   * Lays out every sub-zone of a project, in order. When the route of a sub-zone is longer than
   * its own modules, the rest continues in the next sub-zone, on the same (last) row, from its
   * first module: in a real frame the row goes on to the right. The next sub-zone then starts
   * that row after those pigeonholes.
   * Returns one analysis per sub-zone:
   *   { strips, spill, overflow, warnings, used, capacity, spillUsed, [module][row] = { layout } }
   * strips: its own strips (cells coming from the previous sub-zone have c.foreign = its name);
   * spill: pieces of the next sub-zone's strips holding this sub-zone's continuation.
   */
  function analyseLegacy(project) {
    const subzones = project.subzones;
    const list = [];
    let incoming = null;
    subzones.forEach(function (sz, k) {
      const name = sz.name || 'sottozona ' + (k + 1);
      const parsed = parseRoute(sz.route, sz.town);
      const strips = stripOrder(sz);
      if (incoming) {
        const rowStrips = strips.filter(function (s) { return s.i === incoming.row; });
        const tmp = rowStrips.map(function (s) {
          return { m: s.m, i: s.i, capacity: s.capacity, cells: [], boundaries: [], used: 0, target: name, targetIndex: k };
        });
        const r = layoutRoute(incoming.items, tmp);
        tmp.forEach(function (t, j) {
          rowStrips[j].reserved = t.used;
          rowStrips[j].used = t.used;
          t.cells.forEach(function (c) {
            c.place = name;
            rowStrips[j].cells.push(Object.assign({}, c, { foreign: incoming.name, fromIndex: incoming.index }));
          });
          if (t.used > 0 && t.used < t.capacity) {
            rowStrips[j].boundaries.push({ label: name, at: t.used, line: -1 });
            t.boundaries.push({ label: name, at: t.used, line: -1 });
          }
        });
        list[incoming.index].spill = tmp.filter(function (t) { return t.cells.length; });
        list[incoming.index].overflow = r.overflow;
      }
      const res = layoutRoute(parsed.items, strips);
      list.push({ strips: res.strips, spill: [], overflow: res.overflow, warnings: parsed.warnings.concat(res.notes), name: name });
      incoming = res.overflow.length && k + 1 < subzones.length && strips.length
        ? { items: res.overflow, row: strips[strips.length - 1].i, index: k, name: name } : null;
    });
    list.forEach(function (out) {
      const own = function (s) { return s.used - (s.reserved || 0); };
      out.capacity = out.strips.reduce(function (a, s) { return a + s.capacity - (s.reserved || 0); }, 0);
      out.spillUsed = out.spill.reduce(function (a, s) { return a + s.used; }, 0);
      out.used = out.strips.reduce(function (a, s) { return a + own(s); }, 0) + out.spillUsed +
        out.overflow.reduce(function (a, c) { return a + c.span; }, 0);
      if (out.spill.length) {
        out.warnings.unshift({ line: -1, soft: true, text: 'Il giro continua nella sottozona ' + out.spill[0].target + ': ' +
          out.spillUsed + ' caselle nella fila ' + (out.spill[0].i + 1) + '.' });
      }
      if (out.overflow.length) {
        out.warnings.unshift({ line: out.overflow[0].line, text: 'Il giro è più lungo dei moduli: ' + out.overflow.length +
          (out.overflow.length === 1 ? ' casella non entra' : ' caselle non entrano') + ' (dalla riga ' + (out.overflow[0].line + 1) + ').' });
      }
      MODULES.forEach(function (m) {
        out[m] = [];
        for (let i = 0; i < ROWS_PER_MODULE; i++) {
          const s = out.strips.find(function (x) { return x.m === m && x.i === i; });
          out[m].push({ layout: s || emptyLayout(m) });
        }
      });
    });
    return list;
  }

  function analyseProject(project) {
    if (project.wall && project.wall.modules && project.wall.modules.length) return analyseWall(project);
    const list = analyseLegacy(project);
    list.forEach(function (out, k) {
      const rows = {};
      MODULES.forEach(function (m) { rows[m] = out[m].map(function (x) { return x.layout; }); });
      out.sheets = [{ name: out.name, modules: project.subzones[k].modules, rows: rows }];
    });
    return list;
  }

  // One sub-zone on its own (no continuation into other sub-zones).
  function analyseSubzone(sz) {
    return analyseProject({ subzones: [sz] })[0];
  }

  // The pigeonholes written in this sub-zone's route, wherever they ended up.
  function allCells(a) {
    const cells = [];
    a.strips.forEach(function (s) { s.cells.forEach(function (c) { if (!c.foreign) cells.push(c); }); });
    (a.spill || []).forEach(function (s) { s.cells.forEach(function (c) { cells.push(c); }); });
    return cells.concat(a.overflow);
  }

  function placeName(sz, c) {
    const who = sz.name ? sz.name + ', ' : '';
    if (c.m === undefined) return who + 'fuori dai moduli';
    return who + (c.place ? 'nella ' + c.place + ' ' : '') + 'fila ' + (c.i + 1) + ' ' + MODULE_NAMES[c.m] + ' casella ' + (c.start + 1);
  }

  // Same house number of the same street written more than once in the project.
  function findDuplicates(project) {
    const seen = {};
    const dups = [];
    const all = analyseProject(project);
    project.subzones.forEach(function (sz, k) {
      allCells(all[k]).forEach(function (c) {
        [c.top, c.second].forEach(function (n) {
          if (!c.key || !/^\d+\s*[A-Z]?$/i.test(n)) return;
          const key = c.key + '|' + norm(n).replace(/\s/g, '');
          (seen[key] = seen[key] || []).push(placeName(sz, c));
        });
      });
    });
    Object.keys(seen).forEach(function (k) {
      if (seen[k].length > 1) {
        const parts = k.split('|');
        dups.push({ street: parts[0], number: parts[2], town: parts[1], where: seen[k] });
      }
    });
    return dups;
  }

  // ---------------------------------------------------------------- the frame drawn by the user

  /*
   * A drawn frame ("mobile") lists the modules of the whole zone from left to right, each one a
   * casello (91 slots) or an ala (33 slots) belonging to a sub-zone, plus pencil marks: a mark at
   * (row, module, slot) gives that row of that module, from that slot to the right, to another
   * sub-zone. Each sub-zone's route then fills only its own slots, in reading order: row 1 from
   * left to right across the whole frame, then row 2, and so on. This covers every shape: a route
   * that ends in the next sub-zone's casello, a sub-zone with two alas, one that takes half of the
   * last row of the other...
   */
  const WALL_SLOTS = { casello: 91, ala: 33 };

  function sanitizeWall(w, subzones) {
    if (!w || typeof w !== 'object' || !Array.isArray(w.modules) || !w.modules.length) return null;
    const ids = subzones.map(function (s) { return s.id; });
    const modules = w.modules.map(function (m) {
      return { type: m && m.type === 'casello' ? 'casello' : 'ala', owner: ids.indexOf(m && m.owner) >= 0 ? m.owner : ids[0] };
    });
    const marks = (Array.isArray(w.marks) ? w.marks : []).filter(function (k) {
      return k && k.row >= 0 && k.row < ROWS_PER_MODULE && k.module >= 0 && k.module < modules.length &&
        k.slot >= 0 && k.slot < WALL_SLOTS[modules[k.module].type] && ids.indexOf(k.owner) >= 0;
    }).map(function (k) { return { row: +k.row, module: +k.module, slot: +k.slot, owner: k.owner }; });
    return { modules: modules, marks: marks };
  }

  // Which sub-zone owns each slot of one row of one module (array of sub-zone ids).
  function wallOwners(wall, row, wi) {
    const mod = wall.modules[wi];
    const owners = [];
    for (let s = 0; s < WALL_SLOTS[mod.type]; s++) owners.push(mod.owner);
    wall.marks.filter(function (k) { return k.row === row && k.module === wi; })
      .sort(function (a, b) { return a.slot - b.slot; })
      .forEach(function (k) { for (let s = k.slot; s < owners.length; s++) owners[s] = k.owner; });
    return owners;
  }

  // The pencil: from this slot to the right (until the next mark) the row belongs to `owner`.
  function setWallMark(wall, row, wi, slot, owner) {
    wall.marks = wall.marks.filter(function (k) { return !(k.row === row && k.module === wi && k.slot === slot); });
    wall.marks.push({ row: row, module: wi, slot: slot, owner: owner });
    tidyWallMarks(wall);
  }

  // The eraser: removes the mark that decides this slot.
  function removeWallMark(wall, row, wi, slot) {
    let best = null;
    wall.marks.forEach(function (k) {
      if (k.row === row && k.module === wi && k.slot <= slot && (!best || k.slot > best.slot)) best = k;
    });
    if (best) wall.marks.splice(wall.marks.indexOf(best), 1);
    tidyWallMarks(wall);
  }

  // Drops marks that change nothing (same owner as the slot before them).
  function tidyWallMarks(wall) {
    const keep = [];
    wall.marks.slice().sort(function (a, b) { return a.row - b.row || a.module - b.module || a.slot - b.slot; }).forEach(function (k) {
      const before = k.slot === 0 ? wall.modules[k.module].owner : wallOwners({ modules: wall.modules, marks: keep }, k.row, k.module)[k.slot - 1];
      if (before !== k.owner || (k.slot === 0 && k.owner !== wall.modules[k.module].owner)) keep.push(k);
    });
    wall.marks = keep.filter(function (k) { return !(k.slot === 0 && k.owner === wall.modules[k.module].owner); });
  }

  // The drawn frame that matches the sub-zones as they are now (their modules, left to right),
  // with marks where a route continues into the next sub-zone: nothing moves when it is drawn.
  function wallFromSubzones(project) {
    const all = analyseLegacy(project);
    const modules = [];
    const where = {};
    project.subzones.forEach(function (sz) {
      MODULES.forEach(function (m) {
        if (!sz.modules[m]) return;
        where[sz.id + '|' + m] = modules.length;
        modules.push({ type: m === 'casello' ? 'casello' : 'ala', owner: sz.id });
      });
    });
    const wall = { modules: modules, marks: [] };
    all.forEach(function (a, k) {
      (a.spill || []).forEach(function (s) {
        const target = project.subzones[s.targetIndex];
        const wi = where[target.id + '|' + s.m];
        if (wi === undefined) return;
        wall.marks.push({ row: s.i, module: wi, slot: 0, owner: project.subzones[k].id });
        if (s.used < s.capacity) wall.marks.push({ row: s.i, module: wi, slot: s.used, owner: target.id });
      });
    });
    return wall;
  }

  // The same layout as analyseLegacy, for a drawn frame.
  function analyseWall(project) {
    const wall = project.wall;
    const subs = project.subzones;
    const index = {};
    subs.forEach(function (s, k) { index[s.id] = k; });
    const nameOf = function (k) { return subs[k].name || 'sottozona ' + (k + 1); };
    const pieces = subs.map(function () { return []; });
    const phys = {};
    for (let i = 0; i < ROWS_PER_MODULE; i++) {
      wall.modules.forEach(function (mod, wi) {
        const owners = wallOwners(wall, i, wi);
        const st = { m: mod.type, wi: wi, i: i, capacity: owners.length, cells: [], boundaries: [], used: 0, owners: owners };
        phys[i + ':' + wi] = st;
        let s = 0;
        while (s < owners.length) {
          let e = s;
          while (e + 1 < owners.length && owners[e + 1] === owners[s]) e++;
          const k = index[owners[s]];
          if (k !== undefined) pieces[k].push({ m: mod.type, wi: wi, i: i, capacity: owners.length, from: s, to: e, cells: [], boundaries: [], used: 0 });
          if (s > 0) st.boundaries.push({ label: k !== undefined ? nameOf(k) : '', at: s, line: -1 });
          s = e + 1;
        }
      });
    }
    const results = subs.map(function (sz, k) {
      const parsed = parseRoute(sz.route, sz.town);
      const res = layoutRoute(parsed.items, pieces[k]);
      res.strips.forEach(function (pc) {
        pc.cells.forEach(function (c) { phys[pc.i + ':' + pc.wi].cells.push(Object.assign({}, c, { owner: k })); });
      });
      return { parsed: parsed, res: res };
    });
    Object.keys(phys).forEach(function (key) {
      const st = phys[key];
      st.cells.sort(function (a, b) { return a.start - b.start; });
      st.runs = streetRuns(st.cells, st.capacity);
      st.used = st.cells.reduce(function (a, c) { return Math.max(a, c.end + 1); }, 0);
    });
    return subs.map(function (sz, k) {
      const own = wall.modules.map(function (mod, wi) { return { mod: mod, wi: wi }; }).filter(function (x) { return x.mod.owner === sz.id; });
      const strips = [];
      for (let i = 0; i < ROWS_PER_MODULE; i++) {
        own.forEach(function (x) {
          const st = phys[i + ':' + x.wi];
          strips.push(Object.assign({}, st, {
            cells: st.cells.map(function (c) { return c.owner === k ? c : Object.assign({}, c, { foreign: nameOf(c.owner), fromIndex: c.owner }); }),
          }));
        });
      }
      const spill = [];
      Object.keys(phys).forEach(function (key) {
        const st = phys[key];
        if (wall.modules[st.wi].owner === sz.id) return;
        const mine = st.cells.filter(function (c) { return c.owner === k; });
        if (!mine.length) return;
        const target = index[wall.modules[st.wi].owner];
        mine.forEach(function (c) { c.place = nameOf(target); });
        spill.push(Object.assign({}, st, { cells: mine, runs: streetRuns(mine, st.capacity), target: nameOf(target), targetIndex: target }));
      });
      spill.sort(function (a, b) { return a.i - b.i || a.wi - b.wi; });
      const r = results[k];
      const out = { strips: strips, spill: spill, overflow: r.res.overflow, warnings: r.parsed.warnings.concat(r.res.notes), name: nameOf(k), wall: true };
      // slots of its own modules (the ones in another sub-zone's module are shown apart, like a continuation)
      out.capacity = pieces[k].filter(function (pc) { return wall.modules[pc.wi].owner === sz.id; })
        .reduce(function (a, pc) { return a + pc.to - pc.from + 1; }, 0);
      const ownCells = strips.reduce(function (a, st) { return a.concat(st.cells.filter(function (c) { return !c.foreign; })); }, []);
      out.spillUsed = spill.reduce(function (a, st) { return a + st.cells.reduce(function (b, c) { return b + c.span; }, 0); }, 0);
      out.used = ownCells.reduce(function (a, c) { return a + c.span; }, 0) + out.spillUsed +
        out.overflow.reduce(function (a, c) { return a + c.span; }, 0);
      if (out.overflow.length) {
        out.warnings.unshift({ line: out.overflow[0].line, text: 'Il giro è più lungo delle caselle della sottozona: ' + out.overflow.length +
          (out.overflow.length === 1 ? ' casella non entra' : ' caselle non entrano') + ' (dalla riga ' + (out.overflow[0].line + 1) +
          '). Nel disegno del mobile segna con la matita dove continua.' });
      }
      out.sheets = wallSheets(sz, own, phys, nameOf(k));
      MODULES.forEach(function (m) {
        out[m] = [];
        for (let i = 0; i < ROWS_PER_MODULE; i++) out[m].push({ layout: emptyLayout(m) });
      });
      return out;
    });
  }

  // The printed sheets of a sub-zone: its modules go on the template's places (Ala A, Casello,
  // Ala B) from left to right; what does not fit goes on another sheet.
  function wallSheets(sz, own, phys, name) {
    const sheets = [];
    let cur = null;
    const fresh = function () {
      cur = { name: name + (sheets.length ? ' (' + (sheets.length + 1) + ')' : ''), modules: { alaA: false, casello: false, alaB: false }, rows: {} };
      sheets.push(cur);
    };
    own.forEach(function (x) {
      let place;
      if (!cur) fresh();
      if (x.mod.type === 'casello') {
        if (cur.modules.casello || cur.modules.alaB) fresh();
        place = 'casello';
      } else if (!cur.modules.casello && !cur.modules.alaA) place = 'alaA';
      else if (!cur.modules.alaB) place = 'alaB';
      else { fresh(); place = 'alaA'; }
      cur.modules[place] = true;
      cur.rows[place] = [];
      for (let i = 0; i < ROWS_PER_MODULE; i++) cur.rows[place].push(phys[i + ':' + x.wi]);
    });
    return sheets;
  }

  // ---------------------------------------------------------------- old files (one text per strip)

  // Joins the texts of the strips in reading order. A strip that was not full ends with
  // FINE STRISCIA, an empty one becomes STRISCIA VUOTA, so every pigeonhole keeps its place.
  function rowsToRoute(rows, modules, baseTown) {
    const out = [];
    let town = baseTown || '';
    let pendingEmpty = 0;
    for (let i = 0; i < ROWS_PER_MODULE; i++) {
      MODULES.forEach(function (m) {
        if (!modules[m]) return;
        const text = String(rows && rows[m] && rows[m][i] || '').replace(/^\s+|\s+$/g, '');
        const hasCells = parseRoute(text, town).items.some(function (it) { return it.kind === 'cell'; });
        if (!hasCells) {
          pendingEmpty++;
          if (text) { out.push(text); }
          return;
        }
        for (; pendingEmpty > 0; pendingEmpty--) out.push('STRISCIA VUOTA');
        if (norm(town) !== norm(baseTown)) out.push('COMUNE: ' + baseTown);
        town = baseTown;
        out.push('# ---- fila ' + (i + 1) + ', ' + MODULE_NAMES[m] + ' ----');
        out.push(text);
        text.split(/\r?\n/).forEach(function (l) {
          const mm = /^\s*comune\s*:(.*)$/i.exec(l);
          if (mm) town = mm[1].trim() || baseTown;
        });
        const strip = [{ m: m, i: i, capacity: MODULE_SLOTS[m], cells: [], boundaries: [], used: 0 }];
        const lay = layoutRoute(parseRoute(text, baseTown).items, strip);
        if (lay.strips[0].used < MODULE_SLOTS[m] && !lay.overflow.length) out.push('FINE STRISCIA');
      });
    }
    return out.join('\n');
  }

  // ---------------------------------------------------------------- colours

  function paletteEntry(hex) {
    return PALETTE.find(function (c) { return c.hex === String(hex || '').toUpperCase(); }) || null;
  }

  function paletteName(hex) {
    const p = paletteEntry(hex);
    return p ? p.name : '#' + hex;
  }

  function toLab(hex) {
    const v = [0, 2, 4].map(function (i) {
      const c = parseInt(String(hex).slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    const x = (0.4124 * v[0] + 0.3576 * v[1] + 0.1805 * v[2]) / 0.95047;
    const y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    const z = (0.0193 * v[0] + 0.1192 * v[1] + 0.9505 * v[2]) / 1.08883;
    const f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }

  // True when two colours must not be used for streets next to each other: they look alike
  // (CIELAB distance under 45) or they are two shades of the same hue (two greens, two blues).
  function similarColors(hexA, hexB) {
    if (String(hexA).toUpperCase() === String(hexB).toUpperCase()) return true;
    const a = toLab(hexA), b = toLab(hexB);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 45) return true;
    const ca = Math.hypot(a[1], a[2]), cb = Math.hypot(b[1], b[2]);
    if (ca < 20 || cb < 20) return false; // greys, black, white: only the distance counts
    let d = Math.abs(Math.atan2(a[2], a[1]) - Math.atan2(b[2], b[1])) * 180 / Math.PI;
    if (d > 180) d = 360 - d;
    return d < 25;
  }

  // Streets that touch each other somewhere on the strips: key -> { otherKey: true }.
  function streetNeighbours(project) {
    const neighbours = {};
    const order = [];
    analyseProject(project).forEach(function (a) {
      a.strips.concat([{ cells: a.overflow }]).forEach(function (s) {
        let prev = null;
        s.cells.forEach(function (c) {
          if (!c.key) { prev = null; return; }
          if (!neighbours[c.key]) { neighbours[c.key] = {}; order.push(c.key); }
          if (prev && prev !== c.key) { neighbours[c.key][prev] = true; neighbours[prev][c.key] = true; }
          prev = c.key;
        });
      });
    });
    return { map: neighbours, order: order };
  }

  // The streets of each sub-zone's route (wherever its pigeonholes ended up): no colour may
  // repeat inside one of these groups.
  function subzoneStreets(project) {
    return analyseProject(project).map(function (a) {
      const keys = [];
      allCells(a).forEach(function (c) { if (c.key && keys.indexOf(c.key) < 0) keys.push(c.key); });
      return keys;
    });
  }

  // The streets standing in each sub-zone's frame, including pigeonholes of the previous
  // sub-zone that continue there: colours are kept different there too, when possible.
  function frameStreets(project) {
    return analyseProject(project).map(function (a) {
      const keys = [];
      a.strips.forEach(function (s) { s.cells.forEach(function (c) { if (c.key && keys.indexOf(c.key) < 0) keys.push(c.key); }); });
      return keys;
    });
  }

  // For one street: the streets that must not share its colour (same sub-zone) -> { key: true }.
  function sameZoneStreets(groups, key) {
    const out = {};
    groups.forEach(function (g) {
      if (g.indexOf(key) < 0) return;
      g.forEach(function (k) { if (k !== key) out[k] = true; });
    });
    return out;
  }

  /*
   * Gives every street without a colour one that is not used by another street of the same
   * sub-zone and not similar to any street next to it, alternating light and dark colours.
   * Colours are stored in project.streets, so they never change by themselves; a colour that is
   * not in the palette any more, or that repeats in a sub-zone (older files), is given again.
   * Returns true if something was assigned.
   */
  function assignColors(project) {
    let changed = false;
    Object.keys(project.streets).forEach(function (k) {
      if (!paletteEntry(project.streets[k].color)) { delete project.streets[k]; changed = true; }
    });
    const groups = subzoneStreets(project);
    groups.forEach(function (g) {
      const taken = {};
      g.forEach(function (k) {
        const col = project.streets[k] && project.streets[k].color;
        if (!col) return;
        if (taken[col]) { delete project.streets[k]; changed = true; } else taken[col] = true;
      });
    });
    const frames = frameStreets(project);
    const nb = streetNeighbours(project);
    const usage = {};
    Object.keys(project.streets).forEach(function (k) {
      const col = project.streets[k].color;
      usage[col] = (usage[col] || 0) + 1;
    });
    const choices = PALETTE.filter(function (c) { return c.name !== 'bianco'; });
    // in the order of the routes, sub-zone after sub-zone: the end of a route that continues in
    // the next frame gets its colours before the streets of that frame, which then avoid them
    const order = [];
    groups.forEach(function (g) { g.forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); }); });
    nb.order.forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
    order.forEach(function (key) {
      if (project.streets[key]) return;
      const near = Object.keys(nb.map[key] || {}).filter(function (n) { return project.streets[n]; })
        .map(function (n) { return project.streets[n].color; });
      const zone = sameZoneStreets(groups, key);
      const used = {};
      Object.keys(zone).forEach(function (k) { if (project.streets[k]) used[project.streets[k].color] = true; });
      const inFrame = {};
      Object.keys(sameZoneStreets(frames, key)).forEach(function (k) { if (project.streets[k]) inFrame[project.streets[k].color] = true; });
      const darkNear = near.filter(function (hx) { return paletteEntry(hx).dark; }).length;
      const wantDark = near.length ? darkNear * 2 < near.length : false;
      const notNear = function (c) { return !near.some(function (hx) { return similarColors(hx, c.hex); }); };
      let pool = choices.filter(function (c) { return !used[c.hex] && notNear(c); });
      if (!pool.length) pool = choices.filter(function (c) { return !used[c.hex]; });
      if (!pool.length) pool = choices.filter(notNear);
      if (!pool.length) pool = choices;
      const score = function (c) {
        return (inFrame[c.hex] ? 5000 : 0) + (near.length && c.dark !== wantDark ? 1000 : 0) + (usage[c.hex] || 0) * 100 + choices.indexOf(c);
      };
      pool.sort(function (x, y) { return score(x) - score(y); });
      project.streets[key] = { color: pool[0].hex };
      usage[pool[0].hex] = (usage[pool[0].hex] || 0) + 1;
      changed = true;
    });
    return changed;
  }

  function colorOf(project, key) {
    return key && project.streets[key] ? project.streets[key].color : 'FFFFFF';
  }

  // The colour of the writing on a street's colour.
  function textColorOf(project, key) {
    const p = paletteEntry(colorOf(project, key));
    return p ? p.text : '111111';
  }

  // ---------------------------------------------------------------- map

  const ABBREVIATIONS = [
    [/^C\.?\s*NA\b\.?/i, 'Cascina'], [/^CNA\b\.?/i, 'Cascina'], [/^V\.\s*LE\b/i, 'Viale'],
    [/^P\.\s*Z?ZA\b/i, 'Piazza'], [/^V\.\s+/i, 'Via '], [/^LOC\.\s*/i, 'Località '],
    [/\bF\.\s*LLI\b/i, 'Fratelli'],
  ];

  // Only street, number and town go to the map: never names of people or companies.
  function mapQuery(street, top, town) {
    let s = String(street || '').replace(/\?/g, '').replace(/\(.*?\)/g, '').trim();
    if (!s) return '';
    ABBREVIATIONS.forEach(function (a) { s = s.replace(a[0], a[1]); });
    const m = /^(\d+)(\s*[A-Z](?![A-Z]))?/i.exec(String(top || '').trim());
    const number = m ? (m[1] + (m[2] ? m[2].trim() : '')) : '';
    return (s + (number ? ' ' + number : '') + (town ? ', ' + town : '')).replace(/\s+/g, ' ').trim();
  }

  // ---------------------------------------------------------------- the round on the map

  /*
   * The stops of a sub-zone's round, in the order of its pigeonholes (the order of the frame):
   * one stop for each piece of street written on a line of the route. Names that are not a
   * street ("?") are left out. Each stop has the map queries to try: with the first house number,
   * then the street alone.
   */
  function routeStops(project, k) {
    const a = analyseProject(project)[k];
    if (!a) return [];
    const stops = [];
    let last = null;
    allCells(a).forEach(function (c) {
      if (!c.key || /^\?/.test(String(c.street).trim()) || !streetName(c.street)) { last = null; return; }
      if (last && last.line === c.line && last.key === c.key) { last.cells++; return; }
      const number = /^\d+\s*[A-Z]?$/i.test(String(c.top).trim()) ? c.top : '';
      last = { line: c.line, key: c.key, street: c.street, town: c.town, cells: 1,
        queries: [mapQuery(c.street, number, c.town), mapQuery(c.street, '', c.town), mapQuery(bareName(c.street), '', c.town)]
          .filter(function (q, i, arr) { return q && arr.indexOf(q) === i; }) };
      stops.push(last);
    });
    return stops;
  }

  // The name without the word for the kind of street ("VIA DEI TIGLI" -> "DEI TIGLI"): a last try on
  // the map, when the street is written there with another word or with the full first name.
  function bareName(street) {
    const words = norm(street).split(' ');
    return words.length > 1 && streetType(street) !== 'altro' && streetType(street) !== 'cascina' ? words.slice(1).join(' ') : '';
  }

  // Distance in km between two points (straight line), used when the road route is not available.
  function airKm(a, b) {
    const R = 6371, toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad, dLon = (b.lon - a.lon) * toRad;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // ---------------------------------------------------------------- text format

  const MODULE_WORDS = { alaA: 'ala A', casello: 'casello', alaB: 'ala B' };

  function projectToText(project) {
    const out = [];
    out.push('# Casellino: file di testo. Si riapre con il programma (Apri, oppure Altro → Importa testo).');
    out.push('ZONA: ' + project.zone);
    out.push('TITOLARE: ' + project.owner);
    project.subzones.forEach(function (sz) {
      out.push('');
      out.push('== SOTTOZONA ' + sz.name + ' ==');
      out.push('COMUNE: ' + sz.town);
      out.push('MODULI: ' + MODULES.filter(function (m) { return sz.modules[m]; }).map(function (m) { return MODULE_WORDS[m]; }).join(', '));
      out.push('-- GIRO --');
      const t = sz.route.replace(/\s+$/, '');
      if (t) out.push(t);
    });
    const keys = Object.keys(project.streets);
    if (keys.length) {
      out.push('');
      out.push('== COLORI ==');
      keys.forEach(function (k) {
        const p = k.split('|');
        out.push(p[0] + ' (' + p[1] + '): ' + paletteName(project.streets[k].color));
      });
    }
    return out.join('\n') + '\n';
  }

  /*
   * Reads the text format. Accepts the route ("-- GIRO --" followed by the lines) and the
   * old format with one section per strip ("-- CASELLO · FILA 1 --"), which is converted.
   */
  function textToProject(text) {
    const p = newProject();
    p.subzones = [];
    let sz = null, mode = 'settings', inColors = false, townSet = false;
    let oldRows = null, oldMod = null, oldRow = -1;
    function finish() {
      if (!sz) return;
      if (oldRows) {
        const conv = rowsToRoute(oldRows, sz.modules, sz.town);
        sz.route = sz.route ? sz.route + '\n' + conv : conv;
      }
      sz.route = sz.route.replace(/^\n+|\n+$/g, '');
      if (!MODULES.some(function (m) { return sz.modules[m]; })) sz.modules.casello = true;
    }
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      const line = raw.replace(/\s+$/, '');
      const t = line.trim();
      let m = /^==\s*(.*?)\s*==$/.exec(t);
      if (m) {
        finish();
        if (/^colori$/i.test(m[1])) { inColors = true; sz = null; return; }
        inColors = false;
        sz = newSubzone(m[1].replace(/^sottozona\s*/i, '').trim(), '');
        sz.modules = { alaA: false, casello: false, alaB: false };
        mode = 'settings'; townSet = false; oldRows = null; oldMod = null;
        p.subzones.push(sz);
        return;
      }
      if (inColors) {
        m = /^(.*?)\s*\((.*)\)\s*:\s*(.+)$/.exec(t);
        if (m) {
          const name = m[3].trim().toLowerCase();
          const pal = PALETTE.find(function (c) { return c.name === name; });
          const hex = pal ? pal.hex : name.replace('#', '').toUpperCase();
          if (/^[0-9A-F]{6}$/.test(hex)) p.streets[streetKey(m[1], m[2])] = { color: hex };
        }
        return;
      }
      if (!sz) {
        m = /^zona\s*:(.*)$/i.exec(t); if (m) { p.zone = m[1].trim(); return; }
        m = /^titolare\s*:(.*)$/i.exec(t); if (m) { p.owner = m[1].trim(); return; }
        return;
      }
      if (/^--\s*giro\s*-*$/i.test(t)) { mode = 'route'; return; }
      m = /^--\s*(ALA\s*A|ALETTA\s*A|ALA\s*B|ALETTA\s*B|CASELL\w*)\s*[·,.\-]?\s*FILA\s*(\d)\s*-*$/i.exec(t);
      if (m) {
        const w = m[1].toUpperCase().replace(/\s+/g, '');
        oldMod = /^CASELL/.test(w) ? 'casello' : (/A$/.test(w) ? 'alaA' : 'alaB');
        oldRow = Math.min(ROWS_PER_MODULE, Math.max(1, parseInt(m[2], 10))) - 1;
        sz.modules[oldMod] = true;
        if (!oldRows) oldRows = { alaA: ['', '', '', ''], casello: ['', '', '', ''], alaB: ['', '', '', ''] };
        mode = 'old';
        return;
      }
      if (mode === 'old') {
        oldRows[oldMod][oldRow] += (oldRows[oldMod][oldRow] ? '\n' : '') + line;
        return;
      }
      if (mode === 'settings') {
        m = /^comune\s*:(.*)$/i.exec(t); if (m && !townSet) { sz.town = m[1].trim(); townSet = true; return; }
        m = /^moduli\s*:(.*)$/i.exec(t);
        if (m) {
          const w = m[1].toLowerCase();
          sz.modules.alaA = /\b(?:ala|aletta)\s*a\b/.test(w);
          sz.modules.alaB = /\b(?:ala|aletta)\s*b\b/.test(w);
          sz.modules.casello = /casell/.test(w);
          return;
        }
        if (!t) return;
        mode = 'route';
      }
      sz.route += (sz.route ? '\n' : '') + line;
    });
    finish();
    if (!p.subzones.length) p.subzones.push(newSubzone('', ''));
    return p;
  }

  // Classifies a street name by its first word (via, vicolo, piazza, cascina...).
  const STREET_TYPES = [
    ['VIA', 'via'], ['V.', 'via'], ['VIALE', 'viale'], ['V.LE', 'viale'], ['VICOLO', 'vicolo'], ['VIC.', 'vicolo'],
    ['PIAZZA', 'piazza'], ['P.ZA', 'piazza'], ['P.ZZA', 'piazza'], ['PIAZZALE', 'piazzale'], ['LARGO', 'largo'],
    ['CORSO', 'corso'], ['STRADA', 'strada'], ['CASCINA', 'cascina'], ['C.NA', 'cascina'], ['CNA', 'cascina'],
    ['CONTRADA', 'contrada'], ['LOCALITA', 'località'], ['LOCALITÀ', 'località'], ['LOC.', 'località'],
    ['FRAZIONE', 'frazione'], ['BORGO', 'borgo'], ['SALITA', 'salita'], ['RIONE', 'rione'],
    ['VIALETTO', 'vialetto'], ['TRAVERSA', 'traversa'], ['CALLE', 'calle'], ['BORGATA', 'borgata'],
  ];

  function streetType(name) {
    const first = norm(name).split(' ')[0];
    const t = STREET_TYPES.find(function (x) { return x[0] === first; });
    return t ? t[1] : 'altro';
  }

  return {
    MODULES: MODULES,
    MODULE_SLOTS: MODULE_SLOTS,
    MODULE_NAMES: MODULE_NAMES,
    ROWS_PER_MODULE: ROWS_PER_MODULE,
    SLOTS_PER_PAGE: SLOTS_PER_PAGE,
    PALETTE: PALETTE,
    norm: norm,
    streetKey: streetKey,
    newProject: newProject,
    newSubzone: newSubzone,
    sanitizeProject: sanitizeProject,
    parseToken: parseToken,
    parseRoute: parseRoute,
    stripOrder: stripOrder,
    layoutRoute: layoutRoute,
    streetRuns: streetRuns,
    analyseSubzone: analyseSubzone,
    analyseProject: analyseProject,
    WALL_SLOTS: WALL_SLOTS,
    wallOwners: wallOwners,
    setWallMark: setWallMark,
    removeWallMark: removeWallMark,
    wallFromSubzones: wallFromSubzones,
    sanitizeWall: sanitizeWall,
    allCells: allCells,
    findDuplicates: findDuplicates,
    rowsToRoute: rowsToRoute,
    assignColors: assignColors,
    colorOf: colorOf,
    textColorOf: textColorOf,
    similarColors: similarColors,
    subzoneStreets: subzoneStreets,
    frameStreets: frameStreets,
    sameZoneStreets: sameZoneStreets,
    streetNeighbours: streetNeighbours,
    paletteEntry: paletteEntry,
    streetName: streetName,
    paletteName: paletteName,
    mapQuery: mapQuery,
    routeStops: routeStops,
    airKm: airKm,
    projectToText: projectToText,
    textToProject: textToProject,
    streetType: streetType,
  };
});

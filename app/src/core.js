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
  const MODULE_NAMES = { alaA: 'Ala A', casello: 'Casello', alaB: 'Ala B' };
  const ROWS_PER_MODULE = 4;
  // Landscape A4 holds 23 slot columns of 1.244 cm on paper, but printers keep a small
  // margin and Excel then fits 22 (seen in a real export). The workbook sets a page break
  // every 22 slots, so the cut is always in the same place.
  const SLOTS_PER_PAGE = 22;
  const MAX_RANGE_ITEMS = 300;
  // Italian house-number letters skip J, K, W, X, Y (e.g. 20I, 20L, 20M).
  const IT_LETTERS = 'ABCDEFGHILMNOPQRSTUVZ';
  const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Print-friendly light colours; text stays black on all of them.
  const PALETTE = [
    { name: 'azzurro', hex: '9DC3E6' },
    { name: 'verde', hex: 'A9D08E' },
    { name: 'giallo', hex: 'FFE699' },
    { name: 'rosa', hex: 'F4B6C2' },
    { name: 'arancione', hex: 'F8CBAD' },
    { name: 'lilla', hex: 'CDB8E8' },
    { name: 'verde acqua', hex: '9FDCD0' },
    { name: 'sabbia', hex: 'E2D3B5' },
    { name: 'celeste', hex: 'C9E4F5' },
    { name: 'verde chiaro', hex: 'D4EDBC' },
    { name: 'rosso', hex: 'F1948A' },
    { name: 'grigio', hex: 'D9D9D9' },
    { name: 'bianco', hex: 'FFFFFF' },
  ];

  function norm(text) {
    return String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function streetKey(street, town) {
    return norm(street) + '|' + norm(town);
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
    let p = 0, pos = 0;
    const overflow = [];
    const notes = [];
    function next() { p++; pos = 0; }
    function rowStart() { return pos === 0 && (p === 0 || p >= strips.length || strips[p].i !== strips[p - 1].i); }
    items.forEach(function (it) {
      if (it.kind === 'boundary') {
        if (p < strips.length) strips[p].boundaries.push({ label: it.label, at: pos, line: it.line });
        return;
      }
      if (it.kind === 'break') {
        if (it.mode === 'strip') { if (pos > 0) next(); }
        else if (it.mode === 'row') {
          if (!rowStart() && p < strips.length) {
            const row = strips[p].i;
            while (p < strips.length && strips[p].i === row) p++;
            pos = 0;
          }
        } else if (it.mode === 'skip') { if (pos > 0) next(); next(); }
        return;
      }
      if (p >= strips.length) { overflow.push(it); return; }
      if (it.span > strips[p].capacity) {
        notes.push({ line: it.line, text: 'Riga ' + (it.line + 1) + ': una casella larga ' + it.span + ' non entra in nessuna striscia.' });
        return;
      }
      if (pos + it.span > strips[p].capacity) {
        notes.push({ line: it.line, soft: true, text: 'Riga ' + (it.line + 1) + ': «' + (it.top || it.street) + '» non entrava alla fine della striscia ed è passata alla striscia dopo.' });
        next();
        if (p >= strips.length) { overflow.push(it); return; }
      }
      const s = strips[p];
      s.cells.push(Object.assign({}, it, { m: s.m, i: s.i, start: pos, end: pos + it.span - 1 }));
      pos += it.span;
      s.used = pos;
      if (pos === s.capacity) next();
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
   * Lays out a sub-zone. Returns
   *   { strips, overflow, warnings, used, capacity, [module][row] = { layout } }
   */
  function analyseSubzone(sz) {
    const parsed = parseRoute(sz.route, sz.town);
    const res = layoutRoute(parsed.items, stripOrder(sz));
    const out = { strips: res.strips, overflow: res.overflow, warnings: parsed.warnings.concat(res.notes) };
    out.capacity = res.strips.reduce(function (a, s) { return a + s.capacity; }, 0);
    out.used = res.strips.reduce(function (a, s) { return a + s.used; }, 0) +
      res.overflow.reduce(function (a, c) { return a + c.span; }, 0);
    if (res.overflow.length) {
      out.warnings.unshift({ line: res.overflow[0].line, text: 'Il giro è più lungo dei moduli: ' + res.overflow.length +
        (res.overflow.length === 1 ? ' casella non entra' : ' caselle non entrano') + ' (dalla riga ' + (res.overflow[0].line + 1) + ').' });
    }
    MODULES.forEach(function (m) {
      out[m] = [];
      for (let i = 0; i < ROWS_PER_MODULE; i++) {
        const s = res.strips.find(function (x) { return x.m === m && x.i === i; });
        out[m].push({ layout: s || emptyLayout(m) });
      }
    });
    return out;
  }

  function allCells(a) {
    const cells = [];
    a.strips.forEach(function (s) { s.cells.forEach(function (c) { cells.push(c); }); });
    return cells.concat(a.overflow);
  }

  function placeName(sz, c) {
    if (c.m === undefined) return (sz.name ? sz.name + ', ' : '') + 'fuori dai moduli';
    return (sz.name ? sz.name + ', ' : '') + 'fila ' + (c.i + 1) + ' ' + MODULE_NAMES[c.m] + ' casella ' + (c.start + 1);
  }

  // Same house number of the same street written more than once in the project.
  function findDuplicates(project) {
    const seen = {};
    const dups = [];
    project.subzones.forEach(function (sz) {
      allCells(analyseSubzone(sz)).forEach(function (c) {
        [c.top, c.second].forEach(function (n) {
          if (!c.key || !/^\d+\s*[A-Z]?$/i.test(n)) return;
          const k = c.key + '|' + norm(n).replace(/\s/g, '');
          (seen[k] = seen[k] || []).push(placeName(sz, c));
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

  function paletteName(hex) {
    const p = PALETTE.find(function (c) { return c.hex === String(hex).toUpperCase(); });
    return p ? p.name : '#' + hex;
  }

  /*
   * Gives every street without a colour one that differs from the streets next to it.
   * Colours are stored in project.streets so they never change by themselves.
   * Returns true if something was assigned.
   */
  function assignColors(project) {
    const neighbours = {};
    const order = [];
    project.subzones.forEach(function (sz) {
      const a = analyseSubzone(sz);
      a.strips.concat([{ cells: a.overflow }]).forEach(function (s) {
        let prev = null;
        s.cells.forEach(function (c) {
          if (!c.key) { prev = null; return; }
          if (!neighbours[c.key]) { neighbours[c.key] = {}; order.push(c.key); }
          if (prev && prev !== c.key) { neighbours[c.key][prev] = 1; neighbours[prev][c.key] = 1; }
          prev = c.key;
        });
      });
    });
    const usage = {};
    Object.keys(project.streets).forEach(function (k) {
      const col = project.streets[k].color;
      usage[col] = (usage[col] || 0) + 1;
    });
    let changed = false;
    const choices = PALETTE.filter(function (c) { return c.name !== 'bianco'; });
    order.forEach(function (key) {
      if (project.streets[key]) return;
      const taken = {};
      Object.keys(neighbours[key]).forEach(function (n) { if (project.streets[n]) taken[project.streets[n].color] = 1; });
      const free = choices.filter(function (c) { return !taken[c.hex]; });
      const pool = free.length ? free : choices;
      pool.sort(function (x, y) { return (usage[x.hex] || 0) - (usage[y.hex] || 0) || choices.indexOf(x) - choices.indexOf(y); });
      project.streets[key] = { color: pool[0].hex };
      usage[pool[0].hex] = (usage[pool[0].hex] || 0) + 1;
      changed = true;
    });
    return changed;
  }

  function colorOf(project, key) {
    return key && project.streets[key] ? project.streets[key].color : 'FFFFFF';
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
    allCells: allCells,
    findDuplicates: findDuplicates,
    rowsToRoute: rowsToRoute,
    assignColors: assignColors,
    colorOf: colorOf,
    paletteName: paletteName,
    mapQuery: mapQuery,
    projectToText: projectToText,
    textToProject: textToProject,
    streetType: streetType,
  };
});

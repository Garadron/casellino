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

  // Strong colours for the strips. Each one has the text colour that reads best on it
  // (contrast checked: from 6.9:1 up to 18.9:1) and a family: two streets next to each other
  // never get colours of the same family or colours that look alike (see similarColors).
  const PALETTE = [
    { name: 'giallo', hex: 'FFE135', text: '111111', family: 'giallo', dark: false },
    { name: 'blu', hex: '1F4E9E', text: 'FFFFFF', family: 'blu', dark: true },
    { name: 'verde chiaro', hex: '8ED16B', text: '111111', family: 'verde', dark: false },
    { name: 'rosso scuro', hex: '8B1A1A', text: 'FFF6C2', family: 'rosso', dark: true },
    { name: 'azzurro', hex: '6CCFF6', text: '111111', family: 'azzurro', dark: false },
    { name: 'viola', hex: '5B2A94', text: 'FFFFFF', family: 'viola', dark: true },
    { name: 'arancione', hex: 'FF9A2E', text: '111111', family: 'arancio', dark: false },
    { name: 'verde scuro', hex: '17673A', text: 'FFFFFF', family: 'verde', dark: true },
    { name: 'rosa', hex: 'F7A1CF', text: '111111', family: 'rosa', dark: false },
    { name: 'nero', hex: '151515', text: 'FFFFFF', family: 'nero', dark: true },
    { name: 'grigio', hex: 'CFCFCF', text: '111111', family: 'grigio', dark: false },
    { name: 'marrone', hex: '6A3F22', text: 'FFFFFF', family: 'marrone', dark: true },
    { name: 'bianco', hex: 'FFFFFF', text: '111111', family: 'bianco', dark: false },
  ];
  // Pairs that look too much alike to stay next to each other (besides same family).
  const ALIKE = [
    ['giallo', 'arancione'], ['blu', 'viola'], ['rosso scuro', 'marrone'], ['nero', 'marrone'],
    ['azzurro', 'grigio'], ['azzurro', 'bianco'], ['rosa', 'grigio'], ['grigio', 'bianco'],
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
    // a strip may start with slots already taken ("reserved") by the end of the previous sub-zone
    const first = function (k) { return k < strips.length ? (strips[k].reserved || 0) : 0; };
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
   * Lays out every sub-zone of a project, in order. When the route of a sub-zone is longer than
   * its own modules, the rest continues in the next sub-zone, on the same (last) row, from its
   * first module: in a real frame the row goes on to the right. The next sub-zone then starts
   * that row after those pigeonholes.
   * Returns one analysis per sub-zone:
   *   { strips, spill, overflow, warnings, used, capacity, spillUsed, [module][row] = { layout } }
   * strips: its own strips (cells coming from the previous sub-zone have c.foreign = its name);
   * spill: pieces of the next sub-zone's strips holding this sub-zone's continuation.
   */
  function analyseProject(project) {
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

  // True when two colours must not be used for streets next to each other.
  function similarColors(hexA, hexB) {
    const a = paletteEntry(hexA), b = paletteEntry(hexB);
    if (!a || !b) return String(hexA).toUpperCase() === String(hexB).toUpperCase();
    if (a === b || a.family === b.family) return true;
    return ALIKE.some(function (x) { return (x[0] === a.name && x[1] === b.name) || (x[0] === b.name && x[1] === a.name); });
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

  /*
   * Gives every street without a colour one that is not similar to any street next to it,
   * alternating light and dark colours. Colours are stored in project.streets, so they never
   * change by themselves; colours that are not in the palette any more are given again.
   * Returns true if something was assigned.
   */
  function assignColors(project) {
    let changed = false;
    Object.keys(project.streets).forEach(function (k) {
      if (!paletteEntry(project.streets[k].color)) { delete project.streets[k]; changed = true; }
    });
    const nb = streetNeighbours(project);
    const usage = {};
    Object.keys(project.streets).forEach(function (k) {
      const col = project.streets[k].color;
      usage[col] = (usage[col] || 0) + 1;
    });
    const choices = PALETTE.filter(function (c) { return c.name !== 'bianco'; });
    nb.order.forEach(function (key) {
      if (project.streets[key]) return;
      const near = Object.keys(nb.map[key]).filter(function (n) { return project.streets[n]; })
        .map(function (n) { return project.streets[n].color; });
      const darkNear = near.filter(function (h) { return paletteEntry(h).dark; }).length;
      const wantDark = near.length ? darkNear * 2 < near.length : false;
      const free = choices.filter(function (c) { return !near.some(function (h) { return similarColors(h, c.hex); }); });
      const pool = free.length ? free : choices;
      const score = function (c) { return (near.length && c.dark !== wantDark ? 100 : 0) + (usage[c.hex] || 0); };
      pool.sort(function (x, y) { return score(x) - score(y) || choices.indexOf(x) - choices.indexOf(y); });
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
    allCells: allCells,
    findDuplicates: findDuplicates,
    rowsToRoute: rowsToRoute,
    assignColors: assignColors,
    colorOf: colorOf,
    textColorOf: textColorOf,
    similarColors: similarColors,
    streetNeighbours: streetNeighbours,
    paletteEntry: paletteEntry,
    streetName: streetName,
    paletteName: paletteName,
    mapQuery: mapQuery,
    projectToText: projectToText,
    textToProject: textToProject,
    streetType: streetType,
  };
});

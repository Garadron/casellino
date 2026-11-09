/*
 * Casellino - reads an Excel of strips made with the template (or by Casellino) and writes the route.
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 *
 * Every sheet with something written becomes a sub-zone. The modules are the print areas of the
 * sheet (33 columns = ala, 91 = casello; rows 4-11 = 4 strips of two lines), or the template's
 * places if there is no print area. On each strip: the upper line has the pigeonholes (a merged
 * cell is a wider pigeonhole), the lower line the street names over their pigeonholes.
 * Works in the browser (window.CasellinoImporta) and in Node 18+ (module.exports).
 */
(function (root, factory) {
  const api = factory(root.CasellinoCore || (typeof require === 'function' ? require('./core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CasellinoImporta = api;
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  // ---------------------------------------------------------------- zip

  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // name -> text of the files of a zip (only the ones `want` accepts)
  async function unzip(bytes, want) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
    if (end < 0) throw new Error('il file non è un Excel (.xlsx o .xlsm)');
    const count = v.getUint16(end + 10, true);
    let p = v.getUint32(end + 16, true);
    const out = {};
    const dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
      const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
      const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extra + comment;
      if (!want(name)) continue;
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const raw = bytes.subarray(start, start + size);
      out[name] = dec.decode(method === 0 ? raw : await inflate(raw));
    }
    return out;
  }

  // ---------------------------------------------------------------- workbook

  function unescape(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); }).replace(/&amp;/g, '&');
  }
  const attr = function (tag, name) { const m = new RegExp('\\b' + name + '="([^"]*)"').exec(tag); return m ? unescape(m[1]) : ''; };
  const texts = function (xml) {
    let s = '';
    xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function (_, t) { s += unescape(t); });
    return s;
  };

  function colNumber(letters) {
    let n = 0;
    for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
    return n;
  }
  function ref(r) {
    const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(r);
    return m ? { c: colNumber(m[1]), r: +m[2] } : null;
  }

  function readSheet(xml, strings) {
    const cells = {};
    const re = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    while ((m = re.exec(xml))) {
      const at = ref(attr(m[1], 'r'));
      if (!at || !m[2]) continue;
      const type = attr(m[1], 't');
      const v = /<v>([\s\S]*?)<\/v>/.exec(m[2]);
      let text = '';
      if (type === 's' && v) text = strings[+v[1]] || '';
      else if (type === 'inlineStr') text = texts(m[2]);
      else if (v) text = unescape(v[1]);
      text = String(text).replace(/\r/g, '').trim();
      if (text) cells[at.r + ':' + at.c] = text;
    }
    const merges = [];
    xml.replace(/<mergeCell\s+ref="([^"]+)"/g, function (_, r) {
      const parts = r.split(':').map(ref);
      if (parts[0] && parts[1]) merges.push({ r1: parts[0].r, c1: parts[0].c, r2: parts[1].r, c2: parts[1].c });
    });
    return { cells: cells, merges: merges };
  }

  async function readWorkbook(bytes) {
    const files = await unzip(bytes, function (n) { return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n); });
    const wb = files['xl/workbook.xml'];
    if (!wb) throw new Error('il file non è un Excel (.xlsx o .xlsm)');
    const rels = {};
    (files['xl/_rels/workbook.xml.rels'] || '').replace(/<Relationship\s([^>]*)\/?>/g, function (_, a) { rels[attr(a, 'Id')] = attr(a, 'Target'); });
    const strings = [];
    (files['xl/sharedStrings.xml'] || '').replace(/<si>([\s\S]*?)<\/si>/g, function (_, si) { strings.push(texts(si)); });
    const areas = {};
    wb.replace(/<definedName\s([^>]*)>([^<]*)<\/definedName>/g, function (_, a, value) {
      if (attr(a, 'name') !== '_xlnm.Print_Area') return;
      areas[attr(a, 'localSheetId')] = unescape(value).split(',').map(function (part) {
        const range = part.replace(/^.*!/, '').split(':').map(ref);
        return range[0] && range[1] ? { c1: range[0].c, r1: range[0].r, c2: range[1].c, r2: range[1].r } : null;
      }).filter(Boolean);
    });
    const sheets = [];
    let index = 0;
    wb.replace(/<sheet\s([^>]*)\/?>/g, function (_, a) {
      const target = (rels[attr(a, 'r:id')] || '').replace(/^\/?xl\//, '');
      const xml = files['xl/' + target];
      if (xml) sheets.push({ name: attr(a, 'name'), areas: areas[String(index)] || [], data: readSheet(xml, strings) });
      index++;
    });
    return sheets;
  }

  // ---------------------------------------------------------------- strips -> route

  const TEMPLATE_PLACES = [{ c1: 2, c2: 34 }, { c1: 38, c2: 128 }, { c1: 132, c2: 164 }];

  // The modules of a sheet: print areas 33 or 91 wide, left to right; else the template's places.
  function modulesOf(sheet) {
    let list = sheet.areas.filter(function (a) { const w = a.c2 - a.c1 + 1; return w === 33 || w === 91; })
      .map(function (a) { return { c1: a.c1, c2: a.c2, row: a.r1 }; });
    if (!list.length) list = TEMPLATE_PLACES.map(function (a) { return { c1: a.c1, c2: a.c2, row: 4 }; });
    return list.sort(function (a, b) { return a.c1 - b.c1; }).map(function (a) {
      return Object.assign(a, { type: a.c2 - a.c1 + 1 === 91 ? 'casello' : 'ala' });
    });
  }

  function mergeAt(sheet, r, c) {
    return sheet.data.merges.find(function (g) { return r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2; });
  }

  // One strip: pigeonholes { from, to, top, street, whole } from the upper line, streets from the lower one.
  function readStrip(sheet, mod, i) {
    const top = mod.row + 2 * i, bottom = top + 1;
    const get = function (r, c) { return sheet.data.cells[r + ':' + c] || ''; };
    const holes = [];
    let c = mod.c1;
    while (c <= mod.c2) {
      const g = mergeAt(sheet, top, c);
      const to = g ? Math.min(g.c2, mod.c2) : c;
      const from = g ? Math.max(g.c1, mod.c1) : c;
      holes.push({ from: from - mod.c1, to: to - mod.c1, top: g ? get(g.r1, g.c1) : get(top, c), whole: !!(g && g.r2 >= bottom) });
      c = to + 1;
    }
    // street of each slot: the merged range or the single cell under it
    const streetOf = [];
    for (let k = mod.c1; k <= mod.c2; k++) {
      const g = mergeAt(sheet, bottom, k);
      streetOf.push(g && g.r1 === bottom ? get(bottom, g.c1) : (g ? '' : get(bottom, k)));
    }
    holes.forEach(function (h) {
      const names = streetOf.slice(h.from, h.to + 1).filter(Boolean);
      // two names one above the other in the same cell (written by Casellino): "C.NA ALTA / C.NA BASSA"
      h.street = h.whole ? '' : (names[0] || '').split(/\s*\n\s*/).filter(Boolean).join(' / ');
    });
    return holes;
  }

  // A pigeonhole as written in the route: "12", "2/4" (two numbers in one), "35A (2)", "vuota".
  function token(h) {
    let t = h.top.replace(/[,:]/g, ' ').replace(/\s+/g, ' ').trim();
    const two = /^([^\n]+)\n\s*([^\n]+)$/.exec(h.top.trim());
    if (two) t = two[1].trim() + '/' + two[2].trim();
    if (!t) t = 'vuota';
    return t + (h.to > h.from ? ' (' + (h.to - h.from + 1) + ')' : '');
  }

  function stripLines(holes) {
    const lines = [];
    let last = holes.length - 1;
    while (last >= 0 && !holes[last].top && !holes[last].street) last--;
    if (last < 0) return ['STRISCIA VUOTA'];
    let cur = null;
    for (let k = 0; k <= last; k++) {
      const h = holes[k];
      if (h.whole) { cur = null; lines.push(token(h).replace(/^vuota/, '?')); continue; }
      if (!h.top && !h.street) {
        if (cur && cur.empty) cur.n++;
        else { cur = { empty: true, n: 1 }; lines.push(cur); }
        continue;
      }
      const street = (h.street || '?').replace(/:/g, ' ').trim();
      if (cur && !cur.empty && cur.street === street) cur.tokens.push(token(h));
      else { cur = { street: street, tokens: [token(h)] }; lines.push(cur); }
    }
    const out = lines.map(function (l) {
      if (typeof l === 'string') return l;
      return l.empty ? 'vuote ' + l.n : l.street + ': ' + l.tokens.join(', ');
    });
    if (holes[holes.length - 1].to > holes[last].to) out.push('FINE STRISCIA');
    return out;
  }

  function sheetHasStrips(sheet, mods) {
    return mods.some(function (mod) {
      for (let i = 0; i < Core.ROWS_PER_MODULE; i++) {
        for (let c = mod.c1; c <= mod.c2; c++) {
          if (sheet.data.cells[(mod.row + 2 * i) + ':' + c] || sheet.data.cells[(mod.row + 2 * i + 1) + ':' + c]) return true;
        }
      }
      return false;
    });
  }

  // The text right of a label in the first rows ("Zona", "Titolare").
  function headerValue(sheet, word) {
    const keys = Object.keys(sheet.data.cells).filter(function (k) { return +k.split(':')[0] <= 2; });
    const label = keys.find(function (k) { return sheet.data.cells[k].trim().toLowerCase() === word; });
    if (!label) return '';
    const r = +label.split(':')[0], c = +label.split(':')[1];
    const g = mergeAt(sheet, r, c);
    const after = keys.filter(function (k) { return +k.split(':')[0] === r && +k.split(':')[1] > (g ? g.c2 : c); })
      .sort(function (a, b) { return +a.split(':')[1] - +b.split(':')[1]; });
    return after.length ? sheet.data.cells[after[0]] : '';
  }

  /*
   * An Excel file (bytes) -> { project, sheets, skipped }: a project with one sub-zone for every sheet with
   * strips. The modules follow the template (Ala A, Casello, Ala B); other arrangements become a drawn frame.
   */
  async function importExcel(bytes) {
    const sheets = await readWorkbook(bytes);
    const p = Core.newProject();
    p.subzones = [];
    const wallModules = [];
    let standard = true;
    const skipped = [];
    sheets.forEach(function (sheet) {
      const mods = modulesOf(sheet);
      if (!sheetHasStrips(sheet, mods)) { skipped.push(sheet.name); return; }
      const sz = Core.newSubzone(sheet.name, '');
      sz.modules = { alaA: false, casello: false, alaB: false };
      const caselli = mods.filter(function (m) { return m.type === 'casello'; });
      mods.forEach(function (m) {
        const place = m.type === 'casello' ? 'casello' : (caselli.length && m.c1 > caselli[0].c1 ? 'alaB' : 'alaA');
        if (caselli.length > 1 || sz.modules[place]) standard = false;
        sz.modules[place] = true;
        m.place = place;
        wallModules.push({ type: m.type, owner: sz.id });
      });
      const lines = [];
      for (let i = 0; i < Core.ROWS_PER_MODULE; i++) {
        mods.forEach(function (m) {
          lines.push('# ---- fila ' + (i + 1) + ', ' + (m.type === 'casello' ? 'Casello' : 'Ala') + ' ----');
          stripLines(readStrip(sheet, m, i)).forEach(function (l) { lines.push(l); });
        });
      }
      // a strip that only says it is empty, at the end of the route, is not needed
      while (lines.length && /^(STRISCIA VUOTA|FINE STRISCIA|# ----.*)$/.test(lines[lines.length - 1])) lines.pop();
      sz.route = lines.join('\n') + '\n';
      if (!p.zone) p.zone = headerValue(sheet, 'zona').split(' · ')[0];
      if (!p.owner) p.owner = headerValue(sheet, 'titolare');
      p.subzones.push(sz);
    });
    if (!p.subzones.length) throw new Error('in questo Excel non ho trovato strisce scritte');
    if (!standard) p.wall = { modules: wallModules, marks: [] };
    return { project: p, skipped: skipped };
  }

  return { importExcel: importExcel };
});

// Run with: node tests/test_core.js
'use strict';
const assert = require('assert');
const Core = require('../app/src/core.js');
const Xlsx = require('../app/src/xlsx.js');
const EXAMPLE = require('../app/src/example.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
const cellsOf = function (text) { return Core.parseRoute(text, 'Borgo').items.filter(function (i) { return i.kind === 'cell'; }); };
const tops = function (cells) { return cells.map(function (c) { return c.top + (c.second ? '/' + c.second : ''); }); };
// A sub-zone with the given modules and route.
const zone = function (route, modules) {
  const sz = Core.newSubzone('1A', 'Borgo');
  sz.modules = Object.assign({ alaA: false, casello: true, alaB: false }, modules || {});
  sz.route = route;
  return sz;
};
const where = function (c) { return [c.i + 1, c.m, c.start + 1].join(' '); };

test('single numbers and pairs', function () {
  const r = cellsOf('VIA DEI TIGLI: 1, 2/4, 5A, 10 A\\B');
  assert.deepStrictEqual(tops(r), ['1', '2/4', '5A', '10 A\\B']);
  assert.strictEqual(r[1].second, '4');
  assert.strictEqual(r[0].street, 'VIA DEI TIGLI');
  assert.strictEqual(r[0].town, 'Borgo');
  assert.deepStrictEqual(r.map(function (c) { return c.tok; }), [0, 1, 2, 3]);
});

test('ranges keep odd/even side', function () {
  assert.deepStrictEqual(tops(cellsOf('V: 1..9')), ['1', '3', '5', '7', '9']);
  assert.deepStrictEqual(tops(cellsOf('V: 14..8')), ['14', '12', '10', '8']);
  assert.deepStrictEqual(tops(cellsOf('V: 1..4')), ['1', '2', '3', '4']);
  assert.deepStrictEqual(tops(cellsOf('V: 2-9 dispari')), ['3', '5', '7', '9']);
  assert.deepStrictEqual(tops(cellsOf('V: 10-4 pari')), ['10', '8', '6', '4']);
  assert.deepStrictEqual(tops(cellsOf('V: 67-69')), ['67-69']);
});

test('letter ranges skip J and K', function () {
  assert.deepStrictEqual(tops(cellsOf('V: 20G..20M')), ['20G', '20H', '20I', '20L', '20M']);
  assert.deepStrictEqual(tops(cellsOf('V: 14A..C')), ['14A', '14B', '14C']);
});

test('width, empty pigeonholes, names alone', function () {
  const r = cellsOf('V: 35A (2), vuota, , 7\nCASCINA ALTA (2)\nvuote 3');
  assert.deepStrictEqual(r.map(function (c) { return c.span; }), [2, 1, 1, 1, 2, 1, 1, 1]);
  assert.strictEqual(r[4].street, 'CASCINA ALTA');
  assert.strictEqual(r[4].top, '');
  assert.strictEqual(r[5].key, '');
});

test('comments, town change, boundary, breaks', function () {
  const items = Core.parseRoute('# nota\nVIA A: 1\nCONFINE: 9B\nCOMUNE: Altrove\nVIA A: 2\nFINE STRISCIA\nfine fila\nStriscia vuota', 'Qui').items;
  assert.deepStrictEqual(items.map(function (i) { return i.kind + (i.mode ? ':' + i.mode : ''); }),
    ['cell', 'boundary', 'cell', 'break:strip', 'break:row', 'break:skip']);
  assert.strictEqual(items[0].town, 'Qui');
  assert.strictEqual(items[2].town, 'Altrove');
  assert.notStrictEqual(items[0].key, items[2].key);
});

test('too long range gives a warning, not a crash', function () {
  const r = Core.parseRoute('V: 1..5000');
  assert.strictEqual(r.items.length, 0);
  assert.strictEqual(r.warnings.length, 1);
});

test('reading order: row 1 of every module left to right, then row 2', function () {
  const a = Core.analyseSubzone(zone('V: 1..249', { alaA: true, alaB: true }));
  assert.deepStrictEqual(a.strips.slice(0, 4).map(function (s) { return s.i + ' ' + s.m; }),
    ['0 alaA', '0 casello', '0 alaB', '1 alaA']);
  const cells = Core.allCells(a);
  assert.strictEqual(where(cells[0]), '1 alaA 1');
  assert.strictEqual(where(cells[32]), '1 alaA 33');
  assert.strictEqual(where(cells[33]), '1 casello 1');
  assert.strictEqual(where(cells[123]), '1 casello 91');
  assert.strictEqual(where(cells[124]), '1 alaB 1');
  assert.strictEqual(where(cells[124]), '1 alaB 1');
  assert.strictEqual(cells[124].top, '249');
  assert.strictEqual(a.used, 125);
  assert.strictEqual(a.capacity, 4 * (33 + 91 + 33));
});

test('FINE STRISCIA, FINE FILA, STRISCIA VUOTA', function () {
  const a = Core.analyseSubzone(zone('V: 1\nFINE STRISCIA\nV: 3\nFINE FILA\nV: 5\nSTRISCIA VUOTA\nV: 7', { alaB: true }));
  assert.deepStrictEqual(Core.allCells(a).map(where), ['1 casello 1', '1 alaB 1', '2 casello 1', '3 casello 1']);
  // after a full strip, FINE STRISCIA does nothing (no empty strip by mistake)
  const b = Core.analyseSubzone(zone('V: 1..181\nFINE STRISCIA\nV: 2', { alaB: true }));
  assert.strictEqual(where(Core.allCells(b)[91]), '1 alaB 1');
  // FINE FILA at the very start of a row does nothing
  const c = Core.analyseSubzone(zone('FINE FILA\nV: 2', { alaB: true }));
  assert.strictEqual(where(Core.allCells(c)[0]), '1 casello 1');
});

test('a wide pigeonhole that does not fit moves whole to the next strip', function () {
  const a = Core.analyseSubzone(zone('V: 1..179, 200 (2)', { alaB: true }));
  const last = Core.allCells(a).pop();
  assert.strictEqual(where(last), '1 alaB 1');
  assert.strictEqual(last.span, 2);
  assert.ok(a.warnings.some(function (w) { return w.soft; }));
});

test('route longer than the frame: overflow is reported', function () {
  const a = Core.analyseSubzone(zone('V: 1..399, 2..400'));
  assert.strictEqual(a.overflow.length, 400 - 4 * 91);
  assert.ok(/più lungo/.test(a.warnings[0].text));
});

test('street runs are cut at page edges', function () {
  const a = Core.analyseSubzone(zone('VIA X: 1..61\nVIA Y: 2/4, 6', { casello: false, alaB: true }));
  const runs = a.strips[0].runs;
  assert.deepStrictEqual(runs.map(function (r) { return [r.street, r.start, r.end]; }),
    [['VIA X', 0, 21], ['VIA X', 22, 30], ['VIA Y', 31, 32]]);
});

test('old files with one text per strip keep every pigeonhole in place', function () {
  const rows = { alaA: ['', '', '', ''], casello: ['V: 1..179', 'W: 1', '', 'COMUNE: Altrove\nZ: 1'], alaB: ['V: 2..10', '', 'Y: 1', ''] };
  const route = Core.rowsToRoute(rows, { alaA: false, casello: true, alaB: true }, 'Borgo');
  const a = Core.analyseSubzone(Object.assign(zone(route, { alaB: true })));
  const cells = Core.allCells(a);
  const at = function (street, top) { return where(cells.find(function (c) { return c.street === street && c.top === top; })); };
  assert.strictEqual(at('V', '179'), '1 casello 90');
  assert.strictEqual(at('V', '2'), '1 alaB 1');
  assert.strictEqual(at('W', '1'), '2 casello 1');
  assert.strictEqual(at('Y', '1'), '3 alaB 1');
  assert.strictEqual(at('Z', '1'), '4 casello 1');
  assert.strictEqual(cells.find(function (c) { return c.street === 'Z'; }).town, 'Altrove');
  // and the same through a saved file of version 1
  const p = Core.sanitizeProject({ subzones: [{ name: '1A', town: 'Borgo', modules: { casello: true, alaB: true }, rows: rows }] });
  assert.strictEqual(p.subzones[0].route, route);
});

test('a sub-zone longer than its modules continues in the next one, on its last row', function () {
  const p = Core.newProject();
  const a = Core.newSubzone('1A', 'Borgo'); a.modules = { alaA: false, casello: true, alaB: true };
  const b = Core.newSubzone('1B', 'Villa'); b.modules = { alaA: false, casello: true, alaB: true };
  // 1A: 4 rows x (91 + 33) = 496 pigeonholes, then 3 more
  a.route = 'VIA A: 1..591, 2..400\nVIA LUNGA: 2, 4, 6';
  // 1B: row 1, row 2, row 3, then row 4 starts after the 3 pigeonholes of 1A
  b.route = 'VIA B: 1..181\nFINE FILA\nVIA C: 1..5\nFINE FILA\nVIA E: 1\nFINE FILA\nVIA D: 1, 3';
  p.subzones = [a, b];
  const all = Core.analyseProject(p);
  assert.strictEqual(all[0].overflow.length, 0, 'nothing left out');
  assert.strictEqual(all[0].spillUsed, 3);
  assert.deepStrictEqual(all[0].spill.map(function (s) { return s.target + ' ' + (s.i + 1) + ' ' + s.m + ' ' + s.used; }), ['1B 4 casello 3']);
  const bRow4 = all[1].casello[3].layout;
  assert.deepStrictEqual(bRow4.cells.map(function (c) { return (c.foreign ? '1A:' : '') + c.street + ' ' + c.top + ' @' + (c.start + 1); }),
    ['1A:VIA LUNGA 2 @1', '1A:VIA LUNGA 4 @2', '1A:VIA LUNGA 6 @3', 'VIA D 1 @4', 'VIA D 3 @5']);
  assert.deepStrictEqual(bRow4.boundaries.map(function (x) { return x.label + '@' + x.at; }), ['1B@3']);
  assert.ok(/continua nella sottozona 1B/.test(all[0].warnings[0].text));
  // each pigeonhole is counted once, in its own sub-zone
  assert.strictEqual(Core.allCells(all[1]).filter(function (c) { return c.street === 'VIA LUNGA'; }).length, 0);
  assert.strictEqual(Core.allCells(all[0]).filter(function (c) { return c.street === 'VIA LUNGA'; }).length, 3);
  // and the Excel of 1B prints them in its row 4
  const sheet2 = Xlsx.buildWorkbookFiles(p).find(function (f) { return f.name === 'xl/worksheets/sheet2.xml'; }).data;
  assert.ok(sheet2.indexOf('<c r="AL10" ') >= 0 && sheet2.indexOf('<c r="AN10" ') >= 0);
});

test('without a next sub-zone the extra pigeonholes are reported', function () {
  const p = Core.newProject();
  p.subzones[0].route = 'VIA A: 1..591, 2..400\nVIA LUNGA: 2, 4, 6';
  const a = Core.analyseProject(p)[0];
  assert.strictEqual(a.overflow.length, 3);
  assert.ok(/più lungo/.test(a.warnings[0].text));
});

test('colours: strong contrast, never alike next to each other, light and dark alternate', function () {
  // every colour has readable writing on it
  const lum = function (hex) {
    const v = [0, 2, 4].map(function (i) { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  Core.PALETTE.forEach(function (c) {
    const a = lum(c.hex), b = lum(c.text);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(ratio >= 6.5, c.name + ' contrasto ' + ratio.toFixed(1));
  });
  assert.ok(Core.similarColors('FFE135', 'FF9A2E'), 'giallo e arancione sono simili');
  assert.ok(Core.similarColors('8ED16B', '17673A'), 'due verdi sono simili');
  assert.ok(!Core.similarColors('151515', 'FFFFFF'), 'nero e bianco no');
  const p = Core.newProject();
  p.subzones[0].route = 'VIA A: 1\nVIA B: 1\nVIA C: 1\nVIA D: 1\nVIA E: 1\nVIA F: 1\nVIA G: 1\nVIA H: 1';
  p.streets['OLD|'] = { color: 'F4B6C2' }; // a colour of an older version: given again
  Core.assignColors(p);
  assert.ok(!p.streets['OLD|'], 'old colour removed');
  const cells = Core.allCells(Core.analyseSubzone(p.subzones[0]));
  for (let i = 1; i < cells.length; i++) {
    const a = Core.colorOf(p, cells[i - 1].key), b = Core.colorOf(p, cells[i].key);
    assert.ok(!Core.similarColors(a, b), cells[i - 1].street + ' / ' + cells[i].street);
    assert.notStrictEqual(Core.paletteEntry(a).dark, Core.paletteEntry(b).dark, 'chiaro e scuro alternati');
  }
});

test('colours never repeat in the same sub-zone, even with many streets', function () {
  const p = Core.newProject();
  const lines = [];
  for (let i = 1; i <= 55; i++) lines.push('VIA NUMERO ' + i + ': 1, 3');
  lines.push('VIA NUMERO 1: 5'); // the same street again: same colour, no new one
  p.subzones[0].route = lines.join('\n');
  const b = Core.newSubzone('1B', '');
  b.route = 'VIA ALTRA: 1\nVIA SECONDA: 2';
  p.subzones.push(b);
  Core.assignColors(p);
  const groups = Core.subzoneStreets(p);
  groups.forEach(function (g) {
    const colors = g.map(function (k) { return Core.colorOf(p, k); });
    assert.strictEqual(new Set(colors).size, colors.length, 'colori ripetuti nella sottozona');
  });
  const cells = Core.allCells(Core.analyseProject(p)[0]);
  for (let i = 1; i < cells.length; i++) {
    if (cells[i].key === cells[i - 1].key) continue;
    assert.ok(!Core.similarColors(Core.colorOf(p, cells[i - 1].key), Core.colorOf(p, cells[i].key)), cells[i].street);
  }
  // an older file with a repeated colour gets fixed
  p.streets[groups[0][1]] = { color: Core.colorOf(p, groups[0][0]) };
  Core.assignColors(p);
  assert.notStrictEqual(Core.colorOf(p, groups[0][1]), Core.colorOf(p, groups[0][0]));
});

test('the stops of the round follow the frame, one per piece of street', function () {
  const p = Core.newProject();
  p.subzones[0].town = 'Borgo';
  p.subzones[0].route = 'VIA A: 1, 3, 5\nVIA B: 2\n? NOMI: X\nVIA A: 7\nC.NA ALTA (2)';
  const stops = Core.routeStops(p, 0);
  assert.deepStrictEqual(stops.map(function (s) { return s.queries[0]; }),
    ['VIA A 1, Borgo', 'VIA B 2, Borgo', 'VIA A 7, Borgo', 'Cascina ALTA, Borgo']);
  assert.deepStrictEqual(stops[0].queries, ['VIA A 1, Borgo', 'VIA A, Borgo', 'A, Borgo']);
  assert.strictEqual(stops[0].cells, 3);
  assert.ok(Math.abs(Core.airKm({ lat: 45, lon: 9 }, { lat: 45.01, lon: 9 }) - 1.112) < 0.01);
  // found points stay in the saved work
  const saved = Core.sanitizeProject(JSON.parse(JSON.stringify(Object.assign(p, { geo: { 'VIA A 1, Borgo': { lat: 45, lon: 9, found: 'civico' }, x: { lat: 'a' } }, depot: 'Ufficio' }))));
  assert.deepStrictEqual(saved.geo, { 'VIA A 1, Borgo': { lat: 45, lon: 9, found: 'civico' } });
  assert.strictEqual(saved.depot, 'Ufficio');
});

test('one street, written in different ways, is one street', function () {
  assert.strictEqual(Core.streetKey('C.NA ALTA', 'Borgo'), Core.streetKey('CASCINA ALTA', 'borgo'));
  assert.strictEqual(Core.streetKey('V. DEI TIGLI?', 'Borgo'), Core.streetKey('VIA DEI TIGLI', 'Borgo'));
  assert.notStrictEqual(Core.streetKey('VIA DEI TIGLI', 'Borgo'), Core.streetKey('VIA DEI TIGLI', 'Villa'));
  // a street split in several pieces of the route keeps one colour
  const p = Core.newProject();
  p.subzones[0].route = 'VIA A: 1, 3\nVIA B: 2\nV. A: 5';
  Core.assignColors(p);
  const cells = Core.allCells(Core.analyseSubzone(p.subzones[0]));
  assert.strictEqual(Core.colorOf(p, cells[0].key), Core.colorOf(p, cells[3].key));
  assert.strictEqual(Object.keys(p.streets).length, 2);
});

test('a drawn frame: three modules for A and one for B (like a zone with two alas)', function () {
  const p = Core.newProject();
  const a = p.subzones[0]; a.name = '3A';
  const b = Core.newSubzone('3B', ''); p.subzones.push(b);
  p.wall = { modules: [{ type: 'ala', owner: a.id }, { type: 'casello', owner: a.id }, { type: 'ala', owner: a.id }, { type: 'casello', owner: b.id }], marks: [] };
  a.route = 'VIA A: 1..313\nVIA A2: 2';  // 157 = 33 + 91 + 33 fill row 1, then row 2
  b.route = 'VIA B: 1, 3';
  const all = Core.analyseProject(p);
  const cells = Core.allCells(all[0]);
  const at = function (c) { return (c.i + 1) + ' ' + c.m + '#' + c.wi + ' ' + (c.start + 1); };
  assert.strictEqual(at(cells[0]), '1 ala#0 1');
  assert.strictEqual(at(cells[33]), '1 casello#1 1');
  assert.strictEqual(at(cells[124]), '1 ala#2 1');
  assert.strictEqual(at(cells[157]), '2 ala#0 1');
  assert.strictEqual(all[0].capacity, 4 * 157);
  assert.strictEqual(at(Core.allCells(all[1])[0]), '1 casello#3 1');
  // Excel: A gets Ala A + Casello + Ala B on one sheet, B its casello
  const files = Xlsx.buildWorkbookFiles(p);
  const wb = files.find(function (f) { return f.name === 'xl/workbook.xml'; }).data;
  assert.ok(wb.indexOf("'3A'!$B$4:$AH$11,'3A'!$AL$4:$DX$11,'3A'!$EB$4:$FH$11") >= 0, wb);
  assert.ok(wb.indexOf("'3B'!$AL$4:$DX$11") >= 0);
});

test('a drawn frame: B takes the last row of A from the middle (pencil mark)', function () {
  const p = Core.newProject();
  const a = p.subzones[0]; a.name = '5A';
  const b = Core.newSubzone('5B', ''); p.subzones.push(b);
  p.wall = { modules: [{ type: 'casello', owner: a.id }, { type: 'ala', owner: a.id }, { type: 'casello', owner: b.id }, { type: 'ala', owner: b.id }], marks: [] };
  Core.setWallMark(p.wall, 3, 0, 45, b.id); // row 4 of A's casello, from slot 46, is B's
  assert.deepStrictEqual(p.wall.marks, [{ row: 3, module: 0, slot: 45, owner: b.id }]);
  a.route = 'VIA A: 1..991'.replace('1..991', '1..591, 2..334'); // 296 + 167 = 463 = 3 x 124 + 45 + 46... fills A
  b.route = 'VIA B: 1..181\nFINE FILA\nVIA C: 1\nFINE FILA\nVIA D: 1\nFINE FILA\nVIA E: 1, 3';
  const all = Core.analyseProject(p);
  const e = Core.allCells(all[1]).filter(function (c) { return c.street === 'VIA E'; });
  // in reading order, row 4 of B starts in A's casello at slot 46 (left), then B's own modules
  assert.deepStrictEqual(e.map(function (c) { return c.wi + ':' + (c.start + 1); }), ['0:46', '0:47']);
  const aRow4 = Core.allCells(all[0]).filter(function (c) { return c.i === 3; });
  assert.ok(aRow4.every(function (c) { return c.wi === 1 || c.start < 45; }), 'A in row 4 stops at slot 45 of its casello');
  // the eraser gives the slots back
  Core.removeWallMark(p.wall, 3, 0, 60);
  assert.deepStrictEqual(p.wall.marks, []);
});

test('drawing the frame of a project keeps every pigeonhole in place', function () {
  const p = Core.newProject();
  const a = p.subzones[0]; a.name = '1A';
  const b = Core.newSubzone('1B', ''); b.modules = { alaA: false, casello: true, alaB: true }; p.subzones.push(b);
  a.route = 'VIA A: 1..591, 2..400\nVIA LUNGA: 2, 4, 6';
  b.route = 'VIA B: 1..181\nFINE FILA\nVIA C: 1..5\nFINE FILA\nVIA E: 1\nFINE FILA\nVIA D: 1, 3';
  const key = function (all) { return all.map(function (x) { return Core.allCells(x).map(function (c) { return c.street + c.top + '@' + c.i + c.m + c.start; }).join(','); }).join('|'); };
  const before = key(Core.analyseProject(p));
  p.wall = Core.wallFromSubzones(p);
  assert.strictEqual(p.wall.marks.length, 2);
  const after = Core.analyseProject(p);
  assert.strictEqual(key(after).replace(/alaB/g, 'ala'), before.replace(/alaB/g, 'ala'));
  // saved and opened again
  const again = Core.sanitizeProject(JSON.parse(JSON.stringify(p)));
  assert.deepStrictEqual(again.wall, p.wall);
});

test('files of older versions with another word for the big module still open', function () {
  const p = Core.sanitizeProject({ subzones: [{ name: '1A', modules: { casellVecchio: false, alaB: true }, rows: { casellVecchio: ['V: 1', '', '', ''], alaB: ['W: 2', '', '', ''] } }] });
  assert.deepStrictEqual(p.subzones[0].modules, { alaA: false, casello: false, alaB: true });
  const cells = Core.allCells(Core.analyseSubzone(p.subzones[0]));
  assert.deepStrictEqual(cells.map(function (c) { return c.street; }), ['W']);
  const q = Core.textToProject('== SOTTOZONA 1A ==\nMODULI: casellone\n-- CASELLONE · FILA 2 --\nV: 1\n');
  assert.strictEqual(where(Core.allCells(Core.analyseSubzone(q.subzones[0]))[0]), '2 casello 1');
});

test('colours: neighbours differ and stay fixed', function () {
  const p = Core.textToProject(EXAMPLE);
  Core.assignColors(p);
  Core.analyseSubzone(p.subzones[0]).strips.forEach(function (s) {
    let prev = null;
    s.cells.forEach(function (c) {
      if (prev && c.key && prev.key && prev.key !== c.key) {
        assert.notStrictEqual(Core.colorOf(p, c.key), Core.colorOf(p, prev.key), c.street + ' / ' + prev.street);
      }
      prev = c;
    });
  });
  const before = JSON.stringify(p.streets);
  assert.strictEqual(Core.assignColors(p), false);
  assert.strictEqual(JSON.stringify(p.streets), before);
});

test('text format round trip', function () {
  const p = Core.textToProject(EXAMPLE);
  assert.strictEqual(p.zone, '9');
  assert.strictEqual(p.subzones.length, 1);
  const sz = p.subzones[0];
  assert.strictEqual(sz.town, 'Borgo Esempio');
  assert.deepStrictEqual(sz.modules, { alaA: false, casello: true, alaB: true });
  assert.ok(sz.route.indexOf('COMUNE: Villa Esempio') >= 0);
  Core.assignColors(p);
  const again = Core.textToProject(Core.projectToText(p));
  assert.strictEqual(again.subzones[0].route, sz.route);
  assert.deepStrictEqual(again.streets, p.streets);
});

test('old text format is converted on import', function () {
  const p = Core.textToProject('== SOTTOZONA 1A ==\nCOMUNE: Borgo\nMODULI: casello, ala B\n-- CASELLO · FILA 1 --\nV: 1, 3\n-- ALA B · FILA 1 --\nV: 2\n');
  const cells = Core.allCells(Core.analyseSubzone(p.subzones[0]));
  assert.deepStrictEqual(cells.map(where), ['1 casello 1', '1 casello 2', '1 alaB 1']);
});

test('duplicates are found', function () {
  const p = Core.newProject();
  p.subzones[0].name = '1A';
  p.subzones[0].route = 'VIA A: 1, 3, 5\nVIA B: 2\nVIA A: 3';
  const d = Core.findDuplicates(p);
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].number, '3');
  assert.deepStrictEqual(d[0].where, ['1A, fila 1 Casello casella 2', '1A, fila 1 Casello casella 5']);
});

test('map query sends only street, number, town', function () {
  assert.strictEqual(Core.mapQuery('VIA DEI TIGLI', '7', 'Borgo'), 'VIA DEI TIGLI 7, Borgo');
  assert.strictEqual(Core.mapQuery('C.NA ALTA', '', 'Borgo'), 'Cascina ALTA, Borgo');
  assert.strictEqual(Core.mapQuery('VIA X', 'ROSSI MARIO', 'Borgo'), 'VIA X, Borgo');
  assert.strictEqual(Core.mapQuery('VIA X', '12B', 'Borgo'), 'VIA X 12B, Borgo');
  assert.strictEqual(Core.mapQuery('', '12', 'Borgo'), '');
});

test('sanitize keeps good data and drops bad colours', function () {
  const p = Core.sanitizeProject({ zone: 3, subzones: [{ name: 'X', route: 'a' }], streets: { k: { color: '#abcdef' }, z: { color: 'red' } } });
  assert.strictEqual(p.zone, '3');
  assert.strictEqual(p.subzones[0].route, 'a');
  assert.deepStrictEqual(p.streets, { k: { color: 'ABCDEF' } });
});

test('xlsx package has the parts Excel needs', function () {
  const p = Core.textToProject(EXAMPLE);
  const files = Xlsx.buildWorkbookFiles(p);
  const names = files.map(function (f) { return f.name; });
  ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml']
    .forEach(function (n) { assert.ok(names.indexOf(n) >= 0, n); });
  const wb = files.find(function (f) { return f.name === 'xl/workbook.xml'; }).data;
  assert.ok(wb.indexOf("'9A'!$AL$4:$DX$11,'9A'!$EB$4:$FH$11") >= 0, 'print area');
  const sheet = files.find(function (f) { return f.name === 'xl/worksheets/sheet1.xml'; }).data;
  assert.ok(sheet.indexOf('<brk id="59"') >= 0, 'page break after 22 slots');
  const styles = files.find(function (f) { return f.name === 'xl/styles.xml'; }).data;
  assert.ok(styles.indexOf('diagonalUp="1"') >= 0, 'diagonal line for two numbers in one pigeonhole');
  const bytes = Xlsx.buildXlsx(p);
  assert.strictEqual(bytes[0], 0x50); assert.strictEqual(bytes[1], 0x4B);
  assert.strictEqual(Xlsx.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

console.log(passed + ' prove superate' + (process.exitCode ? ', ALCUNE FALLITE' : ''));

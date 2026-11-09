// © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
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
  const saved = Core.sanitizeProject(JSON.parse(JSON.stringify(Object.assign(p, { geo: { 'VIA A 1, Borgo': { lat: 45, lon: 9, found: 'civico' },
    'VIA B 2, Borgo': { lat: 45.1, lon: 9.1, found: 'mano' }, x: { lat: 'a' } }, depot: 'Ufficio' }))));
  assert.deepStrictEqual(saved.geo, { 'VIA A 1, Borgo': { lat: 45, lon: 9, found: 'civico' }, 'VIA B 2, Borgo': { lat: 45.1, lon: 9.1, found: 'mano' } },
    'a point moved by hand stays moved by hand');
  assert.strictEqual(saved.depot, 'Ufficio');
  // the office: its name and its point put by hand or with the position
  const office = Core.sanitizeProject({ subzones: [], depotName: 'Centro Esempio', depotPoint: { lat: 45.2, lon: 9.3, found: 'gps' } });
  assert.strictEqual(office.depotName, 'Centro Esempio');
  assert.deepStrictEqual(office.depotPoint, { lat: 45.2, lon: 9.3, found: 'gps' });
  assert.strictEqual(Core.sanitizeProject({ subzones: [], depotPoint: { lat: null, lon: 9 } }).depotPoint, null);
  assert.strictEqual(Core.newProject().depotPoint, null);
  // the office's address in three parts (comune, via, civico), also from a line written before, in any order
  const addr = function (via, civico, comune, provincia) { return { via: via, civico: civico, comune: comune, provincia: provincia || '' }; };
  assert.deepStrictEqual(Core.splitAddress('Via dei Tigli, 15, 00000 Borgo Esempio (Frazione)'), addr('Via dei Tigli', '15', 'Borgo Esempio'));
  assert.deepStrictEqual(Core.splitAddress('Borgo Esempio, Via dei Tigli, 15'), addr('Via dei Tigli', '15', 'Borgo Esempio'));
  assert.deepStrictEqual(Core.splitAddress('Piazza del Pozzo 1/A - Villa Esempio'), addr('Piazza del Pozzo', '1/A', 'Villa Esempio'));
  assert.deepStrictEqual(Core.splitAddress('Borgo Nuovo 3, Villa Esempio'), addr('Borgo Nuovo', '3', 'Villa Esempio'));
  assert.deepStrictEqual(Core.splitAddress('Via dei Tigli 15, 00000 Borgo Esempio (CR)'), addr('Via dei Tigli', '15', 'Borgo Esempio', 'CR'), 'the province in brackets');
  assert.deepStrictEqual(Core.splitAddress('Via dei Tigli 15, Borgo Esempio MI'), addr('Via dei Tigli', '15', 'Borgo Esempio', 'MI'));
  assert.strictEqual(Core.addressText(addr('Via dei Tigli', '15', 'Borgo Esempio')), 'Via dei Tigli 15, Borgo Esempio');
  assert.strictEqual(Core.addressText(addr('Via dei Tigli', '15', 'Borgo Esempio', 'CR')), 'Via dei Tigli 15, Borgo Esempio (CR)');
  assert.strictEqual(Core.provinceName('cr'), 'Cremona');
  assert.strictEqual(Core.provinceName('XX'), '');
  assert.deepStrictEqual(Core.sanitizeProject({ subzones: [], depot: 'Via Esempio 1, Borgo Esempio' }).depotAddr,
    { comune: 'Borgo Esempio', provincia: '', via: 'Via Esempio', civico: '1' }, 'works saved before keep their address');
  // coordinates pasted from a map, also as a Google Maps link
  assert.deepStrictEqual(Core.parseCoordinates('45.43212, 9.56789'), { lat: 45.43212, lon: 9.56789 });
  assert.deepStrictEqual(Core.parseCoordinates('45,4321 9,5678'), { lat: 45.4321, lon: 9.5678 });
  assert.deepStrictEqual(Core.parseCoordinates('https://www.google.com/maps/place/X/@45.40,9.50,17z/data=!3m1!4b1!4m6!3m5!8m2!3d45.4321!4d9.5678'),
    { lat: 45.4321, lon: 9.5678 }, 'the point of the place, not the centre of the map');
  assert.strictEqual(Core.parseCoordinates('Via dei Tigli 15'), null);
});

test('optimizing the round: shortest order from the office and back', function () {
  const xs = [0, 5, 2, 9, 1, 7, 3, 8, 4, 6];               // the office at 0, stops on a straight road
  const d = xs.map(function (a) { return xs.map(function (b) { return Math.abs(a - b); }); });
  const order = Core.optimizeOrder(d);
  assert.strictEqual(Core.tourCost(d, order), 18, 'out to 9 and back');
  assert.deepStrictEqual(order.slice().sort(function (a, b) { return a - b; }), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'every stop once');
  // one-way streets: the matrix is not symmetric
  const one = [[0, 1, 9], [9, 0, 1], [1, 9, 0]];
  assert.deepStrictEqual(Core.optimizeOrder(one), [1, 2]);
});

test('optimizing the round: the route text in the new order', function () {
  const p = Core.newProject();
  const sz = p.subzones[0];
  sz.town = 'Borgo';
  sz.route = ['# inizio', 'VIA A: 1, 3', 'FINE STRISCIA', '# nota della B', 'VIA B: 2', '? NOMI: X', 'vuote 3',
    'COMUNE: Villa', 'VIA C: 5', 'CONFINE: 1B'].join('\n');
  const stops = Core.routeStops(p, 0);
  assert.deepStrictEqual(stops.map(function (s) { return s.street + '@' + s.town; }), ['VIA A@Borgo', 'VIA B@Borgo', 'VIA C@Villa']);
  const r = Core.reorderRoute(sz, stops, [2, 0, 1]);
  // a note travels with the line under it
  assert.strictEqual(r.route, ['COMUNE: Villa', 'VIA C: 5', 'COMUNE: Borgo', '# inizio', 'VIA A: 1, 3', '# nota della B', 'VIA B: 2', '? NOMI: X', ''].join('\n'));
  assert.deepStrictEqual(r.dropped, ['FINE STRISCIA', 'vuote 3', 'CONFINE: 1B']);
  // nothing is lost: the same pigeonholes, in another order
  const before = Core.allCells(Core.analyseSubzone(sz)).map(function (c) { return c.street + c.top; }).sort();
  const after = Core.allCells(Core.analyseSubzone(Object.assign({}, sz, { route: r.route }))).map(function (c) { return c.street + c.top; }).sort();
  assert.deepStrictEqual(after, before.filter(function (x) { return x !== ''; }));
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

test('photo of a strip: printed lines removed, one group of ink per pigeonhole', function () {
  const F = require('../app/src/foto.js');
  // a white strip 300x60: border lines, a middle line at y=35, lines between pigeonholes at x=100 and 200,
  // and a "number" (two strokes close together) in each pigeonhole
  const W = 300, H = 60, data = new Uint8ClampedArray(W * H * 4).fill(255);
  const ink = function (x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  };
  ink(0, 0, W, 2); ink(0, 34, W, 36); ink(0, 58, W, 60);
  ink(99, 0, 102, 60); ink(199, 0, 202, 60);
  [40, 140, 240].forEach(function (x) { ink(x, 10, x + 4, 24); ink(x + 7, 10, x + 11, 24); });
  const img = { width: W, height: H, data: data };
  const seg = F.segmentStrip(img);
  assert.ok(Math.abs(seg.split - 35) <= 2, 'line between the two rows: ' + seg.split);
  const up = F.cleanBand(img, seg.top, seg.split, 1);
  assert.strictEqual(up.separators.length, 2);
  const clusters = F.inkClusters(up);
  assert.deepStrictEqual(clusters.map(function (c) { return [c.x0, c.x1]; }), [[40, 50], [140, 150], [240, 250]]);
  assert.strictEqual(F.cleanNumber(' |12| '), '12');
  assert.strictEqual(F.cleanNumber('2O'), '20');
  assert.strictEqual(F.cleanNumber('20 G'), '20G');
  assert.strictEqual(F.cleanNumber('61\\59'), '61\\59');
  assert.strictEqual(F.cleanNumber('ABC'), '');
  assert.strictEqual(F.cleanNumber('2U'), '20', 'U read for 0');
  assert.strictEqual(F.cleanNumber('2725'), '27/25?', 'two numbers whose small slash was not seen, to check');
  assert.strictEqual(F.cleanNumber('1234'), '1234', 'not two numbers of the same side');
  const lines = F.routeLines([{ x0: 0, x1: 10, top: '1', span: 1 }, { x0: 20, x1: 30, top: '3', unsure: true, span: 1 }, { x0: 200, x1: 210, top: '2', span: 1 }],
    [{ text: 'VIA DEI TIGLI', x0: 0, x1: 40 }, { text: 'VIA DELLE ROSE', x0: 190, x1: 260 }]);
  assert.deepStrictEqual(lines, ['VIA DEI TIGLI: 1, 3?', 'VIA DELLE ROSE: 2']);
});

test('printing: pieces of 22 slots packed on full A4 sheets, one shelf row per line', function () {
  const p = Core.textToProject(EXAMPLE);
  const pieces = Core.printPieces(p);
  // casello 91 = 22+22+22+22+3, ala 33 = 22+11, 4 rows
  assert.strictEqual(pieces.length, 4 * (5 + 2));
  assert.deepStrictEqual(pieces.slice(0, 7).map(function (x) { return x.label.join(' '); }), [
    '9A Fila 1 Casello 1-22', '9A Fila 1 Casello 23-44', '9A Fila 1 Casello 45-66', '9A Fila 1 Casello 67-88',
    '9A Fila 1 Casello 89-91', '9A Fila 1 Ala B 1-22', '9A Fila 1 Ala B 23-33']);
  const pages = Core.packPages(pieces, 10);
  const lines = [].concat.apply([], pages);
  assert.strictEqual(lines.length, 4 * 6, 'the end of the casello and the end of the ala share a line');
  lines.forEach(function (l) {
    assert.ok(l.used <= Core.SLOTS_PER_PAGE);
    assert.ok(l.pieces.every(function (x) { return x.piece.i === l.pieces[0].piece.i; }), 'one shelf row per line');
  });
  const shared = lines.find(function (l) { return l.pieces.length === 2; });
  assert.deepStrictEqual(shared.pieces.map(function (x) { return x.start; }), [0, 4], 'one free slot between the pieces');
  assert.deepStrictEqual(pages.map(function (pg) { return pg.length; }), [10, 10, 4]);
  // the slots of a piece are those of its strip
  const piece = pieces[1];
  assert.ok(piece.cells.every(function (c) { return c.end >= 22 && c.start <= 43; }));
});

test('numbers for another line ("17*"): underlined on the strip, in the PDF and in the Excel', function () {
  const r = Core.parseRoute('VIA DEI TIGLI: 1, 3*, 5 *, 13A* (2), 13B (2)*, 2/4*, 7..9*\nCASCINA ALTA (2)*\nCASCINA BASSA', 'Borgo');
  assert.deepStrictEqual(r.items.map(function (i) { return (i.top || i.street) + (i.second ? '/' + i.second : '') + (i.other ? '*' : ''); }),
    ['1', '3*', '5*', '13A*', '13B*', '2/4*', '7*', '9*', 'CASCINA ALTA*', 'CASCINA BASSA']);
  assert.deepStrictEqual(r.items.map(function (i) { return i.span; }), [1, 1, 1, 2, 2, 1, 1, 1, 2, 1], 'the width stays');
  assert.strictEqual(r.warnings.length, 0);
  const p = Core.sanitizeProject({ subzones: [{ name: 'A', town: 'Borgo', route: 'VIA DEI TIGLI: 1, 3*, 2/4*\nCASCINA ALTA (2)*' }] });
  const cells = Core.allCells(Core.analyseProject(p)[0]);
  assert.deepStrictEqual(cells.map(function (c) { return !!c.other; }), [false, true, true, true]);
  // renaming finds the farm also with the mark
  Core.renameStreet(p, Core.streetKey('CASCINA ALTA', 'Borgo'), 'CASCINA ALTA DI SOPRA');
  assert.ok(/\nCASCINA ALTA DI SOPRA \(2\)\*$/.test(p.subzones[0].route), p.subzones[0].route);
  // Excel: a thick bottom border in the colour of the writing; PDF: a thick line
  const sheet = Xlsx.buildCompactFiles(p).files.find(function (f) { return f.name === 'xl/styles.xml'; }).data;
  assert.ok(/<bottom style="thick"><color rgb="FF[0-9A-F]{6}"\/><\/bottom>/.test(sheet));
  const pdf = Buffer.from(require('../app/src/pdf.js').buildPdf(p, 'Prova').bytes).toString('latin1');
  assert.ok(/ RG 3\.00 w /.test(pdf), 'a 3 pt line under the number');
});

test('two names in one pigeonhole ("C.NA ALTA / C.NA BASSA"), one above the other', function () {
  const p = Core.sanitizeProject({ subzones: [{ name: 'A', town: 'Borgo', route: 'C.NA ALTA / C.NA BASSA (2)\nVIA DEI TIGLI: 1, 2' }] });
  const a = Core.analyseProject(p)[0];
  const c = Core.allCells(a)[0];
  assert.deepStrictEqual([c.street, c.street2, c.span, c.key2], ['C.NA ALTA', 'C.NA BASSA', 2, Core.streetKey('C.NA BASSA', 'Borgo')]);
  assert.deepStrictEqual(a.strips[0].runs.map(function (r) { return [r.street, r.street2 || '']; }), [['C.NA ALTA', 'C.NA BASSA'], ['VIA DEI TIGLI', '']]);
  // printed on two lines
  const strings = Xlsx.buildCompactFiles(p).files.find(function (f) { return f.name === 'xl/sharedStrings.xml'; }).data;
  assert.ok(strings.indexOf('C.NA ALTA\nC.NA BASSA') >= 0, 'Excel: two lines in the cell');
  const pdf = Buffer.from(require('../app/src/pdf.js').buildPdf(p, 'Prova').bytes).toString('latin1');
  assert.ok(pdf.indexOf('(C.NA ALTA) Tj') >= 0 && pdf.indexOf('(C.NA BASSA) Tj') >= 0, 'PDF: both names');
  // each name can be corrected on its own
  Core.renameStreet(p, Core.streetKey('C.NA BASSA', 'Borgo'), 'C.NA BASSA DI SOTTO');
  assert.strictEqual(p.subzones[0].route.split('\n')[0], 'C.NA ALTA / C.NA BASSA DI SOTTO (2)');
});

test('two numbers in one pigeonhole follow the way of the street', function () {
  const text = ['VIA DEI TIGLI: 1, 3, 2A, 4, 7/5, 6, 9, 8, 11', 'VIA DELLE ROSE: 52/50, 48/46, 44/42,',
    'VIA DEL CANALE: 2/4, 8/10, 12/14, 13, 11, 9/7, 5/3, 1A/1', 'VIA DEL BOSCO: 8, 6A, 9C/9B, 4', 'VIA DEI MULINI: 3, 9/7 (2)*, 11'].join('\n');
  const r = Core.fixPairOrder(text, 'Borgo');
  assert.deepStrictEqual(r.fixes.map(function (f) { return (f.line + 1) + ':' + f.from + '>' + f.to; }), ['1:7/5>5/7', '5:9/7>7/9']);
  assert.strictEqual(r.text.split('\n')[0], 'VIA DEI TIGLI: 1, 3, 2A, 4, 5/7, 6, 9, 8, 11');
  assert.strictEqual(r.text.split('\n')[1], 'VIA DELLE ROSE: 52/50, 48/46, 44/42,', 'a street that goes down stays down');
  assert.strictEqual(r.text.split('\n')[2], 'VIA DEL CANALE: 2/4, 8/10, 12/14, 13, 11, 9/7, 5/3, 1A/1', 'a street that turns back is understood');
  assert.strictEqual(r.text.split('\n')[3], 'VIA DEL BOSCO: 8, 6A, 9C/9B, 4', 'same number: the letters stay as written');
  assert.strictEqual(r.text.split('\n')[4], 'VIA DEI MULINI: 3, 7/9 (2)*, 11', 'width and mark stay');
  assert.strictEqual(Core.fixPairOrder(r.text, 'Borgo').fixes.length, 0, 'nothing more to fix');
  // a "*" on both numbers is one marked pigeonhole
  const it = Core.parseRoute('VIA DEL BOSCO: 9C*/9B*', 'Borgo').items[0];
  assert.deepStrictEqual([it.top, it.second, it.other], ['9C', '9B', true]);
});

test('correcting a street name from the list: every line, every sub-zone, same colour', function () {
  const p = Core.sanitizeProject({ subzones: [
    { name: 'A', town: 'Borgo', route: 'VIA DEI TIGLLI: 1..5\nC.NA ALTA (2)\nVIA DELLE ROSE: 2\n  via dei tiglli?: 7, 9\nCOMUNE: Villa\nVIA DEI TIGLLI: 1' },
    { name: 'B', town: 'Borgo', route: 'VIA DEI TIGLLI: 11\nFINE FILA\nCASCINA ALTA: 4' },
  ] });
  const key = Core.streetKey('VIA DEI TIGLLI', 'Borgo');
  p.streets[key] = { color: '8ED16B' };
  const r = Core.renameStreet(p, key, 'VIA DEI TIGLI');
  assert.deepStrictEqual(r, { lines: 3, zones: [0, 1] });
  assert.strictEqual(p.subzones[0].route, 'VIA DEI TIGLI: 1..5\nC.NA ALTA (2)\nVIA DELLE ROSE: 2\n  VIA DEI TIGLI: 7, 9\nCOMUNE: Villa\nVIA DEI TIGLLI: 1',
    'the numbers stay; the street with the same name in another town does not change');
  assert.strictEqual(p.subzones[1].route, 'VIA DEI TIGLI: 11\nFINE FILA\nCASCINA ALTA: 4');
  assert.deepStrictEqual(p.streets[Core.streetKey('VIA DEI TIGLI', 'Borgo')], { color: '8ED16B' }, 'the colour goes with it');
  assert.strictEqual(p.streets[key], undefined);
  // "C.NA ALTA" and "CASCINA ALTA" are one street: both get the new name, the span stays
  Core.renameStreet(p, Core.streetKey('CASCINA ALTA', 'Borgo'), 'CASCINA ALTA DI SOPRA');
  assert.ok(/\nCASCINA ALTA DI SOPRA \(2\)\n/.test(p.subzones[0].route));
  assert.ok(/CASCINA ALTA DI SOPRA: 4$/.test(p.subzones[1].route));
  assert.deepStrictEqual(Core.renameStreet(p, key, '  '), { lines: 0, zones: [] }, 'an empty name changes nothing');
});

test('printing by modules: the 4 rows of a module together, like the template, 2 blocks per sheet', function () {
  const p = Core.textToProject(EXAMPLE);
  const blocks = Core.printBlocks(p);
  assert.deepStrictEqual(blocks.map(function (b) { return b.label.join(' '); }), ['9A Casello 1-22', '9A Casello 23-44',
    '9A Casello 45-66', '9A Casello 67-88', '9A Casello 89-91', '9A Ala B 1-22', '9A Ala B 23-33']);
  blocks.forEach(function (b) {
    assert.strictEqual(b.floors.length, Core.ROWS_PER_MODULE);
    b.floors.forEach(function (f) { assert.ok(f.cells.every(function (c) { return c.end >= b.from && c.start <= b.to; })); });
  });
  const lines = [].concat.apply([], Core.packPages(blocks, 2));
  assert.deepStrictEqual(lines.map(function (l) { return l.pieces.map(function (x) { return x.piece.label[2] + '@' + x.start; }).join(' '); }),
    ['1-22@0', '23-44@0', '45-66@0', '67-88@0', '89-91@0 23-33@4', '1-22@0'], 'the end of the ala fills the line of the end of the casello');
});

test('printing: the compact Excel keeps the template measures; the PDF is a valid file', function () {
  const p = Core.textToProject(EXAMPLE);
  const r = Xlsx.buildCompactFiles(p);
  const sheet = r.files.find(function (f) { return f.name === 'xl/worksheets/sheet1.xml'; }).data;
  assert.ok(sheet.indexOf('<col min="2" max="23" width="' + Xlsx.GEOMETRY.defaultColWidth + '" customWidth="1"/>') >= 0, 'slot width of the template');
  assert.ok(sheet.indexOf('<row r="2" ht="28.35" customHeight="1">') >= 0 && sheet.indexOf('<row r="9" ht="19.9" customHeight="1">') >= 0, 'row heights of the template');
  assert.ok(sheet.indexOf('<printOptions horizontalCentered="1" verticalCentered="1"/>') >= 0);
  assert.ok(sheet.indexOf('<rowBreaks count="2"') >= 0, 'a page break every 2 blocks');
  assert.ok(sheet.indexOf('<mergeCell ref="A2:A3"/>') >= 0, '"1 Fila" beside the first row of the block');
  assert.strictEqual(r.pages, 3);
  const floors = Xlsx.buildCompactFiles(p, 'piani');
  const sheet2 = floors.files.find(function (f) { return f.name === 'xl/worksheets/sheet1.xml'; }).data;
  assert.ok(sheet2.indexOf('<col min="1" max="22" width="' + Xlsx.GEOMETRY.defaultColWidth + '" customWidth="1"/>') >= 0);
  assert.ok(sheet2.indexOf('<row r="2" ht="28.35" customHeight="1">') >= 0 && sheet2.indexOf('<row r="3" ht="19.9" customHeight="1">') >= 0);
  assert.strictEqual(floors.pages, 3);
  assert.strictEqual(floors.lines, 24);
  const Pdf = require('../app/src/pdf.js');
  assert.strictEqual(Pdf.buildPdf(p, 'Prova', 'piani').pages, 3);
  const pdf = Pdf.buildPdf(p, 'Prova');
  const text = Buffer.from(pdf.bytes).toString('latin1');
  assert.strictEqual(pdf.pages, 3);
  assert.ok(/^%PDF-1\.4/.test(text) && /%%EOF\n$/.test(text));
  assert.strictEqual((text.match(/\/Type \/Page /g) || []).length, 3);
  const xref = +/startxref\n(\d+)/.exec(text)[1];
  assert.strictEqual(text.slice(xref, xref + 4), 'xref', 'the table of contents is where it says');
  assert.ok(text.indexOf('(VIA DEI TIGLI) Tj') >= 0);
  assert.ok(Pdf.diagonalSize('5A', '5B', 35.25, 28.35) >= 8, 'two short numbers stay readable');
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

test('a locked route stays locked in the saved work', function () {
  const p = Core.newProject();
  p.subzones[0].locked = 1762560000000;
  assert.strictEqual(Core.sanitizeProject(JSON.parse(JSON.stringify(p))).subzones[0].locked, 1762560000000);
  assert.strictEqual(Core.sanitizeProject({ subzones: [{ name: 'x', locked: 'no' }] }).subzones[0].locked, 0);
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

// ---------------------------------------------------------------- tests that wait (reading Excel files)

// A zip compressed like the ones Excel writes (deflate), from a list of { name, data }.
function deflatedZip(files) {
  const zlib = require('zlib');
  const parts = [], central = [];
  let offset = 0;
  files.forEach(function (f) {
    const name = Buffer.from(f.name), data = Buffer.from(f.data), packed = zlib.deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(Xlsx.crc32(data), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(Xlsx.crc32(data), 16); cd.writeUInt32LE(packed.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42);
    parts.push(local, name, packed); central.push(cd, name);
    offset += 30 + name.length + packed.length;
  });
  const size = central.reduce(function (a, b) { return a + b.length; }, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat(parts.concat(central, [end])));
}

async function asyncTests() {
  const Importa = require('../app/src/importa.js');
  // street names without the town: the Excel does not say it
  const pigeonholes = function (project) {
    return Core.analyseProject(project).map(function (a) {
      return a.sheets.map(function (sh) {
        return Core.MODULES.filter(function (m) { return sh.modules[m]; }).map(function (m) {
          return sh.rows[m].map(function (st) {
            return st.cells.map(function (c) { return c.start + ':' + c.span + ':' + Core.streetName(c.street) + (c.street2 ? '+' + Core.streetName(c.street2) : '') + ':' + c.top + (c.second ? '/' + c.second : ''); }).join(',');
          }).join('|');
        }).join('#');
      }).join('&');
    });
  };
  try {
    const p = Core.textToProject(EXAMPLE);
    p.subzones[0].town = '';
    p.subzones[0].route = p.subzones[0].route.replace('CASCINA ALTA', 'CASCINA ALTA / CASCINA BASSA');   // two names in a pigeonhole
    // Excel like the template -> Casellino: every pigeonhole in its place, with its street
    const plain = await Importa.importExcel(Xlsx.buildXlsx(JSON.parse(JSON.stringify(p))));
    assert.deepStrictEqual(pigeonholes(plain.project), pigeonholes(p), 'stesse caselle dopo andata e ritorno');
    assert.strictEqual(plain.project.zone, '9');
    assert.strictEqual(plain.project.owner, 'Mario Esempio');
    assert.deepStrictEqual(plain.project.subzones[0].modules, { alaA: false, casello: true, alaB: true });
    // the same, compressed as Excel does
    const packed = await Importa.importExcel(deflatedZip(Xlsx.buildWorkbookFiles(JSON.parse(JSON.stringify(p)))));
    assert.deepStrictEqual(pigeonholes(packed.project), pigeonholes(p), 'anche compresso');
    // not an Excel
    await assert.rejects(Importa.importExcel(new Uint8Array([1, 2, 3, 4])), /non è un Excel/);
    passed++;
  } catch (e) { console.error('FAIL Excel import\n  ' + e.message); process.exitCode = 1; }
}

asyncTests().then(function () {
  console.log(passed + ' prove superate' + (process.exitCode ? ', ALCUNE FALLITE' : ''));
});

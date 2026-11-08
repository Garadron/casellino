// © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
// Smoke test of the page in a simulated browser (jsdom).
// Needs jsdom, installed anywhere:  npm install jsdom   (then JSDOM_PATH=<that folder>/node_modules/jsdom)
// Run:  node tests/test_pagina.js
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'Casellino.html'), 'utf8');
const blobs = [];
const dom = new JSDOM(html, {
  url: 'http://localhost/#esempio',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(win) {
    win.matchMedia = function () { return { matches: false, addEventListener() {} }; };
    win.TextEncoder = require('util').TextEncoder; // real browsers have it, jsdom does not
    win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    win.HTMLDialogElement.prototype.close = function () { this.open = false; };
    win.URL.createObjectURL = function (b) { blobs.push(b); return 'blob:x'; };
    win.URL.revokeObjectURL = function () {};
    win.HTMLAnchorElement.prototype.click = function () {};
    win.HTMLElement.prototype.scrollIntoView = function () {};
    // the device position, as a phone at the office would give it
    Object.defineProperty(win.navigator, 'geolocation', { value: { getCurrentPosition: function (ok) { ok({ coords: { latitude: 45.25, longitude: 9.35 } }); } } });
  },
});
const win = dom.window;
const doc = win.document;
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const text = function (sel) { return doc.querySelector(sel).textContent; };

function caretAt(ta, needle, offset) {
  const pos = ta.value.indexOf(needle) + (offset || 0);
  assert.ok(pos >= 0, 'non trovo ' + needle);
  ta.setSelectionRange(pos, pos);
  ta.dispatchEvent(new win.Event('click'));
}

(async function () {
  await wait(300);
  const ta = doc.querySelector('textarea.route-text');
  assert.ok(ta.value.indexOf('VIA DEI TIGLI') >= 0, 'esempio caricato');
  assert.strictEqual(doc.querySelectorAll('#strips .fila').length, 4, 'quattro file');
  assert.deepStrictEqual([...doc.querySelectorAll('#strips .strip-head b')].slice(0, 2).map(function (b) { return b.textContent; }),
    ['Casello', 'Ala B'], 'in ogni fila prima il casello, poi l\'ala a destra');

  caretAt(ta, 'VIA DEL CANALE: 2/4, 6/8', 'VIA DEL CANALE: 2/4, '.length + 1);
  await wait(150);
  assert.ok(/Sei qui: Fila 1 · Casello · casella 64 di 91/.test(text('.now-title')), text('.now-title'));
  // the pigeonhole "6/8": one cell split by a diagonal line, 6 upper-left and 8 lower-right
  assert.deepStrictEqual([...doc.querySelectorAll('.now .here-cell')].map(function (c) { return c.querySelector('.d1').textContent + '|' + c.querySelector('.d2').textContent; }), ['6|8'], 'casella segnata, divisa in obliquo');

  caretAt(ta, 'VIA DELLE ROSE: 13..21', 'VIA DELLE ROSE: 1'.length);
  await wait(150);
  assert.ok(/Sei qui: Fila 1 · Ala B · casella 1 di 33/.test(text('.now-title')), text('.now-title'));
  assert.ok(/VIA DELLE ROSE 13, Borgo Esempio/.test(text('.here')), text('.here'));

  doc.querySelector('#strips .cell.top').dispatchEvent(new win.Event('click'));
  await wait(50);
  assert.strictEqual(doc.getElementById('selection-card').hidden, false, 'scheda della casella');
  assert.ok(/VIA DEI TIGLI/.test(text('#selection')), text('#selection'));

  const before = text('.route .used');
  ta.value = 'VIA NUOVA: 1, 2, 3\n' + ta.value;
  ta.dispatchEvent(new win.Event('input'));
  await wait(900); // the route updates after 150 ms, the side panel after another 250 ms
  assert.notStrictEqual(text('.route .used'), before, 'il conto cambia scrivendo');
  assert.ok(/VIA NUOVA/.test(text('#streets')), 'la via nuova compare nell\'elenco');

  // lock the checked route: the text cannot change, then unlock
  win.confirm = function () { return true; };
  [...doc.querySelectorAll('.route-actions button')].find(function (b) { return /Blocca/.test(b.textContent); }).dispatchEvent(new win.Event('click'));
  assert.ok(doc.querySelector('textarea.route-text').readOnly, 'giro bloccato');
  assert.ok(/bloccato/.test(text('.locked-banner')));
  assert.strictEqual(doc.querySelector('.photo-btn'), null, 'niente foto sul giro bloccato');
  [...doc.querySelectorAll('.locked-banner button')][0].dispatchEvent(new win.Event('click'));
  assert.strictEqual(doc.querySelector('textarea.route-text').readOnly, false, 'sbloccato');

  // the three ways to print
  ['btn-pdf', 'btn-excel', 'btn-excel-model'].forEach(function (id) { doc.getElementById(id).dispatchEvent(new win.Event('click')); });
  const toastText = doc.querySelector('.toast') ? doc.querySelector('.toast').textContent : '';
  assert.strictEqual(blobs.length, 3, 'PDF, Excel e Excel come il modello: ' + toastText);
  assert.strictEqual(blobs[0].type, 'application/pdf');
  assert.ok(blobs.every(function (b) { return b.size > 5000; }), 'file non vuoti');
  // "per piani" instead of "per moduli": another PDF, and the choice is remembered
  const piani = doc.querySelector('input[name="print-layout"][value="piani"]');
  piani.checked = true;
  piani.dispatchEvent(new win.Event('change'));
  doc.getElementById('btn-pdf').dispatchEvent(new win.Event('click'));
  assert.strictEqual(blobs.length, 4);
  assert.notStrictEqual(blobs[3].size, blobs[0].size, 'per piani il PDF è diverso');
  assert.strictEqual(win.localStorage.getItem('casellino.stampa'), 'piani');

  // "Lo consegna un collega": the number at the cursor gets a "*" and its pigeonhole is underlined; pressed again, it goes
  const other = [...doc.querySelectorAll('.route-actions button')].find(function (b) { return /Lo consegna un collega/.test(b.textContent); });
  const rb = doc.querySelector('textarea.route-text');
  const at = rb.value.indexOf('VIA DELLE ROSE: 1/3') + 'VIA DELLE ROSE: 1'.length;
  rb.setSelectionRange(at, at);
  other.dispatchEvent(new win.Event('click'));
  assert.ok(/VIA DELLE ROSE: 1\/3\*, 5\/7/.test(rb.value), 'segnato con *');
  assert.ok(doc.querySelectorAll('.cell.top.other').length >= 1, 'casella sottolineata');
  const at2 = rb.value.indexOf('1/3*') + 1;
  rb.setSelectionRange(at2, at2);
  other.dispatchEvent(new win.Event('click'));
  assert.ok(/VIA DELLE ROSE: 1\/3, 5\/7/.test(rb.value), 'tolto');
  // a selection marks every number in it
  const from = rb.value.indexOf('VIA DELLE ROSE: ') + 'VIA DELLE ROSE: '.length;
  rb.setSelectionRange(from, from + '1/3, 5/7'.length);
  other.dispatchEvent(new win.Event('click'));
  assert.ok(/VIA DELLE ROSE: 1\/3\*, 5\/7\*, 9,/.test(rb.value), rb.value.split('\n').find(function (l) { return /ROSE: 1/.test(l); }));
  rb.setSelectionRange(from, from + '1/3*, 5/7*'.length);
  other.dispatchEvent(new win.Event('click'));
  assert.ok(/VIA DELLE ROSE: 1\/3, 5\/7, 9,/.test(rb.value));
  // from the phone: tap the pigeonhole on the strip, then the button; a series is written out, only that one marked
  const three = [...doc.querySelectorAll('.cell.top')].find(function (el) { return el.textContent === '3' && /VIA DEI TIGLI/.test(el.title); });
  three.dispatchEvent(new win.Event('click'));
  doc.querySelector('#selection .colleague-btn').dispatchEvent(new win.Event('click'));
  assert.ok(/^VIA DEI TIGLI: 1, 3\*, 5, 7, 9, 11, 13, 15, 14\.\.2$/m.test(rb.value), 'segnata solo la 3');
  assert.ok(/La consegna un collega/.test(text('#selection .colleague-btn')), 'il pulsante dice che è segnata');
  doc.querySelector('#selection .colleague-btn').dispatchEvent(new win.Event('click'));
  assert.ok(/^VIA DEI TIGLI: 1, 3, 5, 7, 9, 11, 13, 15, 14\.\.2$/m.test(rb.value), 'tolto');
  rb.value = rb.value.replace('VIA DEI TIGLI: 1, 3, 5, 7, 9, 11, 13, 15, 14..2', 'VIA DEI TIGLI: 1..15, 14..2');
  rb.dispatchEvent(new win.Event('input'));

  // leaving the app (another app, or closing it) saves at once, without waiting
  const routeBox = doc.querySelector('textarea.route-text');
  routeBox.value = routeBox.value + '\nVIA SALVATA SUBITO: 1';
  routeBox.dispatchEvent(new win.Event('input'));
  Object.defineProperty(doc, 'visibilityState', { value: 'hidden', configurable: true });
  doc.dispatchEvent(new win.Event('visibilitychange'));
  assert.ok(/VIA SALVATA SUBITO/.test(win.localStorage.getItem('casellino.progetto')), 'salvato appena si esce');
  Object.defineProperty(doc, 'visibilityState', { value: 'visible', configurable: true });
  routeBox.value = routeBox.value.replace('\nVIA SALVATA SUBITO: 1', '');
  routeBox.dispatchEvent(new win.Event('input'));

  // a street name corrected from the list of streets: the round changes, the numbers stay
  assert.ok(!/null|undefined/.test(text('#streets')), "niente parole del programma nell'elenco");
  const tigli = [...doc.querySelectorAll('#streets li')].find(function (li) { return /^VIA DEI TIGLI$/.test((li.querySelector('.nm') || {}).textContent || ''); });
  tigli.querySelector('.pen').dispatchEvent(new win.Event('click'));
  const box = tigli.querySelector('.rename-street input');
  assert.strictEqual(box.value, 'VIA DEI TIGLI');
  box.value = 'VIA DEI TIGLI ROSSI';
  tigli.querySelector('.rename-street').dispatchEvent(new win.Event('submit', { cancelable: true }));
  const route = doc.querySelector('textarea.route-text').value;
  assert.ok(/^VIA DEI TIGLI ROSSI: 1\.\.15, 14\.\.2$/m.test(route), 'il giro ha il nome nuovo, con gli stessi civici');
  assert.ok(!/^VIA DEI TIGLI:/m.test(route));
  assert.ok([...doc.querySelectorAll('#streets .nm')].some(function (b) { return b.textContent === 'VIA DEI TIGLI ROSSI'; }), 'e anche l\'elenco');
  assert.ok(/Nome corretto in \d+ righe/.test(doc.querySelector('.toast').textContent));

  // the office: name, address, and its point from the device position (the address is kept)
  doc.getElementById('depot-name').value = 'Centro di Borgo Esempio';
  doc.getElementById('depot-name').dispatchEvent(new win.Event('input'));
  [['depot-town', 'Borgo Esempio'], ['depot-street', 'Via Esempio'], ['depot-number', '1']].forEach(function (f) {
    doc.getElementById(f[0]).value = f[1];
    doc.getElementById(f[0]).dispatchEvent(new win.Event('input'));
  });
  assert.ok(/Non ancora sulla mappa/.test(text('#depot-status')));
  doc.getElementById('btn-depot-gps').dispatchEvent(new win.Event('click'));
  assert.ok(/dalla tua posizione/.test(text('#depot-status')), text('#depot-status'));
  assert.ok(/Cerca dall/.test(text('#btn-depot-find')));
  await wait(1200);  // saved on the device after a moment
  const kept = JSON.parse(win.localStorage.getItem('casellino.progetto'));
  assert.strictEqual(kept.depotName, 'Centro di Borgo Esempio');
  assert.deepStrictEqual(kept.depotPoint, { lat: 45.25, lon: 9.35, found: 'gps' });
  assert.strictEqual(kept.depot, 'Via Esempio 1, Borgo Esempio', 'the address written stays');
  assert.deepStrictEqual(kept.depotAddr, { comune: 'Borgo Esempio', provincia: '', via: 'Via Esempio', civico: '1' });
  // the point from coordinates pasted from Google Maps
  doc.getElementById('depot-coords-in').value = '45.4321, 9.5678';
  doc.getElementById('depot-coords-in').dispatchEvent(new win.Event('input'));
  assert.ok(/messo a mano/.test(text('#depot-status')), text('#depot-status'));
  await wait(600);
  assert.deepStrictEqual(JSON.parse(win.localStorage.getItem('casellino.progetto')).depotPoint, { lat: 45.4321, lon: 9.5678, found: 'mano' });
  // the province: capitals, two letters
  doc.getElementById('depot-prov').value = 'cr';
  doc.getElementById('depot-prov').dispatchEvent(new win.Event('input'));
  assert.strictEqual(doc.getElementById('depot-prov').value, 'CR');

  // the photo reader opens from the big button and from the menu
  doc.querySelector('.photo-btn').dispatchEvent(new win.Event('click'));
  assert.ok(doc.getElementById('dlg-foto').open, 'finestra delle foto dal pulsante');
  doc.getElementById('dlg-foto').open = false;
  doc.getElementById('btn-photos').dispatchEvent(new win.Event('click'));
  assert.ok(doc.getElementById('dlg-foto').open, 'finestra delle foto dal menu');
  doc.getElementById('dlg-foto').open = false;

  // the drawing of the whole frame: two modules (casello, ala B), then one more casello
  const ov = doc.getElementById('overview-card');
  ov.open = true;
  ov.dispatchEvent(new win.Event('toggle'));
  await wait(50);
  assert.strictEqual(doc.querySelectorAll('.wall-chip').length, 2, 'due moduli nel disegno');
  assert.ok(doc.querySelector('#overview svg'), 'disegno fatto');
  [...doc.querySelectorAll('#wall-tools button')].find(function (b) { return b.textContent === '+ Casello'; }).dispatchEvent(new win.Event('click'));
  await wait(50);
  assert.strictEqual(doc.querySelectorAll('.wall-chip').length, 3, 'tre moduli dopo + Casello');
  assert.ok(/disegno del mobile/.test(text('#subzone')), 'i moduli ora si scelgono nel disegno');
  assert.ok([...doc.querySelectorAll('.pen')].length >= 2, 'matite e gomma');

  assert.ok(/Versione \d+\.\d+\.\d+/.test(text('#version')), 'versione nel menu');
  console.log('Pagina: tutte le prove superate');
  win.close();
})().catch(function (e) { console.error('FAIL ' + e.message); process.exitCode = 1; win.close(); });

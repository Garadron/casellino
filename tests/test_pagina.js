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

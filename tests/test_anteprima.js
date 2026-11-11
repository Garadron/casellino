// © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
// The preview (window.CASELLINO_ANTEPRIMA, as `build.py --anteprima` writes it): note, logo, switch and the
// words of the company replacing ours everywhere on the page, also in what appears later, but never in the route.
// Here with made-up words and logo. Run:  node tests/test_anteprima.js   (JSDOM_PATH as for test_pagina.js)
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'Casellino.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'http://localhost/#esempio',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(win) {
    win.CASELLINO_ANTEPRIMA = {
      testo: 'Anteprima di prova',
      logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 4"><rect width="10" height="4" fill="#eedc00"/></svg>',
      termini: [['casello', 'modulone'], ['caselli', 'moduloni']],
    };
    win.matchMedia = function () { return { matches: false, addEventListener() {} }; };
    win.TextEncoder = require('util').TextEncoder;
    win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    win.HTMLDialogElement.prototype.close = function () { this.open = false; };
    win.HTMLElement.prototype.scrollIntoView = function () {};
  },
});
const win = dom.window;
const doc = win.document;
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
// what the page shows: every text but the route, the scripts and the styles
const shown = function () {
  const out = [];
  const walk = doc.createTreeWalker(doc.body, 4);
  while (walk.nextNode()) if (!walk.currentNode.parentElement.closest('textarea, script, style')) out.push(walk.currentNode.nodeValue);
  return out.join(' ');
};

(async function () {
  await wait(300);
  assert.ok(doc.querySelector('.preview-note') && /Anteprima di prova/.test(doc.querySelector('.preview-note').textContent), 'la nota in alto');
  assert.ok(doc.querySelector('.theme-switch'), 'l\'interruttore sole / luna');
  assert.ok(doc.querySelector('.brand > .preview-logo svg'), 'il logo nella barra in alto');

  assert.ok(!/\bcasell[oi]\b/i.test(shown()), 'nessun "casello" resta in vista: ' + (shown().match(/.{0,30}\bcasell[oi]\b.{0,30}/i) || [''])[0]);
  assert.ok(/Modulone · 91/.test(shown()), 'la casella del modulo grande con la parola nuova, maiuscola compresa');
  assert.ok(/\bcasello\b/.test(doc.querySelector('textarea.route-text').value), 'il testo del giro resta com\'è');

  doc.getElementById('btn-tutorial').click();  // something drawn later
  await wait(50);
  assert.ok(/moduloni/.test(doc.getElementById('dlg-tutorial').textContent) && !/\bcasell[oi]\b/i.test(shown()), 'anche il tutorial, aperto dopo');
  const slot = doc.querySelector('#strips .strip-head b');
  assert.strictEqual(slot.textContent, 'Modulone', 'anche le strisce, disegnate dal programma');
  console.log('Anteprima: tutte le prove superate');
  win.close();
})().catch(function (e) { console.error(e); process.exit(1); });

// © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
// Entering with the account (v0.49.0): without it nothing of the work is shown; the news once; the work kept on the
// device after «Esci» comes back only to the same account. The server is pretended here.
// Run:  node tests/test_accesso.js   (JSDOM_PATH as for test_pagina.js)
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'Casellino.html'), 'utf8');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const calls = [];

// One page, as a phone would open it; `store` is what the device already keeps.
function open(store) {
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(win) {
      win.matchMedia = function () { return { matches: false, addEventListener() {} }; };
      win.TextEncoder = require('util').TextEncoder;
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new win.Event('close')); };
      win.HTMLElement.prototype.scrollIntoView = function () {};
      win.confirm = function () { return false; };   // «Esci»: keep the work on the device
      Object.keys(store).forEach(function (k) { win.localStorage.setItem(k, store[k]); });
      // the server: signs in whoever asks, keeps nothing
      win.fetch = function (url, o) {
        const p = url.replace(/^https?:\/\/[^/]+/, '');
        const body = o && o.body ? JSON.parse(o.body) : {};
        calls.push([o.method, p, body]);
        let r = {};
        if (p === '/api/accedi') r = { token: 'gettone-' + body.utente, utente: body.utente };
        else if (p === '/api/lavori') r = { lavori: [] };
        else if (/^\/api\/lavori\//.test(p)) r = { versione: 1, aggiornato_il: Date.now() };
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(r); } });
      };
    },
  });
  return dom.window;
}

async function signIn(win, user) {
  const doc = win.document;
  const form = doc.querySelector('#gate-body form');
  assert.ok(form, 'il riquadro d\'accesso');
  const inputs = form.querySelectorAll('input');
  inputs[0].value = user;
  form.querySelector('input[type=password]').value = 'una password lunga';
  form.dispatchEvent(new win.Event('submit', { cancelable: true }));
  await wait(200);
}

(async function () {
  const work = JSON.stringify({ zone: '7', subzones: [{ name: 'A', route: 'VIA DEI TIGLI: 1, 3, 5' }] });
  let win = open({ 'casellino.progetto': work, 'casellino.novita': '0.47.0' });
  let doc = win.document;
  await wait(300);
  // 1. without the account: only the sign-in
  assert.ok(doc.body.classList.contains('gated') && !doc.getElementById('gate').hidden, 'si vede solo l\'accesso');
  assert.ok(!doc.getElementById('gate-kept').hidden, 'dice che il lavoro sul dispositivo non si perde');
  assert.ok(!doc.getElementById('dlg-news').open, 'le novità dopo l\'accesso, non prima');
  assert.strictEqual(doc.querySelector('textarea.route-text').value, 'VIA DEI TIGLI: 1, 3, 5', 'il lavoro c\'è, nascosto');
  // 2. signing in: the page, then the news not seen yet (two versions), once
  await signIn(win, 'mario');
  assert.ok(!doc.body.classList.contains('gated') && doc.getElementById('gate').hidden, 'entrato');
  assert.ok(/mario/.test(doc.getElementById('btn-account').textContent), 'il nome in alto');
  assert.ok(calls.some(function (c) { return c[0] === 'PUT'; }), 'il lavoro che c\'era si salva nell\'account');
  assert.ok(doc.getElementById('dlg-news').open, 'le novità appena entrato');
  const versions = Array.prototype.map.call(doc.querySelectorAll('#news-body h3'), function (h3) { return h3.textContent; });
  assert.strictEqual(versions.length, 2, versions.join(' / '));
  assert.ok(versions[0].indexOf(win.CASELLINO_VERSION) >= 0, 'in cima le novità di questa versione: ' + versions[0]);
  doc.getElementById('dlg-news').close();
  doc.getElementById('btn-news').dispatchEvent(new win.Event('click'));
  assert.ok(doc.getElementById('dlg-news').open && doc.querySelectorAll('#news-body h3').length > 2, 'il tasto Novità: tutte');
  doc.getElementById('dlg-news').close();

  // 3. opened again: already in, no news a second time
  const kept = {};
  for (let i = 0; i < win.localStorage.length; i++) kept[win.localStorage.key(i)] = win.localStorage.getItem(win.localStorage.key(i));
  win = open(kept);
  doc = win.document;
  await wait(300);
  assert.ok(!doc.body.classList.contains('gated') && !doc.getElementById('dlg-news').open, 'si riapre già dentro, senza novità');
  assert.ok(/VIA DEI TIGLI/.test(doc.querySelector('textarea.route-text').value), 'il lavoro');

  // 4. «Esci» keeping the work: the page goes back to the sign-in, the work is put aside for mario
  const out = Array.prototype.find.call((function () {
    doc.getElementById('btn-account').dispatchEvent(new win.Event('click'));
    return doc.querySelectorAll('#account-body button');
  })(), function (b) { return b.textContent === 'Esci'; });
  out.dispatchEvent(new win.Event('click'));
  await wait(200);
  assert.ok(doc.body.classList.contains('gated'), 'uscito: di nuovo l\'accesso');
  assert.strictEqual(doc.querySelector('textarea.route-text').value, '', 'il lavoro non resta in vista');
  // someone else on the same phone: does not see it, and it does not go in their account
  calls.length = 0;
  await signIn(win, 'luigi');
  assert.strictEqual(doc.querySelector('textarea.route-text').value, '', 'luigi non vede il lavoro di mario');
  assert.ok(!calls.some(function (c) { return c[0] === 'PUT'; }), 'e non finisce nel suo account');
  doc.getElementById('dlg-news').close();
  if (doc.getElementById('dlg-account').open) doc.getElementById('dlg-account').close();
  Array.prototype.find.call((function () {
    doc.getElementById('btn-account').dispatchEvent(new win.Event('click'));
    return doc.querySelectorAll('#account-body button');
  })(), function (b) { return b.textContent === 'Esci'; }).dispatchEvent(new win.Event('click'));
  await wait(200);
  // mario again: his work is back
  await signIn(win, 'mario');
  assert.ok(/VIA DEI TIGLI: 1, 3, 5/.test(doc.querySelector('textarea.route-text').value), 'mario ritrova il suo lavoro');

  // 5. the server says the entry is no longer valid: back to the sign-in, with the reason
  win = open({ 'casellino.account': JSON.stringify({ token: 'vecchio', utente: 'mario' }), 'casellino.novita': '99.0.0', 'casellino.progetto': work });
  doc = win.document;
  win.fetch = function () {
    return Promise.resolve({ ok: false, status: 401, json: function () { return Promise.resolve({ errore: 'Sei uscito dal tuo account: accedi di nuovo.' }); } });
  };
  await wait(300);
  doc.getElementById('btn-account').dispatchEvent(new win.Event('click'));   // the list of the works asks the server
  await wait(200);
  assert.ok(doc.body.classList.contains('gated') && /accedi di nuovo/.test(doc.getElementById('gate-body').textContent), 'accesso scaduto: di nuovo l\'accesso');
  console.log('Accesso: tutte le prove superate');
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });

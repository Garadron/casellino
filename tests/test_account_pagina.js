// The account in the page, against a running copy of the server (simulated browser, jsdom).
// Run:  (cd server && npx wrangler dev --local --port 8799)  then
//       JSDOM_PATH=<folder>/node_modules/jsdom node tests/test_account_pagina.js [http://127.0.0.1:8799]
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const API = process.argv[2] || 'http://127.0.0.1:8799';
const html = fs.readFileSync(path.join(__dirname, '..', 'Casellino.html'), 'utf8')
  .replace('<head>', '<head><script>window.CASELLINO_API = ' + JSON.stringify(API) + ';</script>');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

// One "device": a page with its own storage. confirm() answers with `answers.confirm`.
function device(answers) {
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:5500/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(win) {
      win.matchMedia = function () { return { matches: false, addEventListener() {} }; };
      win.TextEncoder = require('util').TextEncoder;
      win.fetch = fetch;
      win.crypto.getRandomValues = function (a) { return require('crypto').getRandomValues(a); };
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { this.open = false; };
      win.HTMLElement.prototype.scrollIntoView = function () {};
      win.confirm = function () { return answers.confirm; };
    },
  });
  return dom;
}

async function until(fn, ms, label) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) { const v = fn(); if (v) return v; await wait(100); }
  throw new Error('tempo scaduto: ' + (label || fn.toString().slice(0, 90)));
}

(async function () {
  try { await fetch(API + '/api'); } catch (e) { console.log('Server non acceso: prova saltata.'); return; }
  const user = 'pagina' + Date.now().toString(36);
  const pass = 'password di prova';

  // device 1: write something, create the account
  const one = device({ confirm: false });
  const w1 = one.window, d1 = w1.document;
  await wait(300);
  assert.strictEqual(d1.getElementById('btn-account').textContent, 'Accedi');
  const ta = d1.querySelector('textarea.route-text');
  ta.value = 'VIA DEI TIGLI: 1..9';
  ta.dispatchEvent(new w1.Event('input'));
  d1.getElementById('zone').value = '9';
  d1.getElementById('zone').dispatchEvent(new w1.Event('input'));
  d1.getElementById('btn-account').dispatchEvent(new w1.Event('click'));
  [...d1.querySelectorAll('#account-body .tabs button')].find(function (b) { return b.textContent === 'Registrati'; }).dispatchEvent(new w1.Event('click'));
  const inputs = d1.querySelectorAll('#account-body input');
  inputs[0].value = user; inputs[1].value = pass;
  d1.querySelector('#account-body form').dispatchEvent(new w1.Event('submit', { cancelable: true }));
  const code = await until(function () { const c = d1.querySelector('.recovery .code'); return c && c.textContent; });
  assert.ok(/^[A-Z2-9-]{14}$/.test(code), 'codice di recupero mostrato');
  assert.strictEqual(d1.getElementById('btn-account').textContent, '👤 ' + user);
  await until(function () { return /Zona 9/.test(d1.querySelector('.works').textContent); });

  // a change is saved by itself
  ta.value = 'VIA DEI TIGLI: 1..9\nVIA DELLE ROSE: 2, 4';
  d1.getElementById('saved').textContent = '';
  ta.dispatchEvent(new w1.Event('input'));
  // saved by itself, about 2.5 seconds after the last change
  await until(function () { return /Salvato nel tuo account/.test(d1.getElementById('saved').textContent); }, 10000);

  // device 2 (office computer): sign in, the work is there
  const two = device({ confirm: true });
  const w2 = two.window, d2 = w2.document;
  await wait(300);
  d2.getElementById('btn-account').dispatchEvent(new w2.Event('click'));
  const in2 = d2.querySelectorAll('#account-body input');
  in2[0].value = user; in2[1].value = pass;
  d2.querySelector('#account-body form').dispatchEvent(new w2.Event('submit', { cancelable: true }));
  const openBtn = await until(function () {
    return [...d2.querySelectorAll('.works button')].find(function (b) { return b.textContent === 'Apri'; });
  });
  openBtn.dispatchEvent(new w2.Event('click'));
  await until(function () { return /VIA DELLE ROSE/.test(d2.querySelector('textarea.route-text').value); });
  assert.strictEqual(d2.getElementById('zone').value, '9');

  // sign out on the office computer, removing the work from it
  d2.getElementById('btn-account').dispatchEvent(new w2.Event('click'));
  [...d2.querySelectorAll('#account-body button')].find(function (b) { return b.textContent === 'Esci'; }).dispatchEvent(new w2.Event('click'));
  await until(function () { return d2.getElementById('btn-account').textContent === 'Accedi'; });
  assert.strictEqual(d2.querySelector('textarea.route-text').value, '', 'niente resta in ufficio');
  assert.strictEqual(w2.localStorage.getItem('casellino.progetto'), null);
  assert.strictEqual(w2.localStorage.getItem('casellino.account'), null);

  // clean up: delete the test account
  await fetch(API + '/api/accedi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utente: user, password: pass }) })
    .then(function (r) { return r.json(); })
    .then(function (r) {
      return fetch(API + '/api/elimina-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token }, body: JSON.stringify({ password: pass }) });
    });
  one.window.close(); two.window.close();
  console.log('Account nella pagina: tutte le prove superate');
})().catch(function (e) { console.error('FAIL ' + e.message); process.exitCode = 1; });

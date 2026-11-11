// © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
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
  assert.ok(/palmare/.test(d1.getElementById('account-body').textContent), 'il consiglio sul nome utente');
  const inputs = d1.querySelectorAll('#account-body input');
  inputs[0].value = user; inputs[1].value = 'Mario.Rossi@esempio.it'; inputs[2].value = pass;
  assert.strictEqual(inputs[1].type, 'email');
  d1.querySelector('#account-body form').dispatchEvent(new w1.Event('submit', { cancelable: true }));
  const code = await until(function () { const c = d1.querySelector('.recovery .code'); return c && c.textContent; });
  assert.ok(/^[A-Z2-9-]{14}$/.test(code), 'codice di recupero mostrato');
  assert.strictEqual(d1.getElementById('btn-account').textContent, '👤 ' + user);
  await until(function () { return /Zona 9/.test(d1.querySelector('.works').textContent); });
  await until(function () { return /m\*\*\*@esempio\.it/.test(d1.querySelector('.account-details').textContent); }, 8000, 'email nascosta');

  // a change is saved by itself
  ta.value = 'VIA DEI TIGLI: 1..9\nVIA DELLE ROSE: 2, 4';
  d1.getElementById('saved').textContent = '';
  ta.dispatchEvent(new w1.Event('input'));
  // saved by itself about 2.5 seconds after the last change; at once when the app is left
  Object.defineProperty(d1, 'visibilityState', { value: 'hidden', configurable: true });
  d1.dispatchEvent(new w1.Event('visibilitychange'));
  await until(function () { return /Salvato nel tuo account/.test(d1.getElementById('saved').textContent); }, 1800, 'salvato subito uscendo');
  Object.defineProperty(d1, 'visibilityState', { value: 'visible', configurable: true });

  // device 2 (office computer): sign in, the work is there
  const two = device({ confirm: true });
  const w2 = two.window, d2 = w2.document;
  await wait(300);
  d2.getElementById('btn-account').dispatchEvent(new w2.Event('click'));
  const in2 = d2.querySelectorAll('#account-body input');
  in2[0].value = user.toUpperCase(); in2[1].value = pass;  // capitals or not, the same name
  d2.querySelector('#account-body form').dispatchEvent(new w2.Event('submit', { cancelable: true }));
  const openBtn = await until(function () {
    return [...d2.querySelectorAll('.works button')].find(function (b) { return b.textContent === 'Apri'; });
  });
  openBtn.dispatchEvent(new w2.Event('click'));
  await until(function () { return /VIA DELLE ROSE/.test(d2.querySelector('textarea.route-text').value); });
  assert.strictEqual(d2.getElementById('zone').value, '9');

  // the phone goes on writing; the office computer, coming back on screen, opens the newer copy by itself
  ta.value = ta.value + '\nVIA DEL TELEFONO: 1';
  d1.getElementById('saved').textContent = '';
  ta.dispatchEvent(new w1.Event('input'));
  await until(function () { return /Salvato nel tuo account/.test(d1.getElementById('saved').textContent); }, 10000, 'salvato dal primo');
  d2.dispatchEvent(new w2.Event('visibilitychange'));
  await until(function () { return /VIA DEL TELEFONO/.test(d2.querySelector('textarea.route-text').value); }, 8000, 'il secondo prende la versione nuova');
  assert.ok(/Aggiornato dall'account/.test(d2.getElementById('saved').textContent));

  // a new user name: a wrong password does not sign out; then the name changes everywhere on this device
  const renamed = user + 'n';
  [...d2.querySelectorAll('.account-details button')].find(function (b) { return b.textContent === 'Cambia'; }).dispatchEvent(new w2.Event('click'));
  let fields = d2.querySelectorAll('.account-details input');
  fields[0].value = renamed; fields[1].value = 'sbagliata!!';
  d2.querySelector('.account-details form').dispatchEvent(new w2.Event('submit', { cancelable: true }));
  await until(function () { return /Password sbagliata/.test(d2.querySelector('.account-details').textContent); });
  assert.strictEqual(d2.getElementById('btn-account').textContent, '👤 ' + user, 'ancora dentro');
  fields[1].value = pass;
  d2.querySelector('.account-details form').dispatchEvent(new w2.Event('submit', { cancelable: true }));
  await until(function () { return d2.getElementById('btn-account').textContent === '👤 ' + renamed; });
  await until(function () { return /cambiare di nuovo dal/.test(d2.querySelector('.account-details').textContent); }, 8000, 'prossimo cambio');

  // sign out on the office computer, removing the work from it
  d2.getElementById('btn-account').dispatchEvent(new w2.Event('click'));
  [...d2.querySelectorAll('#account-body button')].find(function (b) { return b.textContent === 'Esci'; }).dispatchEvent(new w2.Event('click'));
  await until(function () { return d2.getElementById('btn-account').textContent === 'Accedi'; });
  assert.strictEqual(d2.querySelector('textarea.route-text').value, '', 'niente resta in ufficio');
  assert.strictEqual(w2.localStorage.getItem('casellino.progetto'), null);
  assert.strictEqual(w2.localStorage.getItem('casellino.account'), null);

  // a problem reported from the page: system written by itself, sent to the server
  d1.getElementById('btn-bug').dispatchEvent(new w1.Event('click'));
  await until(function () { return d1.getElementById('dlg-bug').open; }, 3000, 'finestra della segnalazione');
  d1.getElementById('bug-text').value = 'prova di segnalazione';
  d1.getElementById('bug-send').dispatchEvent(new w1.Event('click'));
  await until(function () { return !d1.getElementById('dlg-bug').open; }, 8000, 'segnalazione inviata');
  assert.ok(/Segnalazione inviata/.test(d1.querySelector('.toast').textContent));

  // forgotten password on the office computer: a code by e-mail (on the PC the server gives it back and the page writes it)
  d2.getElementById('btn-account').dispatchEvent(new w2.Event('click'));
  [...d2.querySelectorAll('#account-body .tabs button')].find(function (b) { return b.textContent === 'Password dimenticata'; }).dispatchEvent(new w2.Event('click'));
  let form2 = d2.querySelector('#account-body form');
  assert.strictEqual(form2.querySelector('button[type=submit]').textContent, 'Mandami il codice');
  fields = form2.querySelectorAll('input');
  fields[0].value = renamed; fields[1].value = 'mario.rossi@esempio.it';
  form2.dispatchEvent(new w2.Event('submit', { cancelable: true }));
  await until(function () { return /Ti ho mandato un codice di 6 cifre a m\*\*\*@esempio\.it/.test(d2.getElementById('account-body').textContent); }, 8000, 'codice mandato');
  form2 = d2.querySelector('#account-body form');
  assert.ok(/^\d{6}$/.test(form2.querySelector('input[autocomplete=one-time-code]').value), 'il codice di prova è scritto');
  form2.querySelector('input[type=password]').value = pass;
  form2.dispatchEvent(new w2.Event('submit', { cancelable: true }));
  await until(function () { return d2.querySelector('.recovery .code'); }, 8000, 'password cambiata');
  assert.ok(/Password cambiata/.test(d2.querySelector('.recovery').textContent));
  assert.strictEqual(d2.getElementById('btn-account').textContent, '👤 ' + renamed);

  // clean up: delete the test account
  await fetch(API + '/api/accedi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utente: renamed, password: pass }) })
    .then(function (r) { return r.json(); })
    .then(function (r) {
      return fetch(API + '/api/elimina-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token }, body: JSON.stringify({ password: pass }) });
    });
  one.window.close(); two.window.close();
  console.log('Account nella pagina: tutte le prove superate');
})().catch(function (e) { console.error('FAIL ' + e.message); process.exitCode = 1; });

// © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
// Tests the account server against a running copy.
// Run:  (cd server && npx wrangler dev --local --port 8799)  then  node tests/test_server.js [http://127.0.0.1:8799]
'use strict';
const assert = require('assert');
const BASE = process.argv[2] || 'http://127.0.0.1:8799';
const ORIGIN = 'http://127.0.0.1:5500';

async function call(method, path, body, token) {
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json();
  return { status: res.status, data: data, cors: res.headers.get('access-control-allow-origin') };
}

(async function () {
  const user = 'prova' + Date.now().toString(36);
  const pass = 'una password lunga';

  let r = await call('POST', '/api/registrati', { utente: 'ab', password: pass });
  assert.strictEqual(r.status, 400, 'nome troppo corto');
  r = await call('POST', '/api/registrati', { utente: user, password: 'corta' });
  assert.strictEqual(r.status, 400, 'password corta');

  r = await call('POST', '/api/registrati', { utente: user, password: pass });
  assert.strictEqual(r.status, 400, "serve l'email");
  r = await call('POST', '/api/registrati', { utente: user, password: pass, email: 'senza-chiocciola.it' });
  assert.strictEqual(r.status, 400, 'email non valida');
  r = await call('POST', '/api/registrati', { utente: user.toUpperCase(), password: pass, email: ' Mario.Rossi@Esempio.IT ' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.cors, ORIGIN, 'permesso per la pagina');
  assert.strictEqual(r.data.utente, user);
  assert.ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.data.recupero), 'codice di recupero');
  const recovery = r.data.recupero;
  let token = r.data.token;

  r = await call('POST', '/api/registrati', { utente: user, password: pass, email: 'a@esempio.it' });
  assert.strictEqual(r.status, 409, 'nome già preso');

  r = await call('GET', '/api/io', undefined, token);
  assert.strictEqual(r.data.utente, user);
  assert.strictEqual(r.data.email, 'm***@esempio.it', "l'email si vede solo nascosta");
  assert.strictEqual(r.data.prossimoCambioNome, 0);
  r = await call('GET', '/api/lavori');
  assert.strictEqual(r.status, 401, 'senza accesso niente lavori');

  // save, conflict, force, list, read
  const id = 'lavoro' + Date.now().toString(36);
  r = await call('PUT', '/api/lavori/' + id, { nome: 'Zona 9', dati: { zone: '9', subzones: [] }, versione: 0 }, token);
  assert.strictEqual(r.data.versione, 1, JSON.stringify(r.data));
  r = await call('PUT', '/api/lavori/' + id, { nome: 'Zona 9', dati: { zone: '9b' }, versione: 1 }, token);
  assert.strictEqual(r.data.versione, 2);
  r = await call('PUT', '/api/lavori/' + id, { nome: 'Zona 9', dati: { zone: 'vecchio' }, versione: 1 }, token);
  assert.strictEqual(r.status, 409, 'cambiato da un altro dispositivo');
  assert.strictEqual(r.data.versione, 2);
  r = await call('PUT', '/api/lavori/' + id, { nome: 'Zona 9', dati: { zone: 'forzato' }, versione: 1, forza: true }, token);
  assert.strictEqual(r.data.versione, 3);
  r = await call('GET', '/api/lavori', undefined, token);
  assert.strictEqual(r.data.lavori.length, 1);
  assert.strictEqual(r.data.lavori[0].nome, 'Zona 9');
  r = await call('GET', '/api/lavori/' + id, undefined, token);
  assert.strictEqual(JSON.parse(r.data.dati).zone, 'forzato');

  // another account cannot see or overwrite it
  const other = await call('POST', '/api/registrati', { utente: user + 'x', password: pass, email: 'altro@esempio.it' });
  r = await call('GET', '/api/lavori/' + id, undefined, other.data.token);
  assert.strictEqual(r.status, 404);
  r = await call('PUT', '/api/lavori/' + id, { nome: 'x', dati: {}, versione: 3 }, other.data.token);
  assert.strictEqual(r.status, 404);

  // wrong password, login, logout
  r = await call('POST', '/api/accedi', { utente: user, password: 'sbagliata!!' });
  assert.strictEqual(r.status, 401);
  r = await call('POST', '/api/accedi', { utente: user.toUpperCase(), password: pass });
  assert.strictEqual(r.status, 200, 'maiuscole o minuscole: è lo stesso nome');
  const second = r.data.token;
  await call('POST', '/api/esci', {}, second);
  r = await call('GET', '/api/io', undefined, second);
  assert.strictEqual(r.status, 401, 'dopo «esci» il token non vale più');

  // forgotten password with the recovery code: other devices signed out, new code
  r = await call('POST', '/api/recupera', { utente: user, recupero: 'AAAA-BBBB-CCCC', password: 'nuova password 1' });
  assert.strictEqual(r.status, 401);
  r = await call('POST', '/api/recupera', { utente: user, recupero: recovery.toLowerCase(), password: 'nuova password 1' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.notStrictEqual(r.data.recupero, recovery);
  r = await call('GET', '/api/io', undefined, token);
  assert.strictEqual(r.status, 401, 'il vecchio dispositivo è uscito');
  r = await call('POST', '/api/accedi', { utente: user, password: 'nuova password 1' });
  token = r.data.token;
  assert.ok(token);

  // a new user name, then no other change for a week
  const renamed = user + 'n';
  r = await call('POST', '/api/cambia-nome', { utente: renamed, password: 'sbagliata!!' }, token);
  assert.strictEqual(r.status, 403, 'password sbagliata, ma il dispositivo resta dentro');
  r = await call('POST', '/api/cambia-nome', { utente: user + 'x', password: 'nuova password 1' }, token);
  assert.strictEqual(r.status, 409, 'nome di un altro');
  r = await call('POST', '/api/cambia-nome', { utente: renamed.toUpperCase(), password: 'nuova password 1' }, token);
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.data.utente, renamed);
  r = await call('GET', '/api/io', undefined, token);
  assert.strictEqual(r.data.utente, renamed, 'il dispositivo resta dentro');
  assert.ok(r.data.prossimoCambioNome > Date.now() + 6 * 24 * 3600 * 1000);
  r = await call('POST', '/api/cambia-nome', { utente: user, password: 'nuova password 1' }, token);
  assert.strictEqual(r.status, 429, 'una volta a settimana');
  assert.ok(/settimana/.test(r.data.errore));
  r = await call('POST', '/api/accedi', { utente: user, password: 'nuova password 1' });
  assert.strictEqual(r.status, 401, 'il nome vecchio non vale più');
  r = await call('POST', '/api/accedi', { utente: renamed, password: 'nuova password 1' });
  assert.strictEqual(r.status, 200);

  // another e-mail
  r = await call('POST', '/api/cambia-email', { email: 'nuova@esempio.it', password: 'sbagliata!!' }, token);
  assert.strictEqual(r.status, 403, 'password sbagliata, ma il dispositivo resta dentro');
  r = await call('POST', '/api/cambia-email', { email: 'nuova', password: 'nuova password 1' }, token);
  assert.strictEqual(r.status, 400);
  r = await call('POST', '/api/cambia-email', { email: 'nuova@esempio.it', password: 'nuova password 1' }, token);
  assert.strictEqual(r.data.email, 'n***@esempio.it');

  // delete the account: works go too
  r = await call('POST', '/api/elimina-account', { password: 'sbagliata!!' }, token);
  assert.strictEqual(r.status, 403, 'password sbagliata, ma il dispositivo resta dentro');
  r = await call('POST', '/api/elimina-account', { password: 'nuova password 1' }, token);
  assert.strictEqual(r.status, 200);
  r = await call('POST', '/api/accedi', { utente: renamed, password: 'nuova password 1' });
  assert.strictEqual(r.status, 401);
  await call('POST', '/api/elimina-account', { password: pass }, other.data.token);

  // too many wrong attempts from one address are stopped
  let last = null;
  for (let i = 0; i < 12; i++) last = await call('POST', '/api/accedi', { utente: 'nessuno' + i, password: 'xxxxxxxx' });
  assert.strictEqual(last.status, 429, 'troppi tentativi');

  // unknown pages answer from another site get no permission
  const res = await fetch(BASE + '/api', { headers: { Origin: 'https://sito-qualsiasi.example' } });
  assert.strictEqual(res.headers.get('access-control-allow-origin'), null);

  console.log('Server: tutte le prove superate');
})().catch(function (e) { console.error('FAIL ' + e.message); process.exitCode = 1; });

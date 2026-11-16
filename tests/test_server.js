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
  const mail = user + '@esempio.it';   // one e-mail, one account: a new one for every run

  let r = await call('POST', '/api/registrati', { utente: 'ab', password: pass });
  assert.strictEqual(r.status, 400, 'nome troppo corto');
  r = await call('POST', '/api/registrati', { utente: user, password: 'corta' });
  assert.strictEqual(r.status, 400, 'password corta');

  for (const easy of ['12345678', 'Password1', 'aaaaaaaa', 'casellino']) {
    r = await call('POST', '/api/registrati', { utente: user, password: easy });
    assert.strictEqual(r.status, 400, 'password tra le più usate: ' + easy);
  }
  r = await call('POST', '/api/registrati', { utente: user, password: pass });
  assert.strictEqual(r.status, 400, "serve l'email");
  r = await call('POST', '/api/registrati', { utente: user, password: pass, email: 'senza-chiocciola.it' });
  assert.strictEqual(r.status, 400, 'email non valida');
  r = await call('POST', '/api/registrati', { utente: user.toUpperCase(), password: pass, email: ' ' + mail.toUpperCase() + ' ' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.cors, ORIGIN, 'permesso per la pagina');
  assert.strictEqual(r.data.utente, user);
  assert.ok(!('recupero' in r.data), 'niente codice di recupero da conservare');
  let token = r.data.token;

  r = await call('POST', '/api/registrati', { utente: user, password: pass, email: 'a' + mail });
  assert.strictEqual(r.status, 409, 'nome già preso');
  r = await call('POST', '/api/registrati', { utente: user + 'y', password: pass, email: mail });
  assert.ok(r.status === 409 && /email/.test(r.data.errore), 'una email, un account');

  r = await call('GET', '/api/io', undefined, token);
  assert.strictEqual(r.data.utente, user);
  assert.strictEqual(r.data.email, 'p***@esempio.it', "l'email si vede solo nascosta");
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
  const other = await call('POST', '/api/registrati', { utente: user + 'x', password: pass, email: 'x' + mail });
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
  r = await call('POST', '/api/accedi', { utente: ' ' + mail.toUpperCase(), password: pass });
  assert.strictEqual(r.status, 200, "si entra anche con l'email");
  await call('POST', '/api/esci', {}, r.data.token);
  await call('POST', '/api/esci', {}, second);
  r = await call('GET', '/api/io', undefined, second);
  assert.strictEqual(r.status, 401, 'dopo «esci» il token non vale più');

  r = await call('POST', '/api/recupera', { utente: user, recupero: 'AAAA-BBBB-CCCC', password: 'nuova password 1' });
  assert.strictEqual(r.status, 400, 'niente più codice di recupero: solo quello per email');

  // forgotten password with the e-mail (on the PC, MODO_PROVA=si: nothing is sent, the code is in the answer)
  r = await call('POST', '/api/codice-email', { email: 'nessuno' + mail });
  assert.strictEqual(r.status, 403, "non è l'email di un account");
  r = await call('POST', '/api/codice-email', { email: ' ' + mail.toUpperCase() });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.data.email, 'p***@esempio.it', "l'email si dice solo nascosta");
  assert.ok(/^\d{6}$/.test(r.data.prova), 'codice di 6 cifre');
  r = await call('POST', '/api/codice-email', { email: mail });
  const mailed = r.data.prova;
  r = await call('POST', '/api/recupera', { utente: mail, codice: String((+mailed + 1) % 1000000).padStart(6, '0'), password: 'nuova password 1' });
  assert.strictEqual(r.status, 401, 'codice sbagliato');
  r = await call('POST', '/api/recupera', { utente: mail, codice: mailed.slice(0, 3) + ' ' + mailed.slice(3), password: 'nuova password 1' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.token && !('recupero' in r.data), 'dentro, senza codici da conservare');
  r = await call('GET', '/api/io', undefined, token);
  assert.strictEqual(r.status, 401, 'gli altri dispositivi sono usciti');
  token = (await call('POST', '/api/accedi', { utente: user, password: 'nuova password 1' })).data.token;
  r = await call('POST', '/api/recupera', { utente: mail, codice: mailed, password: 'nuova password 1' });
  assert.strictEqual(r.status, 401, 'il codice vale una volta sola');
  r = await call('POST', '/api/codice-email', { email: mail });
  assert.strictEqual(r.status, 200, 'il terzo codice del giorno');
  r = await call('POST', '/api/codice-email', { email: mail });
  assert.strictEqual(r.status, 429, 'non più di tre al giorno');

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
  r = await call('POST', '/api/cambia-email', { email: 'x' + mail, password: 'nuova password 1' }, token);
  assert.strictEqual(r.status, 409, "l'email di un altro account");
  r = await call('POST', '/api/cambia-email', { email: 'n' + mail, password: 'nuova password 1' }, token);
  assert.strictEqual(r.data.email, 'n***@esempio.it');

  // the support: also without an account; the answer goes to the e-mail written
  r = await call('POST', '/api/supporto', { email: 'non-una-email', testo: 'una domanda' });
  assert.strictEqual(r.status, 400, 'serve una email valida per la risposta');
  r = await call('POST', '/api/supporto', { email: mail, testo: '' });
  assert.strictEqual(r.status, 400, 'serve il messaggio');
  r = await call('POST', '/api/supporto', { email: mail, testo: 'Come si mette una cascina?', versione: '0.37.0', dispositivo: 'prova' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));

  // a problem reported from the page; the PC picks it up with its key and removes it
  r = await call('POST', '/api/segnala', { testo: '', immagine: '' }, token);
  assert.strictEqual(r.status, 400, 'niente testo e niente screenshot');
  r = await call('POST', '/api/segnala', { testo: 'si ferma alla prima foto', immagine: 'non-una-immagine' }, token);
  assert.strictEqual(r.status, 400, 'screenshot non valido');
  const shot = 'data:image/jpeg;base64,' + Buffer.from('finta immagine').toString('base64');
  r = await call('POST', '/api/segnala', { testo: 'si ferma alla prima foto', sistema: 'Android 13', telefono: 'CPH2333', dettagli: '{"versione":"0.27.0"}', immagine: shot }, token);
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  const admin = process.env.CASELLINO_ADMIN || 'prova-locale-segnalazioni-1234567890';
  r = await call('GET', '/api/segnalazioni', undefined, 'chiave-sbagliata-1234567890');
  assert.strictEqual(r.status, 401, 'senza la chiave del PC niente');
  r = await call('GET', '/api/segnalazioni', undefined, admin);
  const mine = r.data.segnalazioni.find(function (x) { return x.utente === renamed && x.testo === 'si ferma alla prima foto'; });
  assert.ok(mine && mine.telefono === 'CPH2333' && mine.immagine === shot, 'arriva intera');
  r = await call('DELETE', '/api/segnalazioni/' + mine.id, undefined, admin);
  assert.strictEqual(r.data.ok, true);
  r = await call('GET', '/api/segnalazioni', undefined, admin);
  assert.ok(!r.data.segnalazioni.some(function (x) { return x.id === mine.id; }), 'tolta dal server');

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

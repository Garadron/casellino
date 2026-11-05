/*
 * Casellino - account server (Cloudflare Worker + D1, free plan).
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 *
 * Accounts with user name and password, and the works ("lavori") saved in each account, so they are
 * not lost and can be opened from any device. The page stays on its own site and calls this server
 * with a session token (Authorization: Bearer ...): no cookies, so it works on every phone.
 *
 * Passwords, recovery codes and session tokens are stored only as HMAC fingerprints made with the
 * server secret SEGRETO: the database alone does not reveal them. Fast fingerprints keep each request
 * inside the 10 ms of the free plan; guessing is stopped by the limit on attempts.
 */

const ENC = new TextEncoder();
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LIMITS = {
  attemptsPerIp: 10,        // wrong logins / recoveries from one address, in 15 minutes
  attemptsPerAccount: 20,   // wrong logins on one account, then 15 minutes of lock
  registrationsPerIp: 10,   // new accounts from one address, in a day
  works: 100,               // works per account
  bytes: 1500000,           // size of one work
  sessionDays: 180,         // a device stays signed in this long without being used
};
const ORIGINS = ['https://garadron.github.io', 'null'];

class UserError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------------------------------------------------------------- helpers

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const ok = ORIGINS.indexOf(origin) >= 0 || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  } : { 'Vary': 'Origin' };
}

function json(request, data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, corsHeaders(request)),
  });
}

function b64url(bytes) {
  let s = '';
  new Uint8Array(bytes).forEach(function (b) { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomId(n) { return b64url(crypto.getRandomValues(new Uint8Array(n || 16))); }

async function fingerprint(env, text) {
  if (!env.SEGRETO) throw new Error('Manca SEGRETO');
  const key = await crypto.subtle.importKey('raw', ENC.encode(env.SEGRETO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, ENC.encode(text)));
}

function sameText(a, b) {
  const x = ENC.encode(String(a)), y = ENC.encode(String(b));
  if (x.length !== y.length) return false;
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(x, y) : x.every(function (v, i) { return v === y[i]; });
}

async function body(request) {
  try { return await request.json(); } catch (e) { throw new UserError(400, 'Richiesta non valida.'); }
}

function userName(raw) {
  const u = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) {
    throw new UserError(400, 'Il nome utente va da 3 a 30 caratteri: lettere, numeri, punto, trattino.');
  }
  return u;
}

function checkPassword(raw, user) {
  const p = String(raw || '');
  if (p.length < 8) throw new UserError(400, 'La password deve avere almeno 8 caratteri.');
  if (p.length > 200) throw new UserError(400, 'La password è troppo lunga.');
  if (p.toLowerCase() === user) throw new UserError(400, 'La password non può essere uguale al nome utente.');
  return p;
}

// A recovery code: 12 letters and digits that are not easy to confuse, as XXXX-XXXX-XXXX.
function newRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = '';
  bytes.forEach(function (b, i) { s += (i && i % 4 === 0 ? '-' : '') + alphabet[b % alphabet.length]; });
  return s;
}
const recoveryText = function (id, code) { return 'recupero:' + id + ':' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
const passwordText = function (id, password) { return 'password:' + id + ':' + password; };

// ---------------------------------------------------------------- limits on attempts

async function checkAttempts(env, key, max, windowMs) {
  const row = await env.DB.prepare('SELECT errori, dal FROM tentativi WHERE chiave = ?').bind(key).first();
  if (row && Date.now() - row.dal < windowMs && row.errori >= max) {
    throw new UserError(429, 'Troppi tentativi. Riprova tra un quarto d\'ora.');
  }
}

async function countAttempt(env, key, windowMs) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO tentativi (chiave, errori, dal) VALUES (?1, 1, ?2)
     ON CONFLICT(chiave) DO UPDATE SET
       errori = CASE WHEN ?2 - dal > ?3 THEN 1 ELSE errori + 1 END,
       dal = CASE WHEN ?2 - dal > ?3 THEN ?2 ELSE dal END`,
  ).bind(key, now, windowMs).run();
}

const clearAttempts = function (env, key) { return env.DB.prepare('DELETE FROM tentativi WHERE chiave = ?').bind(key).run(); };
const ipOf = function (request) { return request.headers.get('CF-Connecting-IP') || 'locale'; };

// ---------------------------------------------------------------- sessions

async function newSession(env, accountId) {
  const token = randomId(32);
  const now = Date.now();
  await env.DB.prepare('DELETE FROM sessioni WHERE account_id = ? AND usata_il < ?').bind(accountId, now - LIMITS.sessionDays * DAY).run();
  await env.DB.prepare('INSERT INTO sessioni (impronta, account_id, creata_il, usata_il) VALUES (?, ?, ?, ?)')
    .bind(await fingerprint(env, 'sessione:' + token), accountId, now, now).run();
  return token;
}

async function signedIn(request, env) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(request.headers.get('Authorization') || '');
  if (!m) throw new UserError(401, 'Devi accedere al tuo account.');
  const print = await fingerprint(env, 'sessione:' + m[1]);
  const row = await env.DB.prepare(
    `SELECT s.impronta, s.usata_il, a.id, a.utente FROM sessioni s JOIN account a ON a.id = s.account_id WHERE s.impronta = ?`,
  ).bind(print).first();
  const now = Date.now();
  if (!row || now - row.usata_il > LIMITS.sessionDays * DAY) throw new UserError(401, 'Sei uscito dal tuo account: accedi di nuovo.');
  if (now - row.usata_il > DAY) await env.DB.prepare('UPDATE sessioni SET usata_il = ? WHERE impronta = ?').bind(now, print).run();
  return { id: row.id, utente: row.utente, session: print };
}

// ---------------------------------------------------------------- account

async function register(request, env) {
  const ip = 'registrazione:' + ipOf(request);
  await checkAttempts(env, ip, LIMITS.registrationsPerIp, DAY);
  const b = await body(request);
  const user = userName(b.utente);
  const password = checkPassword(b.password, user);
  const exists = await env.DB.prepare('SELECT 1 FROM account WHERE utente = ?').bind(user).first();
  if (exists) throw new UserError(409, 'Questo nome utente è già preso: scegline un altro.');
  const id = randomId(12);
  const code = newRecoveryCode();
  await env.DB.prepare(
    'INSERT INTO account (id, utente, password_impronta, recupero_impronta, errori, bloccato_fino, creato_il) VALUES (?, ?, ?, ?, 0, 0, ?)',
  ).bind(id, user, await fingerprint(env, passwordText(id, password)), await fingerprint(env, recoveryText(id, code)), Date.now()).run();
  await countAttempt(env, ip, DAY);
  return json(request, { token: await newSession(env, id), utente: user, recupero: code });
}

async function login(request, env) {
  const ip = 'accesso:' + ipOf(request);
  await checkAttempts(env, ip, LIMITS.attemptsPerIp, 15 * MINUTE);
  const b = await body(request);
  const user = String(b.utente || '').trim().toLowerCase();
  const row = await env.DB.prepare('SELECT * FROM account WHERE utente = ?').bind(user).first();
  const wrong = new UserError(401, 'Nome utente o password sbagliati.');
  if (!row) { await countAttempt(env, ip, 15 * MINUTE); throw wrong; }
  if (row.bloccato_fino > Date.now()) throw new UserError(429, 'Troppi tentativi. Riprova tra un quarto d\'ora.');
  const ok = sameText(await fingerprint(env, passwordText(row.id, String(b.password || ''))), row.password_impronta);
  if (!ok) {
    await countAttempt(env, ip, 15 * MINUTE);
    const errors = row.errori + 1;
    await env.DB.prepare('UPDATE account SET errori = ?, bloccato_fino = ? WHERE id = ?')
      .bind(errors >= LIMITS.attemptsPerAccount ? 0 : errors, errors >= LIMITS.attemptsPerAccount ? Date.now() + 15 * MINUTE : 0, row.id).run();
    throw wrong;
  }
  if (row.errori) await env.DB.prepare('UPDATE account SET errori = 0, bloccato_fino = 0 WHERE id = ?').bind(row.id).run();
  await clearAttempts(env, ip);
  return json(request, { token: await newSession(env, row.id), utente: row.utente });
}

// Forgotten password: user name + recovery code + new password. All the other devices are signed out
// and a new recovery code is given (the old one is used up).
async function recover(request, env) {
  const ip = 'accesso:' + ipOf(request);
  await checkAttempts(env, ip, LIMITS.attemptsPerIp, 15 * MINUTE);
  const b = await body(request);
  const user = String(b.utente || '').trim().toLowerCase();
  const row = await env.DB.prepare('SELECT * FROM account WHERE utente = ?').bind(user).first();
  const wrong = new UserError(401, 'Nome utente o codice di recupero sbagliati.');
  if (!row || !sameText(await fingerprint(env, recoveryText(row.id, b.recupero)), row.recupero_impronta)) {
    await countAttempt(env, ip, 15 * MINUTE);
    throw wrong;
  }
  const password = checkPassword(b.password, row.utente);
  const code = newRecoveryCode();
  await env.DB.batch([
    env.DB.prepare('UPDATE account SET password_impronta = ?, recupero_impronta = ?, errori = 0, bloccato_fino = 0 WHERE id = ?')
      .bind(await fingerprint(env, passwordText(row.id, password)), await fingerprint(env, recoveryText(row.id, code)), row.id),
    env.DB.prepare('DELETE FROM sessioni WHERE account_id = ?').bind(row.id),
  ]);
  await clearAttempts(env, ip);
  return json(request, { token: await newSession(env, row.id), utente: row.utente, recupero: code });
}

async function logout(request, env, me) {
  await env.DB.prepare('DELETE FROM sessioni WHERE impronta = ?').bind(me.session).run();
  return json(request, { ok: true });
}

async function deleteAccount(request, env, me) {
  const b = await body(request);
  const row = await env.DB.prepare('SELECT * FROM account WHERE id = ?').bind(me.id).first();
  if (!sameText(await fingerprint(env, passwordText(row.id, String(b.password || ''))), row.password_impronta)) {
    throw new UserError(401, 'Password sbagliata.');
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lavori WHERE account_id = ?').bind(me.id),
    env.DB.prepare('DELETE FROM sessioni WHERE account_id = ?').bind(me.id),
    env.DB.prepare('DELETE FROM account WHERE id = ?').bind(me.id),
  ]);
  return json(request, { ok: true });
}

// ---------------------------------------------------------------- works

function workId(raw) {
  const id = String(raw || '');
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) throw new UserError(400, 'Lavoro non valido.');
  return id;
}

async function listWorks(request, env, me) {
  const { results } = await env.DB.prepare(
    'SELECT id, nome, versione, aggiornato_il, length(dati) AS dimensione FROM lavori WHERE account_id = ? ORDER BY aggiornato_il DESC',
  ).bind(me.id).all();
  return json(request, { lavori: results });
}

async function getWork(request, env, me, id) {
  const row = await env.DB.prepare('SELECT id, nome, dati, versione, aggiornato_il FROM lavori WHERE id = ? AND account_id = ?')
    .bind(workId(id), me.id).first();
  if (!row) throw new UserError(404, 'Questo lavoro non c\'è più nel tuo account.');
  return json(request, row);
}

// Saves a work. `versione` is the version the device started from: if somebody saved it in the
// meantime from another device, the answer is 409 with the newer version, unless `forza` is true.
async function putWork(request, env, me, rawId) {
  const id = workId(rawId);
  const b = await body(request);
  const name = String(b.nome || 'Senza nome').slice(0, 120);
  const data = typeof b.dati === 'string' ? b.dati : JSON.stringify(b.dati);
  if (ENC.encode(data).length > LIMITS.bytes) throw new UserError(413, 'Il lavoro è troppo grande per essere salvato nell\'account.');
  try { JSON.parse(data); } catch (e) { throw new UserError(400, 'Il lavoro non è valido.'); }
  const now = Date.now();
  const row = await env.DB.prepare('SELECT account_id, versione, aggiornato_il FROM lavori WHERE id = ?').bind(id).first();
  if (row && row.account_id !== me.id) throw new UserError(404, 'Lavoro non trovato.');
  if (row) {
    if (!b.forza && Number(b.versione) !== row.versione) {
      return json(request, { errore: 'Questo lavoro è stato cambiato da un altro dispositivo.', versione: row.versione, aggiornato_il: row.aggiornato_il }, 409);
    }
    const version = row.versione + 1;
    await env.DB.prepare('UPDATE lavori SET nome = ?, dati = ?, versione = ?, aggiornato_il = ? WHERE id = ?').bind(name, data, version, now, id).run();
    return json(request, { id: id, versione: version, aggiornato_il: now });
  }
  const count = await env.DB.prepare('SELECT count(*) AS n FROM lavori WHERE account_id = ?').bind(me.id).first();
  if (count.n >= LIMITS.works) throw new UserError(409, 'Nel tuo account ci sono già ' + LIMITS.works + ' lavori: eliminane qualcuno.');
  await env.DB.prepare('INSERT INTO lavori (id, account_id, nome, dati, versione, aggiornato_il) VALUES (?, ?, ?, ?, 1, ?)')
    .bind(id, me.id, name, data, now).run();
  return json(request, { id: id, versione: 1, aggiornato_il: now });
}

async function deleteWork(request, env, me, id) {
  await env.DB.prepare('DELETE FROM lavori WHERE id = ? AND account_id = ?').bind(workId(id), me.id).run();
  return json(request, { ok: true });
}

// ---------------------------------------------------------------- routes

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = request.method;
  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (path === '' || path === '/api') return json(request, { casellino: true });
  if (path === '/api/registrati' && m === 'POST') return register(request, env);
  if (path === '/api/accedi' && m === 'POST') return login(request, env);
  if (path === '/api/recupera' && m === 'POST') return recover(request, env);
  const me = await signedIn(request, env);
  if (path === '/api/io' && m === 'GET') return json(request, { utente: me.utente });
  if (path === '/api/esci' && m === 'POST') return logout(request, env, me);
  if (path === '/api/elimina-account' && m === 'POST') return deleteAccount(request, env, me);
  if (path === '/api/lavori' && m === 'GET') return listWorks(request, env, me);
  const w = /^\/api\/lavori\/([^/]+)$/.exec(path);
  if (w && m === 'GET') return getWork(request, env, me, w[1]);
  if (w && m === 'PUT') return putWork(request, env, me, w[1]);
  if (w && m === 'DELETE') return deleteWork(request, env, me, w[1]);
  throw new UserError(404, 'Indirizzo sconosciuto.');
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof UserError) return json(request, { errore: e.message }, e.status);
      console.error(e && e.stack || e);
      return json(request, { errore: 'Errore del server: riprova tra poco.' }, 500);
    }
  },
};

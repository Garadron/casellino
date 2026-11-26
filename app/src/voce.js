/*
 * Casellino - il dettato (no DOM).
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 *
 * The dictation (Garadron, 26 November 2026): the words said for a piece of the route ("via Rossi 1 3 5, 41 due
 * caselle collega") become lines of the route text ("VIA ROSSI: 1, 3, 5, 41 (2)*"). The words are the whole
 * transcript, so a correction made with the keyboard is translated again from the start.
 * Stammers are cleaned: a number said twice is written once, "no"/"anzi" changes the last one, "cancella" takes it
 * away. Then insertLines() puts the lines into the route: at the end, after a pigeonhole, or in its place.
 *
 * Works in the browser (window.CasellinoVoce) and in Node (module.exports).
 */
(function (root, factory) {
  const core = root && root.CasellinoCore ? root.CasellinoCore : (typeof require === 'function' ? require('./core.js') : null);
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CasellinoVoce = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const plain = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };

  // ---------------------------------------------------------------- numbers said in words ("quarantuno" -> 41)
  const UNITS = { uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9 };
  const TEENS = { dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16,
    diciassette: 17, diciotto: 18, diciannove: 19 };
  const TENS = [['venti', 20], ['trenta', 30], ['quaranta', 40], ['cinquanta', 50], ['sessanta', 60], ['settanta', 70],
    ['ottanta', 80], ['novanta', 90]];
  function below100(s) {
    if (s in TEENS) return TEENS[s];
    if (s in UNITS) return UNITS[s];
    for (let k = 0; k < TENS.length; k++) {
      const t = TENS[k][0], v = TENS[k][1];
      if (s === t) return v;
      if (s.indexOf(t) === 0 && s.slice(t.length) in UNITS && s.slice(t.length) !== 'uno') return v + UNITS[s.slice(t.length)];
      const stem = t.slice(0, -1);   // "ventuno", "trentotto"
      if (s === stem + 'uno') return v + 1;
      if (s === stem + 'otto') return v + 8;
    }
    return null;
  }
  function wordNumber(w) {
    if (/^\d{1,4}$/.test(w)) return parseInt(w, 10);
    let s = w, n = 0;
    const hm = /^(due|tre|quattro|cinque|sei|sette|otto|nove)?cento/.exec(s);
    if (hm) {
      n = (hm[1] ? UNITS[hm[1]] : 1) * 100;
      s = s.slice(hm[0].length);
      if (!s) return n;
      if (s === 'tto') return n + 8;   // "centotto"
    }
    const r = below100(s);
    return r === null ? null : n + r;
  }

  // ---------------------------------------------------------------- the words
  const LETTERS = { a: 'A', b: 'B', bi: 'B', c: 'C', ci: 'C', d: 'D', di: 'D', e: 'E', f: 'F', effe: 'F', g: 'G', gi: 'G',
    h: 'H', acca: 'H', i: 'I', l: 'L', elle: 'L', m: 'M', emme: 'M', n: 'N', enne: 'N', o: 'O', p: 'P', pi: 'P', q: 'Q',
    cu: 'Q', r: 'R', erre: 'R', s: 'S', esse: 'S', t: 'T', ti: 'T', u: 'U', v: 'V', vu: 'V', vi: 'V', z: 'Z', zeta: 'Z',
    j: 'J', k: 'K', w: 'W', x: 'X', ics: 'X', y: 'Y' };
  // letters that are also ordinary words ("41 e 43", "lo do a un collega"): a letter only when nothing else follows
  const WEAK = { a: 1, e: 1, i: 1, o: 1, di: 1, ci: 1, ti: 1, vi: 1, pi: 1, u: 1 };
  const STARTERS = ['via', 'viale', 'vicolo', 'vico', 'vicoletto', 'piazza', 'piazzale', 'piazzetta', 'corso', 'largo',
    'strada', 'localita', 'contrada', 'borgo', 'frazione', 'salita', 'traversa', 'lungomare', 'galleria', 'rione',
    'regione', 'cortile', 'passaggio', 'viottolo', 'stradone', 'cascina'];
  const FILLERS = ('e ed poi il lo la i gli le l un uno una numero numeri civico civici casella ok okay allora dunque ' +
    'quindi ecco eh ehm uhm mm hmm dopo segue continua ancora anche di del della dello dei degli delle al allo alla ai ' +
    'agli alle mio mia tuo tua mi ti ci si ne c adesso ora va bene vabbe aspetta sono do dallo dalla consegna ' +
    'consegnalo porta portalo glielo gliela da dare dato dai lettera').split(' ');
  const isFiller = function (w) { return FILLERS.indexOf(w) >= 0; };
  const SPAN_WORDS = { doppia: 2, doppio: 2, tripla: 3, triplo: 3 };
  const KEYWORDS = ['collega', 'colleghi', 'simbolino', 'simbolini', 'simbolo', 'simboli', 'controllare', 'verificare',
    'controllo', 'dubbio', 'interrogativo', 'vuota', 'vuoto', 'vuote', 'vuoti', 'fine', 'no', 'anzi', 'scusa', 'cioe',
    'sbagliato', 'cancella', 'cancellalo', 'cancellala', 'togli', 'toglilo', 'elimina', 'barra', '/', 'nome', 'comune',
    'casella', 'caselle', 'larga', 'largo', 'doppia', 'doppio', 'tripla', 'triplo', 'bis', 'ter', 'dal', 'dall'];
  const CORRECT = ['no', 'anzi', 'scusa', 'cioe', 'sbagliato'];
  const REMOVE = ['cancella', 'cancellalo', 'cancellala', 'togli', 'toglilo', 'elimina'];
  const TRAILING = ['numero', 'numeri', 'civico', 'civici', 'il', 'lo', 'la', 'al', 'e', 'poi', 'ok', 'allora', 'casella', 'ecco'];

  function tokenize(text) {
    const out = [];
    const re = /\d+|[A-Za-zÀ-ÖØ-öø-ÿ]+['’]?|\//g;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[0].replace('’', "'");
      out.push({ raw: raw, w: plain(raw).replace(/'$/, ''), from: m.index, to: m.index + m[0].length });
    }
    return out;
  }

  // The same street written in another way ("Via F.lli Rossi", "via fratelli rossi"): one form to compare.
  function comparable(s) {
    return plain(C.streetName(s)).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // A street said: the name already known (the official one, or the one already in the route) when it is clear which
  // one it is, even said in short ("via Rossi" for "VIA FRATELLI ROSSI").
  function resolveStreet(said, known) {
    const k = comparable(said);
    const list = (known || []).filter(Boolean);
    const exact = list.find(function (n) { return comparable(n) === k; });
    if (exact) return exact;
    const words = k.split(' ');
    const found = {};
    list.forEach(function (n) {
      const w = comparable(n).split(' ');
      if (w[0] === words[0] && words.length > 1 && words.slice(1).every(function (x) { return w.indexOf(x) >= 0; })) found[comparable(n)] = n;
    });
    const keys = Object.keys(found);
    return keys.length === 1 ? found[keys[0]] : C.norm(said);
  }

  /*
   * The words said -> { lines, entries, notes, unknown }.
   * opts: { street: the street where the dictation starts (numbers said first belong to it), streets: known names }.
   * entries: what was understood, in order, with where it is in the text ({ kind, from, to }), so that "Togli
   * l'ultima" cuts the text there.
   */
  function translate(text, opts) {
    opts = opts || {};
    const known = (opts.streets || []).concat(opts.street ? [opts.street] : []);
    const t = tokenize(String(text || ''));
    const entries = [], notes = [], unknown = [];
    let street = opts.street || '';
    let cur = null;           // the last pigeonhole: what comes after it ("due caselle", "collega") is for it
    let replace = false;      // after "no" / "anzi": the next number takes the place of the last one
    let i = 0;
    const W = function (k) { return t[k] ? t[k].w : ''; };
    const num = function (k) { return t[k] ? wordNumber(t[k].w) : null; };
    const isStarter = function (k) { return STARTERS.indexOf(W(k)) >= 0; };
    const isKeyword = function (k) { return KEYWORDS.indexOf(W(k)) >= 0 || isStarter(k); };
    const isLetter = function (k) { return !!t[k] && W(k) in LETTERS && t[k].raw.length <= 5; };
    // a number inside a name ("via 4 Novembre", "via 20 Settembre"): an ordinary word follows it
    const numberInName = function (k, first) {
      return first && num(k) !== null && t[k + 1] && num(k + 1) === null && !isKeyword(k + 1) && !isFiller(W(k + 1)) && !isLetter(k + 1);
    };
    const nameEnds = function (k, first) {
      if (!t[k]) return true;
      if (num(k) !== null) return !numberInName(k, first);
      if ((W(k) === 'dal' || W(k) === 'dall' || W(k) === 'da') && num(k + 1) !== null) return true;
      if (W(k) === 'fine' && /^(fila|riga|striscia)$/.test(W(k + 1))) return true;
      if (W(k) === 'striscia' && /^vuot/.test(W(k + 1))) return true;
      if (W(k) === 'da' && /^(controllare|verificare)$/.test(W(k + 1))) return true;
      return isKeyword(k) && W(k) !== 'largo' && W(k) !== 'borgo';
    };
    // words of a name, up to where it ends: "Bar del Ponte", "dell'Annunziata"
    const readName = function (k) {
      const words = [];
      while (t[k] && !nameEnds(k, !words.length)) { words.push(t[k]); k++; }
      while (words.length && TRAILING.indexOf(words[words.length - 1].w) >= 0) words.pop();
      let s = '';
      words.forEach(function (x) { s += (s && !/'$/.test(s) ? ' ' : '') + x.raw; });
      return { text: s, next: k, to: words.length ? words[words.length - 1].to : null };
    };
    const last = function () { return entries[entries.length - 1]; };
    const add = function (e) {
      if (replace) {
        replace = false;
        const l = last();
        if (l && l.kind !== 'line') entries.pop();
      }
      entries.push(e);
      cur = e.kind === 'line' ? null : e;
      return e;
    };
    // a house number at k: "35", "35 A", "35 bis", "2 barra 4", "20 G barra 20 H"
    const readHouse = function (k) {
      let s = String(num(k)), to = t[k].to;
      k++;
      if (W(k) === 'bis' || W(k) === 'ter') { s += W(k).toUpperCase(); to = t[k].to; k++; }
      else if (isLetter(k) && (!WEAK[W(k)] || !t[k + 1] || (W(k) === 'a' && !isFiller(W(k + 1)) && !/^colleg/.test(W(k + 1))) || isStarter(k + 1) || W(k + 1) === 'barra' || W(k + 1) === '/' ||
          (num(k + 1) !== null && /^casell/.test(W(k + 2))))) {
        s += LETTERS[W(k)]; to = t[k].to; k++;
      }
      return { text: s, next: k, to: to };
    };

    while (i < t.length) {
      const w = W(i), n = num(i), start = t[i].from;
      // a new street (or a farmhouse): "via dei Tigli", "cascina Alta"
      if (isStarter(i)) {
        const r = readName(i + 1);
        if (!r.text) { i = r.next; continue; }   // "e così via"
        const said = t[i].raw + ' ' + r.text;
        if (w === 'cascina' && (!t[r.next] || num(r.next) === null || /^(caselle|casella)$/.test(W(r.next + 1)))) {
          // a farmhouse without house numbers: a pigeonhole with its name
          add({ kind: 'name', name: C.norm(said), span: 1, from: start, to: r.to });
        } else {
          street = resolveStreet(said, known);
          cur = null;
        }
        i = r.next;
        continue;
      }
      if (w === 'nome') {
        const r = readName(i + 1);
        if (r.text) add({ kind: 'name', name: C.norm(r.text), span: 1, from: start, to: r.to });
        i = r.next;
        continue;
      }
      if (w === 'comune') {
        const r = readName(i + 1 + (W(i + 1) === 'di' ? 1 : 0));
        if (r.text) add({ kind: 'line', text: 'COMUNE: ' + r.text.replace(/^(.)/, function (x) { return x.toUpperCase(); }), from: start, to: r.to });
        i = r.next;
        continue;
      }
      if (w === 'fine' && /^(fila|riga)$/.test(W(i + 1))) { add({ kind: 'line', text: 'FINE FILA', from: start, to: t[i + 1].to }); i += 2; continue; }
      if (w === 'fine' && W(i + 1) === 'striscia') { add({ kind: 'line', text: 'FINE STRISCIA', from: start, to: t[i + 1].to }); i += 2; continue; }
      if (w === 'striscia' && /^vuot/.test(W(i + 1))) { add({ kind: 'line', text: 'STRISCIA VUOTA', from: start, to: t[i + 1].to }); i += 2; continue; }
      if (CORRECT.indexOf(w) >= 0) { replace = !!last(); i++; continue; }
      if (REMOVE.indexOf(w) >= 0) {
        const l = entries.pop();
        if (l) notes.push('«' + text.slice(l.from, l.to) + '» cancellato.');
        cur = last() && last().kind !== 'line' ? last() : null;
        replace = false;
        i++;
        continue;
      }
      // what is said after a pigeonhole is for it
      if (n !== null && n >= 1 && n <= 9 && /^(caselle|casella)$/.test(W(i + 1))) {
        if (cur) cur.span = n; else if (n > 1) notes.push('«' + n + ' caselle»: prima dì il civico.');
        if (cur) cur.to = t[i + 1].to;
        i += 2;
        continue;
      }
      if (w in SPAN_WORDS || ((w === 'larga' || w === 'largo') && num(i + 1) !== null)) {
        const s = w in SPAN_WORDS ? SPAN_WORDS[w] : num(i + 1);
        const end = w in SPAN_WORDS ? i : i + 1;
        if (cur && s >= 1 && s <= 9) { cur.span = s; cur.to = t[end].to; }
        i = end + 1;
        continue;
      }
      if (w === 'collega' || w === 'colleghi') {
        if (cur) { cur.other = true; cur.to = t[i].to; } else notes.push('«collega»: prima dì il civico.');
        i++;
        continue;
      }
      if (/^simbol/.test(w)) {
        let k = i + 1;
        while (t[k] && isFiller(W(k))) k++;
        const s = num(k);
        if (s !== null && s >= 1 && s <= 99) {
          if (cur) { cur.link = s; cur.to = t[k].to; } else notes.push('«simbolino ' + s + '»: prima dì il civico.');
          i = k + 1;
        } else { notes.push('«simbolino»: dì anche il numero, per esempio «simbolino 1».'); i++; }
        continue;
      }
      if (/^(controllare|verificare|controllo|dubbio|interrogativo)$/.test(w)) {
        if (cur) { cur.unsure = true; cur.to = t[i].to; }
        i++;
        continue;
      }
      // "dal 9 al 21", "dal 2 al 10 tutti", "dal 20 G al 20 M"
      if ((w === 'dal' || w === 'dall' || w === 'da' || w === 'dai') && num(i + 1) !== null) {
        const a = readHouse(i + 1);
        let k = a.next;
        if (W(k) === 'fino') k++;
        if (/^(al|all|a|ai)$/.test(W(k)) && num(k + 1) !== null) {
          const b = readHouse(k + 1);
          k = b.next;
          let kind = '';
          if (/^(tutti|tutto|compresi|consecutivi)$/.test(W(k))) { kind = 'tutti'; k++; }
          else if (W(k) === 'pari' || W(k) === 'dispari') { kind = W(k); k++; }
          const la = /^(\d+)([A-Z])$/.exec(a.text), lb = /^(\d+)([A-Z])$/.exec(b.text);
          let tok;
          if (la && lb && la[1] === lb[1]) tok = a.text + '..' + b.text;
          else if (/^\d+$/.test(a.text) && /^\d+$/.test(b.text)) tok = kind ? a.text + '-' + b.text + ' ' + kind : a.text + '..' + b.text;
          if (tok) {
            if (!street) notes.push('Prima dei civici dì la via: «via …».');
            add({ kind: 'cell', street: street, top: tok, second: '', range: true, span: 1, from: start, to: t[k - 1].to });
            i = k;
            continue;
          }
        }
      }
      if ((w === 'vuota' || w === 'vuoto') || (n !== null && /^(vuote|vuoti)$/.test(W(i + 1)))) {
        const many = n !== null ? Math.min(n, 99) : 1;
        const end = n !== null ? i + 1 : i;
        for (let k = 0; k < many; k++) add({ kind: 'cell', street: street, top: '', second: '', span: 1, empty: true, from: start, to: t[end].to });
        i = end + 1;
        continue;
      }
      if (n !== null) {
        const a = readHouse(i);
        let k = a.next, second = '', to = a.to;
        if ((W(k) === 'barra' || W(k) === '/') && num(k + 1) !== null) {
          const b = readHouse(k + 1);
          second = b.text; to = b.to; k = b.next;
        }
        if (!street) notes.push('Prima dei civici dì la via: «via …».');
        const same = function (e) { return e.kind === 'cell' && !e.range && !e.empty && comparable(e.street) === comparable(street) && e.top === a.text && e.second === second; };
        const twice = replace ? null : entries.filter(same)[0];
        if (twice) {
          // said again: written once (what is said after it is still for it)
          if (twice !== last()) notes.push('Il ' + a.text + (second ? '/' + second : '') + ' di ' + (street || 'questa via') + ' l\'avevi già detto: è scritto una volta sola.');
          cur = twice;
        } else add({ kind: 'cell', street: street, top: a.text, second: second, span: 1, from: start, to: to });
        i = k;
        continue;
      }
      if (!isFiller(w) && !isKeyword(i)) unknown.push(t[i].raw);
      i++;
    }

    // the entries -> lines of the route
    const lines = [];
    let open = null;
    const flush = function () { if (open) { lines.push((open.street ? open.street + ': ' : ': ') + open.toks.join(', ')); open = null; } };
    const marks = function (e) { return (e.unsure && !e.range ? '?' : '') + (e.span > 1 ? ' (' + e.span + ')' : '') + (e.other ? '*' : '') + (e.link ? '@' + e.link : ''); };
    for (let k = 0; k < entries.length; k++) {
      const e = entries[k];
      if (e.kind === 'cell' && e.empty && !e.street) {
        flush();
        let n = 1;
        while (entries[k + 1] && entries[k + 1].kind === 'cell' && entries[k + 1].empty && !entries[k + 1].street) { n++; k++; }
        lines.push(n > 1 ? 'vuote ' + n : 'vuota');
      } else if (e.kind === 'cell') {
        const tok = (e.empty ? 'vuota' : e.top + (e.second ? '/' + e.second : '')) + marks(e);
        if (open && open.street === e.street) open.toks.push(tok);
        else { flush(); open = { street: e.street, toks: [tok] }; }
      } else if (e.kind === 'name') {
        flush();
        lines.push(e.name + marks(e));
      } else {
        flush();
        lines.push(e.text);
      }
    }
    flush();
    return { lines: lines, entries: entries, notes: notes.filter(function (x, k) { return notes.indexOf(x) === k; }), unknown: unknown };
  }

  /*
   * The route with new lines put in: at = null (at the end), or { line, tok, top, second } of a pigeonhole, with
   * replace: true to put them in its place. A series like "1..15" is written out, so only that pigeonhole counts.
   * Lines of the same street next to each other become one. Returns { text, first } (first: the line where the new
   * part starts).
   */
  function insertLines(route, at, newLines) {
    const src = String(route || '').split('\n');
    const head = function (l) {
      const c = l.indexOf(':');
      if (c < 0) return null;
      const h = l.slice(0, c).trim();
      return /^(comune|confine)$/i.test(h) ? null : h;
    };
    const toksOf = function (l) { return l.slice(l.indexOf(':') + 1).split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
    const cellText = function (x) { return x.top + (x.second ? '/' + x.second : '') + (x.span > 1 ? ' (' + x.span + ')' : '') + (x.other ? '*' : '') + (x.link ? '@' + x.link : ''); };
    let before, after, left = null, right = null;
    if (!at) {
      before = src.slice();
      while (before.length && !before[before.length - 1].trim()) before.pop();
      after = [];
      const l = before[before.length - 1];
      if (l !== undefined && head(l) !== null) { before.pop(); left = { h: head(l), toks: toksOf(l), orig: l }; }
    } else {
      const line = src[at.line] === undefined ? '' : src[at.line];
      const hd = head(line);
      before = src.slice(0, at.line);
      after = src.slice(at.line + 1);
      if (hd === null) {
        if (!at.replace) before.push(line);
      } else {
        const raw = line.slice(line.indexOf(':') + 1).split(',');
        if (raw.length > 1 && raw[raw.length - 1].trim() === '') raw.pop();
        const tok = raw[at.tok] === undefined ? '' : raw[at.tok];
        const many = C.parseRoute('X:' + tok, '').items;
        let parts = [tok.trim()], k = 0;
        if (many.length > 1) {
          parts = many.map(cellText);
          k = Math.max(0, many.findIndex(function (x) { return x.top === at.top && x.second === (at.second || ''); }));
        }
        const trim = function (x) { return x.trim(); };
        const l = raw.slice(0, at.tok).map(trim).concat(parts.slice(0, at.replace ? k : k + 1)).filter(Boolean);
        const r = parts.slice(k + 1).concat(raw.slice(at.tok + 1).map(trim)).filter(Boolean);
        if (l.length) left = { h: hd, toks: l };
        if (r.length) right = { h: hd, toks: r };
      }
    }
    const lineOf = function (x) { return x.orig !== undefined ? x.orig : x.h + ': ' + x.toks.join(', '); };
    const sameHead = function (a, b) { return a !== null && b !== null && C.norm(a) === C.norm(b); };
    const mid = newLines.slice();
    if (left && mid.length && sameHead(left.h, head(mid[0]))) {
      mid[0] = left.h + ': ' + left.toks.concat(toksOf(mid[0])).join(', ');
      left = null;
    }
    if (right && mid.length && sameHead(right.h, head(mid[mid.length - 1]))) {
      mid[mid.length - 1] = right.h + ': ' + toksOf(mid[mid.length - 1]).concat(right.toks).join(', ');
      right = null;
    }
    if (left && right && !mid.length) {
      mid.push(left.h + ': ' + left.toks.concat(right.toks).join(', '));
      left = right = null;
    }
    const block = (left ? [lineOf(left)] : []).concat(mid, right ? [lineOf(right)] : []);
    return { text: before.concat(block, after).join('\n'), first: before.length + (left ? 1 : 0) };
  }

  return {
    wordNumber: wordNumber,
    translate: translate,
    insertLines: insertLines,
    resolveStreet: resolveStreet,
  };
});

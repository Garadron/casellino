/*
 * Casellino - reading a photo of a strip (no DOM, no network).
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 *
 * The photo of one strip is cut into its pigeonholes by finding the dark vertical lines between
 * them; the upper line (house numbers) and the lower line (street names) are found by the dark
 * horizontal line between them. The text itself is read by Tesseract (free, on the device),
 * one pigeonhole at a time; here are only the steps before and after it.
 * Works in the browser (window.CasellinoFoto) and in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CasellinoFoto = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // { width, height, data: RGBA } -> gray levels 0..255
  function toGray(img) {
    const g = new Uint8Array(img.width * img.height);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) {
      g[i] = (img.data[j] * 299 + img.data[j + 1] * 587 + img.data[j + 2] * 114) / 1000;
    }
    return g;
  }

  // Otsu: the gray level that best splits writing (dark) from paper (light).
  function threshold(gray) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, best = 0, bestT = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = gray.length - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; bestT = t; }
    }
    return bestT;
  }

  /*
   * Dark (writing, lines) or light, judged against the neighbourhood of each point (Bradley): a
   * shadow over half the strip or a coloured street line do not hide the writing, as one grey
   * level for the whole photo did.
   */
  function darkMask(img, window) {
    const W = img.width, H = img.height;
    const gray = toGray(img);
    const sum = new Float64Array((W + 1) * (H + 1));   // integral image
    for (let y = 1; y <= H; y++) {
      let row = 0;
      for (let x = 1; x <= W; x++) {
        row += gray[(y - 1) * W + x - 1];
        sum[y * (W + 1) + x] = sum[(y - 1) * (W + 1) + x] + row;
      }
    }
    const r = Math.max(7, Math.round(Math.min(W, H) / (window || 8)));
    const mask = new Uint8Array(gray.length);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
        const area = (x1 - x0) * (y1 - y0);
        const s = sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0];
        mask[y * W + x] = gray[y * W + x] * area < s * 0.82 ? 1 : 0;   // clearly darker than around it
      }
    }
    return mask;
  }

  // Groups of consecutive indexes (allowing small gaps) -> [{ from, to }]
  function groups(indexes, gap) {
    const out = [];
    indexes.forEach(function (x) {
      const last = out[out.length - 1];
      if (last && x - last.to <= gap) last.to = x; else out.push({ from: x, to: x });
    });
    return out;
  }

  /*
   * Finds the parts of a strip photo: the line between house numbers and street names, and
   * the pigeonholes. Returns { split, top, bottom, cells: [{ x0, x1 }] } in pixels.
   */
  function segmentStrip(img) {
    const W = img.width, H = img.height;
    const mask = darkMask(img);
    // horizontal lines: rows that are dark for most of the width
    const rowDark = [];
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = 0; x < W; x++) n += mask[y * W + x];
      rowDark.push(n / W);
    }
    const lines = groups(rowDark.map(function (f, y) { return f > 0.45 ? y : -1; }).filter(function (y) { return y >= 0; }), 2)
      .map(function (g) { return (g.from + g.to) / 2; });
    // the line between the two rows of a strip sits near 58% of the height (1 cm over 0.7 cm)
    let split = Math.round(H * 0.58);
    const inner = lines.filter(function (y) { return y > H * 0.3 && y < H * 0.8; });
    if (inner.length) split = Math.round(inner.reduce(function (a, y) { return Math.abs(y - H * 0.58) < Math.abs(a - H * 0.58) ? y : a; }));
    let top = Math.round((lines.filter(function (y) { return y < split - H * 0.15; }).pop() || 0));
    const bottom = Math.round((lines.filter(function (y) { return y > split + H * 0.15; })[0] || H - 1));
    // The top of the numbers row is where the lines between pigeonholes begin: they stand on the line
    // under the numbers and go up to it (numbers never touch that line). A dark border of the frame
    // above the strip is no longer taken for it.
    const at = function (x, y) { return mask[y * W + x] || (x > 0 && mask[y * W + x - 1]) || (x + 1 < W && mask[y * W + x + 1]); };
    const starts = [];
    for (let x = 0; x < W; x++) {
      let y = split - 3, gap = 0, up = null;
      if (!at(x, y)) continue;
      while (y >= 0) {
        if (at(x, y)) { up = y; gap = 0; } else if (++gap > 2) break;
        y--;
      }
      if (up !== null && split - up >= split * 0.3) starts.push(up);
    }
    if (starts.length >= 5) {
      starts.sort(function (a, b) { return a - b; });
      const fromLines = starts[Math.floor(starts.length * 0.6)];   // a little lower than the middle: some lines go on into the frame
      if (fromLines > top + 2 && fromLines < split - H * 0.15) top = fromLines;
    }
    // vertical lines in the house-number row: columns dark for most of its height
    const y0 = top + 2, y1 = split - 2;
    // (a line a little slanted, as in a photo taken not quite straight, falls in the next column: 3 at a time)
    // A line between pigeonholes is dark for most of the row's height (even dashed, in shadow) and also
    // near its top and its bottom edge, where numbers never are (they stand in the middle).
    // First the clear lines (dark for 3/4 of the height); only if they give few pigeonholes, also the
    // faint ones (shadow): those must be dark near the top and the bottom edge too, unlike a "1".
    const band = Math.max(1, y1 - y0), edge = Math.max(2, Math.round(band * 0.2));
    const strong = [], faint = [];
    for (let x = 0; x < W; x++) {
      let n = 0, nTop = 0, nBottom = 0;
      for (let y = y0; y < y1; y++) {
        const d = mask[y * W + x] || (x > 0 && mask[y * W + x - 1]) || (x + 1 < W && mask[y * W + x + 1]) ? 1 : 0;
        n += d;
        if (y < y0 + edge) nTop += d;
        if (y >= y1 - edge) nBottom += d;
      }
      strong.push(n / band >= 0.75);
      faint.push(n / band >= 0.45 && nTop >= edge * 0.35 && nBottom >= edge * 0.35);
    }
    const lineCentres = function (isLine) {
      return groups(isLine.map(function (on, x) { return on ? x : -1; }).filter(function (x) { return x >= 0; }), 3)
        .map(function (g) { return (g.from + g.to) / 2; });
    };
    // Pale lines (thin, grey, in a shadow): along the top and bottom edges of the row, where numbers never
    // reach, a column clearly darker than the columns around it can only be a line.
    const gray = toGray(img);
    const strip = Math.max(2, Math.round(band * 0.15));
    const profile = [];
    for (let x = 0; x < W; x++) {
      let s = 0, k = 0;
      for (let y = y0; y < y0 + strip; y++) { s += gray[y * W + x]; k++; }
      for (let y = y1 - strip; y < y1; y++) { s += gray[y * W + x]; k++; }
      profile.push(s / k);
    }
    const pale = profile.map(function (v, x) {
      let s = 0, k = 0;
      for (let d = 6; d <= 14; d++) {
        if (x - d >= 0) { s += profile[x - d]; k++; }
        if (x + d < W) { s += profile[x + d]; k++; }
      }
      return k && v < s / k - 10;
    });
    const strongX = lineCentres(strong);
    const faintX = lineCentres(strong.map(function (s, x) { return s || faint[x]; }));
    const paleX = lineCentres(strong.map(function (s, x) { return s || faint[x] || pale[x]; }));   // only inside wide gaps
    // the usual width of a pigeonhole: the middle gap between lines, counting also the faint ones
    const gaps = [];
    for (let i = 1; i < faintX.length; i++) gaps.push(faintX[i] - faintX[i - 1]);
    gaps.sort(function (a, b) { return a - b; });
    // (the middle of the larger half: double lines and strokes of numbers make many small gaps)
    const upper = gaps.slice(Math.floor(gaps.length / 2));
    const usual = upper.length ? upper[Math.floor(upper.length / 2)] : W;
    // the clear lines; where they leave a gap of more than two pigeonholes, the faint lines inside it too
    const found = [0];
    strongX.concat([W - 1]).forEach(function (x) {
      const last = found[found.length - 1];
      if (x - last > usual * 2.5) paleX.forEach(function (f) { if (f > last + usual * 0.5 && f < x - usual * 0.5) found.push(f); });
      found.push(x);
    });
    // Pigeonholes next to each other are as wide (a photo taken at an angle makes them narrower little by
    // little): a line closer than 4/5 of the pigeonhole before is not a border (the stroke of a "1" or a "4"
    // when the numbers fill the row, the second line of a double line). Of two lines too close, the one that
    // falls better on that width stays.
    const edges = [found[0]];
    found.slice(1).forEach(function (x, i) {
      const last = edges[edges.length - 1];
      const before = edges.length > 1 ? edges[edges.length - 2] : null;
      const prevGap = before === null ? usual : last - before;
      const width = prevGap >= usual * 0.7 && prevGap <= usual * 1.3 ? prevGap : usual;   // a wide pigeonhole before does not count
      if (x - last >= width * 0.8 || i === found.length - 2) { edges.push(x); return; }
      if (before !== null && Math.abs(x - before - width) < Math.abs(last - before - width)) edges[edges.length - 1] = x;
    });
    let cells = [];
    for (let i = 1; i < edges.length; i++) cells.push({ x0: Math.round(edges[i - 1]), x1: Math.round(edges[i]) });
    const widths = cells.map(function (c) { return c.x1 - c.x0; }).sort(function (a, b) { return a - b; });
    const typical = widths[Math.floor(widths.length * 0.6)] || W;
    // drop the thin gaps of double lines and the cut pieces at the photo edges
    cells = cells.filter(function (c) { return c.x1 - c.x0 >= typical * 0.4; });
    cells.forEach(function (c) { c.span = Math.max(1, Math.round((c.x1 - c.x0) / typical)); });
    return { split: split, top: top, bottom: bottom, cells: cells, typical: typical };
  }

  // Black and white with the grey level chosen inside the image itself (one pigeonhole: its own light).
  function blackWhite(b) {
    const g = new Uint8Array(b.width * b.height);
    for (let i = 0; i < g.length; i++) g[i] = b.data[i * 4];
    const t = threshold(g);
    let dark = 0;
    for (let i = 0; i < g.length; i++) if (g[i] <= t) dark++;
    const flip = dark > g.length * 0.5;   // light writing on a dark colour: the writing becomes black
    const out = { width: b.width, height: b.height, data: new Uint8ClampedArray(b.data.length), ink: (flip ? g.length - dark : dark) / g.length };
    const ink = new Uint8Array(g.length);
    for (let i = 0; i < g.length; i++) ink[i] = (g[i] <= t) !== flip ? 1 : 0;
    // what is left of the borders: rows dark across most of the width, columns dark for most of the height
    const W = b.width, H = b.height;
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = 0; x < W; x++) n += ink[y * W + x];
      if (n > W * 0.7) for (let x = 0; x < W; x++) ink[y * W + x] = 0;
    }
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let y = 0; y < H; y++) n += ink[y * W + x];
      if (n > H * 0.8) for (let y = 0; y < H; y++) ink[y * W + x] = 0;
    }
    for (let i = 0; i < g.length; i++) {
      const v = ink[i] ? 0 : 255;
      out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v;
      out.data[i * 4 + 3] = 255;
    }
    return out;
  }

  /*
   * A clean black-and-white copy of one band of the strip (rows y0..y1), without the printed
   * lines: dark columns that cross most of the band (the lines between pigeonholes) and dark rows
   * across most of the width are made white, so they are not read as "1" or "I".
   * Returns { width, height, data: RGBA } (scaled by `scale` for better reading).
   */
  function cleanBand(img, y0, y1, scale, forNames) {
    const W = img.width, H = Math.max(1, y1 - y0);
    const mask = img._mask || (img._mask = darkMask(img));
    const m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = mask[(y0 + y) * W + x];
    // long straight strokes are printed lines, even when the photo is a little crooked:
    // horizontal runs longer than ~a third of the band height times 3, vertical runs taller than 70%
    // the widest stroke of a digit is shorter; for street names only the long border lines go
    const hMax = forNames ? Math.max(40, Math.round(H * 2.5)) : Math.max(12, Math.round(H * 0.4));
    const cut = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (!m[y * W + x]) { x++; continue; }
        let e = x;
        while (e + 1 < W && m[y * W + e + 1]) e++;
        if (e - x + 1 > hMax) for (let k = x; k <= e; k++) for (let dy = -1; dy <= 1; dy++) if (y + dy >= 0 && y + dy < H) cut[(y + dy) * W + k] = 1;
        x = e + 1;
      }
    }
    const vMax = Math.round(H * 0.45); // numbers are about a third of the band tall, lines more
    const seps = []; // where the lines between pigeonholes were
    for (let x = 0; x < W; x++) {
      let y = 0;
      while (y < H) {
        if (!m[y * W + x]) { y++; continue; }
        let e = y;
        while (e + 1 < H && m[(e + 1) * W + x]) e++;
        if (e - y + 1 > vMax) {
          seps.push(x);
          for (let k = y; k <= e; k++) for (let dx = -2; dx <= 2; dx++) if (x + dx >= 0 && x + dx < W) cut[k * W + x + dx] = 1;
        }
        y = e + 1;
      }
    }
    for (let i = 0; i < m.length; i++) if (cut[i]) m[i] = 0;
    // the edges of the band are the borders of the strip: no number is written there
    for (let y = 0; y < H; y++) {
      if (y >= H * 0.12 && y <= H * 0.92) continue;
      for (let x = 0; x < W; x++) m[y * W + x] = 0;
    }
    const s = scale || 1;
    const out = { width: W * s, height: H * s, data: new Uint8ClampedArray(W * s * H * s * 4) };
    out.separators = groups(seps.sort(function (a, b) { return a - b; }), 4).map(function (g) { return Math.round((g.from + g.to) / 2 * s); });
    for (let y = 0; y < H * s; y++) {
      for (let x = 0; x < W * s; x++) {
        const v = m[Math.floor(y / s) * W + Math.floor(x / s)] ? 0 : 255;
        const i = (y * W * s + x) * 4;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
        out.data[i + 3] = 255;
      }
    }
    return out;
  }

  /*
   * The groups of writing in a cleaned band, left to right: columns with ink, joined when the
   * white gap between them is small (the letters of one number), split at larger gaps (the
   * space between two pigeonholes). Returns [{ x0, x1, y0, y1 }] in pixels of the band.
   */
  function inkClusters(band) {
    const W = band.width, H = band.height;
    const ink = [];
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let y = 0; y < H; y++) if (band.data[(y * W + x) * 4] < 128) n++;
      ink.push(n);
    }
    const gap = Math.max(3, Math.round(H * 0.10));
    const seps = band.separators || [];
    const out = [];
    let cur = null, white = 0, si = 0;
    for (let x = 0; x < W; x++) {
      // a line between two pigeonholes was here: what follows is another pigeonhole
      let crossed = false;
      while (si < seps.length && seps[si] <= x) { crossed = true; si++; }
      if (crossed) { cur = null; white = gap + 1; }
      if (ink[x] > 0) {
        if (cur && white <= gap) cur.x1 = x; else { cur = { x0: x, x1: x }; out.push(cur); }
        white = 0;
      } else white++;
    }
    return out.map(function (c) {
      let y0 = H, y1 = 0, n = 0;
      for (let x = c.x0; x <= c.x1; x++) for (let y = 0; y < H; y++) {
        if (band.data[(y * W + x) * 4] < 128) { n++; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      return { x0: c.x0, x1: c.x1, y0: y0, y1: y1, ink: n };
    }).filter(function (c) {
      // specks and leftovers of lines are not numbers
      return c.ink > H * 0.6 && c.y1 - c.y0 > H * 0.25;
    });
  }

  // A piece of a band as its own small image, with a white border (Tesseract reads it better).
  function cropBand(band, c, pad) {
    const w = c.x1 - c.x0 + 1 + 2 * pad, h = c.y1 - c.y0 + 1 + 2 * pad;
    const out = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) };
    for (let y = 0; y <= c.y1 - c.y0; y++) for (let x = 0; x <= c.x1 - c.x0; x++) {
      const si = ((c.y0 + y) * band.width + c.x0 + x) * 4, di = ((y + pad) * w + x + pad) * 4;
      out.data[di] = out.data[di + 1] = out.data[di + 2] = band.data[si];
    }
    return out;
  }

  // What Tesseract read in one pigeonhole -> a house number ("12", "5A", "61\59") or ''.
  function cleanNumber(text) {
    let t = String(text || '').toUpperCase().replace(/[|[\]{}()!_.,;:'"`~]/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.replace(/(\d)\s+([A-Z])\b/g, '$1$2').replace(/O(?=\d)|(?<=\d)O/g, '0').replace(/(\d)U\b/g, '$10');   // "2U" is 20
    const m = /\d{1,4}\s*[A-Z]?(\s*[\/\\-]\s*\d{1,4}\s*[A-Z]?)?/.exec(t);
    const n = m ? m[0].replace(/\s+/g, '') : '';
    // four digits in one pigeonhole are two numbers whose small "/" was not seen ("2725" is 27/25):
    // same side of the street, close to each other. Marked "?" to be checked.
    const two = /^(\d\d)(\d\d)$/.exec(n);
    if (two && +two[1] % 2 === +two[2] % 2 && Math.abs(two[1] - two[2]) <= 8) return two[1] + '/' + two[2] + '?';
    return n;
  }

  // Street names read on the lower line: words with their position -> phrases [{ text, x0, x1 }]
  function streetPhrases(words) {
    const ws = words.map(function (w) {
      return { text: String(w.text || '').replace(/[^A-ZÀ-Ü'.\s]/gi, '').trim().toUpperCase(), x0: w.bbox.x0, x1: w.bbox.x1, conf: w.confidence };
    }).filter(function (w) { return w.text.length >= 2 && w.conf > 20; }).sort(function (a, b) { return a.x0 - b.x0; });
    const out = [];
    ws.forEach(function (w) {
      const last = out[out.length - 1];
      const gap = last ? w.x0 - last.x1 : Infinity;
      const charW = last ? (last.x1 - last.x0) / Math.max(1, last.text.length) : 0;
      if (last && gap < charW * 2.5) { last.text += ' ' + w.text; last.x1 = w.x1; } else out.push({ text: w.text, x0: w.x0, x1: w.x1 });
    });
    return out.filter(function (ph) { return ph.text.replace(/[^A-Z]/g, '').length >= 3; });
  }

  /*
   * Puts together what was read: pigeonholes (left to right, with what was read above and below)
   * and street phrases -> lines of a route, e.g. "VIA DEI TIGLI: 1, 3, 5/7".
   * A pigeonhole takes the street written under it, or the nearest one.
   */
  function routeLines(cells, phrases) {
    return itemLines(routeItems(cells, phrases));
  }

  // The same, one item per pigeonhole: [{ street, tok }] (to compare two photos before writing the lines).
  function routeItems(cells, phrases) {
    const streetOf = function (c) {
      if (!phrases.length) return '?';
      const mid = (c.x0 + c.x1) / 2;
      let best = phrases[0], dist = Infinity;
      phrases.forEach(function (ph) {
        const d = mid < ph.x0 ? ph.x0 - mid : (mid > ph.x1 ? mid - ph.x1 : 0);
        if (d < dist) { dist = d; best = ph; }
      });
      return best.text;
    };
    return cells.map(function (c) {
      let tok = c.top || (c.empty ? 'vuota' : '?');
      if (c.second) tok += '/' + c.second;
      if (c.unsure && tok !== 'vuota' && !/\?$/.test(tok)) tok += '?';
      if (c.span > 1) tok += ' (' + c.span + ')';
      return { street: streetOf(c), tok: tok };
    });
  }

  // Items -> lines of a route: the pigeonholes of the same street one after the other on one line.
  function itemLines(items) {
    const lines = [];
    items.forEach(function (it) {
      const last = lines[lines.length - 1];
      if (last && last.street === it.street) last.tokens.push(it.tok);
      else lines.push({ street: it.street, tokens: [it.tok] });
    });
    return lines.map(function (l) { return l.street + ': ' + l.tokens.join(', '); });
  }

  /*
   * Two photos taken one after the other show some of the same pigeonholes: the end of the first is
   * the start of the second (the person starts each photo a little before where the last one ended).
   * That piece is never written twice: the new items come back without it.
   * The two pieces are compared like two lists, so a pigeonhole read differently, missed or cut at the
   * edge of a photo does not hide the overlap: the start of the new photo is lined up with the end of
   * the old one, and the best line-up counts if at least 2 house numbers are the same (same street).
   * After it, a house number of the same street that the last photos already had, right at the start
   * of the new photo, is left out too.
   */
  const OVERLAP_MAX = 40;
  function overlapKey(it) { return String(it.tok).toUpperCase().replace(/[?\s]|\(\d+\)/g, '').replace(/\\/g, '/'); }
  function streetKey(it) { return String(it.street || '').toUpperCase().replace(/[^A-Z]/g, ''); }
  // two street names read in two photos: the same street (a letter or two may differ), or unknown
  function sameStreet(a, b) {
    const x = streetKey(a), y = streetKey(b);
    if (!x || !y || x === y) return true;
    if (x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return true;
    const n = Math.max(x.length, y.length);
    let same = 0;
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] === y[i]) same++;
    return same >= n * 0.7;
  }
  const hasNumber = function (k) { return /\d/.test(k); };
  // how much two pigeonholes look like the same one: { score, exact }
  function likeness(a, b) {
    const x = overlapKey(a), y = overlapKey(b);
    if (!hasNumber(x) || !hasNumber(y)) return { score: x === y && x ? 0.5 : (x && y ? -0.5 : 0), exact: false };
    const street = sameStreet(a, b);
    if (x === y) return { score: street ? 3 : 0, exact: street };
    // read a little differently: the same digits, or one character changed, added or missing
    const digits = function (s) { return s.replace(/\D/g, ''); };
    if (digits(x) === digits(y)) return { score: street ? 1.5 : 0, exact: false };
    const short = x.length <= y.length ? x : y, long = x.length <= y.length ? y : x;
    let i = 0;
    while (i < short.length && short[i] === long[i]) i++;
    const close = long.length - short.length <= 1 && (short.slice(i) === long.slice(i + 1) || short.slice(i + 1) === long.slice(i + 1));
    return { score: close && street ? 0.5 : -2, exact: false };
  }
  function withoutOverlap(before, after) {
    const old = before.slice(-OVERLAP_MAX), neu = after.slice(0, OVERLAP_MAX);
    const n = old.length, m = neu.length, GAP = -1.5;
    // best[i][j]: the best line-up of a piece of old ending at i with the first j of the new ones
    const best = [], exact = [];
    for (let i = 0; i <= n; i++) {
      best.push(new Float64Array(m + 1)); exact.push(new Int16Array(m + 1));
      for (let j = 1; j <= m; j++) {
        if (i === 0) { best[i][j] = GAP * j; continue; }
        const l = likeness(old[i - 1], neu[j - 1]);
        let s = best[i - 1][j - 1] + l.score, e = exact[i - 1][j - 1] + (l.exact ? 1 : 0);
        if (best[i - 1][j] + GAP > s) { s = best[i - 1][j] + GAP; e = exact[i - 1][j]; }
        if (best[i][j - 1] + GAP > s) { s = best[i][j - 1] + GAP; e = exact[i][j - 1]; }
        best[i][j] = s; exact[i][j] = e;
      }
    }
    // the line-up must reach the end of the old photo
    let cut = 0, top = 0;
    for (let j = 1; j <= m; j++) if (exact[n][j] >= 2 && best[n][j] >= 4 && best[n][j] > top) { top = best[n][j]; cut = j; }
    let fresh = after.slice(cut);
    // a number the last photos already had, right at the start of the new photo: the same pigeonhole
    const seen = {};
    old.forEach(function (it) { const k = overlapKey(it); if (hasNumber(k)) (seen[k] = seen[k] || []).push(it); });
    let lead = 0;
    for (let k = 0; k < Math.min(fresh.length, 6); k++) {
      const key = overlapKey(fresh[k]);
      if (!hasNumber(key)) continue;   // an empty or unread pigeonhole goes with the numbers around it
      if (!(seen[key] || []).some(function (it) { return sameStreet(it, fresh[k]); })) break;
      lead = k + 1;
    }
    return fresh.slice(lead);
  }

  /*
   * The streets written on the itinerary (the sheet with the list of the streets of the sub-zone), from
   * the words read on its photo: lines of words, and a street type (VIA, CASCINA...) starts a name.
   */
  const STREET_TYPE = /^(VIA|VIALE|V\.LE|PIAZZA|P\.ZA|PIAZZALE|CASCINA|C\.NA|VICOLO|STRADA|CORSO|LARGO|LOCALITA|LOC\.|FRAZIONE|FRAZ\.|CONTRADA|BORGO|PASSAGGIO|TRAVERSA|ALZAIA|RIPA)$/;
  function sheetStreets(words) {
    const ws = (words || []).filter(function (w) { return w.confidence > 50 && w.bbox; }).map(function (w) {
      return { t: String(w.text || '').toUpperCase().replace(/[^A-ZÀ-Ü'.]/g, ''), x0: w.bbox.x0, x1: w.bbox.x1, y: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 };
    }).filter(function (w) { return w.t.replace(/[^A-Z]/g, '').length >= 2 || STREET_TYPE.test(w.t); });
    ws.sort(function (a, b) { return a.y - b.y; });
    const lines = [];
    ws.forEach(function (w) {
      const line = lines.find(function (l) { return Math.abs(l.y - w.y) < Math.max(l.h, w.h) * 0.5; });
      if (line) line.words.push(w); else lines.push({ y: w.y, h: w.h, words: [w] });
    });
    const names = {};
    lines.forEach(function (l) {
      let name = null, end = 0;
      const close = function () { if (name && name.length >= 2 && name.slice(1).join('').length >= 3) names[name.join(' ')] = true; name = null; };
      l.words.sort(function (a, b) { return a.x0 - b.x0; }).forEach(function (w) {
        if (STREET_TYPE.test(w.t)) { close(); name = [w.t]; end = w.x1; return; }
        if (name && w.x0 - end < l.h * 6) { name.push(w.t); end = w.x1; return; }
        close();
      });
      close();
    });
    return Object.keys(names);
  }

  // How many letters must change to turn a into b.
  function editDistance(a, b) {
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev.push(j);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
      prev = row;
    }
    return prev[b.length];
  }

  /*
   * A street name read on a strip, put right with the streets already known (the itinerary, the work):
   * "VIA DEI TIGU" is "VIA DEI TIGLI". Only when it is clearly the same name (at most a quarter of
   * the letters different, and no other known name as close); otherwise it stays as read.
   */
  function snapStreet(read, known) {
    const key = function (x) { return String(x || '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim(); };
    const r = key(read);
    if (r.replace(/ /g, '').length < 4) return read;
    let best = '', score = 0, second = 0;
    (known || []).forEach(function (k) {
      const kk = key(k);
      if (!kk) return;
      const sc = 1 - editDistance(r, kk) / Math.max(r.length, kk.length);
      if (sc > score) { second = score; score = sc; best = k; } else if (sc > second && key(best) !== kk) second = sc;
    });
    return best && score >= 0.75 && score - second >= 0.08 ? best : read;
  }

  // The items of `items` whose house number (same street) is already in `before`: to point them out.
  function repeatedItems(before, items) {
    return items.filter(function (it) {
      const k = overlapKey(it);
      return hasNumber(k) && before.some(function (b) { return overlapKey(b) === k && sameStreet(b, it); });
    });
  }

  /*
   * Where the big writing of a sign ("2A") may be, on a small copy of the photo (about 1000 points):
   * groups of 2-4 dark letters side by side, of the same height, between 4% and 45% of the photo, on a
   * light ground (the sign is white or yellow: the gaps between the dividers of the pigeonholes are not).
   * The reader finds the name only on the piece cut around it, not on the whole photo.
   * Returns up to 3 boxes (parts of the photo, 0..1), the biggest first.
   */
  function signBoxes(img) {
    const W = img.width, H = img.height;
    const mask = darkMask(img, 3);
    const gray = toGray(img);
    const sum = new Float64Array((W + 1) * (H + 1));   // integral image of the grey, for the ground around a letter
    for (let y = 1; y <= H; y++) {
      let row = 0;
      for (let x = 1; x <= W; x++) { row += gray[(y - 1) * W + x - 1]; sum[y * (W + 1) + x] = sum[(y - 1) * (W + 1) + x] + row; }
    }
    const area = function (x0, y0, x1, y1) { return sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0]; };
    const label = new Int32Array(W * H);
    const parts = [];
    const stack = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || label[start]) continue;
      const id = parts.length + 1;
      let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0, ink = 0;
      label[start] = id; stack.push(start);
      while (stack.length) {
        const p = stack.pop(), x = p % W, y = (p - x) / W;
        n++; ink += gray[p];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const next = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
        for (let k = 0; k < 4; k++) { const q = next[k]; if (q >= 0 && mask[q] && !label[q]) { label[q] = id; stack.push(q); } }
      }
      parts.push({ x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1, n: n, ink: ink / n });
    }
    // the ground around a letter: the box a little bigger, without the letter
    const ground = function (c) {
      const pad = Math.round((c.y1 - c.y0) * 0.15);
      const X0 = Math.max(0, c.x0 - pad), Y0 = Math.max(0, c.y0 - pad), X1 = Math.min(W, c.x1 + pad), Y1 = Math.min(H, c.y1 + pad);
      const all = (X1 - X0) * (Y1 - Y0) - c.n;
      return all > 0 ? (area(X0, Y0, X1, Y1) - c.ink * c.n) / all : 0;
    };
    const letters = parts.filter(function (c) {
      const w = c.x1 - c.x0, h = c.y1 - c.y0, fill = c.n / (w * h);
      if (h < H * 0.04 || h > H * 0.45 || w < h * 0.2 || w > h * 1.3 || fill < 0.07 || fill > 0.8) return false;   // 0.07: outlined letters
      const light = ground(c);
      return light >= 150 && light - c.ink >= 70;
    }).sort(function (a, b) { return a.x0 - b.x0; });
    const found = [];
    letters.forEach(function (c, i) {
      const h = c.y1 - c.y0;
      const group = [c];
      for (let j = i + 1; j < letters.length && group.length < 4; j++) {
        const d = letters[j], last = group[group.length - 1], dh = d.y1 - d.y0;
        if (d.x0 - last.x1 > h * 0.6) break;
        if (dh < h * 0.7 || dh > h * 1.4 || Math.abs((d.y0 + d.y1) - (c.y0 + c.y1)) > h * 0.5) continue;
        group.push(d);
      }
      if (group.length < 2) return;
      const box = { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, h: h };
      group.forEach(function (g) { box.x0 = Math.min(box.x0, g.x0); box.y0 = Math.min(box.y0, g.y0); box.x1 = Math.max(box.x1, g.x1); box.y1 = Math.max(box.y1, g.y1); });
      found.push(box);
    });
    found.sort(function (a, b) { return b.h - a.h; });
    const out = [];
    found.forEach(function (b) {
      if (out.length >= 3 || out.some(function (o) { return b.x0 < o.x1 * W && b.x1 > o.x0 * W && b.y0 < o.y1 * H && b.y1 > o.y0 * H; })) return;
      const pad = b.h * 0.2;
      out.push({ x0: Math.max(0, b.x0 - pad) / W, y0: Math.max(0, b.y0 - pad) / H, x1: Math.min(W, b.x1 + pad) / W, y1: Math.min(H, b.y1 + pad) / H });
    });
    return out;
  }

  /*
   * The piece cut around the name of a sign, black on white for the reader: ink is what is dark or
   * coloured (yellow letters with a dark border would otherwise be only their border); white and grey not.
   */
  function signInk(img) {
    const gray = toGray(img), t = threshold(gray);
    const out = new Uint8ClampedArray(img.width * img.height * 4);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
      const r = img.data[j], g = img.data[j + 1], b = img.data[j + 2];
      const ink = gray[i] < t || Math.max(r, g, b) - Math.min(r, g, b) > 60;
      out[j] = out[j + 1] = out[j + 2] = ink ? 0 : 255; out[j + 3] = 255;
    }
    return { width: img.width, height: img.height, data: out };
  }

  // A name read on a sign: a number and a letter ("2B"); a last 8, 4 or 0 is the letter B, A or D read as a digit.
  function signText(text) {
    const t = String(text || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (/^\d{1,3}[A-Z]$/.test(t)) return t;
    const m = /^(\d{1,3})([840])$/.exec(t);
    return m ? m[1] + { 8: 'B', 4: 'A', 0: 'D' }[m[2]] : '';
  }

  // The photo of the sign of a sub-zone ("2A"): which of the names given is written big in it, or ''.
  // Only writing at least minTall points tall counts: a small sign in the background of a strip photo is not it.
  function zoneSign(words, names, minTall) {
    const wanted = {};
    names.forEach(function (n) { if (n) wanted[String(n).toUpperCase().replace(/\s+/g, '')] = n; });
    let found = '', size = minTall || 0;
    (words || []).forEach(function (w) {
      const t = String(w.text || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
      const tall = w.bbox ? w.bbox.y1 - w.bbox.y0 : 0;
      // a name already in the work, or one shaped like a sub-zone (a number and a letter: "8B")
      const name = wanted[t] || (/^\d{1,3}[A-Z]$/.test(t) ? t : '');
      if (name && tall >= size) { found = name; size = tall; }   // the biggest writing is the sign
    });
    return found;
  }

  const NUMBER_CHARS = '0123456789ABCDEFGHILMNOPQRSTUVZ/\\-';

  /*
   * Reads one strip (the photo already cut to it): the house numbers, one pigeonhole at a time, then
   * the street names under them. recognize(band, mode, whitelist) runs the reader (Tesseract) on a
   * band image and returns its data { text, confidence, words }; progress(i, n) says how far it is.
   * Returns { cells, phrases }, positions in pixels of the photo.
   */
  /*
   * Where the strip is in a whole photo (best on a small copy, about 600 points wide): the rows of
   * light paper crossed by many thin dark strokes (the lines between pigeonholes and the printed
   * numbers) make the row of the numbers; the street names are just under it.
   * Returns { x0, y0, x1, y1 } as parts of the photo (0..1), or null if there is no strip.
   */
  function findStrip(img, tallest) {
    const W = img.width, H = img.height, g = toGray(img);
    const step = Math.max(2, Math.round(W / 200));   // a stroke is a few points wide in a small copy
    const raw = new Float64Array(H);
    for (let y = 0; y < H; y++) {
      let strokes = 0, light = 0;
      for (let x = step; x < W - step; x++) {
        const v = g[y * W + x];
        if (v > 150) light++;
        if (v < g[y * W + x - step] - 25 && v < g[y * W + x + step] - 25) { strokes++; x += step; }
      }
      raw[y] = strokes * light / W;
    }
    const score = new Float64Array(H);   // a little smoothed: one row alone does not count
    for (let y = 0; y < H; y++) {
      let s = 0, k = 0;
      for (let d = -2; d <= 2; d++) if (y + d >= 0 && y + d < H) { s += raw[y + d]; k++; }
      score[y] = s / k;
    }
    // the strip has long straight edges (above and below its white row) across most of the photo;
    // fins and papers do not: rows near such an edge count more
    const edge = new Float64Array(H);
    for (let y = 2; y < H - 2; y++) {
      let k = 0;
      for (let x = 0; x < W; x++) if (Math.abs(g[(y + 2) * W + x] - g[(y - 2) * W + x]) > 35) k++;
      edge[y] = k / W;
    }
    const near = Math.max(3, Math.round(H * 0.04));
    let best = 0, at = -1;
    for (let y = 0; y < H; y++) {
      let e = 0;
      for (let d = -near; d <= near; d++) if (y + d >= 0 && y + d < H && edge[y + d] > e) e = edge[y + d];
      const v = score[y] * (0.3 + e);
      if (v > best) { best = v; at = y; }
    }
    if (at < 0 || score[at] < 3) return null;
    best = score[at];
    // the row of the numbers is thin (a few hundredths of the photo): the band stops there, even if the
    // pigeonholes above (grey fins, also full of strokes) go on
    let a = at, b = at;
    const most = Math.max(4, Math.round(H * (tallest || 0.06)));   // in a whole photo the strip is thin
    while (b - a < most && ((a > 0 && score[a - 1] > best * 0.5) || (b < H - 1 && score[b + 1] > best * 0.5))) {
      if (a > 0 && score[a - 1] >= (b < H - 1 ? score[b + 1] : 0)) a--; else b++;
    }
    const h = Math.max(b - a + 1, Math.round(H * 0.015));
    // a little paper above the numbers, and the street names under them (about 0.7 of their height) with some room
    const y0 = Math.max(0, a - h * 0.35), y1 = Math.min(H, b + h * 1.25);
    return { x0: 0, y0: y0 / H, x1: 1, y1: y1 / H };
  }

  // One pigeonhole of the photo, grey and enlarged, without its borders.
  function cellImage(img, x0, x1, y0, y1) {
    const gray = img._gray || (img._gray = toGray(img));
    const mx = Math.max(2, Math.round((x1 - x0) * 0.07)), my = Math.max(1, Math.round((y1 - y0) * 0.1));
    const ax = Math.max(0, x0 + mx), bx = Math.min(img.width, x1 - mx), ay = Math.max(0, y0 + my), by = Math.min(img.height, y1 - my);
    // enlarged so the row of the number is about 130 points tall, whatever the size of the photo:
    // Tesseract reads small print badly, and print made too big and blurred too
    const k = Math.max(1, Math.min(4, Math.round(130 / Math.max(1, y1 - y0))));
    const pad = 12, w = Math.max(1, bx - ax) * k + 2 * pad, h = Math.max(1, by - ay) * k + 2 * pad;
    const out = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) };
    for (let y = 0; y < (by - ay) * k; y++) for (let x = 0; x < (bx - ax) * k; x++) {
      const v = gray[(ay + Math.floor(y / k)) * img.width + ax + Math.floor(x / k)];
      const i = ((y + pad) * w + x + pad) * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    }
    return out;
  }

  /*
   * A strip photographed a little slanted, straightened: the long line between numbers and street
   * names is found in 12 slices across the width, its slope measured (the middle value, so one slice
   * gone wrong does not count) and every column moved up or down by it. Returns the same image if straight.
   */
  function straighten(img) {
    const W = img.width, H = img.height;
    const mask = img._mask || (img._mask = darkMask(img));
    const n = 12, pts = [];
    for (let k = 0; k < n; k++) {
      const a = Math.floor(W * k / n), b = Math.floor(W * (k + 1) / n);
      let bestY = -1, best = 0;
      for (let y = Math.round(H * 0.3); y < Math.round(H * 0.85); y++) {
        let d = 0;
        for (let x = a; x < b; x++) d += mask[y * W + x];
        if (d > best) { best = d; bestY = y; }
      }
      if (best > (b - a) * 0.75) pts.push({ x: (a + b) / 2, y: bestY });   // a real line, not writing
    }
    if (pts.length < n / 2) return img;   // no clear line across the strip: better leave it as it is
    const slopes = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) slopes.push((pts[j].y - pts[i].y) / (pts[j].x - pts[i].x));
    slopes.sort(function (p, q) { return p - q; });
    const slope = slopes[Math.floor(slopes.length / 2)];
    if (Math.abs(slope * W) < 2) return img;   // less than 2 points from one end to the other: straight enough
    // the points must lie on that line (a few points off at most), or it was not one line
    const mid = pts.map(function (p) { return p.y - slope * p.x; }).sort(function (a, b) { return a - b; })[Math.floor(pts.length / 2)];
    if (pts.filter(function (p) { return Math.abs(p.y - slope * p.x - mid) <= 3; }).length < pts.length * 0.7) return img;
    const out = { width: W, height: H, data: new Uint8ClampedArray(img.data.length).fill(255) };
    for (let x = 0; x < W; x++) {
      const dy = Math.round(slope * (x - W / 2));
      for (let y = 0; y < H; y++) {
        const sy = y + dy;
        if (sy < 0 || sy >= H) continue;
        const i = (y * W + x) * 4, j = (sy * W + x) * 4;
        out.data[i] = img.data[j]; out.data[i + 1] = img.data[j + 1]; out.data[i + 2] = img.data[j + 2]; out.data[i + 3] = 255;
      }
    }
    return out;
  }

  // Rows y0..y1 of an image, as an image of their own.
  function rowsOf(img, y0, y1) {
    const W = img.width, H = Math.max(1, y1 - y0);
    return { width: W, height: H, data: img.data.slice(y0 * W * 4, (y0 + H) * W * 4) };
  }

  async function readStrip(photo, recognize, progress) {
    // a rectangle much taller than a strip (frame above, papers below; a strip is many times wider than
    // tall): only the strip is kept
    let part = photo;
    if (photo.width / photo.height < 7) {
      const band = findStrip(photo, 0.3);
      if (band && band.y1 - band.y0 < 0.8) part = rowsOf(photo, Math.floor(band.y0 * photo.height), Math.ceil(band.y1 * photo.height));
    }
    const img = straighten(part);
    const seg = segmentStrip(img);
    const S = 2;
    const up = cleanBand(img, seg.top, seg.split, S);
    const low = cleanBand(img, seg.split, seg.bottom, S, true);
    const cells = [];
    // the lines between the pigeonholes were found: each pigeonhole is read on its own, in black and white
    if (seg.cells.length >= 4) {
      const ink = inkClusters(up);
      const pieces = [];
      seg.cells.forEach(function (c) {
        // as wide as more pigeonholes: the numbers inside it one by one (lines lost in a shadow), or one wide pigeonhole
        const inside = c.span > 1 ? ink.filter(function (k) { return k.x0 / S >= c.x0 - 2 && k.x1 / S <= c.x1 + 2; }) : [];
        if (inside.length > 1) {
          const pad = Math.round(seg.typical * 0.12);
          inside.forEach(function (k) { pieces.push({ x0: Math.max(c.x0, Math.round(k.x0 / S) - pad), x1: Math.min(c.x1, Math.round(k.x1 / S) + pad), span: 1 }); });
        } else pieces.push(c);
      });
      for (let i = 0; i < pieces.length; i++) {
        if (progress) progress(i, pieces.length);
        const c = pieces[i];
        const picture = blackWhite(cellImage(img, c.x0, c.x1, seg.top, seg.split));
        if (picture.ink < 0.004) continue;   // an empty pigeonhole
        let best = { t: '', conf: -1 };
        for (const mode of ['8', '7']) {
          const r = await recognize(picture, mode, NUMBER_CHARS);
          const t = cleanNumber(r.text);
          if (t && r.confidence > best.conf) best = { t: t, conf: r.confidence };
          if (best.conf >= 60) break;   // sure enough: no second try
        }
        if (best.t) cells.push({ x0: c.x0, x1: c.x1, top: best.t, unsure: best.conf < 70, span: c.span });
      }
      const rn = await recognize(low, '11', '');
      return { cells: cells, phrases: streetPhrases(rn.words).map(function (p) { return { text: p.text, x0: p.x0 / S, x1: p.x1 / S }; }) };
    }
    const clusters = inkClusters(up);
    for (let i = 0; i < clusters.length; i++) {
      if (progress) progress(i, clusters.length);
      const r = await recognize(cropBand(up, clusters[i], 10), '8', NUMBER_CHARS);
      const t = cleanNumber(r.text);
      if (t) cells.push({ x0: clusters[i].x0 / S, x1: clusters[i].x1 / S, top: t, unsure: r.confidence < 70, span: 1 });
    }
    const rn = await recognize(low, '11', '');
    const phrases = streetPhrases(rn.words).map(function (p) { return { text: p.text, x0: p.x0 / S, x1: p.x1 / S }; });
    return { cells: cells, phrases: phrases };
  }

  return { toGray: toGray, threshold: threshold, segmentStrip: segmentStrip, cleanBand: cleanBand, inkClusters: inkClusters, cropBand: cropBand, cleanNumber: cleanNumber,
    streetPhrases: streetPhrases, routeLines: routeLines, routeItems: routeItems, itemLines: itemLines, withoutOverlap: withoutOverlap, sheetStreets: sheetStreets, snapStreet: snapStreet, signBoxes: signBoxes, signInk: signInk, signText: signText, repeatedItems: repeatedItems,
    zoneSign: zoneSign, readStrip: readStrip, findStrip: findStrip };
});

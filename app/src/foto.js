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
  function darkMask(img) {
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
    const r = Math.max(7, Math.round(Math.min(W, H) / 8));
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
    const usual = gaps.length ? gaps[Math.floor(gaps.length / 2)] : W;
    // the clear lines; where they leave a gap of more than two pigeonholes, the faint lines inside it too
    const edges = [0];
    strongX.concat([W - 1]).forEach(function (x) {
      const last = edges[edges.length - 1];
      if (x - last > usual * 2.5) paleX.forEach(function (f) { if (f > last + usual * 0.5 && f < x - usual * 0.5) edges.push(f); });
      edges.push(x);
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
    for (let i = 0; i < g.length; i++) {
      const v = (g[i] <= t) !== flip ? 0 : 255;
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
    const lines = [];
    cells.forEach(function (c) {
      let tok = c.top || (c.empty ? 'vuota' : '?');
      if (c.second) tok += '/' + c.second;
      if (c.unsure && tok !== 'vuota' && !/\?$/.test(tok)) tok += '?';
      if (c.span > 1) tok += ' (' + c.span + ')';
      const street = streetOf(c);
      const last = lines[lines.length - 1];
      if (last && last.street === street) last.tokens.push(tok);
      else lines.push({ street: street, tokens: [tok] });
    });
    return lines.map(function (l) { return l.street + ': ' + l.tokens.join(', '); });
  }

  const NUMBER_CHARS = '0123456789ABCDEFGHILMNOPQRSTUVZ/\\-';

  /*
   * Reads one strip (the photo already cut to it): the house numbers, one pigeonhole at a time, then
   * the street names under them. recognize(band, mode, whitelist) runs the reader (Tesseract) on a
   * band image and returns its data { text, confidence, words }; progress(i, n) says how far it is.
   * Returns { cells, phrases }, positions in pixels of the photo.
   */
  // One pigeonhole of the photo, grey, enlarged 3 times (Tesseract reads small print better so), without its borders.
  function cellImage(img, x0, x1, y0, y1) {
    const gray = img._gray || (img._gray = toGray(img));
    const mx = Math.max(2, Math.round((x1 - x0) * 0.07)), my = Math.max(1, Math.round((y1 - y0) * 0.1));
    const ax = Math.max(0, x0 + mx), bx = Math.min(img.width, x1 - mx), ay = Math.max(0, y0 + my), by = Math.min(img.height, y1 - my);
    const k = 3, pad = 12, w = Math.max(1, bx - ax) * k + 2 * pad, h = Math.max(1, by - ay) * k + 2 * pad;
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

  async function readStrip(photo, recognize, progress) {
    const img = straighten(photo);
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
    streetPhrases: streetPhrases, routeLines: routeLines, readStrip: readStrip };
});

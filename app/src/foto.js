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

  function darkMask(img) {
    const gray = toGray(img);
    const t = threshold(gray);
    const mask = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) mask[i] = gray[i] <= t ? 1 : 0; // Otsu: the dark class is "up to t"
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
    const top = Math.round((lines.filter(function (y) { return y < split - H * 0.15; }).pop() || 0));
    const bottom = Math.round((lines.filter(function (y) { return y > split + H * 0.15; })[0] || H - 1));
    // vertical lines in the house-number row: columns dark for most of its height
    const y0 = top + 2, y1 = split - 2;
    const colDark = [];
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let y = y0; y < y1; y++) n += mask[y * W + x];
      colDark.push(n / Math.max(1, y1 - y0));
    }
    const vlines = groups(colDark.map(function (f, x) { return f > 0.7 ? x : -1; }).filter(function (x) { return x >= 0; }), 3);
    const edges = [0].concat(vlines.map(function (g) { return (g.from + g.to) / 2; }), [W - 1]);
    let cells = [];
    for (let i = 1; i < edges.length; i++) cells.push({ x0: Math.round(edges[i - 1]), x1: Math.round(edges[i]) });
    const widths = cells.map(function (c) { return c.x1 - c.x0; }).sort(function (a, b) { return a - b; });
    const typical = widths[Math.floor(widths.length * 0.6)] || W;
    // drop the thin gaps of double lines and the cut pieces at the photo edges
    cells = cells.filter(function (c) { return c.x1 - c.x0 >= typical * 0.4; });
    cells.forEach(function (c) { c.span = Math.max(1, Math.round((c.x1 - c.x0) / typical)); });
    return { split: split, top: top, bottom: bottom, cells: cells, typical: typical };
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

  // House numbers read on the cleaned upper line: words with their position, left to right.
  function numberWords(words) {
    return words.map(function (w) {
      return { text: cleanNumber(w.text), x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, conf: w.confidence };
    }).filter(function (w) { return w.text && /\d/.test(w.text); }).sort(function (a, b) { return a.x0 - b.x0; });
  }

  // Share of dark pixels in a box (to skip empty pigeonholes).
  function inkIn(img, box) {
    const mask = img._mask || (img._mask = darkMask(img));
    let n = 0, all = 0;
    for (let y = box.y0; y < box.y1; y++) {
      for (let x = box.x0; x < box.x1; x++) { n += mask[y * img.width + x]; all++; }
    }
    return all ? n / all : 0;
  }

  // What Tesseract read in one pigeonhole -> a house number ("12", "5A", "61\59") or ''.
  function cleanNumber(text) {
    let t = String(text || '').toUpperCase().replace(/[|[\]{}()!_.,;:'"`~]/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.replace(/(\d)\s+([A-Z])\b/g, '$1$2').replace(/O(?=\d)|(?<=\d)O/g, '0');
    const m = /\d{1,4}\s*[A-Z]?(\s*[\/\\-]\s*\d{1,4}\s*[A-Z]?)?/.exec(t);
    return m ? m[0].replace(/\s+/g, '') : '';
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

  return { toGray: toGray, threshold: threshold, segmentStrip: segmentStrip, cleanBand: cleanBand, inkClusters: inkClusters, cropBand: cropBand, numberWords: numberWords, inkIn: inkIn, cleanNumber: cleanNumber,
    streetPhrases: streetPhrases, routeLines: routeLines };
});

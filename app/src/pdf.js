/*
 * Casellino - writes the strips as a PDF to print (no library, works offline).
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 *
 * Same layout as the compact Excel (Core.printPieces + Core.packPages) and the template's measures:
 * a slot is 35.25 pt wide (1.2435 cm), the house-number line 28.35 pt (1 cm), the street line 19.9 pt.
 * Text uses the standard PDF font Helvetica-Bold (same widths as Arial bold), so nothing is embedded.
 */
(function (root, factory) {
  const api = factory(root.CasellinoCore || (typeof require === 'function' ? require('./core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CasellinoPdf = api;
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  const PAGE = { w: 841.89, h: 595.28 };          // A4 landscape
  const SLOT = 35.25, LABEL = 8, TOP = 28.35, BOTTOM = 19.9, PER_PAGE = 10;
  const THIN = 0.6, MEDIUM = 1.4;
  // Helvetica-Bold widths (1/1000 em) of the WinAnsi characters 32..255
  const WIDTHS = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];
  const WIN = { 0x20AC: 128, 0x201A: 130, 0x201E: 132, 0x2026: 133, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2013: 150, 0x2014: 151 };

  function code(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c < 128) return c;
    if (c >= 160 && c < 256) return c;
    return WIN[c] || 63; // "?" for what the standard font cannot write
  }

  function textWidth(s, size) {
    let w = 0;
    for (const ch of String(s)) w += WIDTHS[code(ch) - 32] || 556;
    return w * size / 1000;
  }

  function pdfString(s) {
    let out = '';
    for (const ch of String(s)) {
      const c = code(ch);
      if (c === 40 || c === 41 || c === 92) out += '\\' + String.fromCharCode(c);
      else if (c < 128) out += String.fromCharCode(c);
      else out += '\\' + c.toString(8).padStart(3, '0');
    }
    return '(' + out + ')';
  }

  function rgb(hex) {
    const h = String(hex || 'FFFFFF');
    return [0, 2, 4].map(function (i) { return (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3); }).join(' ');
  }
  const n = function (v) { return Number(v).toFixed(2); };

  // Drawing commands, with y measured from the top of the page.
  function Canvas() { this.ops = []; }
  Canvas.prototype.fill = function (x, y, w, h, hex) {
    this.ops.push(rgb(hex) + ' rg ' + n(x) + ' ' + n(PAGE.h - y - h) + ' ' + n(w) + ' ' + n(h) + ' re f');
  };
  Canvas.prototype.line = function (x1, y1, x2, y2, width, hex) {
    this.ops.push(rgb(hex || '111111') + ' RG ' + n(width) + ' w ' + n(x1) + ' ' + n(PAGE.h - y1) + ' m ' + n(x2) + ' ' + n(PAGE.h - y2) + ' l S');
  };
  Canvas.prototype.text = function (x, baseline, size, s, hex) {
    this.ops.push('BT /F1 ' + n(size) + ' Tf ' + rgb(hex) + ' rg ' + n(x) + ' ' + n(PAGE.h - baseline) + ' Td ' + pdfString(s) + ' Tj ET');
  };
  // Text centred in a box, made smaller until it fits (never cut).
  Canvas.prototype.centered = function (x, y, w, h, s, max, hex) {
    const size = Math.max(4, Math.min(max, (w - 4) / Math.max(1, textWidth(s, 1)), h * 0.8));
    this.text(x + (w - textWidth(s, size)) / 2, y + h / 2 + size * 0.36, size, s, hex);
  };

  // The largest size that keeps two numbers clear of the "/" line (lower-left to upper-right corner).
  function diagonalSize(a, b, w, h) {
    const lineY = function (x) { return h - h / w * x; };
    for (let s = 12; s > 4; s -= 0.5) {
      const w1 = textWidth(a, s), w2 = textWidth(b, s), cap = 0.72 * s;
      if (2 + cap + 1 <= lineY(3 + w1) && h - 3 - cap - 1 >= lineY(w - 3 - w2)) return s;
    }
    return 4;
  }

  // A name in a pigeonhole: on two lines when that makes it bigger.
  function twoLines(text, w) {
    const words = String(text).split(/\s+/);
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const l1 = words.slice(0, k).join(' '), l2 = words.slice(k).join(' ');
      const size = Math.min(11, (w - 4) / Math.max(textWidth(l1, 1), textWidth(l2, 1)), TOP * 0.4);
      if (!best || size > best.size) best = { lines: [l1, l2], size: size };
    }
    return best;
  }

  function drawPiece(cv, project, piece, x0, y0) {
    const yTop = y0 + LABEL, yBottom = yTop + TOP, right = x0 + piece.width * SLOT;
    const xOf = function (slot) { return x0 + (slot - piece.from) * SLOT; };
    cv.text(x0, y0 + LABEL - 2, 6.5, piece.label[0] + ' · ' + piece.label[1] + ' · ' + piece.label[2] + ' · caselle ' + piece.label[3], '444444');
    piece.cells.forEach(function (c) {
      const a = Math.max(c.start, piece.from), b = Math.min(c.end, piece.to);
      const x = xOf(a), w = (b - a + 1) * SLOT;
      const ink = Core.textColorOf(project, c.key);
      cv.fill(x, yTop, w, TOP, Core.colorOf(project, c.key));
      if (c.second) {
        const s = diagonalSize(c.top, c.second, w, TOP);
        cv.line(x, yTop + TOP, x + w, yTop, THIN, ink);
        cv.text(x + 3, yTop + 2 + 0.72 * s, s, c.top, ink);
        cv.text(x + w - 3 - textWidth(c.second, s), yTop + TOP - 3, s, c.second, ink);
        return;
      }
      const two = /\s/.test(c.top) && c.top.length > 6 ? twoLines(c.top, w) : null;
      if (two && two.size > Math.min(11, (w - 4) / textWidth(c.top, 1))) {
        two.lines.forEach(function (l, k) {
          cv.text(x + (w - textWidth(l, two.size)) / 2, yTop + TOP / 2 + (k ? two.size * 1.0 : -two.size * 0.15), two.size, l, ink);
        });
      } else if (c.top) cv.centered(x, yTop, w, TOP, c.top, two ? 11 : 20, ink);
    });
    piece.runs.forEach(function (r) {
      const a = Math.max(r.start, piece.from), b = Math.min(r.end, piece.to);
      cv.fill(xOf(a), yBottom, (b - a + 1) * SLOT, BOTTOM, Core.colorOf(project, r.key));
      cv.centered(xOf(a), yBottom, (b - a + 1) * SLOT, BOTTOM, r.street, 16, Core.textColorOf(project, r.key));
    });
    // lines: between pigeonholes and between streets (thin), between the two rows (thin), around (medium)
    for (let k = piece.from + 1; k <= piece.to; k++) {
      if (!piece.cells.some(function (c) { return c.start < k && c.end >= k; })) cv.line(xOf(k), yTop, xOf(k), yBottom, THIN);
      if (piece.runs.some(function (r) { return r.start === k; }) || piece.runs.some(function (r) { return r.end === k - 1; })) {
        cv.line(xOf(k), yBottom, xOf(k), yBottom + BOTTOM, THIN);
      }
    }
    cv.line(x0, yBottom, right, yBottom, THIN);
    cv.line(x0, yTop, right, yTop, MEDIUM);
    cv.line(x0, yBottom + BOTTOM, right, yBottom + BOTTOM, MEDIUM);
    cv.line(x0, yTop, x0, yBottom + BOTTOM, MEDIUM);
    cv.line(right, yTop, right, yBottom + BOTTOM, MEDIUM);
  }

  // The PDF file (bytes): one A4 landscape page for every 10 lines of strips.
  function buildPdf(project, title) {
    Core.assignColors(project);
    const pages = Core.packPages(Core.printPieces(project), PER_PAGE);
    const lineH = LABEL + TOP + BOTTOM;
    const x0 = (PAGE.w - Core.SLOTS_PER_PAGE * SLOT) / 2;
    const y0 = (PAGE.h - PER_PAGE * lineH) / 2;
    const streams = pages.map(function (page, k) {
      const cv = new Canvas();
      page.forEach(function (line, j) {
        line.pieces.forEach(function (x) { drawPiece(cv, project, x.piece, x0 + x.start * SLOT, y0 + j * lineH); });
      });
      cv.text(x0, PAGE.h - 5, 6, (title || 'Casellino') + ' · foglio ' + (k + 1) + ' di ' + pages.length +
        ' · stampa a dimensioni reali (100%), A4 orizzontale', '777777');
      return cv.ops.join('\n');
    });
    // objects: 1 catalog, 2 pages, 3 font, then a page and its content for each sheet
    const objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [' + streams.map(function (_, k) { return (4 + 2 * k) + ' 0 R'; }).join(' ') +
      '] /Count ' + streams.length + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    streams.forEach(function (s, k) {
      objs[4 + 2 * k] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE.w + ' ' + PAGE.h + '] ' +
        '/Resources << /Font << /F1 3 0 R >> >> /Contents ' + (5 + 2 * k) + ' 0 R >>';
      objs[5 + 2 * k] = '<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream';
    });
    let out = '%PDF-1.4\n';
    const offsets = [];
    for (let i = 1; i < objs.length; i++) {
      offsets[i] = out.length;
      out += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
    }
    const xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < objs.length; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    // all ASCII (other characters are written as octal codes), so one byte per character
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
    return { bytes: bytes, pages: pages.length };
  }

  return { buildPdf: buildPdf, textWidth: textWidth, diagonalSize: diagonalSize };
});

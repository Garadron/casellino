/*
 * Casellino - writes the printable .xlsx strips.
 * © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
 * The sheet geometry (column widths, row heights, margins, paper, default font)
 * is copied number by number from the blank template, so that the printed
 * strip matches the pigeonholes. Do not change GEOMETRY without re-measuring the template.
 */
(function (root, factory) {
  const api = factory(root.CasellinoCore || (typeof require === 'function' ? require('./core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CasellinoXlsx = api;
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  const GEOMETRY = {
    // <cols> of the template, unchanged: [min, max, width, customWidth]
    cols: [
      [1, 1, '4.28515625', true], [2, 34, '6.7109375', true], [35, 35, '3.85546875', true],
      [36, 36, '2.42578125', true], [37, 37, '4.42578125', true], [38, 63, '6.7109375', true],
      [64, 128, '6.7109375', true], [129, 129, '4.42578125', true], [130, 130, '2', true],
      [131, 131, '4.42578125', true], [132, 164, '6.7109375', true], [165, 165, '4.42578125', true],
      [166, 199, '6.7109375', true], [200, 16384, '6.7109375', false],
    ],
    defaultColWidth: '6.7109375',
    defaultRowHeight: '18',
    rowHeights: (function () {
      const h = { 1: '18', 2: '18', 3: '15', 12: '15', 49: '19.9', 51: '19.9' };
      for (let r = 4; r <= 47; r++) if (r !== 12) h[r] = r % 2 === 0 ? '28.35' : '19.9';
      return h;
    })(),
    margins: { left: '0', right: '0', top: '0.19685039370078741', bottom: '0.19685039370078741', header: '0', footer: '0' },
    paperSize: 9,           // A4
    orientation: 'landscape',
    defaultFont: '<font><sz val="10"/><name val="Arial"/></font>', // decides the width of a column unit
    dimension: 'A1:GQ51',
  };

  // Where each module sits in the sheet (1-based column numbers).
  const LAYOUT = {
    alaA: { first: 2, labelLeft: 1, labelRight: 35, word: 'Ala A', labelFont: 10 },
    casello: { first: 38, labelLeft: 37, labelRight: 129, word: 'Fila', labelFont: 12 },
    alaB: { first: 132, labelLeft: 131, labelRight: 165, word: 'Ala B', labelFont: 10 },
  };
  const NUMBER_ROWS = [3, 12];
  const topRowOf = function (i) { return 4 + 2 * i; };     // civico line of row i (0-based)
  const bottomRowOf = function (i) { return 5 + 2 * i; };  // street line of row i

  function colName(n) {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  function esc(s) {
    return String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ------------------------------------------------------------------ styles

  function StyleBook() {
    this.fonts = [GEOMETRY.defaultFont];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.index = {};
  }
  StyleBook.prototype.add = function (list, xml) {
    const found = list.indexOf(xml);
    if (found >= 0) return found;
    list.push(xml);
    return list.length - 1;
  };
  StyleBook.prototype.font = function (size, bold, color) {
    return this.add(this.fonts, '<font>' + (bold ? '<b/>' : '') + '<sz val="' + size + '"/>' +
      (color ? '<color rgb="FF' + color + '"/>' : '') + '<name val="Arial"/><family val="2"/></font>');
  };
  StyleBook.prototype.fill = function (hex) {
    if (!hex || hex === 'FFFFFF') return 0;
    return this.add(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="FF' + hex +
      '"/><bgColor indexed="64"/></patternFill></fill>');
  };
  StyleBook.prototype.border = function (b) {
    const side = function (name, style, hex) {
      const color = hex ? '<color rgb="FF' + hex + '"/>' : '<color indexed="64"/>';
      return style ? '<' + name + ' style="' + style + '">' + color + '</' + name + '>' : '<' + name + '/>';
    };
    // b.d: colour of a "/" line from the lower-left to the upper-right corner (two numbers in one
    // pigeonhole); it has the colour of the writing, so it shows on dark colours too
    return this.add(this.borders, '<border' + (b.d ? ' diagonalUp="1"' : '') + '>' + side('left', b.l) +
      side('right', b.r) + side('top', b.t) + side('bottom', b.b) + side('diagonal', b.d ? 'thin' : null, b.d) + '</border>');
  };
  // s = { size, bold, color, fill, border:{l,r,t,b}, text, wrap, shrink, rot, h }
  StyleBook.prototype.xf = function (s) {
    const fontId = this.font(s.size || 10, !!s.bold, s.color);
    const fillId = this.fill(s.fill);
    const borderId = this.border(s.border || {});
    const numFmt = s.text ? 49 : 0;
    let al = ' horizontal="' + (s.h || 'center') + '" vertical="center"';
    if (s.rot) al += ' textRotation="' + s.rot + '"';
    if (s.wrap) al += ' wrapText="1"';
    if (s.shrink) al += ' shrinkToFit="1"';
    const xml = '<xf numFmtId="' + numFmt + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' +
      borderId + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
      '<alignment' + al + '/></xf>';
    return this.add(this.xfs, xml);
  };
  StyleBook.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normale" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  };

  function StringTable() { this.list = []; this.map = {}; }
  StringTable.prototype.id = function (s) {
    if (!(s in this.map)) { this.map[s] = this.list.length; this.list.push(s); }
    return this.map[s];
  };
  StringTable.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + this.list.length +
      '" uniqueCount="' + this.list.length + '">' +
      this.list.map(function (s) { return '<si><t xml:space="preserve">' + esc(s) + '</t></si>'; }).join('') + '</sst>';
  };

  // ------------------------------------------------------------------ one sheet

  // Big bold digits for house numbers; smaller wrapped text for names.
  function topTextStyle(text) {
    const t = String(text);
    if (t.length <= 6 || !/\s/.test(t)) return { size: 20, shrink: true };
    return { size: 11, wrap: true };
  }

  /*
   * Two numbers in one pigeonhole, split by a diagonal line: the first in the upper-left
   * corner, the second in the lower-right one. Excel has one alignment per cell, so the
   * second line is pushed right with spaces (widths of Arial bold, at 96 dpi).
   */
  const SLOT_PX = 47; // width of one slot column in pixels (6.7109375 characters of Arial 10)
  function textPx(s, size) {
    const em = size * 96 / 72;
    let w = 0;
    for (const ch of String(s)) {
      if (/[0-9]/.test(ch)) w += 0.556 * em;
      else if (ch === ' ') w += 0.278 * em;
      else if (/[A-Z]/.test(ch)) w += 0.722 * em;
      else if (/[a-z]/.test(ch)) w += 0.6 * em;
      else w += 0.333 * em;
    }
    return w;
  }
  const ROW_PX = 28.35 * 96 / 72; // height of the house-number row (1 cm) in pixels

  // The largest size (pt) that keeps both numbers clear of the "/" line, so nothing is cut:
  // the first number fits in the upper-left triangle, the second in the lower-right one.
  function diagonalSize(first, second, span) {
    const W = SLOT_PX * span, H = ROW_PX;
    const lineY = function (x) { return H - H / W * x; }; // the line from (0, H) to (W, 0)
    for (let size = 12; size >= 5; size--) {
      const em = size * 96 / 72, L = 1.15 * em, t = (H - 2 * L) / 2;
      const w1 = textPx(first, size), w2 = textPx(second, size);
      const firstClear = t + 0.97 * em + 1 <= lineY(3 + w1);         // lower-right corner of the first
      const secondClear = t + L + 0.25 * em - 1 >= lineY(W - 5 - w2);  // upper-left corner of the second
      if (firstClear && secondClear) return size;
    }
    return 5;
  }

  function diagonalText(first, second, span) {
    const size = diagonalSize(first, second, span);
    const free = SLOT_PX * span - 8 - textPx(second, size);
    const spaces = Math.max(1, Math.round(free / textPx(' ', size)));
    return { text: first + '\n' + ' '.repeat(spaces) + second, size: size };
  }

  function SheetBuilder(styles, strings) {
    this.styles = styles;
    this.strings = strings;
    this.cells = {};   // row -> col -> { s, v, t }
    this.merges = [];
  }
  SheetBuilder.prototype.put = function (row, col, value, style) {
    if (!this.cells[row]) this.cells[row] = {};
    const c = { s: this.styles.xf(style) };
    if (value !== '' && value !== null && value !== undefined) {
      const v = String(value);
      if (/^[1-9]\d{0,8}$/.test(v)) { c.t = 'n'; c.v = v; }
      else { c.t = 's'; c.v = this.strings.id(v); }
    }
    this.cells[row][col] = c;
  };
  // Writes value in the first cell, styles the whole block, merges if needed.
  SheetBuilder.prototype.block = function (row1, col1, row2, col2, value, style) {
    for (let r = row1; r <= row2; r++) {
      for (let c = col1; c <= col2; c++) {
        const edge = Object.assign({}, style.border || {});
        if (c !== col1) delete edge.l;
        if (c !== col2) delete edge.r;
        if (r !== row1) delete edge.t;
        if (r !== row2) delete edge.b;
        this.put(r, c, r === row1 && c === col1 ? value : '', Object.assign({}, style, { border: edge }));
      }
    }
    if (row1 !== row2 || col1 !== col2) this.merges.push(colName(col1) + row1 + ':' + colName(col2) + row2);
  };
  // Manual page breaks every SLOTS_PER_PAGE slots inside each module (column numbers, 1-based,
  // of the last column on a page).
  function pageBreaks(sheet) {
    const out = [];
    Core.MODULES.forEach(function (m) {
      if (!sheet.modules[m]) return;
      for (let s = Core.SLOTS_PER_PAGE; s < Core.MODULE_SLOTS[m]; s += Core.SLOTS_PER_PAGE) {
        out.push(LAYOUT[m].first + s - 1);
      }
    });
    return out;
  }

  SheetBuilder.prototype.xml = function (printSelected, breaks) {
    const g = GEOMETRY;
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr autoPageBreaks="0"/></sheetPr>' +
      '<dimension ref="' + g.dimension + '"/>' +
      '<sheetViews><sheetView' + (printSelected ? ' tabSelected="1"' : '') +
      ' zoomScaleNormal="100" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultColWidth="' + g.defaultColWidth + '" defaultRowHeight="' + g.defaultRowHeight +
      '" customHeight="1"/><cols>';
    g.cols.forEach(function (c) {
      x += '<col min="' + c[0] + '" max="' + c[1] + '" width="' + c[2] + '"' + (c[3] ? ' customWidth="1"' : '') + '/>';
    });
    x += '</cols><sheetData>';
    const rows = {};
    Object.keys(g.rowHeights).forEach(function (r) { rows[r] = true; });
    Object.keys(this.cells).forEach(function (r) { rows[r] = true; });
    const self = this;
    Object.keys(rows).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      const ht = g.rowHeights[r];
      x += '<row r="' + r + '"' + (ht ? ' ht="' + ht + '" customHeight="1"' : '') + '>';
      const rowCells = self.cells[r] || {};
      Object.keys(rowCells).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
        const cell = rowCells[c];
        x += '<c r="' + colName(c) + r + '" s="' + cell.s + '"' + (cell.t === 's' ? ' t="s"' : '') + '>' +
          (cell.v !== undefined ? '<v>' + cell.v + '</v>' : '') + '</c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (this.merges.length) {
      x += '<mergeCells count="' + this.merges.length + '">' +
        this.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
    }
    const mg = g.margins;
    x += '<pageMargins left="' + mg.left + '" right="' + mg.right + '" top="' + mg.top + '" bottom="' + mg.bottom +
      '" header="' + mg.header + '" footer="' + mg.footer + '"/>' +
      '<pageSetup paperSize="' + g.paperSize + '" orientation="' + g.orientation + '"/>' +
      '<headerFooter alignWithMargins="0"/>';
    if (breaks && breaks.length) {
      x += '<colBreaks count="' + breaks.length + '" manualBreakCount="' + breaks.length + '">' +
        breaks.map(function (b) { return '<brk id="' + b + '" max="1048575" man="1"/>'; }).join('') + '</colBreaks>';
    }
    x += '</worksheet>';
    return x;
  };

  function buildSheet(project, sheet, styles, strings, selected) {
    const sb = new SheetBuilder(styles, strings);
    const head = { size: 14, bold: true, h: 'left' };

    sb.put(1, 38, 'Zona', head);
    sb.put(1, 39, [project.zone, sheet.name].filter(Boolean).join(' · ') || '', head);
    sb.block(1, 41, 1, 44, 'Titolare', head);
    sb.block(1, 45, 1, 47, project.owner || '', head);

    Core.MODULES.forEach(function (m) {
      if (!sheet.modules[m]) return;
      const L = LAYOUT[m];
      const slots = Core.MODULE_SLOTS[m];
      const last = L.first + slots - 1;

      NUMBER_ROWS.forEach(function (r) {
        for (let s = 0; s < slots; s++) {
          sb.put(r, L.first + s, String(s + 1), { size: 8, bold: true, border: { l: 'dotted', r: 'dotted' } });
        }
      });

      for (let i = 0; i < Core.ROWS_PER_MODULE; i++) {
        const top = topRowOf(i), bottom = bottomRowOf(i);
        const label = { size: L.labelFont, bold: true, color: 'FFFFFF', fill: '7F7F7F', wrap: true,
          border: { l: 'medium', r: 'medium', t: 'medium', b: 'medium' } };
        sb.block(top, L.labelLeft, bottom, L.labelLeft, (i + 1) + ' ' + L.word, Object.assign({ rot: 90 }, label));
        sb.block(top, L.labelRight, bottom, L.labelRight, (i + 1) + ' ' + L.word, Object.assign({ rot: 180 }, label));

        const lay = sheet.rows[m][i];
        const edges = function (start, end) {
          return { l: L.first + start === L.first ? 'medium' : 'thin', r: L.first + end === last ? 'medium' : 'thin' };
        };
        const usedTop = {}, usedBottom = {};

        lay.cells.forEach(function (c) {
          if (c.start >= slots) return;
          const end = Math.min(c.end, slots - 1);
          const color = Core.colorOf(project, c.key);
          const ink = Core.textColorOf(project, c.key);
          const e = edges(c.start, end);
          if (c.second) {
            const d = diagonalText(c.top, c.second, end - c.start + 1);
            sb.block(top, L.first + c.start, top, L.first + end, d.text,
              { bold: true, text: true, fill: color, color: ink, size: d.size, wrap: true, h: 'left', border: { l: e.l, r: e.r, t: 'medium', b: 'thin', d: ink } });
          } else {
            sb.block(top, L.first + c.start, top, L.first + end, c.top,
              Object.assign({ bold: true, text: true, fill: color, color: ink, border: { l: e.l, r: e.r, t: 'medium', b: 'thin' } }, topTextStyle(c.top)));
          }
          for (let s = c.start; s <= end; s++) usedTop[s] = true;
        });
        lay.runs.forEach(function (run) {
          const e = edges(run.start, run.end);
          sb.block(bottom, L.first + run.start, bottom, L.first + run.end, run.street,
            { size: 16, bold: true, text: true, shrink: true, fill: Core.colorOf(project, run.key), color: Core.textColorOf(project, run.key), border: { l: e.l, r: e.r, b: 'medium' } });
          for (let s = run.start; s <= run.end; s++) usedBottom[s] = true;
        });
        // Slots left empty, and pigeonholes with no street, get a plain lower line.
        for (let s = 0; s < slots; s++) {
          const e = edges(s, s);
          if (!usedTop[s]) sb.put(top, L.first + s, '', { size: 20, bold: true, text: true, shrink: true, border: { l: e.l, r: e.r, t: 'medium', b: 'thin' } });
          if (!usedBottom[s]) {
            sb.put(bottom, L.first + s, '', { size: 16, bold: true, text: true, shrink: true,
              border: { l: s === 0 ? 'medium' : null, r: s === slots - 1 ? 'medium' : null, b: 'medium' } });
          }
        }
      }
    });
    return sb.xml(selected, pageBreaks(sheet));
  }

  // ------------------------------------------------------------------ workbook

  function sheetNames(sheets) {
    const used = {};
    return sheets.map(function (sh, i) {
      let n = String(sh.name || '').replace(/[\[\]:*?\/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || ('Sottozona ' + (i + 1));
      let k = n, j = 2;
      while (used[k.toUpperCase()]) { k = n.slice(0, 28) + ' ' + j++; }
      used[k.toUpperCase()] = true;
      return k;
    });
  }

  function printArea(name, sheet) {
    const q = "'" + name.replace(/'/g, "''") + "'!";
    return Core.MODULES.filter(function (m) { return sheet.modules[m]; }).map(function (m) {
      const L = LAYOUT[m];
      return q + '$' + colName(L.first) + '$4:$' + colName(L.first + Core.MODULE_SLOTS[m] - 1) + '$11';
    }).join(',');
  }

  function buildWorkbookFiles(project) {
    Core.assignColors(project);
    const styles = new StyleBook();
    const strings = new StringTable();
    const all = Core.analyseProject(project);
    const sheets = [];
    all.forEach(function (a) { a.sheets.forEach(function (sh) { sheets.push(sh); }); });
    const names = sheetNames(sheets);
    const files = [];
    sheets.forEach(function (sh, i) {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: buildSheet(project, sh, styles, strings, i === 0) });
    });
    let wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView activeTab="0"/></bookViews><sheets>';
    names.forEach(function (n, i) { wb += '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; });
    wb += '</sheets><definedNames>';
    sheets.forEach(function (sh, i) {
      const area = printArea(names[i], sh);
      if (area) wb += '<definedName name="_xlnm.Print_Area" localSheetId="' + i + '">' + esc(area) + '</definedName>';
    });
    wb += '</definedNames></workbook>';
    const n = sheets.length;
    let rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (let i = 0; i < n; i++) {
      rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }
    rels += '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId' + (n + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
      '</Relationships>';
    let types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
    for (let i = 0; i < n; i++) {
      types += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    types += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '</Types>';
    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
    return [
      { name: '[Content_Types].xml', data: types },
      { name: '_rels/.rels', data: rootRels },
      { name: 'xl/workbook.xml', data: wb },
      { name: 'xl/_rels/workbook.xml.rels', data: rels },
      { name: 'xl/styles.xml', data: styles.xml() },
      { name: 'xl/sharedStrings.xml', data: strings.xml() },
    ].concat(files);
  }

  // ------------------------------------------------------------------ zip (stored, no compression)

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files, date) {
    const enc = new TextEncoder();
    const d = date || new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const chunks = [];
    const central = [];
    let offset = 0;
    files.forEach(function (f) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), name, data);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true); cd.setUint16(12, dosTime, true);
      cd.setUint16(14, dosDate, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true);
      cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    });
    let cdSize = 0;
    central.forEach(function (c) { cdSize += c.length; });
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    let total = 0;
    all.forEach(function (c) { total += c.length; });
    const out = new Uint8Array(total);
    let p = 0;
    all.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  function buildXlsx(project, date) {
    return zip(buildWorkbookFiles(project), date);
  }

  return { GEOMETRY: GEOMETRY, LAYOUT: LAYOUT, colName: colName, buildWorkbookFiles: buildWorkbookFiles, buildXlsx: buildXlsx, crc32: crc32, zip: zip };
});

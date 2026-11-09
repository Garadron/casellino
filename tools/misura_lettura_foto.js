// © 2026 Emmanuel Surace (Garadron). Uso gratuito non commerciale: vedi LICENSE e LICENZA.md.
/*
 * Measures the photo reading (app/src/foto.js, readStrip) on strips whose right numbers are known:
 * how many numbers come out right, and how many are wrong or invented. Run it before and after
 * every change to the reading: a change is kept only if no strip gets worse.
 *
 * The strips (PNG, already cut to the strip) and the right numbers (giusti.json: name -> "1,3,5/7")
 * are private: they show real streets, so they stay in dati/prova-lettura/, never on GitHub.
 * Needs tesseract.js 5.1.1 (the same as the page) and pngjs, installed anywhere:
 *   npm install tesseract.js@5.1.1 pngjs@7      (then OCR_NM=<that folder>/node_modules)
 * Run:  OCR_NM=... node tools/misura_lettura_foto.js [dati/prova-lettura]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const NM = process.env.OCR_NM || 'node_modules';
const { PNG } = require(path.join(NM, 'pngjs'));
const T = require(path.join(NM, 'tesseract.js'));
const F = require('../app/src/foto.js');
const dir = process.argv[2] || path.join(__dirname, '..', 'dati', 'prova-lettura');
const truth = JSON.parse(fs.readFileSync(path.join(dir, 'giusti.json'), 'utf8'));

const toPng = function (band) {
  const p = new PNG({ width: band.width, height: band.height });
  p.data = Buffer.from(band.data);
  return PNG.sync.write(p);
};
const norm = function (t) { return String(t).toUpperCase().replace(/\\/g, '/').replace(/\?/g, ''); };
// how many numbers are right and in the right order (longest common subsequence)
function common(a, b) {
  const d = Array.from({ length: a.length + 1 }, function () { return new Array(b.length + 1).fill(0); });
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
  }
  return d[a.length][b.length];
}

(async function () {
  const w = await T.createWorker('ita', 1, { cachePath: path.join(NM, '..', 'lang') });
  let good = 0, all = 0, wrong = 0;
  for (const name of Object.keys(truth)) {
    const png = PNG.sync.read(fs.readFileSync(path.join(dir, name + '.png')));
    const read = await F.readStrip({ width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }, async function (band, mode, whitelist) {
      await w.setParameters({ tessedit_pageseg_mode: mode, tessedit_char_whitelist: whitelist });
      return (await w.recognize(toPng(band))).data;
    });
    const got = read.cells.map(function (c) { return norm(c.top + (c.second ? '/' + c.second : '')); });
    const want = truth[name].split(',');
    const ok = common(got, want);
    good += ok; all += want.length; wrong += got.length - ok;
    console.log(name.padEnd(18), ok + '/' + want.length, 'giusti,', got.length - ok, 'sbagliati |', got.join(' '), '|',
      read.phrases.map(function (p) { return p.text; }).join(' · '));
  }
  console.log('TOTALE', good + '/' + all, 'giusti (' + Math.round(good / all * 100) + '%),', wrong, 'sbagliati o inventati');
  await w.terminate();
})();

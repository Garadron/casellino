// Builds the .xlsx from a project text file (same format as "Esporta testo").
// Usage: node tools/genera_excel.js <project.txt> <output.xlsx>
'use strict';
const fs = require('fs');
const Core = require('../app/src/core.js');
const Xlsx = require('../app/src/xlsx.js');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Uso: node tools/genera_excel.js <progetto.txt> <uscita.xlsx>');
  process.exit(2);
}
const project = Core.textToProject(fs.readFileSync(input, 'utf8'));
fs.writeFileSync(output, Xlsx.buildXlsx(project));
console.log('Creato ' + output);

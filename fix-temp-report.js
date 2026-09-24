const fs = require('fs');
const path = 'apps/api/src/inventory-counting/inventory-counting.service.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace method signature
code = code.replace(
  /async generateTemporaryReport\(id: string, tolerance: number = 0\): Promise<Buffer> \{/,
  'async generateTemporaryReport(id: string): Promise<Buffer> {'
);
code = code.replace(
  /\`Generating Temporary Report for inventory counting: ID=\\?\${id}, Tolerance=\\?\${tolerance}%\`/,
  '\`Generating Temporary Report for inventory counting: ID=\${id}\`'
);

code = code.replace(
  /worksheet\.getCell\('G6'\)\.value = 'Tolerance %';\s+worksheet\.getCell\('H6'\)\.value = \`: \\\${tolerance}%\`;/,
  `worksheet.getCell('G6').value = 'Tolerance %';
      worksheet.getCell('H6').value = \`: \${inventoryCounting.Tolerance ?? 5}%\`;`
);

code = code.replace(
  /message: \\\`Temporary Report generated with tolerance \\\${tolerance}%\\\`/,
  'message: `Temporary Report generated`'
);

// Replace calculateDiffPctAndStatus function and logic
const oldCalcStart = code.indexOf('const calculateDiffPctAndStatus');
const oldCalcEnd = code.indexOf('if (isMaterial) {', oldCalcStart);

if (oldCalcStart > -1 && oldCalcEnd > -1) {
  const newCalc = `      const calculateDiffPctAndStatus = (sys: number, act: number) => {
        const tolerance = inventoryCounting.Tolerance ?? 5;
        const diff = act - sys;
        if (diff < 0) {
          return { diffPct: 'Minus', status: 'Tidak Memenuhi', isMinus: true };
        }
        let diffPct = 0;
        if (sys === 0) {
          diffPct = act > 0 ? 100 : 0;
        } else {
          diffPct = (diff / sys) * 100;
        }
        const status = diffPct <= tolerance ? 'Memenuhi' : 'Tidak Memenuhi';
        return { diffPct: diffPct.toFixed(2) + '%', status, isMinus: false };
      };

      `;
  code = code.substring(0, oldCalcStart) + newCalc + code.substring(oldCalcEnd);
}

// Now replace the cell styling inside the Material loop
const oldMaterialStyleRegex = /if \(colNumber === 8 \|\| colNumber === 13\) \{[\s\S]*?\}/g;
let match = oldMaterialStyleRegex.exec(code);
if (match) {
  const newStyle = `if (colNumber === 8 || colNumber === 13) {
                const statusVal = cell.value;
                const isMemenuhi = statusVal === 'Memenuhi';
                const diffVal = colNumber === 8 ? row.getCell(6).value : row.getCell(11).value;
                const isMinus = typeof diffVal === 'number' && diffVal < 0;
                
                if (isMinus) {
                    cell.font = { color: { argb: 'FFFF0000' }, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                } else if (isMemenuhi) {
                    cell.font = { color: { argb: 'FF000000' }, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
                } else {
                    cell.font = { color: { argb: 'FF000000' }, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } };
                }
            }`;
  code = code.substring(0, match.index) + newStyle + code.substring(match.index + match[0].length);
}

// Now replace the cell styling inside the FinishGood loop
const oldFgStyleRegex = /if \(colNumber === 9\) \{[\s\S]*?\}/g;
let fgMatch = oldFgStyleRegex.exec(code);
if (fgMatch) {
  const newStyle = `if (colNumber === 9) {
                const statusVal = cell.value;
                const isMemenuhi = statusVal === 'Memenuhi';
                const diffVal = row.getCell(7).value;
                const isMinus = typeof diffVal === 'number' && diffVal < 0;
                
                if (isMinus) {
                    cell.font = { color: { argb: 'FFFF0000' }, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                } else if (isMemenuhi) {
                    cell.font = { color: { argb: 'FF000000' }, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
                } else {
                    cell.font = { color: { argb: 'FF000000' }, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } };
                }
            }`;
  code = code.substring(0, fgMatch.index) + newStyle + code.substring(fgMatch.index + fgMatch[0].length);
}

fs.writeFileSync(path, code);
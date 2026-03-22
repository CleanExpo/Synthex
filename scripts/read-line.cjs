const fs = require('fs');
const file = process.argv[2];
const start = parseInt(process.argv[3], 10);
const count = parseInt(process.argv[4], 10) || 20;
const lines = fs.readFileSync(file, 'utf8').split('\n');
for (let i = start - 1; i < Math.min(start - 1 + count, lines.length); i++) {
  console.log(i + 1 + ': ' + lines[i]);
}

const readline = require('readline');
const m = {};
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (l) => {
  const x = l.match(/^(.+?)\(\d+,\d+\): error TS/);
  if (x) {
    const f = x[1];
    m[f] = (m[f] || 0) + 1;
  }
});
rl.on('close', () => {
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .forEach(([f, c]) => console.log(c + ' ' + f));
});

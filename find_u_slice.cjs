const fs = require('fs');
const path = require('path');
const distAssets = path.join(__dirname, 'dist/assets');
const jsFile = fs.readdirSync(distAssets).find(f => f.endsWith('.js'));
const text = fs.readFileSync(path.join(distAssets, jsFile), 'utf8');

const regex = /u\.slice/g;
let match;
while ((match = regex.exec(text)) !== null) {
  const start = Math.max(0, match.index - 50);
  const end = Math.min(text.length, match.index + 50);
  console.log('Match at', match.index, ':', text.substring(start, end));
}
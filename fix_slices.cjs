const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/engine/raf-engine.ts');
let content = fs.readFileSync(file, 'utf8');

// We want to replace anything that looks like `foo?.slice` or `foo.bar?.slice` or `foo[1]?.slice` 
// with `String(foo || '')?.slice`. But it's easier to just do it manually for the variables we know.
// Let's replace ?.slice with ?.slice but wrap the identifier.
// Wait, `execR.text?.slice` => `String(execR.text || '')?.slice`

const regex = /([a-zA-Z0-9_\.\[\]]+)\?\.slice\(/g;
content = content.replace(regex, (match, p1) => {
  return `String(${p1} || '')?.slice(`;
});

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed slice calls in raf-engine.ts');

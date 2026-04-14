const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'node_modules/react-dom/cjs/react-dom.production.min.js');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');
const line = lines[25]; // index 25 is line 26
console.log(line.substring(400, 450));
console.log("Context around 424:", line.substring(400, 500));
const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'src/engine/raf-engine.ts'),
  path.join(__dirname, 'src/App.tsx'),
  path.join(__dirname, 'src/components/ExecutionGraph.tsx'),
  path.join(__dirname, 'src/services/chatjimmy.ts')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace .slice( with ?.slice( ONLY if it's preceded by a word character or closing parenthesis/bracket
  // Be careful with object properties like Math.random().toString(36).slice(2, 7)
  // Actually, doing a global replace of .slice( to ?.slice( is safe in modern TS/JS as long as the left side is an expression.
  
  // Replace all `.slice(` with `?.slice(` EXCEPT where it already is `?.slice(`
  content = content.replace(/(?<!\?)\.slice\(/g, '?.slice(');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Processed', file);
}

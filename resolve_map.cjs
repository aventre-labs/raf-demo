const fs = require('fs');
const sourceMap = require('source-map');

async function run() {
  const mapFile = fs.readdirSync('./dist/assets').find(f => f.endsWith('.js.map'));
  const mapPath = './dist/assets/' + mapFile;
  const jsFile = mapPath.replace('.js.map', '.js');
  
  const rawMap = fs.readFileSync(mapPath, 'utf8');
  const consumer = await new sourceMap.SourceMapConsumer(rawMap);
  
  const jsContent = fs.readFileSync(jsFile, 'utf8');
  
  let regex = /([a-zA-Z0-9_])\.slice/g;
  let match;
  while ((match = regex.exec(jsContent)) !== null) {
    if (match[1] === 'u') {
      const pos = consumer.originalPositionFor({
        line: 1, // minified is usually 1 line
        column: match.index
      });
      console.log(`u.slice at JS col ${match.index} maps to ${pos.source}:${pos.line}:${pos.column} (name: ${pos.name})`);
    }
  }
}
run();
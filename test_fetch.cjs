const fetch = require('node-fetch');

async function test() {
  const start = Date.now();
  console.log('Sending request...');
  try {
    const res = await fetch('https://aventre-labs.github.io/api/raf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem: 'Count from 1 to 100 very slowly.' })
    });
    
    console.log('Response status:', res.status);
    // ... wait, the API is hosted via GitHub Pages interceptor!
  } catch (e) {
    console.log('Error:', e.message);
  }
}
test();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('https://aventre-labs.github.io/raf-demo/');
  await page.waitForLoadState('networkidle');

  console.log('Page loaded. Clicking a benchmark...');
  // Wait for the 'Benchmarks' tab to be visible
  await page.waitForSelector('text=Benchmarks');
  await page.click('text=Benchmarks');
  await page.waitForTimeout(500);
  
  const benchBtns = await page.$$('button:has-text("→")');
  if (benchBtns.length > 0) {
    await benchBtns[0].click();
    console.log('Benchmark clicked. Waiting for results...');
    
    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('✓ Solved') || text.includes('✗ Failed') || text.includes('Run Ended') || text.includes('Hit 5000 LLM call limit');
      }, { timeout: 120000 });
      console.log('Result found or run ended!');
    } catch (e) {
      console.log('Timeout waiting for result:', e.message);
    }
  } else {
    console.log('No benchmark buttons found.');
  }

  await browser.close();
})();

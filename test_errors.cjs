const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  await page.goto('https://aventre-labs.github.io/raf-demo/');
  await page.waitForLoadState('networkidle');

  await page.waitForSelector('text=Benchmarks');
  await page.click('text=Benchmarks');
  await page.waitForTimeout(500);
  
  const benchBtns = await page.$$('button:has-text("→")');
  if (benchBtns.length > 0) {
    await benchBtns[0].click();
    console.log('Benchmark clicked. Waiting...');
    
    // Check periodically for "Run Ended" or "Solved"
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('Run Ended') || text.includes('Solved') || text.includes('Failed')) {
        console.log('Run stopped!');
        const textToLog = await page.evaluate(() => {
          const el = document.querySelector('.border-amber-500\\/30, .border-green-500\\/30, .border-red-500\\/30');
          return el ? el.innerText : '';
        });
        console.log('Final UI State:', textToLog);
        break;
      }
    }
  }

  await browser.close();
})();

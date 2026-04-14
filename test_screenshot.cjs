const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('https://aventre-labs.github.io/raf-demo/');
  await page.waitForLoadState('networkidle');

  await page.waitForSelector('text=Benchmarks');
  await page.click('text=Benchmarks');
  await page.waitForTimeout(500);
  
  const benchBtns = await page.$$('button:has-text("→")');
  if (benchBtns.length > 0) {
    await benchBtns[0].click();
    console.log('Benchmark clicked. Waiting 5 seconds...');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/data/workspace/projects/raf-demo/screenshot1.png' });
    console.log('Screenshot 1 taken.');
    await page.waitForTimeout(15000);
    await page.screenshot({ path: '/data/workspace/projects/raf-demo/screenshot2.png' });
    console.log('Screenshot 2 taken.');
  }

  await browser.close();
})();

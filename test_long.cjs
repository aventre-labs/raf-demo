const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('https://aventre-labs.github.io/raf-demo/');
  await page.waitForLoadState('networkidle');

  await page.waitForSelector('text=Benchmarks');
  await page.click('text=Benchmarks');
  await page.waitForTimeout(500);
  
  const benchBtns = await page.$$('button:has-text("→")');
  if (benchBtns.length > 0) {
    await benchBtns[0].click();
    console.log('Benchmark clicked. Waiting up to 120s for completion...');
    
    let resultFound = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('✓ Solved') || text.includes('✗ Failed') || text.includes('Run Ended')) {
        console.log('--- FOUND END STATE ---');
        if (text.includes('Run Ended')) {
          console.log('Error found:');
          const errMatch = text.match(/Run Ended\n(.*)/);
          console.log(errMatch ? errMatch[1] : 'Unknown error');
        }
        resultFound = true;
        break;
      }
    }
    
    if (!resultFound) {
      console.log('Timed out waiting for run to finish.');
    }
  }

  await browser.close();
})();

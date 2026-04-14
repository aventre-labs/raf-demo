import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        
        page.on("console", lambda msg: print(f"Console: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))
        page.on("requestfailed", lambda req: print(f"Request failed: {req.url} {req.failure}"))
        
        await page.goto("https://aventre-labs.github.io/raf-demo/")
        await page.wait_for_load_state("networkidle")
        
        # Type into textarea
        await page.fill("textarea", "What is 2 + 2?")
        
        # Click the 'Run RAF Pipeline' button
        print("Clicking 'Run RAF Pipeline'...")
        await page.click("button:has-text('Run RAF Pipeline')")
        
        # Wait and see if an error happens or request is sent
        await asyncio.sleep(5)
        
        await browser.close()

asyncio.run(main())

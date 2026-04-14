import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        
        page.on("console", lambda msg: print(f"Console: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))
        page.on("requestfailed", lambda req: print(f"Request failed: {req.url} {req.failure}"))
        
        print("Navigating to site...")
        response = await page.goto("https://aventre-labs.github.io/raf-demo/")
        print(f"Status: {response.status}")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2) # let react render
        
        await browser.close()

asyncio.run(main())

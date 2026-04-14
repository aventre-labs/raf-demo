import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        await page.goto("https://aventre-labs.github.io/raf-demo/")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        await page.screenshot(path="/data/workspace/projects/raf-demo/screenshot.png")
        await browser.close()

asyncio.run(main())

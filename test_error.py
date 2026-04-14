import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        
        await page.goto("https://aventre-labs.github.io/raf-demo/")
        await page.wait_for_load_state("networkidle")
        
        await page.fill("textarea", "What is 2 + 2?")
        await page.click("button:has-text('Run RAF Pipeline')")
        
        # Wait for either result or error
        try:
            await page.wait_for_selector(".bg-amber-500\\/5, .border-green-500\\/30", timeout=15000)
            content = await page.evaluate("document.querySelector('.bg-amber-500\\\\/5')?.innerText || document.querySelector('.border-green-500\\\\/30')?.innerText || 'No error/result found'")
            print("UI state:", content)
        except Exception as e:
            print("Timeout waiting for result:", e)
            
        await browser.close()

asyncio.run(main())

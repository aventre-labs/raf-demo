import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        
        page.on("console", lambda msg: print(f"Console: {msg.type}: {msg.text}"))
        
        async def handle_response(response):
            print(f"Response: {response.url} - {response.status}")
            if "api" in response.url or "chatjimmy" in response.url:
                try:
                    body = await response.text()
                    print(f"API Response Body: {body[:200]}")
                except Exception as e:
                    print(f"Could not read body: {e}")
                    
        page.on("response", handle_response)
        
        await page.goto("https://aventre-labs.github.io/raf-demo/")
        await page.wait_for_load_state("networkidle")
        
        # Type into textarea
        await page.fill("textarea", "What is 2 + 2?")
        
        print("Clicking 'Run RAF Pipeline'...")
        await page.click("button:has-text('Run RAF Pipeline')")
        
        # Wait to let request happen
        await asyncio.sleep(5)
        
        await browser.close()

asyncio.run(main())
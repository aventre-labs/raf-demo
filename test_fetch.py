import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        
        page.on("console", lambda msg: print(f"Console [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))
        
        await page.goto("https://aventre-labs.github.io/raf-demo/")
        await page.wait_for_load_state("networkidle")
        
        print("Executing fetch...")
        result = await page.evaluate("""async () => {
            try {
                const res = await fetch("/api/raf", { 
                    method: "POST", 
                    headers: { "x-raf-jury-size": "3", "Content-Type": "application/json" }, 
                    body: JSON.stringify({ problem: "What is 2+2?" }) 
                });
                if (!res.ok) return "Fetch error: " + res.status;
                const reader = res.body.getReader();
                const { value, done } = await reader.read();
                return "First chunk: " + new TextDecoder().decode(value);
            } catch (e) {
                return "Exception: " + e.message;
            }
        }""")
        print(f"Eval result: {result}")
        await browser.close()

asyncio.run(main())

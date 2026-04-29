// Renders design HTML files to PNG using bundled headless Chromium (puppeteer).
// Used as a fallback when /Applications/Google Chrome.app is not accessible.
// Equivalent to:
//   "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
//     --window-size=W,H --screenshot=out/foo.png file://...

import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const tasks = [
  { html: "logo.html",      out: "out/logo.png",      width: 600,  height: 600  },
  { html: "thumbnail.html", out: "out/thumbnail.png", width: 1932, height: 828  },
];

const CHROME_BIN = resolve(
  __dirname,
  ".chromium/chrome/mac_arm-149.0.7814.0/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
);

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: CHROME_BIN,
  args: ["--hide-scrollbars", "--disable-gpu"],
});

try {
  for (const t of tasks) {
    const page = await browser.newPage();
    await page.setViewport({
      width: t.width,
      height: t.height,
      deviceScaleFactor: 1,
    });
    const url = "file://" + resolve(__dirname, t.html);
    await page.goto(url, { waitUntil: "networkidle0" });
    // Match headless Chrome's --screenshot behavior: full viewport, no clipping.
    const outPath = resolve(__dirname, t.out);
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: t.width, height: t.height },
      omitBackground: false,
    });
    console.log(`wrote ${outPath} (${t.width}x${t.height})`);
    await page.close();
  }
} finally {
  await browser.close();
}

/**
 * Headless probe: JS execution + React mount on a deployed/preview URL.
 * Usage: node scripts/probe-white-screen.mjs [url]
 */
import { chromium } from 'playwright';

const url = (process.argv[2] || 'https://transpak-frontend.pages.dev').replace(/\/$/, '');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', async (msg) => {
    if (msg.type() !== 'error') return;
    const parts = [];
    for (const arg of msg.args()) {
      try {
        parts.push(await arg.jsonValue());
      } catch {
        parts.push(msg.text());
      }
    }
    consoleErrors.push(parts.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(' '));
  });
  page.on('pageerror', (err) => pageErrors.push(`${err?.message || err}\n${err?.stack || ''}`));

  const failed = [];
  page.on('requestfailed', (req) => {
    failed.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || 'failed'}`);
  });

  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);

  const rootHtml = await page.locator('#root').innerHTML().catch(() => '');
  const rootText = (await page.locator('#root').innerText().catch(() => '')).trim();
  const title = await page.title();

  console.log('URL:', url);
  console.log('HTTP:', res?.status());
  console.log('Title:', title);
  console.log('Root innerHTML length:', rootHtml.length);
  console.log('Root visible text length:', rootText.length);
  console.log('Root text preview:', rootText.slice(0, 120) || '(empty)');
  console.log('Console errors:', consoleErrors.length ? consoleErrors.slice(0, 5) : '(none)');
  console.log('Page errors:', pageErrors.length ? pageErrors.slice(0, 5) : '(none)');
  console.log('Failed requests:', failed.length ? failed.slice(0, 8) : '(none)');

  const ok = Boolean(rootText.length > 0) && pageErrors.length === 0;
  console.log(ok ? '\nRESULT: MOUNT OK' : '\nRESULT: WHITE SCREEN / CRASH');
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('PROBE FAILED:', e.message);
  process.exit(2);
});

// Screenshots for docs/guide, from the production build served by `pnpm preview` (port 4173).
// Firefox, English, muted. Run by hand when the interface changes: `node scripts/screenshots.mjs`.
// Needs Playwright (not a dependency of the project): set PLAYWRIGHT to the path of its index.mjs.

const { firefox } = await import(process.env.PLAYWRIGHT ?? '@playwright/test');

const url = process.env.URL ?? 'http://127.0.0.1:4173/';
const out = 'docs/guide/img/';
const browser = await firefox.launch({ firefoxUserPrefs: { 'media.volume_scale': '0.0' } });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })).newPage();

await page.goto(url);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}new-game.png` });

await page.getByRole('button', { name: 'Hard', exact: true }).click();
await page.getByRole('button', { name: 'Start Hard' }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}board.png` });

await page.keyboard.press('h');
await page.waitForTimeout(2500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}hint-2.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}hint-3.png` });
await page.keyboard.press('Escape');

await page.getByRole('link', { name: 'Stats' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}stats.png` });
await page.getByRole('link', { name: 'Settings' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}settings.png` });

await browser.close();

# Headless recipe (subagents, and batch checks)

Write a throwaway check module in your scratchpad and run it through `scripts/run-check.mjs`. The runner launches Chromium from the project's own Playwright install, accepts Warden's certificate, loads the module's `.env`, collects console errors and failed requests, screenshots on failure, and prints one JSON report.

## 1. Find the install

```bash
find <project-root> -maxdepth 8 -path '*/tests/playwright/node_modules/@playwright/test' -not -path '*/vendor/*' | head -1
```

`PW` is the `tests/playwright` directory above that match. `vendor/` symlinks into `local-src/`, hence the exclusion. If no module has `node_modules`, pick one `tests/playwright` and run `npm ci && npx playwright install chromium` there.

Confirm `PW/.env` exists and names the URLs, without printing the values:

```bash
cut -d= -f1 "$PW/.env"
```

Expected keys: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_ADMIN_URL`, `PLAYWRIGHT_ADMIN_USERNAME`, `PLAYWRIGHT_ADMIN_PASSWORD`. Missing file: copy `.env.sample` and fill it from the env's `.env` (`TRAEFIK_SUBDOMAIN.TRAEFIK_DOMAIN`) and the project's CLAUDE.md.

## 2. Write the check module

`<scratchpad>/check.mjs` exports one default async function and returns whatever the report should carry. Throw, or fail an `expect`, to fail. `expect` arrives preconfigured with a 15s timeout; the module needs no imports.

Storefront:

```js
export default async ({ page, expect, baseUrl }) => {
    await page.goto(`${baseUrl}living-room.html?v=${Date.now()}`);
    await page.waitForFunction(() => window.Alpine && window.hyva);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.product-item').first()).toBeVisible();
    return { products: await page.locator('.product-item').count() };
};
```

Admin (run with `--admin`; `adminLink` returns the secret-keyed href from the menu):

```js
export default async ({ page, expect, adminLink }) => {
    await page.goto(await adminLink('cms/page'));
    await expect(page.getByRole('heading', { name: 'Pages' })).toBeVisible();
    await expect(page.locator('.data-grid tbody tr').first()).toBeVisible();
    return { rows: await page.locator('.data-grid tbody tr').count() };
};
```

The function also receives `context`, `browser`, `adminUrl`, `env` (the `.env` values), and `login(page)` for a second page.

## 3. Run it

```bash
node <skill-dir>/scripts/run-check.mjs --pw "$PW" --check check.mjs --out out
```

| Option | Effect |
|---|---|
| `--admin` | Log in to the admin first |
| `--viewport 390x844` | Phone width (default `1280x800`) |
| `--no-js` | JavaScript disabled, for progressive-enhancement checks |
| `--screenshot always` | Screenshot on success as well as failure |
| `--timeout 90000` | Whole-check budget in ms (default 60000) |

This Bash call runs with the sandbox off (see Sandbox in SKILL.md for why and for the permanent settings fix). Exit code 0 is a pass, 1 a failed check, 2 a setup problem whose message says what to fix.

## 4. Read the report

`ok`, `result` (your return value), `error` (the first lines of the stack), `finalUrl`, `consoleErrors`, `pageErrors`, `failedRequests`, `screenshot`. Console and network arrays are the part a passing `expect` misses: a page that renders but logs an Alpine error or a 500 on an XHR is a fail, and your report says so.

## Gotchas

- **Hydration**: assert after `page.waitForFunction(() => window.Alpine)`, and prefer locators (auto-waiting) over `page.$`.
- **Full-page cache**: every storefront URL gets `?v=${Date.now()}` or the check reads the old template.
- **Admin grids** render through the secret-keyed URL from `adminLink`; a bare `/admin/cms/page/` lands on the dashboard and every locator times out.
- **Editor checks** (Hyvä CMS Liveview) live inside `#liveview-preview-canvas-iframe`; use `page.frameLocator(...)`. When a check needs the suite's helpers, write a spec into the scratchpad instead and run the project runner: `PLAYWRIGHT_TEST_DIR=<scratchpad> npx playwright test --config "$PW/playwright.config.js"`. The blog, menu-builder and form-builder configs read that variable and their `setup` project logs in for you; `grep PLAYWRIGHT_TEST_DIR "$PW/playwright.config.js"` before relying on it elsewhere.
- **Shared instance**: other agents may be writing to the same store. Create what you need with unique names, and never assert on counts you did not seed.

## Return to the orchestrator

At most 15 lines: URL and viewport checked, login state, each assertion as pass or fail, the screenshot path on failure, and console or network errors verbatim (trimmed). A check that could not run is reported as not verified with the exit code and the first error line.

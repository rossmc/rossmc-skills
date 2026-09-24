#!/usr/bin/env node
// Run one throwaway browser check against a Warden Magento storefront or admin, using the
// project's own Playwright install. Prints a JSON report and exits 0 on pass, 1 on fail.
//
//   node run-check.mjs --pw <tests/playwright dir> --check <check.mjs> [options]
//
//   --pw <dir>          directory holding node_modules/@playwright/test and a .env
//                       (or set BROWSER_CHECK_PW_DIR)
//   --check <file>      module whose default export is
//                       async ({ page, context, browser, expect, baseUrl, adminUrl, env, login, adminLink }) => result
//   --admin             log in to the admin before the check runs
//   --no-js             disable JavaScript (progressive-enhancement checks)
//   --viewport WxH      default 1280x800; 390x844 for a phone
//   --out <dir>         where screenshots land, default ./browser-check-out
//   --screenshot always take a screenshot on success too (default: on failure only)
//   --timeout <ms>      whole-check budget, default 60000
//
// The report lists console errors, page errors and 4xx/5xx responses seen during the check, so a
// green page with a red console still reads as a failure. Throw, or fail an expect, to fail.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = parseArgs(process.argv.slice(2));
const pwDir = path.resolve(args.pw ?? process.env.BROWSER_CHECK_PW_DIR ?? '');
const checkPath = args.check && path.resolve(args.check);
const outDir = path.resolve(args.out ?? 'browser-check-out');
const [width, height] = (args.viewport ?? '1280x800').split('x').map(Number);
const timeout = Number(args.timeout ?? 60000);

if (!checkPath || !existsSync(checkPath)) {
    die(`--check must name an existing module (got ${args.check ?? 'nothing'})`);
}
const pwPackage = path.join(pwDir, 'node_modules', '@playwright', 'test');
if (!existsSync(pwPackage)) {
    die(
        `No Playwright install at ${pwPackage}.\n`
        + `Pass --pw <dir> pointing at a tests/playwright directory that has node_modules, e.g.\n`
        + `  find <project> -path '*/tests/playwright/node_modules/@playwright/test' -not -path '*/vendor/*'\n`
        + `or install one there:  npm ci && npx playwright install chromium`,
    );
}

const require = createRequire(path.join(pwDir, 'package.json'));
const { chromium, expect: baseExpect } = require('@playwright/test');
// Storefront round-trips are slow under a cold full-page cache; 5s (the default) fails good pages.
const expect = baseExpect.configure({ timeout: 15000 });

const env = { ...readDotEnv(path.join(pwDir, '.env')), ...process.env };
const baseUrl = (env.PLAYWRIGHT_BASE_URL ?? '').replace(/\/?$/, '/');
if (!baseUrl.startsWith('http')) {
    die(`PLAYWRIGHT_BASE_URL is not set. Put it in ${path.join(pwDir, '.env')} or the environment.`);
}
const adminUrl = (env.PLAYWRIGHT_ADMIN_URL ?? `${baseUrl}admin/`).replace(/\/?$/, '/');

mkdirSync(outDir, { recursive: true });

const report = {
    ok: false,
    check: checkPath,
    baseUrl,
    viewport: `${width}x${height}`,
    admin: Boolean(args.admin),
    javascript: !args['no-js'],
    result: null,
    error: null,
    finalUrl: null,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshot: null,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    // Warden's CA is not in Chromium's trust store, so the dev cert reads as invalid.
    ignoreHTTPSErrors: true,
    viewport: { width, height },
    javaScriptEnabled: !args['no-js'],
});
context.setDefaultTimeout(15000);
const page = await context.newPage();

page.on('console', (m) => {
    if (m.type() === 'error') push(report.consoleErrors, `${m.text()} @ ${m.location().url}`);
});
page.on('pageerror', (e) => push(report.pageErrors, e.message));
page.on('response', (r) => {
    if (r.status() >= 400) push(report.failedRequests, `${r.status()} ${r.request().method()} ${r.url()}`);
});
page.on('requestfailed', (r) => {
    push(report.failedRequests, `${r.failure()?.errorText ?? 'failed'} ${r.method()} ${r.url()}`);
});

async function login(target = page) {
    const user = env.PLAYWRIGHT_ADMIN_USERNAME;
    const pass = env.PLAYWRIGHT_ADMIN_PASSWORD;
    if (!user || !pass) {
        throw new Error(`Admin login needs PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD in ${path.join(pwDir, '.env')}`);
    }
    await target.goto(adminUrl);
    await target.getByRole('textbox', { name: 'Username' }).fill(user);
    await target.getByRole('textbox', { name: 'Password' }).fill(pass);
    await target.getByRole('button', { name: 'Sign in' }).click();
    await expect(target.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 30000 });
}

// Admin URLs carry a secret key; a typed deep link without one bounces to the dashboard. Take the
// keyed href from the admin menu instead. `fragment` is the route, e.g. 'cms/page' or 'catalog/product'.
async function adminLink(fragment, target = page) {
    if (!target.url().startsWith(adminUrl)) await target.goto(adminUrl);
    const href = await target.locator(`#nav a[href*="/${fragment.replace(/^\/|\/$/g, '')}/"]`).first().getAttribute('href');
    if (!href) throw new Error(`No admin menu link matching "${fragment}"`);
    return href;
}

const budget = setTimeout(() => {
    report.error = `Check exceeded ${timeout}ms`;
    finish(1);
}, timeout);

try {
    if (args.admin) await login();
    const mod = await import(pathToFileURL(checkPath).href);
    const check = mod.default;
    if (typeof check !== 'function') throw new Error(`${checkPath} has no default export function`);
    report.result = await check({ page, context, browser, expect, baseUrl, adminUrl, env, login, adminLink });
    report.ok = true;
} catch (e) {
    report.error = String(e?.stack ?? e).split('\n').slice(0, 12).join('\n');
}

if (!report.ok || args.screenshot === 'always') {
    report.screenshot = path.join(outDir, report.ok ? 'check.png' : 'failure.png');
    try {
        await page.screenshot({ path: report.screenshot, fullPage: true });
    } catch (e) {
        report.screenshot = `screenshot failed: ${e.message}`;
    }
}

await finish(report.ok ? 0 : 1);

async function finish(code) {
    clearTimeout(budget);
    try { report.finalUrl = page.url(); } catch {}
    console.log(JSON.stringify(report, null, 2));
    await browser.close().catch(() => {});
    process.exit(code);
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const key = a.slice(2);
        const next = argv[i + 1];
        if (['admin', 'no-js'].includes(key)) out[key] = true;
        else if (key === 'screenshot') out[key] = next && !next.startsWith('--') ? argv[++i] : 'always';
        else out[key] = argv[++i];
    }
    return out;
}

function readDotEnv(file) {
    if (!existsSync(file)) return {};
    const vars = {};
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        vars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    }
    return vars;
}

function push(list, item) {
    if (list.length < 20) list.push(String(item).slice(0, 300));
}

function die(msg) {
    console.error(msg);
    process.exit(2);
}

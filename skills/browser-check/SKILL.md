---
name: browser-check
description: Verify, debug, or research Hyvä storefront and admin changes in a real browser against a Warden Magento environment, choosing between the Playwright MCP (main session only) and a headless Playwright script (every subagent), with the recipe for each. Use when asked to verify in the browser, check on the storefront, confirm the change works, debug with Playwright, research in the browser, or see what a page actually renders, and whenever a parallel-orchestration plan includes browser verification or a subagent is told to check a page.
---

# Browser check

Decide who drives which browser, then run that recipe. Read this file, then one reference: [`references/mcp.md`](references/mcp.md) if you are the main session, [`references/headless.md`](references/headless.md) if you are a subagent or were told to write a script.

## Decision rule

The Playwright MCP is one shared Chrome profile. Every `mcp__playwright__browser_*` call from every agent in the session lands in the same browser, so two drivers overwrite each other's tab, share cookies and login state, and a second server on the profile fails to launch. One driver, therefore:

- **The main session** drives the MCP: the composition check after agents return, exploratory admin work, and any check where you need to look (snapshot, screenshot, console, network) before you know what to assert.
- **Every subagent** writes a throwaway check module in its scratchpad and runs it headless through [`scripts/run-check.mjs`](scripts/run-check.mjs) on the project's own Playwright install. The MCP browser tools are off limits to subagents even though they appear in the tool list. Say so in every agent prompt that includes a browser step; the agent has no other way to know.

Repetitive main-session checks (five pages, three viewports) also go headless: one script, one report, none of the per-call round trips.

## Warden facts both branches need

- **Base URL** is `https://<TRAEFIK_SUBDOMAIN>.<TRAEFIK_DOMAIN>` from the env's `.env`, `https://app.<env>.test` in practice.
- **Admin** is `<base>/<backend.frontName>/` from `app/etc/env.php`, `admin` in every local env. Secret keys are on: a typed deep link without `/key/...` bounces to the dashboard, so after login take the href from the admin menu.
- **Credentials** live in a module's `tests/playwright/.env` (`PLAYWRIGHT_ADMIN_USERNAME`, `PLAYWRIGHT_ADMIN_PASSWORD`) or the project's CLAUDE.md; `playwright` is the local test user. Read them into the browser, never into the transcript.
- **Certificate**: Warden's CA is not in Chromium's trust store, so every context needs `ignoreHTTPSErrors: true`.
- **Caches**: full-page cache serves the template you just replaced. Append a unique query param (`?v=<timestamp>`) or flush with `warden env exec -T php-fpm bin/magento cache:flush`. A Tailwind class missing from the compiled CSS renders unstyled; recompile (hyva-compile-tailwind-css skill).
- **Logs**: `var/` is usually not on the host (Mutagen sync drops it). `warden env exec -T php-fpm tail -50 var/log/exception.log`.
- **Sandbox**: the Bash sandbox denies `*.test` hosts, the Chromium bundle under `~/Library/Caches/ms-playwright`, Node's OpenSSL config under `/System`, and the Docker socket. A browser script that fails with `icudtl.dat not found`, an OpenSSL `BIO_new_file` error, or a network deny, and any `warden env exec` that fails to reach Docker, is the sandbox: rerun that one call with the sandbox off. The permanent fix, per the sandbox settings docs, is `sandbox.network.allowedDomains: ["*.test"]`, `sandbox.filesystem.allowRead: ["~/Library/Caches/ms-playwright", "/System/Library/OpenSSL"]` and `sandbox.excludedCommands: ["warden *", "docker *"]` in settings.json.

## What to look at on a Hyvä page

- The change itself. A healthy page proves nothing about your edit: find the changed markup, class or text in the served page, and when it is absent check theme assignment and caches before you report.
- Console errors and 4xx/5xx responses on every page you touch, not only the one you changed. A green page with a red console fails.
- Alpine: `window.Alpine` and `window.hyva` are defined and the console has no `Alpine Expression Error`. Assert rendered state (`Alpine.$data(el)`, visible text) rather than template markup.
- CSP: `Refused to execute inline script` or `Refused to apply inline style` means the change broke Hyvä's CSP compatibility (hyva-alpine-component skill).
- Admin XHR failing with `SyntaxError: Unexpected token '<'` means Magento answered with an HTML exception page; read `exception.log`.
- Mobile first: anything layout-related is checked at 390 wide as well as desktop.
- Progressive enhancement: pagination, filters and forms get one pass with JavaScript disabled.

## Report

Every planned assertion ends as pass or fail with evidence: URL, viewport, login state, and a screenshot path or console excerpt. A check that could not run (env down, sandbox denied, login failed) is **not verified**, never passed. Subagents return at most 15 lines.

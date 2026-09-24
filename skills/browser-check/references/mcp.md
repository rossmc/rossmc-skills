# Playwright MCP recipes (main session)

The tools are `mcp__playwright__browser_*`. The server is `npx -y @playwright/mcp@latest` with its default persistent profile, so logins and cookies survive from one session to the next.

## Per page

1. `browser_navigate` to `<url>?v=<timestamp>`. The query param defeats full-page cache.
2. `browser_snapshot` for the accessibility tree with element refs. It is what click and fill target, and far cheaper than pixels. Take `browser_take_screenshot` only when layout or styling is the question.
3. `browser_console_messages` and `browser_network_requests`. Scan for errors, `Alpine Expression Error`, CSP refusals, and 4xx/5xx responses.
4. Record the verdict with evidence before moving to the next page. One page at a time keeps the snapshot you are reasoning about current.

## Admin

`browser_navigate` to the admin URL, `browser_fill_form` with the Username and Password fields, click Sign in from the snapshot ref, and wait for the Dashboard heading. The session persists for the rest of the conversation, so later navigations land authenticated. Reach admin pages by clicking the menu, because typed URLs without the secret key bounce to the dashboard. A stale login from an earlier session is normal: check the snapshot before logging in again.

## Viewports

`browser_resize` to 390×844, snapshot or screenshot, then back to 1280×800. Hyvä is mobile first, so a layout change is unverified until the narrow pass is done.

## State and batches

- `browser_evaluate` reads live state: `() => Alpine.$data(document.querySelector('[x-data]'))`, `() => window.hyva.getFormKey()`, `() => typeof window.Alpine`.
- `browser_run_code_unsafe` runs a Playwright snippet `async (page) => { ... }` in one call. Reach for it when a check would otherwise take more than three tool calls in a row.
- `browser_handle_dialog` for confirms and alerts, `browser_tabs` to list and close extra tabs. Keep one tab: every tool acts on the active one.
- Snapshots and screenshots land in `.playwright-mcp/` under the session's working directory. It is disposable and gitignored in this repo; leave it in place rather than deleting a folder you did not inspect.

## When to leave the MCP

If the same check repeats across pages or viewports, or the composition check has more than a handful of assertions, write a check module and run it through `scripts/run-check.mjs` instead ([`headless.md`](headless.md)). You get one JSON report with console and network already collected.

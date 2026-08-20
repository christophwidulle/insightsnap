# Contributing

Thanks for taking a look. Bug reports, fixes and small features are all welcome.

## Setup

Requires Node 22.18 or newer — `npm test` relies on native TypeScript type stripping.

```bash
npm install
npm run dev        # dev server with hot reload, keeps dist/ up to date
```

Then load `dist/` as an unpacked extension: `chrome://extensions` → Developer mode →
Load unpacked.

## Before you open a pull request

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```

CI runs exactly these four. If they pass locally, they pass there.

`npm run format` fixes formatting for you — the project uses Prettier with the config in
`.prettierrc`, so please don't reformat code you didn't touch.

## Pull requests

- Branch off `main`, open the PR against `main`.
- One topic per PR. A formatting sweep and a bugfix in the same diff is hard to review.
- Explain what breaks without the change. Screenshots help for anything visible.
- New behaviour in `src/shared/` should come with a test in `test/` — those modules are
  plain TypeScript and run without a browser, which is why they are the tested ones.

## Things worth knowing

- **No new dependencies without a reason.** The extension ships to users' browsers; every
  package is bytes and attack surface. The test setup deliberately uses `node --test`
  rather than a framework.
- **The API key never leaves `chrome.storage.local`.** LLM calls happen in the background
  service worker, not in the content script, so no page can reach the key. Keep it that
  way.
- **New providers** go into `src/shared/llm.ts`. If the provider needs a host that isn't
  in `manifest.config.ts`, it has to go through the optional-permission flow instead of
  widening the default host permissions.

## Reporting bugs

Use the issue templates. Browser, extension version and provider are the three things
that decide whether a report is reproducible.

Security problems don't belong in public issues — see [SECURITY.md](SECURITY.md).

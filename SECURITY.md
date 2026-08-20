# Security Policy

## Supported versions

InsightSnap is a small project without long-term release branches. Only the latest
release gets fixes.

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's [private vulnerability reporting](https://github.com/christophwidulle/insightsnap/security/advisories/new)
instead. If that is unavailable to you, mail <mail@christophdick.de>.

Expect a first reply within a week. Please include what you did, what happened, and
which browser and extension version you used.

## What is in scope

InsightSnap runs entirely in your browser. It has no backend, and it stores your API key
in `chrome.storage.local`. Interesting attack surface, roughly in order:

- Anything that leaks the stored API key to a page, a content script, or a third party.
- Anything that lets a YouTube page (or an ad, or an embed) execute code in the
  extension's context — the content script renders LLM output as Markdown inside a
  shadow DOM.
- Anything that sends the transcript somewhere other than the provider the user
  configured.
- Abuse of the optional host permissions to reach hosts the user never granted.

## What is not in scope

- The content of LLM replies. The model can be wrong, biased, or manipulated by the
  video's transcript — that is a property of language models, not a bug in this
  extension.
- Attacks that need an already-compromised browser profile or a malicious extension
  with equal permissions.
- YouTube's own APIs and rate limits.

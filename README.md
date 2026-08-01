# InsightSnap

_[Deutsche Version](README.de.md)_

Chrome/Edge extension that summarizes YouTube videos: it pulls the transcript, sends it to
an LLM of your choice, and renders the result right on the video page.

On every YouTube watch page a **✨ InsightSnap** button appears next to _Share_ / _Save_.
Click it and the analysis opens in a dialog.

<!-- Drop a screenshot at docs/screenshot.png and uncomment the next line.
![InsightSnap dialog on a YouTube watch page](docs/screenshot.png)
-->

## Install (no build required)

1. Download the current release: [Releases](../../releases) → `insightsnap-<version>.zip`
2. Unzip it and put the folder somewhere permanent — Chrome loads the extension from that
   path on every start.
3. Open `chrome://extensions` (Edge: `edge://extensions`).
4. Turn on **Developer mode** in the top right.
5. **Load unpacked** → select the unzipped folder.

To update: unzip the new release, replace the old folder, hit **⟳ Reload** in
`chrome://extensions`, then refresh open YouTube tabs with F5.

## Setup

Click the extension icon (or ⚙ in the dialog) to open the options page.

| Field        | Meaning                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider** | Anthropic Claude, OpenAI, Google Gemini, AWS Bedrock, or OpenAI-compatible                                                                          |
| **Model**    | Dropdown that queries the provider for available models once an API key is set. If the provider serves no list, it falls back to a free-text field. |
| **API key**  | Stored locally in `chrome.storage.local`, nowhere else                                                                                              |
| **Region**   | Only for _AWS Bedrock_, turns into `https://bedrock-mantle.{region}.api.aws/v1`                                                                     |
| **Base URL** | Only for _OpenAI-compatible_, e.g. `https://api.example.com/v1`                                                                                     |
| **Access**   | Shows up for Bedrock and custom endpoints: their host is not in the manifest and needs a one-time grant                                             |
| **Prompt**   | System prompt for the analysis, resettable to the default                                                                                           |

Don't forget **Save**.

Get API keys from
[Anthropic](https://console.anthropic.com/settings/keys),
[OpenAI](https://platform.openai.com/api-keys),
[Google AI Studio](https://aistudio.google.com/apikey), or
[AWS Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html).

### AWS Bedrock

Bedrock's `bedrock-mantle` endpoint speaks the OpenAI chat-completions format and takes
the Bedrock API key as a bearer token — no SigV4 signing needed. Pick your region in the
options page, paste the key, and the model dropdown fills itself. Model IDs carry a
prefix there, e.g. `us.anthropic.claude-sonnet-4-6`. The regional host is not in the
manifest, so the options page asks for a one-time access grant, same as a custom endpoint.

### Custom endpoints

The extension ships with host permissions for the three built-in providers only. If you
point it at your own OpenAI-compatible endpoint — a proxy, or a local runtime like Ollama
or LM Studio — the options page shows a **Grant access to `<host>`** button. One click,
and Chrome asks you to confirm access to that host. Plain `http://` works for `localhost`
and `127.0.0.1`; everything else has to be `https://`.

## Usage

1. Open any YouTube video.
2. Click **✨ InsightSnap**.
3. The extension fetches the transcript (caption track, falling back to the transcript
   panel), sends it with your prompt to the provider, and renders the reply as Markdown.
4. **Re-analyze** at the bottom of the dialog runs it again, e.g. after changing the prompt.

The footer shows where the transcript came from, in which language, and how long it was.

Transcripts are capped at 400,000 characters before being sent — a runaway guard for
multi-hour streams. When it kicks in, the footer says so explicitly.

## Privacy

- API key and prompt live only in your local browser profile.
- Transcript and video title go to the provider you configured — nowhere else.
- The transcript is fetched from YouTube's InnerTube API with your session cookies
  (`credentials: 'include'`), same as the page itself does. It never leaves the browser
  except as part of the request to your chosen provider.
- No tracking, no backend of our own.

## Troubleshooting

**"No transcript available"** — The video has no captions. InsightSnap does not transcribe
audio itself; without captions there is nothing to work with.

**"The extension was reloaded. Please refresh the page (F5)."** — Exactly that: after an
extension update, already-open tabs are disconnected.

**Button does not appear** — After an update, click ⟳ in `chrome://extensions`, then
reload the tab.

**HTTP 401/403 from the provider** — API key wrong, expired, or out of credit.

**HTTP 400 with `max_tokens`** — InsightSnap requests up to 8192 output tokens. Legacy
models capped at 4096 (e.g. `claude-3-haiku`) reject that; pick a current model.

## Build it yourself

Requires Node 22.18+ (`npm test` relies on native TypeScript type stripping).

```bash
npm install
npm run build      # output in dist/ — load that folder as the extension
npm run dev        # dev server with hot reload, keeps dist/ up to date
npm test           # transcript parser tests (node --test, no extra dependency)
npm run typecheck
npm run icons      # regenerate PNGs from assets/icon.svg (macOS, uses sips)
npm run release    # build and pack dist/ into insightsnap-<version>.zip
```

Stack: Vite + CRXJS, React 19, TypeScript, Manifest V3.

```
src/
  background/   service worker — performs the LLM calls
  content/      YouTube content script + dialog (shadow DOM)
  options/      options page
  shared/       provider bindings, transcript extraction, settings, types
test/           parser tests
assets/         icon source (SVG)
```

## License

[MIT](LICENSE)

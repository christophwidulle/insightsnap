import { callLLM } from '../shared/llm';
import { loadSettings } from '../shared/storage';
import type { LLMResponse, RuntimeMessage } from '../shared/types';

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (resp: LLMResponse) => void) => {
    if (message.type === 'OPEN_OPTIONS') {
      void chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'LLM_REQUEST') {
      void handleLLM(message)
        .then((content) => sendResponse({ ok: true, content }))
        .catch((err: unknown) =>
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        );
      return true;
    }

    return false;
  },
);

async function handleLLM(
  message: Extract<RuntimeMessage, { type: 'LLM_REQUEST' }>,
): Promise<string> {
  const settings = await loadSettings();
  const systemPrompt = settings.prompt;
  const userContent =
    `Video title: ${message.videoTitle}\n\n` + `Transcript:\n"""\n${message.transcript}\n"""`;
  return callLLM({ settings, systemPrompt, userContent });
}

import type { ExtensionMessage, PageSnapshot } from '../shared/types';

function buildSnapshot(): PageSnapshot {
  const text = document.body?.innerText ?? '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  const description =
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
    '';

  return {
    url: location.href,
    title: document.title,
    description,
    lang: document.documentElement.lang,
    wordCount: words.length,
    linkCount: document.querySelectorAll('a[href]').length,
    imageCount: document.querySelectorAll('img').length,
    headingCount: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
    capturedAt: Date.now(),
  };
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'SNAP') {
    sendResponse(buildSnapshot());
    return true;
  }
  return false;
});

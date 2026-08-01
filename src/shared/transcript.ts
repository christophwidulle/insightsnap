import type { TranscriptResult, TranscriptSegment } from './types';

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  name?: { simpleText?: string };
  kind?: string;
}

interface PlayerResponse {
  videoDetails?: { videoId?: string; title?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

// The default WEB player response (window.ytInitialPlayerResponse) returns caption
// baseUrls carrying `&exp=xpe`, which require a runtime-generated PoToken — fetching
// them yields HTTP 200 with an empty body. The IOS/ANDROID InnerTube clients return
// pot-free baseUrls that fetch fine. Verified 2026-07 against multiple videos.
// ponytail: hardcoded client versions; bump if InnerTube starts rejecting them.
const INNERTUBE_CLIENTS = [
  { clientName: 'IOS', clientVersion: '20.10.4', extra: { deviceModel: 'iPhone16,2' } },
  { clientName: 'ANDROID', clientVersion: '20.10.38', extra: { androidSdkVersion: 30 } },
] as const;

export async function extractTranscript(): Promise<TranscriptResult> {
  try {
    return await fromInnerTube();
  } catch (captionErr) {
    try {
      return fromPanel();
    } catch (panelErr) {
      const captionMsg = captionErr instanceof Error ? captionErr.message : String(captionErr);
      const panelMsg = panelErr instanceof Error ? panelErr.message : String(panelErr);
      throw new Error(`No transcript available.\nCaption track: ${captionMsg}\nPanel: ${panelMsg}`);
    }
  }
}

async function fromInnerTube(): Promise<TranscriptResult> {
  const videoId = extractVideoId(location.href);
  if (!videoId) throw new Error('No video ID in the URL.');

  let lastErr = 'InnerTube caption request failed.';
  for (const client of INNERTUBE_CLIENTS) {
    let player: PlayerResponse;
    try {
      player = await fetchInnerTubePlayer(videoId, client);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      continue;
    }

    const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    if (tracks.length === 0) {
      lastErr = 'Video has no caption tracks.';
      continue;
    }

    const preferred = pickTrack(tracks);
    const segments = await fetchSegments(preferred.baseUrl);
    if (segments.length === 0) {
      lastErr = `Empty caption response (${preferred.languageCode ?? '?'}, ${client.clientName}).`;
      continue;
    }

    return {
      videoId: player.videoDetails?.videoId ?? videoId,
      title: player.videoDetails?.title ?? document.title,
      language: preferred.languageCode ?? '',
      segments,
      fullText: segments.map((s) => s.text).join(' '),
      source: 'caption-track',
    };
  }

  throw new Error(lastErr);
}

async function fetchInnerTubePlayer(
  videoId: string,
  client: (typeof INNERTUBE_CLIENTS)[number],
): Promise<PlayerResponse> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      context: {
        client: {
          clientName: client.clientName,
          clientVersion: client.clientVersion,
          hl: (navigator.language || 'en').slice(0, 2),
          gl: 'US',
          ...client.extra,
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });
  if (!res.ok) throw new Error(`InnerTube player (${client.clientName}) ${res.status}`);
  return res.json() as Promise<PlayerResponse>;
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack {
  const userLang = (navigator.language || 'en').slice(0, 2);
  const human = tracks.filter((t) => t.kind !== 'asr');
  const pool = human.length > 0 ? human : tracks;
  return pool.find((t) => t.languageCode?.startsWith(userLang)) ?? pool[0];
}

async function fetchSegments(baseUrl: string): Promise<TranscriptSegment[]> {
  const json3Url = withFormat(baseUrl, 'json3');
  console.debug('[InsightSnap] fetching captions:', json3Url);
  try {
    const res = await fetch(json3Url, { credentials: 'include' });
    if (res.ok) {
      const body = await res.text();
      const fromJson = parseJson3(body);
      if (fromJson.length > 0) return fromJson;
      const fromXml = parseTimedTextXml(body);
      if (fromXml.length > 0) return fromXml;
      console.debug('[InsightSnap] json3 response had no segments. Body head:', body.slice(0, 200));
    } else {
      console.debug('[InsightSnap] json3 fetch failed:', res.status);
    }
  } catch (err) {
    console.debug('[InsightSnap] json3 fetch error:', err);
  }

  try {
    const fallback = await fetch(baseUrl, { credentials: 'include' });
    const body = await fallback.text();
    const fromXml = parseTimedTextXml(body);
    if (fromXml.length > 0) return fromXml;
    const fromJson = parseJson3(body);
    if (fromJson.length > 0) return fromJson;
    console.debug('[InsightSnap] plain caption response empty. Body head:', body.slice(0, 200));
  } catch (err) {
    console.debug('[InsightSnap] plain caption fetch error:', err);
  }

  return [];
}

function withFormat(url: string, fmt: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('fmt', fmt);
    return u.toString();
  } catch {
    return url.includes('?') ? `${url}&fmt=${fmt}` : `${url}?fmt=${fmt}`;
  }
}

interface Json3Event {
  tStartMs?: number;
  segs?: { utf8?: string }[];
}

export function parseJson3(body: string): TranscriptSegment[] {
  let data: { events?: Json3Event[] };
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  const events = data.events ?? [];
  return events
    .map((ev) => {
      const text = (ev.segs ?? [])
        .map((s) => s.utf8 ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      return { start: (ev.tStartMs ?? 0) / 1000, text };
    })
    .filter((seg) => seg.text.length > 0);
}

// ponytail: untested — needs DOMParser, which Node has no built-in for. Pulling in
// jsdom just for this is not worth it; the json3 path is the one that actually runs.
function parseTimedTextXml(xml: string): TranscriptSegment[] {
  if (!xml.trim().startsWith('<')) return [];
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];

  const segments: TranscriptSegment[] = [];

  doc.querySelectorAll('text').forEach((node) => {
    const text = decodeEntities(node.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      segments.push({ start: parseFloat(node.getAttribute('start') ?? '0'), text });
    }
  });

  if (segments.length === 0) {
    doc.querySelectorAll('p').forEach((node) => {
      const inner = Array.from(node.childNodes)
        .map((c) => c.textContent ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (inner) {
        const t = parseFloat(node.getAttribute('t') ?? '0') / 1000;
        segments.push({ start: t, text: decodeEntities(inner) });
      }
    });
  }

  return segments;
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

function fromPanel(): TranscriptResult {
  const segments = readPanelSegments();
  if (segments.length === 0) {
    throw new Error(
      'Transcript panel not found in the DOM. Open it via "Show transcript" and wait for the ' +
        'segments to load, then try again.',
    );
  }

  return {
    videoId: extractVideoId(location.href) ?? '',
    title: document.title.replace(/\s*-\s*YouTube\s*$/, ''),
    language: document.documentElement.lang || '',
    segments,
    fullText: segments.map((s) => s.text).join(' '),
    source: 'panel',
  };
}

function readPanelSegments(): TranscriptSegment[] {
  const candidates: NodeListOf<Element>[] = [
    document.querySelectorAll('ytd-transcript-segment-renderer'),
    document.querySelectorAll('ytd-transcript-segment-list-renderer .segment'),
    document.querySelectorAll('[class*="ytd-transcript-segment-renderer"]'),
  ];

  for (const list of candidates) {
    if (list.length === 0) continue;
    const segs = extractFromNodes(list);
    if (segs.length > 0) {
      console.debug('[InsightSnap] panel read via', list.length, 'nodes (typed selector)');
      return segs;
    }
  }

  return extractFromGenericPanel();
}

function extractFromNodes(nodes: NodeListOf<Element> | Element[]): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];
  nodes.forEach((node) => {
    const timestampEl =
      node.querySelector('.segment-timestamp') ??
      node.querySelector('[class*="segment-timestamp"]') ??
      node.querySelector('div.segment-start-offset');
    const textEl =
      node.querySelector('.segment-text') ??
      node.querySelector('yt-formatted-string') ??
      node.querySelector('[class*="segment-text"]');

    const stamp = timestampEl?.textContent?.trim() ?? '0';
    const text = textEl?.textContent?.trim() ?? '';
    if (text) result.push({ start: parseTimestamp(stamp), text });
  });
  return result;
}

function extractFromGenericPanel(): TranscriptSegment[] {
  const panel =
    document.querySelector('ytd-transcript-renderer') ??
    document.querySelector('ytd-transcript-search-panel-renderer') ??
    document.querySelector('[target-id="engagement-panel-searchable-transcript"]') ??
    document.querySelector('[panel-target-id*="transcript" i]');

  const root = panel ?? document.body;
  const stampRe = /^\d{1,2}:\d{2}(:\d{2})?$/;
  const result: TranscriptSegment[] = [];
  const seen = new Set<string>();

  root.querySelectorAll('div, button, span').forEach((el) => {
    const txt = el.textContent?.trim() ?? '';
    if (!stampRe.test(txt)) return;

    const sibling =
      el.nextElementSibling ?? el.parentElement?.querySelector('yt-formatted-string') ?? null;
    const siblingText = sibling?.textContent?.trim() ?? '';
    if (!siblingText || stampRe.test(siblingText)) return;

    const key = `${txt}|${siblingText.slice(0, 40)}`;
    if (seen.has(key)) return;
    seen.add(key);

    result.push({ start: parseTimestamp(txt), text: siblingText });
  });

  if (result.length > 0) {
    console.debug('[InsightSnap] panel read via generic stamp scan, segments:', result.length);
  }
  return result;
}

export function parseTimestamp(stamp: string): number {
  const parts = stamp.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function extractVideoId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

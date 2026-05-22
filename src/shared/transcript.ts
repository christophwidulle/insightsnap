import type {
  PlayerResponseResult,
  RuntimeMessage,
  TranscriptResult,
  TranscriptSegment,
} from './types';

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

export async function extractTranscript(): Promise<TranscriptResult> {
  try {
    return await fromCaptionTrack();
  } catch (captionErr) {
    try {
      return fromPanel();
    } catch (panelErr) {
      const captionMsg = captionErr instanceof Error ? captionErr.message : String(captionErr);
      const panelMsg = panelErr instanceof Error ? panelErr.message : String(panelErr);
      throw new Error(
        `Transkript nicht verfügbar.\nCaption-Track: ${captionMsg}\nPanel: ${panelMsg}`,
      );
    }
  }
}

async function fromCaptionTrack(): Promise<TranscriptResult> {
  const player = await getLivePlayerResponse();
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) {
    throw new Error('Keine Untertitel-Spuren im Video.');
  }

  const preferred = pickTrack(tracks);
  const segments = await fetchSegments(preferred.baseUrl);
  if (segments.length === 0) {
    throw new Error(
      `Caption-Response leer (${preferred.languageCode ?? '?'}, ` +
        `${preferred.kind === 'asr' ? 'auto' : 'manual'}).`,
    );
  }

  return {
    videoId: player.videoDetails?.videoId ?? '',
    title: player.videoDetails?.title ?? document.title,
    language: preferred.languageCode ?? '',
    segments,
    fullText: segments.map((s) => s.text).join(' '),
    source: 'caption-track',
  };
}

async function getLivePlayerResponse(): Promise<PlayerResponse> {
  const res: PlayerResponseResult = await chrome.runtime.sendMessage({
    type: 'GET_PLAYER_RESPONSE',
  } satisfies RuntimeMessage);
  if (!res.ok || !res.data) {
    throw new Error(res.error ?? 'PlayerResponse nicht verfügbar.');
  }
  return res.data as PlayerResponse;
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

function parseJson3(body: string): TranscriptSegment[] {
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

function parseTimedTextXml(xml: string): TranscriptSegment[] {
  if (!xml.trim().startsWith('<')) return [];
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];

  const segments: TranscriptSegment[] = [];

  doc.querySelectorAll('text').forEach((node) => {
    const text = decodeEntities(node.textContent ?? '').replace(/\s+/g, ' ').trim();
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

function decodeEntities(input: string): string {
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
  const segmentNodes = document.querySelectorAll('ytd-transcript-segment-renderer');
  if (segmentNodes.length === 0) {
    throw new Error(
      'Transkript-Panel nicht geöffnet. Öffne es manuell über "..." → "Transkript anzeigen".',
    );
  }

  const segments: TranscriptSegment[] = [];
  segmentNodes.forEach((node) => {
    const timeText = node.querySelector('.segment-timestamp')?.textContent?.trim() ?? '0';
    const text = node.querySelector('.segment-text')?.textContent?.trim() ?? '';
    if (text) segments.push({ start: parseTimestamp(timeText), text });
  });

  return {
    videoId: extractVideoId(location.href) ?? '',
    title: document.title.replace(/\s*-\s*YouTube\s*$/, ''),
    language: document.documentElement.lang || '',
    segments,
    fullText: segments.map((s) => s.text).join(' '),
    source: 'panel',
  };
}

function parseTimestamp(stamp: string): number {
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

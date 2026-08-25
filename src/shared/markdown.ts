import type { TranscriptResult } from './types';

function videoUrl({ videoId }: TranscriptResult): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Copying lands in a chat or a note, where a link reads better than metadata.
export function withVideoLink(text: string, transcript?: TranscriptResult): string {
  if (!transcript) return text;
  return `[${transcript.title || 'Video'}](${videoUrl(transcript)})\n\n${text}`;
}

// A double-quoted scalar is the only YAML style that survives colons, quotes and #
// in a video title. Backslash and quote are the sole escapes it needs.
function yamlString(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return `"${flat.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// The downloaded file goes into a note vault, so the video metadata belongs in front
// matter where Obsidian & friends can index it.
export function withFrontMatter(text: string, transcript?: TranscriptResult): string {
  if (!transcript) return text;
  const lines = [
    '---',
    `title: ${yamlString(transcript.title || 'Video')}`,
    `url: ${videoUrl(transcript)}`,
  ];
  if (transcript.language) lines.push(`language: ${yamlString(transcript.language)}`);
  lines.push('---', '');
  return `${lines.join('\n')}\n${text}`;
}

// LLMs (Gemini in particular) like to write arrows and operators as inline LaTeX math
// ($\rightarrow$), which neither the dialog's react-markdown nor most note apps render.
// Known symbol commands become their Unicode character; \text-style wrappers are unwrapped.
const LATEX_SYMBOLS: Record<string, string> = {
  to: '→',
  rightarrow: '→',
  longrightarrow: '→',
  Rightarrow: '⇒',
  leftarrow: '←',
  Leftarrow: '⇐',
  leftrightarrow: '↔',
  times: '×',
  cdot: '·',
  pm: '±',
  neq: '≠',
  leq: '≤',
  geq: '≥',
  approx: '≈',
  ll: '≪',
  gg: '≫',
  mid: '|',
  epsilon: 'ε',
  infty: '∞',
};

export function stripLatexMath(text: string): string {
  // Only spans containing a backslash command are math; "$7k auf $45k" is currency.
  return text.replace(/\$([^$\n]*\\[^$\n]*)\$/g, (span, inner: string) => {
    // Unwrap innermost-out so nested wrappers like \mathbf{Live\text{-}Streamer} resolve.
    let unwrapped = inner;
    for (let prev = ''; prev !== unwrapped; ) {
      prev = unwrapped;
      unwrapped = unwrapped.replace(
        /\\(?:textbf|textit|text|mathbf|mathrm|mathit)\{([^{}]*)\}/g,
        '$1',
      );
    }
    const converted = unwrapped
      .replace(/\\%/g, '%')
      .replace(/\\([a-zA-Z]+)/g, (cmd, name: string) => LATEX_SYMBOLS[name] ?? cmd);
    // An unresolved command means real math ($\sum_{i=1}^{n}$) — better left alone.
    if (converted.includes('\\')) return span;
    return converted.replace(/\s+/g, ' ').trim();
  });
}

// Windows rejects <>:"/\|?* and control characters in file names, macOS chokes on ':'.
// Keep the title readable, strip everything a file system could argue about.
const ILLEGAL = /[\p{Cc}"*/:<>?\\|]/gu;

export function markdownFilename(transcript?: TranscriptResult): string {
  const safe = (transcript?.title ?? '')
    .replace(ILLEGAL, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    // A trailing dot or space is dropped silently by Windows, so drop it deliberately.
    .replace(/[.\s]+$/, '');
  if (safe) return `${safe}.md`;
  return transcript?.videoId ? `insightsnap-${transcript.videoId}.md` : 'insightsnap.md';
}

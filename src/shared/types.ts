export interface PageSnapshot {
  url: string;
  title: string;
  description: string;
  lang: string;
  wordCount: number;
  linkCount: number;
  imageCount: number;
  headingCount: number;
  capturedAt: number;
}

export type SnapRequest = { type: 'SNAP' };

export type ExtensionMessage = SnapRequest;

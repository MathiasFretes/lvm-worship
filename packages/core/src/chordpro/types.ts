export interface ChordPlacement {
  sym: string;
  /** UTF-16 offset into SongLine.lyrics. */
  index: number;
}

export interface InstrumentalDirective {
  chords: string[];
  repeat?: number | undefined;
}

export interface SongLine {
  lyrics: string;
  chords: ChordPlacement[];
  comment?: string;
  instrumental?: InstrumentalDirective;
}

export interface SongSection {
  kind: string; // e.g., 'verse', 'chorus'
  label?: string | undefined;
  lines: SongLine[];
  instrumental?: InstrumentalDirective;
}

export interface SongMeta {
  title?: string;
  key?: string;
  capo?: number;
  meta?: Record<string, string>;
}

export interface SongLayoutHints {
  requestedColumns?: 1 | 2;
  columnBreakAfter?: number[];
}

export type ChordDefine = { name: string; raw: string };

export interface SongDoc {
  meta: SongMeta;
  sections: SongSection[];
  layoutHints?: SongLayoutHints;
  chordDefs?: ChordDefine[];
}

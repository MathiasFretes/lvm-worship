// Canonical Protestant 66-book chapter counts, indexed by book number (1–66),
// matching the book numbering used by the R2 chapter layout
// (`<dataRoot>/<bookNumber>/<chapter>.json`) and the M'Cheyne plan. Pure,
// DOM-free. Added for the offline-download layer, which must enumerate every
// chapter of a translation up front (the R2 manifest lists translations, not
// their chapter counts). Translations that omit a chapter simply 404 on that
// file — the downloader tolerates that — so this table is the upper bound.

/** Chapter count per book, index 0 unused so index === book number (1–66). */
const CHAPTERS_BY_TESTAMENT = {
  old: [
    50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29,
    36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48,
    12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
  ],
  new: [
    28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3,
    6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
  ],
} as const

export const BOOK_CHAPTER_COUNTS: readonly number[] = [
  0,
  ...CHAPTERS_BY_TESTAMENT.old,
  ...CHAPTERS_BY_TESTAMENT.new,
]

/** Total canonical chapters across all 66 books (1189). */
export const TOTAL_BIBLE_CHAPTERS = BOOK_CHAPTER_COUNTS.reduce((a, b) => a + b, 0)

/** Number of chapters in a book, or 0 for an out-of-range book number. */
export function chaptersInBook(bookNumber: number): number {
  return BOOK_CHAPTER_COUNTS[bookNumber] ?? 0
}

export type ChapterRef = { bookNumber: number; chapter: number }

/** Every canonical chapter as `{ bookNumber, chapter }`, book 1→66, chapter 1→N. */
export function allChapters(): ChapterRef[] {
  const chapters: ChapterRef[] = []
  for (const [bookNumber, count] of BOOK_CHAPTER_COUNTS.entries()) {
    if (bookNumber === 0) continue
    for (let chapter = 1; chapter <= count; chapter++) {
      chapters.push({ bookNumber, chapter })
    }
  }
  return chapters
}

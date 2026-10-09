import { useEffect, useReducer } from 'react'
import { getCachedPassage, getPassage, type BibleTranslation, type ChapterData, type Passage } from './bibleSource'
import { failureDetailKey } from './errors'

// The reader's chapter-loading seam. Its typography PREFERENCES (size,
// typeface, verse layout, line spacing) live in `readerSettings.ts`, which is
// RN-free and persists them device-local — this module imports native-backed
// `bibleSource`, so nothing testable belongs here.

type ChapterState = {
  chapter: ChapterData | null
  loading: boolean
  error: string | null
}

type ChapterAction =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ready'; chapter: ChapterData }
  | { type: 'failed'; error: string }

const EMPTY_STATE: ChapterState = { chapter: null, loading: false, error: null }

function chapterReducer(_state: ChapterState, action: ChapterAction): ChapterState {
  switch (action.type) {
    case 'idle':
      return EMPTY_STATE
    case 'loading':
      return { chapter: null, loading: true, error: null }
    case 'ready':
      return { chapter: action.chapter, loading: false, error: null }
    case 'failed':
      return { chapter: null, loading: false, error: action.error }
  }
}

/**
 * Fetch the chapter backing `passage` in `translation` via the source seam,
 * aborting in-flight loads when the passage or translation changes. Mirrors the
 * web PassageReader effect.
 */
export function usePassageChapter(
  passage: Passage | null,
  translation: BibleTranslation | null,
  reloadToken = 0
): ChapterState {
  const [state, dispatch] = useReducer(chapterReducer, EMPTY_STATE)

  useEffect(() => {
    if (!passage || !translation) {
      dispatch({ type: 'idle' })
      return
    }
    // Prefetched / previously-read chapters render immediately, no spinner.
    const cached = getCachedPassage(translation.id, passage.bookNumber, passage.chapter)
    if (cached) {
      dispatch({ type: 'ready', chapter: cached })
      return
    }

    let cancelled = false
    dispatch({ type: 'loading' })

    getPassage({ passage, translation })
      .then((chapter) => {
        if (!cancelled) dispatch({ type: 'ready', chapter })
      })
      .catch((err: unknown) => {
        // The reader renders its own localized copy and only reads this for
        // truthiness, so the value was never shown — but it held raw error text,
        // which made it a trap for anyone who later decided to render it, and
        // nothing logged reader failures at all. An i18n key closes both.
        if (!cancelled) {
          dispatch({ type: 'failed', error: failureDetailKey('usePassageChapter', err) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [passage, translation, reloadToken])

  return state
}

// Relative-path helpers shared by the downloader, resolver, and blob store.
// Local blobs mirror the R2 tree exactly so the read path computes the same
// relative path a network fetch would use:
//   <dataRoot>/<bookNumber>/<chapter>.json   e.g. bible/en/esv/1/1.json

/** Root under which in-progress downloads are staged before the atomic move. */
export const TMP_ROOT = '.downloads-tmp'

function cleanPath(value: string): string {
  return String(value ?? '')
    .split('/')
    .filter(Boolean)
    .join('/')
}

/** Final relative path of one chapter file within its translation tree. */
export function chapterRelPath(dataRoot: string, bookNumber: number, chapter: number): string {
  return [cleanPath(dataRoot), bookNumber, `${chapter}.json`].join('/')
}

/** Final relative directory for a whole translation (its dataRoot). */
export function translationDirRel(dataRoot: string): string {
  return cleanPath(dataRoot)
}

/** Staging directory for an in-progress translation download, keyed by id. */
export function tmpDirRel(id: string): string {
  return `${TMP_ROOT}/${cleanPath(id)}`
}

/** Chapter path inside the staging directory (mirrors book/chapter structure). */
export function tmpChapterRelPath(id: string, bookNumber: number, chapter: number): string {
  return `${tmpDirRel(id)}/${bookNumber}/${chapter}.json`
}

export type LexToken =
  | { type: 'directive'; raw: string }
  | { type: 'lyrics'; raw: string }
  | { type: 'blank' };

export function lexChordPro(input: string): LexToken[] {
  const tokens: LexToken[] = [];
  let lineStart = 0;

  const append = (raw: string) => {
    const trimmed = raw.trim();
    const type: LexToken['type'] =
      trimmed.length === 0
        ? 'blank'
        : trimmed[0] === '{' && trimmed[trimmed.length - 1] === '}'
          ? 'directive'
          : 'lyrics';
    tokens.push(type === 'blank' ? { type } : { type, raw });
  };

  for (let cursor = 0; cursor < input.length; cursor += 1) {
    if (input.charCodeAt(cursor) !== 10) continue;
    const lineEnd = cursor > lineStart && input.charCodeAt(cursor - 1) === 13
      ? cursor - 1
      : cursor;
    append(input.slice(lineStart, lineEnd));
    lineStart = cursor + 1;
  }
  append(input.slice(lineStart));
  return tokens;
}

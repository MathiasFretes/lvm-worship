//
//  LintLocator.swift
//  La Voz Misionera Studio
//
//  Turns a lint warning into a caret position in the body — when it can be done
//  without guessing, and nil when it cannot.
//
//  Clicking a warning to jump to it was blocked on two things. One was that the
//  editor could not move the caret at all, which `ChordProTextView` fixed. The other
//  is that `lineIndex` is two different units depending on the code, which
//  `LintWarning.Location` now sorts out. What is left is this: a body line for each
//  case, or an honest refusal.
//
//  **What this deliberately does not do is pin a lyric line inside a section.**
//  `lint.ts` counts those over the *parsed* document — `sec.lines` with comment lines
//  filtered out — and reconstructing that index from raw text means reimplementing
//  the parser's line model in Swift, which is exactly the drift the bridge exists to
//  prevent. A jump that lands two lines off is worse than no jump: the writer edits
//  what they landed on. So a section-scoped warning takes you to the section's
//  opening line, and the row's own label ("section 2, lyric line 3") says where to
//  look from there.
//
//  If pinning that line ever matters enough, the fix is core emitting a body-relative
//  line alongside the section-relative one, not a cleverer scan here.
//

import Foundation

enum LintLocator {
    /// `parser.ts` RX_LONG_DIR's opening half, RX_SHORT_DIR's opening half, and
    /// RX_PLAIN_HEADER — the three ways a section starts in a body. Transcribed, and
    /// cross-checked below rather than trusted.
    private static let sectionOpener = try! NSRegularExpression(
        pattern: [
            "^\\{\\s*start_of_(?:verse|chorus|bridge|intro|tag|outro)(?::[^}]*)?\\s*\\}$",
            "^\\{\\s*(?:sov|soc|sob)(?::?[^}]*)?\\s*\\}$",
            "^(?:verse|chorus|bridge|intro|tag|outro)(?:\\s+\\d+)?$",
        ].joined(separator: "|"),
        options: [.caseInsensitive]
    )

    /// The body line a warning points at, or nil when it cannot be resolved.
    ///
    /// `sectionCount` is the parsed document's section count, and it is a *check*, not
    /// an input: if this file's idea of where sections start disagrees with the
    /// parser's about how many there are, the correspondence by ordinal is not sound
    /// and no jump is offered. That covers the cases this scan does not model — a
    /// body whose lyrics begin before any header, a directive the parser treats as an
    /// opener and this does not — by noticing them rather than by handling them.
    static func bodyLine(for warning: LintWarning, in body: String, sectionCount: Int) -> Int? {
        let map = LineMap(body)
        switch warning.location {
        case .song:
            return nil
        case .bodyLine(let line):
            return map.ranges.indices.contains(line) ? line : nil
        case .section(let index):
            return map.sectionLine(at: index, expectedCount: sectionCount)
        case .sectionLine(let index, _):
            return map.sectionLine(at: index, expectedCount: sectionCount)
        }
    }

    /// The caret range for a warning: the whole of the line it points at.
    ///
    /// The whole line rather than its start, so the jump also *shows* which line was
    /// meant — a bare caret in a long song is easy to lose.
    static func range(for warning: LintWarning, in body: String, sectionCount: Int) -> NSRange? {
        guard let line = bodyLine(for: warning, in: body, sectionCount: sectionCount) else { return nil }
        return LineMap(body).range(at: line)
    }

    // MARK: - Lines

    /// Zero-based indices of the lines that open a section.
    static func sectionOpenerLines(in body: String) -> [Int] {
        LineMap(body).sectionOpeners
    }

    /// Every line's range, terminators excluded.
    ///
    /// Split on `\r?\n` rather than with `NSString.lineRange(for:)`, to match core's
    /// `split(/\r?\n/)` exactly. The two disagree on a lone `\r`, which AppKit counts
    /// as a line break and core does not — and a line index that means something
    /// different here than it did where it was produced is the whole bug this file
    /// exists to avoid.
    static func lineRanges(in body: String) -> [NSRange] {
        LineMap(body).ranges
    }

    private struct LineMap {
        let source: NSString
        let ranges: [NSRange]
        let sectionOpeners: [Int]

        init(_ body: String) {
            source = body as NSString
            ranges = Self.split(source)
            sectionOpeners = ranges.indices.filter { lineIndex in
                let raw = source.substring(with: ranges[lineIndex])
                let candidate = raw.trimmingCharacters(in: .whitespaces)
                guard !candidate.isEmpty else { return false }
                let span = NSRange(location: 0, length: (candidate as NSString).length)
                return LintLocator.sectionOpener.firstMatch(in: candidate, range: span) != nil
            }
        }

        func range(at line: Int) -> NSRange? {
            ranges.indices.contains(line) ? ranges[line] : nil
        }

        func sectionLine(at index: Int, expectedCount: Int) -> Int? {
            guard sectionOpeners.count == expectedCount,
                  sectionOpeners.indices.contains(index) else { return nil }
            return sectionOpeners[index]
        }

        private static func split(_ text: NSString) -> [NSRange] {
            var result: [NSRange] = []
            var lineStart = 0
            for cursor in 0..<text.length where text.character(at: cursor) == 0x0A {
                let contentEnd = cursor > lineStart && text.character(at: cursor - 1) == 0x0D
                    ? cursor - 1
                    : cursor
                result.append(NSRange(location: lineStart, length: contentEnd - lineStart))
                lineStart = cursor + 1
            }
            result.append(NSRange(location: lineStart, length: text.length - lineStart))
            return result
        }
    }
}

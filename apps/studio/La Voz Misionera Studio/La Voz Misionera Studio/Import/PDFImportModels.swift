import Foundation

// JSON boundary shared with packages/core/src/songs/pdfImport.ts.
// All string offsets are UTF-16 code units, matching JavaScript String indices.

nonisolated struct PDFExtractedWord: Codable {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
    let start: Int
    let end: Int
    /// One x-origin per UTF-16 code unit. Nil means “snap to the word start”.
    let charX: [Double]?
}

nonisolated struct PDFExtractedLine: Codable {
    let text: String
    let words: [PDFExtractedWord]
    let x: Double
    /// Top edge in crop-box coordinates, increasing downward.
    let y: Double
    let w: Double
    let h: Double
    let fontSize: Double?
    let isBold: Bool?
    let page: Int
    /// Zero-based column; nil denotes a gutter-spanning line.
    let column: Int?
    let startsBlock: Bool
}

nonisolated struct PDFExtractedPage: Codable {
    let index: Int
    let width: Double
    let height: Double
    let columnCount: Int
    let layoutTrusted: Bool
}

nonisolated struct PDFExtraction: Codable {
    let lines: [PDFExtractedLine]
    let pages: [PDFExtractedPage]
    let diagnostics: [String]

    var isEmpty: Bool { lines.isEmpty }

    /// Refuse to bridge malformed geometry. Core deliberately trusts this native
    /// boundary, so catching an offset or NaN here avoids plausible but wrong chords.
    func validateContract() throws {
        let pageIndices = Set(pages.map(\.index))
        guard pageIndices.count == pages.count else {
            throw PDFExtractionContractError.duplicatePage
        }
        let pagesByIndex = Dictionary(uniqueKeysWithValues: pages.map { ($0.index, $0) })
        for page in pages {
            guard page.index >= 0,
                  page.width.isFinite, page.width > 0,
                  page.height.isFinite, page.height > 0,
                  (1...2).contains(page.columnCount)
            else { throw PDFExtractionContractError.invalidPage(page.index) }
        }

        for (lineIndex, line) in lines.enumerated() {
            let utf16 = line.text as NSString
            guard let page = pagesByIndex[line.page],
                  line.column.map { $0 >= 0 && $0 < page.columnCount } ?? true,
                  [line.x, line.y, line.w, line.h].allSatisfy(\.isFinite),
                  line.w >= 0, line.h >= 0
            else { throw PDFExtractionContractError.invalidLine(lineIndex) }

            var previousEnd = 0
            for word in line.words {
                guard word.start >= previousEnd,
                      word.end >= word.start,
                      word.end <= utf16.length,
                      [word.x, word.y, word.w, word.h].allSatisfy(\.isFinite),
                      word.w >= 0, word.h >= 0
                else { throw PDFExtractionContractError.invalidWord(lineIndex) }

                let range = NSRange(location: word.start, length: word.end - word.start)
                guard utf16.substring(with: range) == word.text,
                      (word.charX?.count ?? range.length) == range.length,
                      (word.charX ?? []).allSatisfy(\.isFinite)
                else { throw PDFExtractionContractError.invalidWord(lineIndex) }
                previousEnd = word.end
            }
        }
    }
}

nonisolated enum PDFExtractionContractError: Error {
    case duplicatePage
    case invalidPage(Int)
    case invalidLine(Int)
    case invalidWord(Int)
}

struct ImportWarning: Codable, Hashable, Identifiable {
    let code: String
    let message: String

    var id: String { code + message }
}

struct SongDraftStats: Codable, Hashable {
    let sections: Int
    let chords: Int
    let lyricLines: Int
    let suspiciousInsertions: Int
    let unpairedChordLines: Int
}

struct SongDraft: Codable {
    let title: String?
    let key: String?
    let artist: String?
    let tempo: String?
    let timeSignature: String?
    let chordpro: String
    let confidence: Int
    let warnings: [ImportWarning]
    let stats: SongDraftStats

    static let lowConfidence = 70

    var summary: String {
        let name = title.map { "“\($0)”" } ?? "the chart"
        var parts = ["Imported \(name) — \(stats.sections) \(stats.sections == 1 ? "section" : "sections"), \(stats.chords) \(stats.chords == 1 ? "chord" : "chords")."]
        parts.append(contentsOf: warnings.map(\.message))
        return parts.joined(separator: " ")
    }
}

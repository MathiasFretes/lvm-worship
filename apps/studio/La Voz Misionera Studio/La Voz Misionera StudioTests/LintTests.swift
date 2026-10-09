//
//  LintTests.swift
//  La Voz Misionera StudioTests
//
//  Two things are under test here, and they are the two that were wrong before.
//
//  `LintWarning.location` sorts core's overloaded `lineIndex` into the two units it
//  actually carries. `LintLocator` turns those into a caret position only when it can
//  do so without guessing — a jump that lands two lines off is worse than no jump,
//  because the writer edits what they landed on.
//

import Foundation
import Testing
@testable import LaVozMisionera_Studio

@Suite("Lint warnings")
struct LintWarningTests {
    static func warning(_ code: String, section: Int? = nil, line: Int? = nil) -> LintWarning {
        LintWarning(code: code, message: "m", sectionIndex: section, lineIndex: line)
    }

    @Test("section_mismatch's lineIndex is a body line")
    func mismatchIsBodyLine() {
        // lint.ts produces this one from a raw-text scan, not from the parsed doc.
        #expect(Self.warning(LintWarning.sectionMismatch, line: 7).location == .bodyLine(7))
        #expect(Self.warning(LintWarning.sectionMismatch, line: 7).locationText == "line 8")
    }

    @Test("everything else's lineIndex counts a section's lyric lines")
    func othersAreSectionRelative() {
        let warning = Self.warning("warn:unknown_chord", section: 1, line: 2)
        #expect(warning.location == .sectionLine(section: 1, lyricLine: 2))
        // Worded so it cannot be mistaken for a line you could count to in the editor.
        #expect(warning.locationText == "section 2, lyric line 3")
    }

    @Test("a section-only warning has no line")
    func sectionOnly() {
        #expect(Self.warning("warn:empty_section", section: 0).location == .section(0))
        #expect(Self.warning("warn:empty_section", section: 0).locationText == "section 1")
    }

    @Test("a song-wide warning has no location at all")
    func songWide() {
        #expect(Self.warning(LintWarning.missingTitle).location == .song)
        #expect(Self.warning(LintWarning.missingTitle).locationText == nil)
    }

    @Test("the short label drops the warn: prefix")
    func shortLabel() {
        #expect(Self.warning("warn:unknown_chord").shortLabel == "unknown chord")
        #expect(Self.warning("something_else").shortLabel == "something else")
    }

    @Test("missing title and key are suppressed only while the columns supply them")
    func applicable() {
        let all = [
            Self.warning(LintWarning.missingTitle),
            Self.warning(LintWarning.missingKey),
            Self.warning("warn:unknown_chord", section: 0, line: 0),
        ]
        // Both columns filled: core is complaining about the body, which is not where
        // this app keeps that metadata.
        #expect(SongEditorModel.applicable(all, title: "Amazing Grace", key: "G").count == 1)
        // A column that really is empty still gets its warning.
        #expect(SongEditorModel.applicable(all, title: "", key: "G").map(\.code) ==
                [LintWarning.missingTitle, "warn:unknown_chord"])
        #expect(SongEditorModel.applicable(all, title: "   ", key: "").count == 3)
    }
}

@Suite("Lint navigation")
struct LintLocatorTests {
    static let body = """
    {title: Test}

    {start_of_verse: Verse 1}
    [G]One
    [C]Two
    {end_of_verse}

    Chorus
    [D]Three
    """

    @Test("body lines are split the way core splits them")
    func lineRanges() {
        #expect(LintLocator.lineRanges(in: "a\nb\nc").count == 3)
        // A trailing newline leaves an empty final line, as `split(/\r?\n/)` does.
        #expect(LintLocator.lineRanges(in: "a\n").count == 2)
        #expect(LintLocator.lineRanges(in: "").count == 1)
        // CRLF is one break, not two.
        #expect(LintLocator.lineRanges(in: "a\r\nb").count == 2)
        let crlf = LintLocator.lineRanges(in: "a\r\nb")
        #expect(("a\r\nb" as NSString).substring(with: crlf[0]) == "a")
        // Core only splits on LF; a standalone CR remains inside one source line.
        #expect(LintLocator.lineRanges(in: "a\rb").count == 1)
        #expect(("a\rb" as NSString).substring(with: LintLocator.lineRanges(in: "a\rb")[0]) == "a\rb")
    }

    @Test("a section_mismatch warning goes straight to its line")
    func mismatchJumps() throws {
        let warning = LintWarning(code: LintWarning.sectionMismatch, message: "Stray", sectionIndex: nil, lineIndex: 5)
        #expect(LintLocator.bodyLine(for: warning, in: Self.body, sectionCount: 2) == 5)
        let range = try #require(LintLocator.range(for: warning, in: Self.body, sectionCount: 2))
        #expect((Self.body as NSString).substring(with: range) == "{end_of_verse}")
    }

    @Test("a section-scoped warning goes to that section's opening line")
    func sectionJumps() throws {
        // Both a directive-opened section and a bare header count as openers.
        #expect(LintLocator.sectionOpenerLines(in: Self.body) == [2, 7])

        let first = LintWarning(code: "warn:unknown_chord", message: "m", sectionIndex: 0, lineIndex: 1)
        #expect(LintLocator.bodyLine(for: first, in: Self.body, sectionCount: 2) == 2)

        let second = LintWarning(code: "warn:empty_section", message: "m", sectionIndex: 1, lineIndex: nil)
        let range = try #require(LintLocator.range(for: second, in: Self.body, sectionCount: 2))
        #expect((Self.body as NSString).substring(with: range) == "Chorus")
    }

    @Test("it refuses when its section count disagrees with the parser's")
    func refusesOnDisagreement() {
        // The guard that keeps a jump from landing on the wrong section: if this
        // file's scan and the parser do not see the same number of sections, the
        // correspondence by ordinal is not sound and no jump is offered.
        let warning = LintWarning(code: "warn:empty_section", message: "m", sectionIndex: 0, lineIndex: nil)
        #expect(LintLocator.bodyLine(for: warning, in: Self.body, sectionCount: 3) == nil)
        #expect(LintLocator.range(for: warning, in: Self.body, sectionCount: 3) == nil)
    }

    @Test("a song-wide warning has nowhere to go")
    func songWideDoesNotJump() {
        let warning = LintWarning(code: LintWarning.missingTitle, message: "m", sectionIndex: nil, lineIndex: nil)
        #expect(LintLocator.bodyLine(for: warning, in: Self.body, sectionCount: 2) == nil)
    }

    @Test("a line index past the end is refused")
    func outOfRange() {
        let warning = LintWarning(code: LintWarning.sectionMismatch, message: "m", sectionIndex: nil, lineIndex: 999)
        #expect(LintLocator.bodyLine(for: warning, in: Self.body, sectionCount: 2) == nil)
    }

    @Test("short and long directives preserve section ordinal")
    func directiveVariants() {
        let body = """
          {sov: 1}
        [G]one
        {eov}
        {start_of_chorus: Main}
        [C]two
        """
        #expect(LintLocator.sectionOpenerLines(in: body) == [0, 3])
        let warning = LintWarning(
            code: "warn:unknown_chord",
            message: "m",
            sectionIndex: 1,
            lineIndex: 0
        )
        #expect(LintLocator.bodyLine(for: warning, in: body, sectionCount: 2) == 3)
    }
}

@Suite("Editor lint wiring")
struct SongEditorLintTests {
    @Test("a blank draft lints through the bridge from the moment it opens")
    func blankDraftLints() async throws {
        let store = SongEditorDraftTests.temporaryStore()
        let services = SongEditorDraftTests.services()
        // If this is nil the JS bundle did not reach the app bundle, which would make
        // every bridged feature silently unavailable — worth failing loudly on.
        #expect(services.bridge != nil, "CoreBridge did not load Resources/LaVozMisioneraCore.js")

        let model = SongEditorModel(services: services, drafts: store)
        await model.load()

        // Core reports both; with the columns empty, both are applicable.
        #expect(model.rawWarnings.contains { $0.code == LintWarning.missingTitle })
        #expect(model.warnings.contains { $0.code == LintWarning.missingTitle })

        // Filling the column suppresses it without re-linting the body — the whole
        // reason the raw list is kept separately from the filtered one.
        model.form.title = "Amazing Grace"
        #expect(model.rawWarnings.contains { $0.code == LintWarning.missingTitle })
        #expect(!model.warnings.contains { $0.code == LintWarning.missingTitle })
    }

    @Test("a stray end-of-section is reported and can be jumped to")
    func strayEndOfSection() async throws {
        let store = SongEditorDraftTests.temporaryStore()
        let model = SongEditorModel(services: SongEditorDraftTests.services(), drafts: store)
        model.form.chordproContent = """
        {start_of_verse}
        [G]One
        {end_of_verse}
        {end_of_chorus}
        """
        model.refreshNow()

        let mismatch = try #require(model.warnings.first { $0.code == LintWarning.sectionMismatch })
        #expect(model.canJump(to: mismatch))
        #expect(model.jump(to: mismatch))
        let selected = try #require(model.selection)
        #expect((model.form.chordproContent as NSString).substring(with: selected) == "{end_of_chorus}")
    }
}

@Suite("Runtime wire contracts")
struct RuntimeWireContractTests {
    @Test("bridge edit selections are UTF-16 ranges")
    func editSelectionValidation() throws {
        let valid = Data(#"{"value":"a🎵b","selection":{"start":3,"end":4}}"#.utf8)
        let edit = try JSONDecoder().decode(ChordProEdit.self, from: valid)
        #expect(edit.selection.range == NSRange(location: 3, length: 1))

        let invalid = Data(#"{"value":"a🎵b","selection":{"start":0,"end":5}}"#.utf8)
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(ChordProEdit.self, from: invalid)
        }
    }

    @Test("song chord positions use UTF-16 offsets")
    func songPositionValidation() throws {
        let valid = Data(
            #"{"meta":{},"sections":[{"kind":"verse","lines":[{"lyrics":"a🎵b","chords":[{"sym":"G","index":3}]}]}]}"#.utf8
        )
        let song = try JSONDecoder().decode(SongDoc.self, from: valid)
        #expect(song.sections[0].lines[0].chords[0].index == 3)

        let invalid = Data(
            #"{"meta":{},"sections":[{"kind":"verse","lines":[{"lyrics":"a🎵b","chords":[{"sym":"G","index":5}]}]}]}"#.utf8
        )
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(SongDoc.self, from: invalid)
        }
    }

    @Test("song payload keeps PostgREST column names and insert-only fields")
    func songPayloadEncoding() throws {
        var form = SongForm()
        form.title = "  Amazing Grace  "
        form.defaultKey = " G "
        form.chordproContent = "Verse\n[G]Grace"
        form.tags = ["Hymn"]

        let insert = SongWritePayload(
            form: form,
            slug: "amazing-grace",
            isInsert: true,
            now: "2026-10-07T12:00:00.000Z"
        )
        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(insert)) as? [String: Any]
        )
        #expect(object["default_key"] as? String == "G")
        #expect(object["chordpro_content"] as? String == "Verse\n[G]Grace")
        #expect(object["status"] as? String == "draft")
        #expect(object["created_at"] as? String == "2026-10-07T12:00:00.000Z")

        let update = SongWritePayload(form: form, slug: "amazing-grace", isInsert: false)
        let updated = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(update)) as? [String: Any]
        )
        #expect(updated["status"] == nil)
        #expect(updated["created_at"] == nil)
    }

    @Test("export filenames support quoted and UTF-8 forms")
    func exportFilenameParsing() {
        #expect(ExportService.filename(fromContentDisposition: #"attachment; filename="song.pdf""#) == "song.pdf")
        #expect(
            ExportService.filename(
                fromContentDisposition: "attachment; filename*=UTF-8''Canci%C3%B3n.pdf"
            ) == "Canción.pdf"
        )
    }
}

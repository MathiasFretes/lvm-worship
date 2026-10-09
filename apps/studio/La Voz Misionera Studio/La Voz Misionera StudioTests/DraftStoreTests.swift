//
//  DraftStoreTests.swift
//  La Voz Misionera StudioTests
//
//  The draft store's whole job is to hand back exactly what was typed, or nothing.
//  "Nothing" is a fine answer; a partially understood form is not, because it would
//  put fields the writer never typed into a song they are about to publish.
//

import Foundation
import Testing
@testable import LaVozMisionera_Studio

@Suite("Draft store")
struct DraftStoreTests {
    /// A store in its own temporary directory, so the tests never touch the real
    /// container and delete somebody's recovered work.
    static func temporaryStore() -> DraftStore {
        let directory = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("lvm-draft-tests-\(UUID().uuidString)", isDirectory: true)
        return DraftStore(directory: directory)
    }

    static func sampleForm() -> SongForm {
        var form = SongForm()
        form.title = "Great Is Thy Faithfulness"
        form.defaultKey = "G"
        form.tags = ["Worship", "Slow"]
        form.chordproContent = "{start_of_verse}\n[G]Great is Thy [C]faithfulness\n{end_of_verse}"
        return form
    }

    @Test("a draft round-trips")
    func roundTrip() {
        let store = Self.temporaryStore()
        let form = Self.sampleForm()
        store.write(SongDraftSnapshot(key: "new", form: form, savedAt: Date(timeIntervalSince1970: 1_700_000_000)))

        let read = store.read(key: "new")
        #expect(read?.form == form)
        #expect(read?.key == "new")
        #expect(read?.savedAt == Date(timeIntervalSince1970: 1_700_000_000))
    }

    @Test("an absent draft reads as nil rather than as a blank form")
    func absent() {
        #expect(Self.temporaryStore().read(key: "nothing-here") == nil)
    }

    @Test("clearing removes it")
    func clear() {
        let store = Self.temporaryStore()
        store.write(SongDraftSnapshot(key: "abc", form: Self.sampleForm(), savedAt: Date()))
        store.clear(key: "abc")
        #expect(store.read(key: "abc") == nil)
    }

    @Test("two songs do not share a slot")
    func separateKeys() {
        let store = Self.temporaryStore()
        var one = SongForm(); one.title = "One"
        var two = SongForm(); two.title = "Two"
        store.write(SongDraftSnapshot(key: "song-one", form: one, savedAt: Date()))
        store.write(SongDraftSnapshot(key: "song-two", form: two, savedAt: Date()))
        #expect(store.read(key: "song-one")?.form.title == "One")
        #expect(store.read(key: "song-two")?.form.title == "Two")
    }

    @Test("a corrupt draft is dropped, not repaired")
    func corrupt() throws {
        let store = Self.temporaryStore()
        let url = try #require(store.fileURL(for: "broken"))
        try FileManager.default.createDirectory(at: store.directory, withIntermediateDirectories: true)
        try Data("{ this is not json".utf8).write(to: url)

        #expect(store.read(key: "broken") == nil)
        // And removed, so it cannot fail again on every open.
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }

    @Test("a draft from a newer build is refused")
    func futureVersion() throws {
        let store = Self.temporaryStore()
        let url = try #require(store.fileURL(for: "future"))
        try FileManager.default.createDirectory(at: store.directory, withIntermediateDirectories: true)
        var snapshot = SongDraftSnapshot(key: "future", form: Self.sampleForm(), savedAt: Date())
        snapshot.version = SongDraftSnapshot.currentVersion + 1
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(snapshot).write(to: url)

        #expect(store.read(key: "future") == nil)
    }

    @Test("a key cannot walk out of the drafts directory")
    func keySanitising() throws {
        let store = Self.temporaryStore()
        // Invalid keys are rejected instead of being rewritten into a colliding
        // valid key (`../../escape` used to share `escape.json`).
        #expect(store.fileURL(for: "../../escape") == nil)
        #expect(store.fileURL(for: "song/one") == nil)
        #expect(store.fileURL(for: "../..") == nil)
        #expect(store.fileURL(for: "") == nil)
        let valid = try #require(store.fileURL(for: "song_123-abc"))
        #expect(valid.deletingLastPathComponent() == store.directory)
    }

    @Test("a draft written before a field existed still restores the rest")
    func lenientDecoding() throws {
        // SongForm's decoder fills absent fields with their blank values, so adding a
        // field to the form does not throw away everyone's unsaved work.
        let json = """
        {"version":1,"key":"new","savedAt":"2026-01-01T00:00:00Z",
         "form":{"title":"Partial","chordproContent":"[G]hi"}}
        """
        let store = Self.temporaryStore()
        let url = try #require(store.fileURL(for: "new"))
        try FileManager.default.createDirectory(at: store.directory, withIntermediateDirectories: true)
        try Data(json.utf8).write(to: url)

        let read = try #require(store.read(key: "new"))
        #expect(read.form.title == "Partial")
        #expect(read.form.chordproContent == "[G]hi")
        #expect(read.form.artist.isEmpty)
        #expect(read.form.tags.isEmpty)
    }

    @Test("a snapshot copied into another slot is rejected")
    func mismatchedSlot() throws {
        let store = Self.temporaryStore()
        let source = SongDraftSnapshot(key: "song-one", form: Self.sampleForm(), savedAt: Date())
        #expect(store.write(source))
        let sourceURL = try #require(store.fileURL(for: "song-one"))
        let otherURL = try #require(store.fileURL(for: "song-two"))
        try FileManager.default.copyItem(at: sourceURL, to: otherURL)

        #expect(store.read(key: "song-two") == nil)
        #expect(!FileManager.default.fileExists(atPath: otherURL.path))
        #expect(store.read(key: "song-one") == source)
    }
}

@Suite("Song form rules")
struct SongFormTests {
    @Test("keys respell without changing pitch or mode")
    func keyRespelling() {
        #expect(SongForm.respelled("D#m", as: .flat) == "Ebm")
        #expect(SongForm.respelled("Bb", as: .sharp) == "A#")
        #expect(SongForm.respelled("C", as: .flat) == "C")
    }

    @Test("known tags keep catalog spelling and reject folded duplicates")
    func tagIdentity() {
        var form = SongForm()
        #expect(form.addTag("  worship ", knownTags: ["Worship"]))
        #expect(form.tags == ["Worship"])
        #expect(!form.addTag("WORSHIP"))
    }

    @Test("YouTube normalization returns only the captured id")
    func youtubeNormalization() {
        let id = "abcdefghijk"
        #expect(SongForm.normalizeYouTube("https://www.youtube.com/watch?v=\(id)&t=4").id == id)
        #expect(SongForm.normalizeYouTube("https://youtu.be/\(id)").id == id)
        #expect(!SongForm.normalizeYouTube("not-a-video").valid)
    }
}

@Suite("Editor macros")
@MainActor
struct MacroStoreTests {
    @Test("same folded name updates one stable macro")
    func replaceByName() throws {
        let defaults = LVMPreferenceStorageTests.isolatedDefaults()
        let store = MacroStore(defaults: defaults)
        store.add(name: "Intro", body: "[G] [C]")
        let id = try #require(store.macros.first?.id)
        store.add(name: " intro ", body: "[D] [A]")

        #expect(store.macros.count == 1)
        #expect(store.macros.first?.id == id)
        #expect(store.macros.first?.name == "Intro")
        #expect(store.macros.first?.body == "[D] [A]")
    }

    @Test("persisted format remains a top-level macro array")
    func persistenceFormat() throws {
        let defaults = LVMPreferenceStorageTests.isolatedDefaults()
        let store = MacroStore(defaults: defaults)
        store.add(name: "Tag", body: "{start_of_tag}\n[G]Amen\n{end_of_tag}")

        let reloaded = MacroStore(defaults: defaults)
        #expect(reloaded.macros == store.macros)
    }
}

@Suite("LVM preference storage")
@MainActor
struct LVMPreferenceStorageTests {
    static func isolatedDefaults() -> UserDefaults {
        let suite = "lvm-studio-preference-tests-\(UUID().uuidString)"
        let store = UserDefaults(suiteName: suite)!
        store.removePersistentDomain(forName: suite)
        return store
    }

    @Test("app defaults read LVM keys")
    func appDefaultsStorage() {
        let store = Self.isolatedDefaults()
        store.set("dark", forKey: "lvm.defaults.theme")
        store.set("solfege", forKey: "lvm.defaults.chordStyle")
        store.set(true, forKey: "lvm.defaults.keepAwake")
        store.set(true, forKey: "lvm.viewer.autoHideChrome")

        let defaults = StudioDefaults(store: store)

        #expect(defaults.theme == .dark)
        #expect(defaults.chordStyle == .solfege)
        #expect(defaults.keepAwake)
        #expect(defaults.autoHideChrome)
    }

    @Test("viewer preferences read LVM song overrides")
    func viewerPrefsStorage() {
        let store = Self.isolatedDefaults()
        store.set([
            "default": "single",
            "songs": ["santo": "double"],
        ], forKey: "lvm.viewer.columnMode.v1")

        let preferences = ViewerPrefs(store: store)

        #expect(preferences.columnMode(for: "santo") == .double)
    }
}

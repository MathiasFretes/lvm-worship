//
//  MacroStore.swift
//  La Voz Misionera Studio
//
//  User-defined ChordPro snippets, saved locally.
//
//  Distinct from the quick-chord and quick-section buttons, which insert things core
//  knows about. A macro is whatever *this* person types often and core cannot predict:
//  a house intro, a tag with a specific turnaround, a two-chord vamp, the chorus of a
//  song being arranged in several keys.
//
//  Local and per-user on purpose. These are personal shorthand, not catalog content —
//  putting them in Supabase would mean a schema, RLS, and a sync story for something
//  whose whole value is that it is instant and private. `UserDefaults` is the right
//  size of hammer; if they ever need to follow an account across machines, that is a
//  deliberate later change rather than something to pre-build.
//

// Combine is imported explicitly because the target builds with
// SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY.
import Combine
import Foundation

struct SongMacro: Codable, Hashable, Identifiable {
    let id: UUID
    var name: String
    var body: String

    init(id: UUID = UUID(), name: String, body: String) {
        self.id = id
        self.name = name
        self.body = body
    }

    /// First line, trimmed, for the menu subtitle — enough to tell two macros apart
    /// without showing the whole block.
    var firstLine: String {
        body.components(separatedBy: .newlines)
            .first(where: { !$0.trimmed.isEmpty })?
            .trimmed ?? ""
    }
}

@MainActor
final class MacroStore: ObservableObject {
    static let shared = MacroStore()

    private static let key = "chordproMacros"

    @Published private(set) var macros: [SongMacro] = []

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.macros = Self.decode(defaults.data(forKey: Self.key), with: decoder)
    }

    func add(name: String, body: String) {
        let trimmedName = name.trimmed
        let trimmedBody = body.trimmed
        guard !trimmedName.isEmpty, !trimmedBody.isEmpty else { return }
        let normalized = Self.identity(trimmedName)
        if let existing = macros.firstIndex(where: { Self.identity($0.name) == normalized }) {
            // Keep the UUID and the original display spelling so menu identity and
            // keyboard focus remain stable while the snippet is updated.
            macros[existing].body = trimmedBody
        } else {
            macros.append(SongMacro(name: trimmedName, body: trimmedBody))
        }
        persist()
    }

    func remove(_ macro: SongMacro) {
        macros.removeAll { $0.id == macro.id }
        persist()
    }

    private func persist() {
        // Continue writing the original top-level array; this is a local persistence
        // format used by released builds, not an opportunity for a gratuitous schema.
        guard let data = try? encoder.encode(macros) else { return }
        defaults.set(data, forKey: Self.key)
    }

    private static func decode(_ data: Data?, with decoder: JSONDecoder) -> [SongMacro] {
        guard let data,
              let decoded = try? decoder.decode([SongMacro].self, from: data) else { return [] }
        // Reject unusable records independently rather than making one stale item
        // prevent every valid macro from loading.
        var names = Set<String>()
        return decoded.filter {
            let name = $0.name.trimmed
            let unique = names.insert(identity(name)).inserted
            return !name.isEmpty && !$0.body.trimmed.isEmpty && unique
        }
    }

    private static func identity(_ name: String) -> String {
        name.folding(options: [.caseInsensitive], locale: nil)
            .trimmed
    }
}

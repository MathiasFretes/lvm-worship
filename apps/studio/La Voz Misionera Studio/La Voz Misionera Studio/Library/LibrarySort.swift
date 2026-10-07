//
//  LibrarySort.swift
//  La Voz Misionera Studio
//
//  Grouping and sorting for the Song Library. Direct port of `buildSections`,
//  `bucketLetter` and `byTitle` in apps/mobile/src/screens/SongLibraryScreen.tsx.
//
//  Kept pure and free of SwiftUI so the rules are readable next to mobile's and
//  testable on their own:
//
//    - Title / Artist bucket by first letter (this is what drives the A–Z index).
//    - Key regroups into "Key of X", with the keyless songs under "No key".
//    - Recently added / Tempo are one flat, header-less section.
//    - The direction flips both the group order and the order within a group.
//

import Foundation

enum SortKey: String, CaseIterable, Identifiable, Sendable {
    case title, artist, key, recent, tempo

    var id: String { rawValue }

    /// Matches mobile's song.json `filterSheet.sort` strings.
    var label: String {
        switch self {
        case .title: return "Title"
        case .artist: return "Artist"
        case .key: return "Key"
        case .recent: return "Recently added"
        case .tempo: return "Tempo"
        }
    }

    /// Whether this sort produces lettered groups, i.e. whether an A–Z index means
    /// anything. Mobile gates its scrubber on exactly these two.
    var isLettered: Bool { self == .title || self == .artist }
}

enum SortDirection: String, Sendable {
    case ascending, descending

    var isDescending: Bool { self == .descending }
    var toggled: SortDirection { self == .ascending ? .descending : .ascending }
    var systemImage: String { self == .ascending ? "arrow.up" : "arrow.down" }
}

/// One group of songs in the library list.
struct LibrarySection: Identifiable {
    let id: String
    /// Header text; empty for the flat, header-less sorts.
    let title: String
    /// The A–Z index letter, or nil when this sort has no letters.
    let letter: String?
    let songs: [SongListItem]
}

enum LibrarySort {
    /// Group and sort `songs` for the active sort.
    static func sections(
        for songs: [SongListItem],
        sortKey: SortKey,
        direction: SortDirection
    ) -> [LibrarySection] {
        switch sortKey {
        case .title, .artist:
            return letteredSections(songs, by: sortKey, direction: direction)

        case .key:
            return keySections(songs, direction: direction)

        case .recent, .tempo:
            let data = flatSongs(songs, by: sortKey, direction: direction)
            return data.isEmpty ? [] : [LibrarySection(id: "__flat", title: "", letter: nil, songs: data)]
        }
    }

    private static func letteredSections(
        _ songs: [SongListItem],
        by sortKey: SortKey,
        direction: SortDirection
    ) -> [LibrarySection] {
        let groups = Dictionary(grouping: songs) { song in
            bucketLetter(sortKey == .artist ? song.artist : song.title)
        }
        return ordered(Array(groups.keys), direction: direction, using: localizedLess)
            .map { letter in
                let contents = ordered(groups[letter] ?? [], direction: direction) { lhs, rhs in
                    if sortKey == .artist {
                        let artistOrder = compare(lhs.artist ?? "", rhs.artist ?? "")
                        if artistOrder != .orderedSame { return artistOrder == .orderedAscending }
                    }
                    return byTitle(lhs, rhs)
                }
                return LibrarySection(id: letter, title: letter, letter: letter, songs: contents)
            }
    }

    private static func keySections(
        _ songs: [SongListItem],
        direction: SortDirection
    ) -> [LibrarySection] {
        let groups = Dictionary(grouping: songs) { normalizedKey($0.defaultKey) }
        return ordered(Array(groups.keys), direction: direction, using: localizedLess)
            .map { key in
                LibrarySection(
                    id: key.isEmpty ? "__nokey" : key,
                    title: key.isEmpty ? "No key" : "Key of \(key)",
                    letter: nil,
                    songs: ordered(groups[key] ?? [], direction: direction, using: byTitle)
                )
            }
    }

    private static func flatSongs(
        _ songs: [SongListItem],
        by sortKey: SortKey,
        direction: SortDirection
    ) -> [SongListItem] {
        switch sortKey {
        case .recent:
            // "Ascending" means the mobile default: newest first. Missing dates
            // remain at the end in either direction.
            return orderedPresentValues(
                songs,
                value: { $0.createdAt },
                direction: direction,
                ascending: { $0 > $1 }
            )
        case .tempo:
            return orderedPresentValues(
                songs,
                value: { $0.tempo },
                direction: direction,
                ascending: { $0 < $1 }
            )
        default:
            return songs
        }
    }

    private static func orderedPresentValues<Value>(
        _ songs: [SongListItem],
        value: (SongListItem) -> Value?,
        direction: SortDirection,
        ascending: (Value, Value) -> Bool
    ) -> [SongListItem] {
        let withValues = songs.filter { value($0) != nil }.sorted { lhs, rhs in
            guard let left = value(lhs), let right = value(rhs) else { return false }
            return direction.isDescending ? ascending(right, left) : ascending(left, right)
        }
        let missing = songs.filter { value($0) == nil }.sorted(by: byTitle)
        return withValues + missing
    }

    private static func ordered<Element>(
        _ values: [Element],
        direction: SortDirection,
        using areInIncreasingOrder: (Element, Element) -> Bool
    ) -> [Element] {
        values.sorted {
            direction.isDescending
                ? areInIncreasingOrder($1, $0)
                : areInIncreasingOrder($0, $1)
        }
    }

    private static func normalizedKey(_ key: String?) -> String {
        (key ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func compare(_ lhs: String, _ rhs: String) -> ComparisonResult {
        lhs.localizedCaseInsensitiveCompare(rhs)
    }

    private static func localizedLess(_ lhs: String, _ rhs: String) -> Bool {
        compare(lhs, rhs) == .orderedAscending
    }

    /// First letter A–Z, or "#" for anything else (digits, punctuation, other
    /// scripts) — so "10,000 Reasons" and "‘Tis So Sweet" both bucket under "#".
    static func bucketLetter(_ value: String?) -> String {
        let first = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            .prefix(1).uppercased()
        guard let scalar = first.unicodeScalars.first,
              scalar >= "A", scalar <= "Z" else { return "#" }
        return first
    }

    static func byTitle(_ lhs: SongListItem, _ rhs: SongListItem) -> Bool {
        compare(lhs.title, rhs.title) == .orderedAscending
    }
}

//
//  ExportController.swift
//  La Voz Misionera Studio
//
//  The export actions for whichever song is open, in one object so the toolbar menu
//  and the File menu drive the same code rather than each owning a copy.
//
//  The Viewer publishes it with `.focusedSceneObject`; the menu bar reads it back
//  with `@FocusedObject`. That is how a Mac app's menus reach the active window's
//  state, and it means File ▸ Export disables itself when no song is open.
//

// Combine is imported explicitly because the target builds with
// SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY.
import AppKit
import Combine
import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class ExportController: ObservableObject {
    @Published private(set) var isBusy = false
    /// Set to surface an alert; the Viewer presents it.
    @Published var alert: ExportAlert?

    /// What the actions operate on. Updated by the Viewer as the song and key change.
    ///
    /// `@Published` matters here beyond bookkeeping: the menu bar reads `isAvailable`
    /// through `@FocusedObject`, and a plain stored property would leave File ▸ Export
    /// disabled forever — the menu is built once while the song is still loading, and
    /// nothing would tell it to look again.
    @Published private(set) var song: SongDetail?
    @Published private(set) var exportKey = ""
    private var services: AppServices?

    private struct ExportContext {
        let services: AppServices
        let songID: String
        let key: String
    }

    private enum Destination {
        case save
        case share
    }

    struct ExportAlert: Identifiable {
        let id = UUID()
        let title: String
        let message: String
    }

    /// Whether the actions can run at all: a song is open and the API base is set.
    var isAvailable: Bool { song != nil && (services?.export.isConfigured ?? false) }

    func update(song: SongDetail?, exportKey: String, services: AppServices) {
        self.song = song
        self.exportKey = exportKey
        self.services = services
    }

    // MARK: - Actions

    func save(_ format: ExportFormat) {
        start(format: format, destination: .save)
    }

    func share(_ format: ExportFormat = .pdf) {
        start(format: format, destination: .share)
    }

    private func start(format: ExportFormat, destination: Destination) {
        guard let context = context(), !isBusy else { return }
        isBusy = true
        Task {
            do {
                let file = try await context.services.export.exportSong(
                    songID: context.songID,
                    key: context.key,
                    format: format
                )
                try await deliver(file, to: destination)
            } catch {
                alert = ExportAlert(
                    title: "Export failed",
                    message: (error as? LocalizedError)?.errorDescription ?? "\(error)"
                )
            }
            isBusy = false
        }
    }

    /// Capture all mutable viewer state before suspension. A transpose or song
    /// switch while the request is in flight must not alter that export.
    private func context() -> ExportContext? {
        guard let services, let song else { return nil }
        return ExportContext(services: services, songID: song.id, key: exportKey)
    }

    private func deliver(_ file: ExportService.ExportedFile, to destination: Destination) async throws {
        switch destination {
        case .save:
            // The panel grants sandbox access; bytes are written only after approval.
            guard let url = await Self.promptForDestination(filename: file.filename) else { return }
            try file.data.write(to: url, options: .atomic)
        case .share:
            let url = try Self.temporaryURL(for: file.filename)
            try file.data.write(to: url, options: .atomic)
            Self.presentSharingPicker(for: url)
        }
    }

    private static func promptForDestination(filename: String) async -> URL? {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = filename
        panel.canCreateDirectories = true
        if let type = UTType(filenameExtension: (filename as NSString).pathExtension) {
            panel.allowedContentTypes = [type]
        }
        return await panel.begin() == .OK ? panel.url : nil
    }

    private static func temporaryURL(for filename: String) throws -> URL {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("lvm-export-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: folder,
            withIntermediateDirectories: true
        )
        let safeName = (filename as NSString).lastPathComponent
        return folder.appendingPathComponent(safeName.isEmpty ? "song-export" : safeName)
    }

    private static func presentSharingPicker(for url: URL) {
        guard let view = NSApp.keyWindow?.contentView else { return }
        let picker = NSSharingServicePicker(items: [url])
        picker.show(relativeTo: .zero, of: view, preferredEdge: .minY)
    }
}

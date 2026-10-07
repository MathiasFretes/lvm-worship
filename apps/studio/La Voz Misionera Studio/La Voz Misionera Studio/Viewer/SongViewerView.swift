//
//  SongViewerView.swift
//  La Voz Misionera Studio
//
//  One song: header, chart, and the live view controls.
//
//  Structural port of apps/mobile/app/viewer/[slug].tsx. State lives in
//  SongViewerModel; this file is the presentation and the platform translation of
//  mobile's chrome:
//
//   - mobile's floating auto-hiding header becomes an in-content header plus real
//     window-toolbar buttons, because a Mac window already has a title bar and
//     hiding the only way back would be hostile.
//   - its bottom sheets become popovers anchored to the buttons that open them.
//   - the transpose bar stays a floating pill over the chart, which translates
//     directly and is the control a musician reaches for mid-song.
//
//  Every failure keeps a visible resting state: no bundle, a parse error, a missing
//  song, an expired session. A body the parser cannot handle still shows its lyrics.
//

import SwiftUI

struct SongViewerView: View {
    let slug: String
    let services: AppServices
    var showsBackButton: Bool
    var onBack: () -> Void
    var onSessionExpired: () -> Void

    @StateObject private var model: SongViewerModel
    @StateObject private var export = ExportController()
    @ObservedObject private var defaults: StudioDefaults
    @ObservedObject private var prefs: ViewerPrefs

    @State private var openPanel: Panel?
    /// Width of the chart area, which decides whether two columns are offered.
    @State private var availableWidth: CGFloat = 0

    private enum Panel: String, Identifiable {
        case options, key
        var id: String { rawValue }
    }

    /// Below this the second column is too narrow to read, so it is not offered —
    /// the same judgement mobile makes by restricting it to tablet widths.
    private static let twoColumnMinimumWidth: CGFloat = 900

    init(
        slug: String,
        services: AppServices,
        showsBackButton: Bool,
        onBack: @escaping () -> Void,
        onSessionExpired: @escaping () -> Void,
        defaults: StudioDefaults = .shared,
        prefs: ViewerPrefs = .shared
    ) {
        self.slug = slug
        self.services = services
        self.showsBackButton = showsBackButton
        self.onBack = onBack
        self.onSessionExpired = onSessionExpired
        self.defaults = defaults
        self.prefs = prefs
        _model = StateObject(wrappedValue: SongViewerModel(slug: slug, services: services, defaults: defaults))
    }

    private var offersTwoColumns: Bool { availableWidth >= Self.twoColumnMinimumWidth }
    private var columnMode: ColumnMode { offersTwoColumns ? prefs.columnMode(for: slug) : .single }

    private var chartOptions: ChartRenderOptions {
        ChartRenderOptions(
            showChords: model.showChords,
            showSections: model.showSections,
            fontScale: model.fontScale,
            splitInstrumentals: columnMode == .double
        )
    }

    var body: some View {
        content
            .navigationTitle(model.song?.title ?? "Song")
            .toolbar { toolbarItems }
            .task(id: slug) {
                model.onSessionExpired = onSessionExpired
                await model.load()
            }
            .keepScreenAwake(defaults.keepAwake)
            // Publish the export actions to the menu bar, and keep the song and key
            // they act on current. Mobile exports at the displayed key only when
            // transposed; an untouched song exports in its own key.
            .focusedSceneObject(export)
            .onChange(of: model.song?.id) { _, _ in syncExport() }
            .onChange(of: model.steps) { _, _ in syncExport() }
            .onAppear { syncExport() }
            .alert(
                export.alert?.title ?? "",
                isPresented: Binding(
                    get: { export.alert != nil },
                    set: { if !$0 { export.alert = nil } }
                ),
                presenting: export.alert
            ) { alert in
                Button("OK", role: .cancel) {}
            } message: { alert in
                Text(alert.message)
            }
    }

    private func syncExport() {
        export.update(
            song: model.song,
            exportKey: model.steps == 0 ? "" : model.effectiveKey,
            services: services
        )
    }

    @ViewBuilder
    private var content: some View {
        if model.isLoading {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorText = model.errorText {
            message(errorText, retry: true)
        } else if let song = model.song {
            loaded(song)
        } else {
            message("Song not found.", retry: false)
        }
    }

    /// The chart, plus the transpose bar floating over it.
    private func loaded(_ song: SongDetail) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                ScrollView {
                    VStack(alignment: .leading, spacing: LVMSpacing.lg) {
                        header(for: song)
                        Divider()
                        chart(for: song, viewportHeight: geometry.size.height)
                    }
                    .frame(maxWidth: LVMLayout.MaxWidth.content, alignment: .leading)
                    .padding(LVMSpacing.xl)
                    // Room for the last lines to clear the floating bar.
                    .padding(.bottom, model.showsTransposeBar ? 96 : 0)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }

                if model.showsTransposeBar {
                    TransposeBar(
                        keyLabel: model.keyLabel,
                        capoText: model.capoText,
                        onDown: { model.transpose(by: -1) },
                        onUp: { model.transpose(by: 1) },
                        onChooseKey: { openPanel = .key }
                    )
                    .padding(.bottom, 26)
                    .popover(isPresented: isPresented(.key), arrowEdge: .top) { keyPicker }
                }
            }
            .onAppear { availableWidth = geometry.size.width }
            .onChange(of: geometry.size.width) { _, width in availableWidth = width }
        }
    }

    // MARK: - Header

    @ViewBuilder
    private func header(for song: SongDetail) -> some View {
        VStack(alignment: .leading, spacing: LVMSpacing.xs) {
            HStack(alignment: .firstTextBaseline, spacing: LVMSpacing.sm) {
                Text(song.title)
                    .lvmTextStyle(.largeTitle)
                    .foregroundStyle(LVMColor.ink)
                    .lineLimit(2)
                StarButton(songID: song.id, services: services)
            }
            // Subtitle row: artist · Key pill · time signature · BPM.
            HStack(spacing: LVMSpacing.sm) {
                if let artist = song.artist, !artist.isEmpty {
                    Text(artist)
                        .lvmTextStyle(.rowSubtitle)
                        .foregroundStyle(LVMColor.sec)
                    if !model.keyLabel.isEmpty {
                        Circle().fill(LVMColor.muted).frame(width: 3, height: 3)
                    }
                }
                if !model.keyLabel.isEmpty {
                    Text("Key of \(model.keyLabel)")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(LVMColor.textAccent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(LVMColor.accentSoft, in: Capsule())
                }
                if let timeSignature = song.timeSignature, !timeSignature.isEmpty {
                    Text(timeSignature).lvmTextStyle(.rowMeta).foregroundStyle(LVMColor.muted)
                }
                if let tempo = song.tempo {
                    Text("\(tempo) bpm").lvmTextStyle(.rowMeta).foregroundStyle(LVMColor.muted)
                }
            }
        }
    }

    // MARK: - Chart

    @ViewBuilder
    private func chart(for song: SongDetail, viewportHeight: CGFloat) -> some View {
        if let doc = model.doc {
            if columnMode == .double {
                TwoColumnChartView(doc: doc, options: chartOptions, viewportHeight: viewportHeight)
            } else {
                ChordChartView(doc: doc, options: chartOptions)
            }
        } else if let parseErrorText = model.parseErrorText {
            rawFallback(song, note: parseErrorText)
        } else if (song.chordproContent ?? "").isEmpty {
            VStack(alignment: .leading, spacing: LVMSpacing.xs) {
                Text("No chart available").lvmTextStyle(.body).foregroundStyle(LVMColor.ink)
                Text("This song has no ChordPro content yet.")
                    .lvmTextStyle(.rowMeta).foregroundStyle(LVMColor.muted)
            }
        } else {
            rawFallback(song, note: nil)
        }
    }

    /// Lyrics recovered from a body the parser could not handle — better than an
    /// empty page, and the same fallback mobile shows.
    @ViewBuilder
    private func rawFallback(_ song: SongDetail, note: String?) -> some View {
        let lines = SongViewerModel.rawFallbackLines(from: song.chordproContent ?? "")
        VStack(alignment: .leading, spacing: 0) {
            if note != nil {
                Text("Chords unavailable — showing raw text")
                    .lvmTextStyle(.rowMeta)
                    .foregroundStyle(LVMColor.muted)
                    .padding(.bottom, LVMSpacing.md)
            }
            if lines.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) {
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    Text(line.isEmpty ? " " : line)
                        .font(.system(size: LVMChartMetrics.lyricSize * model.fontScale))
                        .foregroundStyle(LVMColor.ink)
                        .textSelection(.enabled)
                }
            } else {
                Text("No chart available").lvmTextStyle(.body).foregroundStyle(LVMColor.ink)
                Text("This song has no ChordPro content yet.")
                    .lvmTextStyle(.rowMeta).foregroundStyle(LVMColor.muted)
            }
        }
    }

    // MARK: - Toolbar and panels

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        if showsBackButton {
            ToolbarItem(placement: .navigation) {
                Button(action: onBack) {
                    Label("Library", systemImage: "chevron.left")
                }
                .help("Back to Library")
            }
        }
        ToolbarItem(placement: .primaryAction) {
            Button { openPanel = .options } label: {
                Label("View options", systemImage: "ellipsis")
            }
            .help("View options")
            .disabled(model.song == nil)
            .popover(isPresented: isPresented(.options), arrowEdge: .bottom) {
                ViewOptionsView(
                    model: model,
                    defaults: defaults,
                    columnMode: offersTwoColumns ? columnMode : nil,
                    onColumnMode: offersTwoColumns
                        ? { prefs.setColumnMode($0, for: slug) }
                        : nil
                )
            }
        }
        ToolbarItem(placement: .primaryAction) {
            // A menu, not a popover: these are three discrete commands, which is
            // exactly what a Mac menu is for — and it mirrors File ▸ Export item
            // for item instead of inventing a second vocabulary.
            Menu {
                Button("Export as PDF…") { export.save(.pdf) }
                Button("Export as JPG…") { export.save(.jpg) }
                Divider()
                Button("Share…") { export.share() }
            } label: {
                Label("Export and share", systemImage: "square.and.arrow.up")
            }
            .help(services.export.isConfigured
                  ? "Export and share"
                  : "Export needs API_BASE_URL — see apps/studio/README.md")
            .disabled(!export.isAvailable || export.isBusy)
        }
    }

    @ViewBuilder
    private var keyPicker: some View {
        KeyPickerView(
            songTitle: model.song?.title ?? "",
            currentKey: model.keyLabel.isEmpty ? nil : model.keyLabel,
            nativeKey: model.nativeKey.isEmpty ? nil : model.nativeKey,
            hasOverride: model.steps != 0,
            accidental: model.accidental,
            onAccidental: { model.setAccidental($0) },
            onPick: { model.pick(key: $0) },
            onClose: { openPanel = nil }
        )
    }

    /// One `openPanel` drives all three popovers, so opening one closes the others.
    private func isPresented(_ panel: Panel) -> Binding<Bool> {
        Binding(
            get: { openPanel == panel },
            set: { shown in
                if shown { openPanel = panel } else if openPanel == panel { openPanel = nil }
            }
        )
    }

    @ViewBuilder
    private func message(_ text: String, retry: Bool) -> some View {
        VStack(alignment: .leading, spacing: LVMSpacing.sm) {
            Text(text)
                .lvmTextStyle(.body)
                .foregroundStyle(LVMColor.sec)
                .fixedSize(horizontal: false, vertical: true)
            if retry {
                Button("Try Again") { Task { await model.load() } }
            }
        }
        .padding(LVMSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

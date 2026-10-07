//
//  StudioCommands.swift
//  La Voz Misionera Studio
//
//  Menu-bar commands. A Mac app is expected to expose its verbs in the menu bar —
//  discoverable, keyboard-navigable, scriptable — not only on a toolbar button.
//
//  Export lands in File after Save, where a Mac user looks for it. Appearance lands
//  in View, since it changes how the app looks rather than what it contains.
//
//  Both are `Commands` types rather than `View`s dropped into a `CommandGroup`,
//  because `@FocusedObject` only tracks the active scene when read from a Commands
//  body. `@FocusedObject` rather than `@FocusedValue` for the same reason the enabled
//  state kept sticking: FocusedValue hands over the object but does not observe it,
//  so the menu is built once while the song is still loading and never re-evaluated.
//

import SwiftUI

/// File ▸ Export as… / Share…, acting on the frontmost song.
struct ExportCommands: Commands {
    @FocusedObject private var controller: ExportController?

    private var canExport: Bool {
        controller.map { $0.isAvailable && !$0.isBusy } ?? false
    }

    var body: some Commands {
        CommandGroup(after: .saveItem) {
            Button("Export as PDF…") { export(.pdf) }
                .keyboardShortcut("e", modifiers: [.command])
                .disabled(!canExport)

            Button("Export as JPG…") { export(.jpg) }
                .keyboardShortcut("e", modifiers: [.command, .shift])
                .disabled(!canExport)

            Divider()

            Button("Share…") { controller?.share() }
                .disabled(!canExport)
            Divider()
        }
    }

    private func export(_ format: ExportFormat) {
        controller?.save(format)
    }
}

/// View ▸ Appearance ▸ System / Light / Dark.
struct AppearanceCommands: Commands {
    @ObservedObject var defaults: StudioDefaults

    var body: some Commands {
        // `.toolbar` is the View menu's own group, so this lands there rather than in
        // a menu of its own. A Picker in a menu renders as a native checkmarked
        // group, which is the right affordance for three exclusive choices.
        CommandGroup(after: .toolbar) {
            Picker("Appearance", selection: $defaults.theme) {
                ForEach(ThemePreference.allCases) { preference in
                    Text(preference.label).tag(preference)
                }
            }

            Divider()
        }
    }
}

/// View ▸ Library / Manage, and View ▸ Show Preview.
///
/// A Mac app is expected to let the menu bar reach anywhere the toolbar can. Section
/// switching lives in View because it changes what the window is showing rather than
/// what the document contains — the same reasoning that puts Appearance there.
struct NavigationCommands: Commands {
    @FocusedObject private var navigation: ShellNavigation?

    var body: some Commands {
        CommandGroup(before: .toolbar) {
            Button("Library") { navigation?.request(.library) }
                .keyboardShortcut("1", modifiers: .command)
                .disabled(!canOpen(.library))

            Button("Manage Songs") { navigation?.request(.manage) }
                .keyboardShortcut("2", modifiers: .command)
                // Disabled rather than hidden here: a menu whose items appear and
                // disappear is harder to learn than one where an item is greyed out.
                .disabled(!canOpen(.manage))

            Divider()
        }
    }

    private func canOpen(_ section: ShellNavigation.Section) -> Bool {
        guard let navigation else { return false }
        return section != .manage || navigation.canManage
    }
}

/// File ▸ New Song / Save / Publish, acting on the song open in the editor.
///
/// `@FocusedObject` on `EditorSession` rather than on the model directly, because the
/// session outlives any one song: the menu stays wired up while the user switches
/// between songs, and goes inert when the editor closes.
struct EditorCommands: Commands {
    @FocusedObject private var session: EditorSession?

    private var editor: SongEditorModel? { session?.editor }
    private var canSave: Bool {
        editor.map { $0.form.isSavable && !$0.isSaving } ?? false
    }
    private var canPublish: Bool {
        editor.map { !$0.isNew && $0.status != .published } ?? false
    }

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            // No shortcut here: ⌘N is bound on the toolbar button, and declaring it
            // twice makes AppKit pick one arbitrarily.
            Button("New Song") { session?.requestNew?() }
                .disabled(session?.requestNew == nil)

            // ⇧⌘I rather than ⌘I: ⌘I is italics in a text view, which the ChordPro
            // body is. Bound here and nowhere else — the editor's toolbar button
            // carries no key equivalent, so AppKit has nothing to choose between.
            Button("Import from PDF…") { session?.requestImport?() }
                .keyboardShortcut("i", modifiers: [.shift, .command])
                .disabled(session?.requestImport == nil)
        }

        // Verse / Chorus / Bridge get key equivalents because they are most of the
        // typing in a chord chart. The modifier is ⌃⌘ rather than plain ⌃ or ⌥, both of
        // which are already taken inside a text view:
        //
        //   ⌃B / ⌃V are NSTextView's emacs bindings (moveBackward / pageDown), so
        //   binding them would break cursor movement in the body.
        //   ⌥C types "ç" — which Turkish lyrics need, and this catalog has Turkish
        //   songs. ⌥V and ⌥B are √ and ∫.
        //
        // ⇧⌘V is Paste and Match Style in text apps, so ⌃⌘ is what is left that is both
        // free and conventional for app-specific verbs.
        CommandGroup(after: .pasteboard) {
            Divider()
            Group {
                Button("Wrap as Verse") { wrap("Verse") }
                    .keyboardShortcut("v", modifiers: [.control, .command])
                Button("Wrap as Chorus") { wrap("Chorus") }
                    .keyboardShortcut("c", modifiers: [.control, .command])
                Button("Wrap as Bridge") { wrap("Bridge") }
                    .keyboardShortcut("b", modifiers: [.control, .command])
            }
            .disabled(editor == nil)
        }

        CommandGroup(replacing: .saveItem) {
            Button("Save") { save() }
                .keyboardShortcut("s", modifiers: .command)
                .disabled(!canSave)

            Button("Publish…") { publish() }
                .disabled(!canPublish)

            Divider()
        }
    }

    private func wrap(_ label: String) {
        editor?.wrapSection(labeled: label)
    }

    private func save() {
        guard let editor else { return }
        Task { await editor.save() }
    }

    private func publish() {
        guard let editor else { return }
        Task { await editor.publish() }
    }
}

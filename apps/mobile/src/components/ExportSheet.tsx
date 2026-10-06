import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import FormSheetShell from './FormSheetShell'
import SymbolIcon, { type SymbolIconProps } from './SymbolIcon'
import { useFormSheet } from '../lib/formSheetHost'
import { useTheme } from '../theme/ThemeProvider'

// The viewer's "Export & share" sheet (share button), presented via the native
// formSheet route (src/lib/formSheetHost.ts): a bottom sheet on phones, a
// centered narrow form sheet on tablets. The screen owns the async work (export
// endpoint fetch, system share sheet, error alerts); this
// component only tracks which action is busy and disables the rest. PDF and
// JPG are equal side-by-side tiles — both export a file and open the system
// share sheet, just in different formats — so neither is a hero and there is
// no separate "share" button. No ChordPro option by design.

type Busy = 'pdf' | 'jpg' | null

type ExportSheetProps = {
  visible: boolean
  onClose: () => void
  onExport: (format: 'pdf' | 'jpg') => Promise<void>
}

export default function ExportSheet(props: ExportSheetProps) {
  useFormSheet(props.visible, () => <ExportContent {...props} />, props.onClose)
  return null
}

function ExportContent({ onClose, onExport }: ExportSheetProps) {
  const t = useTheme()
  const { t: tx } = useTranslation('export')
  const [busy, setBusy] = useState<Busy>(null)

  const run = (which: Exclude<Busy, null>, fn: () => Promise<void>) => async () => {
    if (busy) return
    setBusy(which)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <FormSheetShell title={tx('title')} onAction={onClose}>
      <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
        {/* Format tiles — PDF and JPG as equals; both open the share sheet. */}
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {(
            [
              { format: 'pdf', label: 'PDF', icon: 'doc.text' },
              { format: 'jpg', label: 'JPG', icon: 'photo' },
            ] as const
          ).map((tile) => (
            <FormatTile
              key={tile.format}
              label={tile.label}
              accessibilityLabel={tile.format === 'pdf' ? tx('exportAsPdf') : tx('exportAsJpg')}
              icon={tile.icon}
              busy={busy === tile.format}
              dimmed={!!busy && busy !== tile.format}
              disabled={!!busy}
              onPress={run(tile.format, () => onExport(tile.format))}
            />
          ))}
        </View>
      </View>
    </FormSheetShell>
  )
}

// Side-by-side export-format tile: accent icon over a short label, sized to
// share the row equally with its sibling. PDF and JPG use the same shape so
// the two formats read as equals.
function FormatTile({
  label,
  accessibilityLabel,
  icon,
  busy,
  dimmed,
  disabled,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  icon: SymbolIconProps['name']
  busy: boolean
  dimmed: boolean
  disabled: boolean
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 13,
        backgroundColor: t.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: t.colors.border,
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color={t.colors.accent} />
      ) : (
        <SymbolIcon name={icon} size={24} color={t.colors.accent} />
      )}
      <Text style={{ fontSize: 13, fontWeight: '600', color: t.colors.ink }}>{label}</Text>
    </Pressable>
  )
}


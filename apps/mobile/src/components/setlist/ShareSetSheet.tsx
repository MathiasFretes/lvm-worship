import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import FormSheetShell from '../FormSheetShell'
import SymbolIcon, { type SymbolIconProps } from '../SymbolIcon'
import { useFormSheet } from '../../lib/formSheetHost'
import { useTheme } from '../../theme/ThemeProvider'

// The setlist "Export & share" sheet (modeled on the viewer's ExportSheet),
// presented via the native formSheet route (src/lib/formSheetHost.ts). This is
// the builder version — whole-set only, no This song / Whole set scope toggle.
// Set PDF and Copy link work today (the same combined-PDF export
// the Performer uses, via /api/export/setlist). PDF is the primary (blue)
// action; Copy link is a full-width secondary row.

type Busy = 'pdf' | 'link' | null

type ShareSetProps = {
  visible: boolean
  onClose: () => void
  songCount: number
  onExport: () => Promise<void>
  onCopyLink: () => Promise<void>
}

export default function ShareSetSheet(props: ShareSetProps) {
  useFormSheet(props.visible, () => <ShareSetContent {...props} />, props.onClose)
  return null
}

function ShareSetContent({ onClose, songCount, onExport, onCopyLink }: ShareSetProps) {
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
        {/* Primary set-PDF export — combined PDF via /api/export/setlist. */}
        <Pressable
          onPress={run('pdf', onExport)}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel={tx('exportSetAsPdf')}
          style={{
            height: 50,
            borderRadius: 13,
            backgroundColor: t.colors.accent,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: t.spacing.sm,
            opacity: busy && busy !== 'pdf' ? 0.5 : 1,
          }}
        >
          {busy === 'pdf' ? (
            <ActivityIndicator color={t.colors.onAccent} />
          ) : (
            <SymbolIcon name="square.and.arrow.up" size={19} color={t.colors.onAccent} />
          )}
          <Text style={{ fontSize: 16, fontWeight: '700', color: t.colors.onAccent }}>
            {tx('exportSetAsPdfCount', { count: songCount })}
          </Text>
        </Pressable>

        {/* Copy link — works today via the web setlist URL. */}
        <SecondaryRow
          label={tx('copyLink')}
          icon="link"
          busy={busy === 'link'}
          dimmed={!!busy && busy !== 'link'}
          disabled={!!busy}
          onPress={run('link', onCopyLink)}
        />
      </View>
    </FormSheetShell>
  )
}

// Full-width secondary action row: accentSoft icon chip, label, trailing
// chevron. Shared shape for the Copy link row.
function SecondaryRow({
  label,
  icon,
  busy,
  dimmed,
  disabled,
  onPress,
}: {
  label: string
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
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        padding: t.spacing.md,
        borderRadius: 13,
        backgroundColor: t.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: t.colors.border,
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: t.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={t.colors.accent} />
        ) : (
          <SymbolIcon name={icon} size={15} color={t.colors.accent} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: t.colors.ink }}>{label}</Text>
      </View>
      <SymbolIcon name="chevron.right" size={14} color={t.colors.sec} />
    </Pressable>
  )
}

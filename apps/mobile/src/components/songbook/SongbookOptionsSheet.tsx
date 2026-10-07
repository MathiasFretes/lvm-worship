import { useCallback, useState } from 'react'
import { ActivityIndicator, Image, Pressable, Switch, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import FormSheetShell from '../FormSheetShell'
import TextField from '../TextField'
import SymbolIcon from '../SymbolIcon'
import { useFormSheet } from '../../lib/formSheetHost'
import { useTheme } from '../../theme/ThemeProvider'

export type SongbookOptionsProps = {
  visible: boolean
  onClose: () => void
  songCount: number
  title: string
  onChangeTitle: (v: string) => void
  subtitle: string
  onChangeSubtitle: (v: string) => void
  includeTOC: boolean
  onToggleTOC: (v: boolean) => void
  coverImageDataUrl: string | null
  coverName: string | null
  onPickCover: () => void
  onClearCover: () => void
  onExport: () => Promise<void>
}

export default function SongbookOptionsSheet(props: SongbookOptionsProps) {
  useFormSheet(props.visible, () => <SongbookOptionsContent {...props} />, props.onClose)
  return null
}

function TocOption({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const t = useTheme()
  const { t: tx } = useTranslation('utilities')

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        padding: t.spacing.md,
        borderRadius: 13,
        backgroundColor: t.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: t.colors.ink }}>
          {tx('songbook.tocLabel')}
        </Text>
        <Text style={{ fontSize: 11.5, color: t.colors.sec, marginTop: 2 }}>
          {tx('songbook.tocHint')}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.colors.accent, false: t.colors.border }}
        accessibilityLabel={tx('songbook.tocLabel')}
      />
    </View>
  )
}

type CoverOptionProps = Pick<
  SongbookOptionsProps,
  'coverImageDataUrl' | 'coverName' | 'onPickCover' | 'onClearCover'
>

function CoverOption({ coverImageDataUrl, coverName, onPickCover, onClearCover }: CoverOptionProps) {
  const t = useTheme()
  const { t: tx } = useTranslation('utilities')

  return (
    <View style={{ gap: t.spacing.sm }}>
      <Text style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.1, color: t.colors.sec }}>
        {tx('songbook.coverLabel')}
      </Text>
      {coverImageDataUrl ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            padding: t.spacing.sm,
            borderRadius: 13,
            backgroundColor: t.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: t.colors.border,
          }}
        >
          <Image
            source={{ uri: coverImageDataUrl }}
            style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: t.colors.border }}
            resizeMode="cover"
          />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: t.colors.ink }}>
            {coverName || tx('songbook.coverLabel')}
          </Text>
          <Pressable
            onPress={onPickCover}
            accessibilityRole="button"
            accessibilityLabel={tx('songbook.replaceCover')}
            hitSlop={8}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: t.colors.textAccent }}>
              {tx('songbook.replaceCover')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClearCover}
            accessibilityRole="button"
            accessibilityLabel={tx('songbook.removeCover')}
            hitSlop={8}
          >
            <SymbolIcon name="trash" size={16} color={t.colors.sec} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onPickCover}
          accessibilityRole="button"
          accessibilityLabel={tx('songbook.addCover')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            padding: t.spacing.md,
            borderRadius: 13,
            backgroundColor: t.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: t.colors.border,
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
            <SymbolIcon name="photo" size={15} color={t.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: t.colors.ink }}>
              {tx('songbook.addCover')}
            </Text>
            <Text style={{ fontSize: 11.5, color: t.colors.sec }}>{tx('songbook.coverHint')}</Text>
          </View>
        </Pressable>
      )}
    </View>
  )
}

function SongbookOptionsContent({
  onClose,
  songCount,
  title,
  onChangeTitle,
  subtitle,
  onChangeSubtitle,
  includeTOC,
  onToggleTOC,
  coverImageDataUrl,
  coverName,
  onPickCover,
  onClearCover,
  onExport,
}: SongbookOptionsProps) {
  const t = useTheme()
  const { t: tx } = useTranslation('utilities')
  const [busy, setBusy] = useState(false)

  const runExport = useCallback(async () => {
    if (busy || songCount === 0) return
    setBusy(true)
    try {
      await onExport()
    } finally {
      setBusy(false)
    }
  }, [busy, onExport, songCount])

  return (
    <FormSheetShell title={tx('songbook.optionsTitle')} onAction={onClose}>
      <View style={{ padding: t.spacing.lg, gap: t.spacing.lg }}>
        <TextField
          label={tx('songbook.nameLabel')}
          icon="book"
          value={title}
          onChangeText={onChangeTitle}
          placeholder={tx('songbook.namePlaceholder')}
          autoCapitalize="words"
        />

        <TextField
          label={tx('songbook.subtitleLabel')}
          icon="calendar"
          value={subtitle}
          onChangeText={onChangeSubtitle}
          placeholder={tx('songbook.subtitlePlaceholder')}
          autoCapitalize="words"
        />

        <TocOption value={includeTOC} onChange={onToggleTOC} />

        <CoverOption
          coverImageDataUrl={coverImageDataUrl}
          coverName={coverName}
          onPickCover={onPickCover}
          onClearCover={onClearCover}
        />

        <Pressable
          onPress={runExport}
          disabled={busy || songCount === 0}
          accessibilityRole="button"
          accessibilityLabel={tx('songbook.exportPdf', { count: songCount })}
          style={{
            height: 50,
            borderRadius: 13,
            backgroundColor: t.colors.accent,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: t.spacing.sm,
            opacity: busy || songCount === 0 ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={t.colors.onAccent} />
          ) : (
            <SymbolIcon name="square.and.arrow.up" size={19} color={t.colors.onAccent} />
          )}
          <Text style={{ fontSize: 16, fontWeight: '700', color: t.colors.onAccent }}>
            {tx('songbook.exportPdf', { count: songCount })}
          </Text>
        </Pressable>
      </View>
    </FormSheetShell>
  )
}

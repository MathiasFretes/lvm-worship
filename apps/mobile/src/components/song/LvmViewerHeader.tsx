import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import HeaderIconButton from '../HeaderIconButton'
import { PersonalChip } from '../PersonalChip'
import StarButton from '../StarButton'
import SymbolIcon from '../SymbolIcon'
import { useTheme } from '../../theme/ThemeProvider'

type Props = {
  title: string
  personal: boolean
  songId?: string
  keyLabel: string
  timeSignature?: string | null
  tempo?: number | null
  onBack: () => void
  onEdit: () => void
  onOptions: () => void
  onExport: () => void
  onAudio?: () => void
  onTablature?: () => void
  onScore?: () => void
  onAddToService?: () => void
}

/** Song identity and actions stay visible above the projected chart. */
export default function LvmViewerHeader(props: Props) {
  const theme = useTheme()
  const { t } = useTranslation(['song', 'common', 'export', 'nav', 'setlist', 'utilities'])
  return <>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" onPress={props.onBack} hitSlop={8}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <SymbolIcon name="chevron.left" size={22} color={theme.colors.accent} />
        <Text style={{ fontSize: 16, color: theme.colors.accent }}>{t('nav:songs')}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {props.onAddToService && <HeaderIconButton icon="list.bullet" label={t('setlist:service.add')} onPress={props.onAddToService} />}
        {props.personal && <HeaderIconButton icon="square.and.pencil" label={t('song:viewer.editSong')} onPress={props.onEdit} />}
        <HeaderIconButton icon="ellipsis" label={t('song:viewer.viewOptions')} onPress={props.onOptions} />
        <HeaderIconButton icon="square.and.arrow.up" iconSize={22}
          label={t('export:exportAndShare')} onPress={props.onExport} />
      </View>
    </View>
    <View style={{ marginTop: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Text numberOfLines={2} style={{ flexShrink: 1, ...theme.typography.largeTitle, color: theme.colors.ink }}>
        {props.title}
      </Text>
      {props.personal ? <PersonalChip /> : <StarButton songId={props.songId} />}
    </View>
    <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm }}>
      {props.onAudio && <Pressable accessibilityRole="button" onPress={props.onAudio}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        <SymbolIcon name="music.note" size={17} color={theme.colors.accent} />
        <Text style={{ color: theme.colors.textAccent }}>{t('utilities:mixer.songAudio')}</Text>
      </Pressable>}
      {(['tablature', 'score'] as const).map(kind => {
        const action = kind === 'tablature' ? props.onTablature : props.onScore
        return action ? <Pressable key={kind} accessibilityRole="button" onPress={action}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textAccent }}>{t(`utilities:${kind}.title`)}</Text>
        </Pressable> : null
      })}
      {props.keyLabel && <View style={{ paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentSoft }}>
        <Text style={{ color: theme.colors.textAccent, fontSize: 13, fontWeight: '700' }}>
          {t('common:keyOf', { key: props.keyLabel })}
        </Text>
      </View>}
      {props.timeSignature && <Text style={{ color: theme.colors.muted, fontSize: 12.5 }}>{props.timeSignature}</Text>}
      {props.tempo && <Text style={{ color: theme.colors.muted, fontSize: 12.5 }}>
        {t('common:bpm', { tempo: props.tempo })}
      </Text>}
    </View>
  </>
}

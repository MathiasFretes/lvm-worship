import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import FormSheetShell from '../FormSheetShell'
import ActionSheetRow from './ActionSheetRow'
import { useFormSheet } from '../../lib/formSheetHost'
import { useTheme } from '../../theme/ThemeProvider'
import type { SymbolIconProps } from '../SymbolIcon'

// The setlist ••• sheet: Rename set / Saved sets… / New set / Delete set.
// Presented via the native formSheet route (src/lib/formSheetHost.ts).
// "Saved sets…" navigates back to the Setlists tab (the saved-sets list
// screen) rather than opening a nested sheet.
type SetOptionsProps = {
  visible: boolean
  onClose: () => void
  onRename: () => void
  onSavedSets: () => void
  onNewSet: () => void
  onDeleteSet: () => void
}

export default function SetOptionsSheet(props: SetOptionsProps) {
  useFormSheet(props.visible, () => <SetOptionsContent {...props} />, props.onClose)
  return null
}

function SetOptionsContent({ onClose, onRename, onSavedSets, onNewSet, onDeleteSet }: SetOptionsProps) {
  const t = useTheme()
  const { t: tx } = useTranslation('setlist')

  const actions: Array<{
    icon: SymbolIconProps['name']
    label: string
    action: () => void
    destructive?: boolean
  }> = [
    { icon: 'pencil', label: tx('options.renameSet'), action: onRename },
    { icon: 'list.bullet', label: tx('options.savedSets'), action: onSavedSets },
    { icon: 'plus', label: tx('options.newSet'), action: onNewSet },
    { icon: 'trash', label: tx('options.deleteSet'), action: onDeleteSet, destructive: true },
  ]

  return (
    <FormSheetShell title={tx('options.title')} onAction={onClose}>
      <View style={{ padding: t.spacing.lg, gap: t.spacing.sm }}>
        {actions.map((item) => (
          <ActionSheetRow
            key={item.label}
            icon={item.icon}
            label={item.label}
            destructive={item.destructive}
            onPress={() => {
              onClose()
              item.action()
            }}
          />
        ))}
      </View>
    </FormSheetShell>
  )
}

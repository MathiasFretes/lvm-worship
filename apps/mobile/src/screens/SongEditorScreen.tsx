import { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  CHROMATIC_KEYS,
  TIME_SIGNATURES,
  LANGUAGE_OPTIONS,
  SECTION_PRESETS,
  getDiatonicChords,
  insertAtCursor,
  wrapSection,
  chordInsertToken,
  parseChordProOrLegacy,
  type SongDoc,
} from '@lavozmisionera/core'
import Screen from '../components/Screen'
import Button from '../components/Button'
import SymbolIcon from '../components/SymbolIcon'
import ChordChart from '../components/ChordChart'
import { useTheme } from '../theme/ThemeProvider'
import { useSongDraft } from '../lib/useSongDraft'
import { useUserRole } from '../lib/useUserRole'
import { actionFailureMessage } from '../lib/errors'

// Mobile song editor at parity with the web editor: metadata fields + a ChordPro
// body with chord/section insert bars (both driven by the shared core helpers,
// so the two apps produce identical output) + a live preview + role-aware
// actions (Save draft, Submit for review, or Publish for editor+).
export default function SongEditorScreen() {
  const t = useTheme()
  const { t: tx } = useTranslation(['song', 'common'])
  const router = useRouter()
  const params = useLocalSearchParams<{ draftId: string | string[] }>()
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId
  const { role } = useUserRole()
  const draft = useSongDraft(draftId ?? '', role)
  const { form, setField, errors, hasErrors, busy, canPublish } = draft

  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [tagInput, setTagInput] = useState('')
  const [selection, setSelection] = useState({ start: 0, end: 0 })

  const diatonic = useMemo(
    () => (getDiatonicChords(form.default_key) ?? []) as Array<{ symbol: string; display: string; degree: string }>,
    [form.default_key],
  )

  const preview = useMemo<{ doc: SongDoc | null; invalid: boolean }>(() => {
    if (mode !== 'preview' || !form.chordpro_content.trim()) return { doc: null, invalid: false }
    try {
      return { doc: parseChordProOrLegacy(form.chordpro_content), invalid: false }
    } catch {
      return { doc: null, invalid: true }
    }
  }, [mode, form.chordpro_content])

  function applyBody(next: { value: string; selection: { start: number; end: number } }) {
    setField('chordpro_content', next.value)
    setSelection(next.selection)
  }

  function insertChord(symbol: string) {
    applyBody(insertAtCursor(form.chordpro_content, selection, chordInsertToken(symbol)))
  }

  function insertSection(directive: string, label: string) {
    applyBody(wrapSection(form.chordpro_content, selection, { directive, label }))
  }

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,/g, '').trim()
    if (!tag) return
    if (!form.tags.includes(tag)) setField('tags', [...form.tags, tag])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setField(
      'tags',
      form.tags.filter((x) => x !== tag),
    )
  }

  async function run(action: () => Promise<unknown>, successMsg: string) {
    try {
      await action()
      Alert.alert(tx('common:done'), successMsg)
      router.back()
    } catch (err) {
      Alert.alert(
        tx('editor.actionFailed'),
        actionFailureMessage('SongEditor.save', err, (key) => tx(key)),
      )
    }
  }

  const primaryLabel = canPublish ? tx('editor.publish') : tx('editor.submitForReview')
  const primaryAction = canPublish
    ? () => run(draft.publish, tx('editor.published'))
    : () => run(draft.submitForReview, tx('editor.submitted'))

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.sm,
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <Text style={{ fontSize: 16, color: t.colors.textAccent }}>{tx('common:cancel')}</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: t.colors.ink }}>
          {form.title || tx('editor.newSong')}
        </Text>
        <Pressable
          onPress={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={{ fontSize: 16, color: t.colors.textAccent }}>
            {mode === 'edit' ? tx('editor.preview') : tx('editor.edit')}
          </Text>
        </Pressable>
      </View>

      {mode === 'preview' ? (
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
          {preview.doc ? (
            <ChordChart doc={preview.doc} steps={0} preferFlat={false} />
          ) : (
            <Text style={{ color: preview.invalid ? t.colors.danger : t.colors.sec }}>
              {tx(preview.invalid ? 'editor.invalidPreview' : 'editor.emptyPreview')}
            </Text>
          )}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: t.spacing.xxl }}
            keyboardShouldPersistTaps="handled"
          >
            <Field label={tx('editor.title')} error={errors.title && tx('editor.titleRequired')}>
              <PlainInput value={form.title} onChangeText={(v) => setField('title', v)} placeholder={tx('editor.titlePlaceholder')} />
            </Field>

            <Field label={tx('editor.key')} error={errors.default_key && tx('editor.keyRequired')}>
              <ChipRow
                options={CHROMATIC_KEYS}
                selected={form.default_key}
                onSelect={(v) => setField('default_key', v)}
              />
            </Field>

            <Field label={tx('editor.artist')}>
              <PlainInput value={form.artist} onChangeText={(v) => setField('artist', v)} placeholder={tx('editor.artistPlaceholder')} />
            </Field>

            <Field label={tx('editor.tags')} error={errors.tags && tx('editor.tagsRequired')}>
              <PlainInput
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={() => addTag(tagInput)}
                placeholder={tx('editor.tagsPlaceholder')}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {form.tags.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => removeTag(tag)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: t.radii.pill,
                      backgroundColor: t.colors.accentSoft,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: t.colors.textAccent }}>{tag}</Text>
                    <SymbolIcon name="xmark" size={10} color={t.colors.textAccent} />
                  </Pressable>
                ))}
              </View>
            </Field>

            <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label={tx('editor.timeSignature')}>
                  <ChipRow
                    options={TIME_SIGNATURES}
                    selected={form.time_signature}
                    onSelect={(v) => setField('time_signature', v)}
                  />
                </Field>
              </View>
              <View style={{ width: 110 }}>
                <Field label={tx('editor.tempo')} error={errors.tempo && tx('editor.tempoInvalid')}>
                  <PlainInput
                    value={form.tempo ? String(form.tempo) : ''}
                    onChangeText={(v) => setField('tempo', v ? parseInt(v, 10) || '' : '')}
                    placeholder="BPM"
                    keyboardType="number-pad"
                  />
                </Field>
              </View>
            </View>

            <Field label={tx('editor.language')}>
              <ChipRow
                options={LANGUAGE_OPTIONS.filter(Boolean)}
                selected={form.language}
                onSelect={(v) => setField('language', form.language === v ? '' : v)}
              />
            </Field>

            <Field label={tx('editor.country')}>
              <PlainInput value={form.country} onChangeText={(v) => setField('country', v)} placeholder={tx('editor.countryPlaceholder')} />
            </Field>

            <Field label={tx('editor.youtube')} error={errors.youtube_id && tx('editor.youtubeInvalid')}>
              <PlainInput value={form.youtube_id} onChangeText={(v) => setField('youtube_id', v)} placeholder="dQw4w9WgXcQ" />
            </Field>

            {/* ChordPro body + insert bars */}
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: t.colors.sec, marginTop: t.spacing.md, marginBottom: t.spacing.sm }}>
              {tx('editor.chart')}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {SECTION_PRESETS.map((p) => (
                  <BarButton key={p.label} label={p.label} onPress={() => insertSection(p.directive, p.sectionLabel)} />
                ))}
              </View>
            </ScrollView>

            {diatonic.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {diatonic.map((c) => (
                    <BarButton key={c.symbol} label={c.display} onPress={() => insertChord(c.symbol)} accent />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={{ fontSize: 12.5, color: t.colors.sec, marginBottom: 8 }}>
                {tx('editor.keyHint')}
              </Text>
            )}

            <TextInput
              value={form.chordpro_content}
              onChangeText={(v) => setField('chordpro_content', v)}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              selection={selection}
              multiline
              placeholder={tx('editor.chartPlaceholder')}
              placeholderTextColor={t.colors.sec}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                minHeight: 220,
                borderWidth: 1,
                borderColor: t.colors.border,
                borderRadius: t.radii.md,
                backgroundColor: t.colors.surface,
                color: t.colors.ink,
                padding: t.spacing.md,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />

            <View style={{ gap: t.spacing.sm, marginTop: t.spacing.lg }}>
              <Button
                title={busy ? tx('editor.working') : primaryLabel}
                onPress={primaryAction}
                disabled={busy || hasErrors}
              />
              <Button
                title={tx('editor.saveDraft')}
                variant="secondary"
                onPress={() => run(async () => draft.saveDraft(), tx('editor.draftSaved'))}
                disabled={busy}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const t = useTheme()
  return (
    <View style={{ marginBottom: t.spacing.md }}>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: t.colors.sec, marginBottom: t.spacing.sm }}>
        {label}
      </Text>
      {children}
      {error ? <Text style={{ fontSize: 12.5, color: t.colors.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  )
}

function PlainInput(props: React.ComponentProps<typeof TextInput>) {
  const t = useTheme()
  return (
    <TextInput
      placeholderTextColor={t.colors.sec}
      {...props}
      style={{
        height: 48,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.surface,
        color: t.colors.ink,
        paddingHorizontal: t.spacing.md,
        fontSize: t.typography.body.fontSize,
      }}
    />
  )
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[]
  selected: string
  onSelect: (v: string) => void
}) {
  const t = useTheme()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((opt) => {
          const on = opt === selected
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: t.radii.pill,
                backgroundColor: on ? t.colors.accent : t.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: on ? t.colors.accent : t.colors.border,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: on ? t.colors.onAccent : t.colors.ink }}>
                {opt}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

function BarButton({ label, onPress, accent }: { label: string; onPress: () => void; accent?: boolean }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: t.radii.sm,
        backgroundColor: accent ? t.colors.accentSoft : t.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: accent ? t.colors.textAccent : t.colors.ink }}>
        {label}
      </Text>
    </Pressable>
  )
}

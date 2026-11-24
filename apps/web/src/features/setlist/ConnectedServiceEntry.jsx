import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/layout-kit'
import PageContainer from '../../components/layout/PageContainer'
import { exchangeRequest, listServiceDrafts, openServiceDraft, serviceScope } from './serviceDrafts'
import { draftFromWorshipPlan } from '@lavozmisionera/core/setlists/worshipDraft.js'

export default function ConnectedServiceEntry({ userId, churchId, serviceId, children }) {
  const { t } = useTranslation(['pages', 'common'])
  const scope = serviceScope(userId, churchId, serviceId)
  const [initial] = useState(() => { try { return { drafts: listServiceDrafts(localStorage, scope) } } catch (error) { return { drafts: [], error } } })
  const drafts = initial.drafts
  const [key, setKey] = useState('')
  const [openError, setOpenError] = useState(initial.error || null)
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current || drafts.length > 1 || initial.error) return
    opened.current = true
    try { setKey(openServiceDraft(localStorage, serviceScope(userId, churchId, serviceId), drafts[0]?.key, crypto.randomUUID())) }
    catch (error) { setOpenError(error) }
  }, [userId, churchId, serviceId, drafts, initial.error])
  function choose(previousKey) {
    try { setKey(openServiceDraft(localStorage, scope, previousKey, crypto.randomUUID())) }
    catch (error) { setOpenError(error) }
  }
  function openRemote(exchange) {
    try {
      const draft = draftFromWorshipPlan(exchange.plan, exchange.context)
      const nextKey = openServiceDraft(localStorage, scope, null, crypto.randomUUID())
      localStorage.setItem(nextKey, JSON.stringify(draft))
      localStorage.setItem(`${nextKey}:exchange`, JSON.stringify({ exchange }))
      setOpenError(null)
      setKey(nextKey)
    } catch (error) { setOpenError(error) }
  }
  if (openError && !key) return <PageContainer><p role="alert">{t('mixer.restoreError')}</p></PageContainer>
  if (!key) return <PageContainer><h1>{t('setlist.savedSets')}</h1>
    <ul>{drafts.map(({ key, draft }, index) => <li key={key}><Button onClick={() => choose(key)}>{draft.name || t('setlist.untitledSet')} · {index + 1}</Button></li>)}</ul>
    <Button onClick={() => choose(null)}>{t('setlist.newSet')}</Button>
  </PageContainer>
  return <ActiveServiceDraft key={key} scope={scope} draftKey={key} openRemote={openRemote} openError={openError}>{children}</ActiveServiceDraft>
}

function readMetadata(key) {
  try { return JSON.parse(localStorage.getItem(`${key}:exchange`) || 'null') || {} } catch { return {} }
}
function ActiveServiceDraft({ scope, draftKey, children, openRemote, openError }) {
  const [initial] = useState(() => readMetadata(draftKey))
  const [exchange, setExchange] = useState(initial.exchange || null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(!!initial.pending)
  const [saved, setSaved] = useState(false)
  const metadata = useRef(initial)
  const running = useRef(false)
  const mounted = useRef(false)
  const controller = useRef(null)
  const scopeRef = useRef(scope)
  const persist = () => localStorage.setItem(`${draftKey}:exchange`, JSON.stringify(metadata.current))
  const flushRef = useRef(null)
  flushRef.current = async () => {
    if (running.current || !metadata.current.pending || !mounted.current) return
    running.current = true
    setBusy(true); setError('')
    const operation = metadata.current.pending
    const requestController = controller.current
    try {
      const result = await exchangeRequest(scopeRef.current, { method: 'PUT', input: operation.input, operationId: operation.id, signal: requestController.signal })
      if (!mounted.current || requestController.signal.aborted) return
      metadata.current = { ...metadata.current, exchange: result, pending: null }
      persist()
      setExchange(result); setPending(false); setSaved(true)
    } catch (error) { if (mounted.current && !requestController.signal.aborted) setError(error.message) }
    finally {
      running.current = false
      if (mounted.current) {
        setBusy(false)
        // Strict Mode can reopen the effect before the aborted request settles.
        if (requestController.signal.aborted && controller.current !== requestController && metadata.current.pending) void flushRef.current?.()
      }
    }
  }
  useEffect(() => {
    mounted.current = true
    const abort = new AbortController()
    controller.current = abort
    const reconnect = () => { void flushRef.current?.() }
    window.addEventListener('online', reconnect)
    if (!metadata.current.exchange) {
      exchangeRequest(scopeRef.current, { signal: abort.signal }).then((result) => {
        if (!mounted.current || abort.signal.aborted) return
        metadata.current.exchange = result
        try { localStorage.setItem(`${draftKey}:exchange`, JSON.stringify(metadata.current)); setExchange(result) }
        catch (error) { setError(error.message) }
      }).catch((error) => { if (mounted.current && !abort.signal.aborted) setError(error.message) })
    }
    if (metadata.current.pending) reconnect()
    return () => { mounted.current = false; abort.abort(); window.removeEventListener('online', reconnect) }
  }, [draftKey])
  async function refresh() {
    if (busy || metadata.current.pending) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const result = await exchangeRequest(scopeRef.current, { signal: controller.current.signal })
      if (!mounted.current) return
      metadata.current.exchange = result
      persist(); setExchange(result)
    } catch (error) { if (mounted.current) setError(error.message) }
    finally { if (mounted.current) setBusy(false) }
  }
  async function submit(plan) {
    if (running.current) return
    if (metadata.current.pending) return flushRef.current()
    if (!exchange?.canPrepare || plan.serviceId !== scope.serviceId) return
    try {
      metadata.current.pending = { id: crypto.randomUUID(), input: { plan, revision: exchange.revision, serviceRevision: exchange.serviceRevision } }
      persist(); setPending(true); setSaved(false)
    } catch (error) { metadata.current.pending = null; setError(error.message); return }
    await flushRef.current()
  }
  function cancelPending() {
    if (busy) return
    try {
      const next = { ...metadata.current, pending: null }
      localStorage.setItem(`${draftKey}:exchange`, JSON.stringify(next))
      metadata.current = next; setPending(false); setSaved(false); setError('')
    } catch (error) { setError(error.message) }
  }
  return children({ exchange, draftKey, error: error || openError?.message, busy, pending, saved, submit, refresh, cancelPending, openRemote: () => openRemote(exchange) })
}

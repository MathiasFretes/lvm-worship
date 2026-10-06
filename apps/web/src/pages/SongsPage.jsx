import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigationType, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { compareSongsByTitle } from '../utils/songs/sort'
import { normalizeSongSearch, searchSongs } from '../utils/songs/search'
import { useSongs } from '../hooks/useSongs'
import { usePersonalSongs } from '../hooks/usePersonalSongs'
import { Chip, Input } from '../components/ui/layout-kit'
import { SongLibraryCard } from '../features/song-library/SongLibraryCard'
import { isIncompleteSong } from '../utils/songs/songStatus'
import { buildTagMap, canonicalizeTags, isHiddenTag, normalizeTagKey, tagLabelFromKey } from '../utils/songs/tags'
import {
  buildGroupSearchText,
  buildSongCatalog,
  getLanguageChipLabel,
  hasGroupLanguage,
  resolveGroupEntry,
  resolveInitialSongLanguage,
  writeSongLanguagePreference,
} from '../utils/songs/songCatalog'

const SITE_URL = 'https://lavozmisionera.com'
const OG_IMAGE_URL = `${SITE_URL}/favicon.ico`
const SONGS_TITLE = 'Browse Songs — Free Worship Chord Sheets & Lyrics | La Voz Misionera'
const SONGS_DESCRIPTION = 'Browse free worship chord sheets and lyrics for churches, worship teams, and believers. Build setlists and access transposable charts at La Voz Misionera.'

export default function Songs(){
  const { t } = useTranslation(['pages', 'home'])
  const { songs: itemsRaw, loading: catalogLoading, error: catalogError, retry: retryCatalog } = useSongs()
  const { personalSongs } = usePersonalSongs()
  const catalog = useMemo(() => buildSongCatalog(itemsRaw), [itemsRaw])
  const languageChipCodes = catalog.translationLanguages || []
  const [selectedLanguage, setSelectedLanguage] = useState(() =>
    resolveInitialSongLanguage(languageChipCodes.length ? languageChipCodes : catalog.allLanguages)
  )
  const [searchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || ''
  const [q, setQ] = useState(initialQ)

  useEffect(() => {
    writeSongLanguagePreference(selectedLanguage)
  }, [selectedLanguage])

  const tagMap = useMemo(() => buildTagMap(catalog.items), [catalog.items])
  const COMMUNITY_KEY = useMemo(() => normalizeTagKey('Community'), [])

  const items = useMemo(() => {
    const out = []
    for (const group of catalog.groups || []) {
      let display = resolveGroupEntry(group, selectedLanguage)
      if (!display) continue
      if (isIncompleteSong(display)) {
        const fallback = group.variants.find((v) => !isIncompleteSong(v))
        if (!fallback) continue
        display = fallback
      }
      const { keys, labels } = canonicalizeTags(display.tags || [], tagMap)
      const searchTags = Array.from(
        new Set(group.variants.flatMap((v) => v.tags || []))
      )
      const searchAuthors = Array.from(
        new Set(group.variants.flatMap((v) => v.authors || []))
      )
      out.push({
        ...display,
        tags: labels,
        tagKeys: keys,
        hasSelectedLanguage: hasGroupLanguage(group, selectedLanguage),
        hasTranslations: group.variants.length > 1,
        group,
        searchTags,
        searchAuthors,
        searchText: buildGroupSearchText(group),
        searchTitles: group.variants.map((v) => v.title || '').filter(Boolean),
      })
    }

    // The signed-in user's personal drafts, baked into the same list (sorted +
    // searchable with everything else). A draft that's already been published
    // (published_song_id set) is hidden — its catalog twin already appears.
    for (const p of personalSongs) {
      if (p.published_song_id) continue
      const { keys, labels } = canonicalizeTags(p.tags || [], tagMap)
      const authors = p.artist ? p.artist.split(/,\s*/).filter(Boolean) : []
      out.push({
        id: `p_${p.id}`,
        personalId: p.id,
        // Route through the viewer's read-only personal mode (?p=<id>).
        to: `/song/${p.slug || p.id}?p=${p.id}`,
        isPersonal: true,
        reviewStatus: p.status,
        title: p.title,
        originalKey: p.default_key || '',
        tags: labels,
        tagKeys: keys,
        authors,
        hasSelectedLanguage: true, // always visible regardless of language chip
        hasTranslations: false,
        group: null,
        searchTags: p.tags || [],
        searchAuthors: authors,
        searchText: `${p.title} ${(p.tags || []).join(' ')} ${p.artist || ''}`.toLowerCase(),
        searchTitles: [p.title].filter(Boolean),
        chordpro_content: p.chordpro_content || '',
      })
    }
    return out
  }, [catalog.groups, selectedLanguage, tagMap, personalSongs])

  const navigationType = useNavigationType()
  const navigationTypeRef = useRef(navigationType)
  const pendingScrollRef = useRef(null)
  const scrollTopRef = useRef(0)

  const searchRef = useRef(null)
  const resultsRef = useRef(null)
  const qLower = normalizeSongSearch(q)
  const allTags = useMemo(() => {
    const seen = new Set()
    const options = []
    for (const s of items) {
      for (const key of s.tagKeys || []) {
        if (!key || seen.has(key) || isHiddenTag(key)) continue
        seen.add(key)
        options.push({ key, label: tagMap.get(key) || tagLabelFromKey(key) })
      }
    }
    return options.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    )
  }, [items, tagMap])

  const [selectedTags, setSelectedTags] = useState([])
  const [lyricsOn, setLyricsOn] = useState(false)
  const [communityOnly, setCommunityOnly] = useState(() => {
    try { return localStorage.getItem('pref:communityOnly') === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('pref:communityOnly', communityOnly ? '1' : '0') } catch {}
  }, [communityOnly])

  const tagPass = useCallback((s) => {
    if (!selectedTags.length) return true
    const tags = s.tagKeys || []
    return selectedTags.some((t) => tags.includes(t))
  }, [selectedTags])
  const communityPass = useCallback((s) => {
    if (!communityOnly) return true
    const tags = s.tagKeys || []
    return tags.includes(COMMUNITY_KEY)
  }, [communityOnly, COMMUNITY_KEY])

  const resultParts = useMemo(() => {
    const scoreMap = new Map()
    let list

    if (qLower.length) {
      const rs = searchSongs(items, qLower)
      list = rs.map((r) => {
        scoreMap.set(r.item.id, r.score)
        return r.item
      })
    } else {
      list = items.slice()
    }

    list = list.filter(tagPass).filter(communityPass)

    if (lyricsOn && qLower.length) {
      const extra = items
        .filter(tagPass)
        .filter(communityPass)
        .filter(s => normalizeSongSearch(s.chordpro_content).includes(qLower))
      const byId = new Set(list.map((i) => i.id))
      for (const s of extra) {
        if (!byId.has(s.id)) list.push(s)
      }
    }

    list.sort((a, b) => {
      if (a.hasSelectedLanguage !== b.hasSelectedLanguage) {
        return a.hasSelectedLanguage ? -1 : 1
      }
      const aSW = qLower && normalizeSongSearch(a.title).startsWith(qLower) ? 1 : 0
      const bSW = qLower && normalizeSongSearch(b.title).startsWith(qLower) ? 1 : 0
      if (aSW !== bSW) return bSW - aSW

      const as = scoreMap.has(a.id) ? scoreMap.get(a.id) : Number.POSITIVE_INFINITY
      const bs = scoreMap.has(b.id) ? scoreMap.get(b.id) : Number.POSITIVE_INFINITY
      if (as !== bs) return as - bs

      return compareSongsByTitle(a, b)
    })

    const translated = []
    const fallback = []
    for (const item of list) {
      if (item.hasSelectedLanguage) translated.push(item)
      else fallback.push(item)
    }
    return { translated, fallback }
  }, [items, qLower, lyricsOn, tagPass, communityPass])

  const results = useMemo(
    () => [...resultParts.translated, ...resultParts.fallback],
    [resultParts]
  )
  const [activeIndex, setActiveIndex] = useState(-1)
  const optionRefs = useRef([])
  const resetRef = useRef(false)

  function onSearchKeyDown(e){
    if(e.key === 'Enter'){
      e.preventDefault()
      const c = resultsRef.current
      if(!c) return
      const containerRect = c.getBoundingClientRect()
      const links = c.querySelectorAll('a')
      for(const link of links){
        const rect = link.getBoundingClientRect()
        if(rect.bottom > containerRect.top && rect.top < containerRect.bottom){
          link.click()
          break
        }
      }
    } else if(e.key === 'Escape') {
      e.preventDefault()
      setQ('')
      searchRef.current?.focus()
    } else if(e.key === 'ArrowDown') {
      e.preventDefault()
      if(results.length === 0) return
      if (activeIndex === 0) {
        optionRefs.current[0]?.focus()
      } else {
        setActiveIndex(0)
      }
    } else if(e.key === 'ArrowUp') {
      e.preventDefault()
      if(results.length === 0) return
      const last = results.length - 1
      setActiveIndex(last)
    }
  }

  function onResultsKeyDown(e){
    if(e.key === 'ArrowDown'){
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if(e.key === 'ArrowUp'){
      e.preventDefault()
      setActiveIndex((i) => {
        if(i <= 0){
          searchRef.current?.focus()
          return -1
        }
        return i - 1
      })
    }
  }

  useEffect(() => {
    if (activeIndex >= 0) {
      if (resetRef.current) {
        resetRef.current = false
      } else {
        optionRefs.current[activeIndex]?.focus()
      }
    }
  }, [activeIndex])

  useEffect(() => {
    if (results.length > 0) {
      setActiveIndex(0)
      resetRef.current = true
    } else {
      setActiveIndex(-1)
    }
  }, [results])

  useEffect(() => {
    const nextQ = searchParams.get('q') || ''
    setQ(nextQ)
  }, [searchParams])

  useEffect(() => {
    function onKeyDown(e){
      if(e.key === '/' && document.activeElement !== searchRef.current){
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    try {
      const isDesktop = window.matchMedia && window.matchMedia('(min-width: 821px)').matches
      if (isDesktop) searchRef.current?.focus()
    } catch {}
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Keep scrollTopRef current so the cleanup below never reads a nulled-out DOM ref.
  useEffect(() => {
    const el = resultsRef.current
    if (!el) return
    const onScroll = () => { scrollTopRef.current = el.scrollTop }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (navigationTypeRef.current === 'POP') {
      const saved = sessionStorage.getItem('songs:scrollTop')
      if (saved) pendingScrollRef.current = Number(saved)
    }
    return () => {
      sessionStorage.setItem('songs:scrollTop', String(scrollTopRef.current))
    }
  }, [])

  // Double-RAF so grid layout is complete before we set scrollTop.
  useEffect(() => {
    if (pendingScrollRef.current !== null && items.length > 0) {
      const y = pendingScrollRef.current
      pendingScrollRef.current = null
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (resultsRef.current) resultsRef.current.scrollTop = y
      }))
    }
  }, [items])

  function toggleTag(key){
    setSelectedTags((prev) => prev.includes(key) ? prev.filter((x) => x!==key) : [...prev, key])
  }
  function clearTags(){ setSelectedTags([]) }

  optionRefs.current = []

  return (
    <div className="lvm-song-library">
      <Helmet>
        <title>{SONGS_TITLE}</title>
        <meta name="description" content={SONGS_DESCRIPTION} />
        <meta name="keywords" content="worship chord sheets, worship lyrics, transposable charts, La Voz Misionera" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={SONGS_TITLE} />
        <meta property="og:description" content={SONGS_DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/songs`} />
        <meta property="og:site_name" content="La Voz Misionera" />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <link rel="canonical" href={`${SITE_URL}/songs`} />
      </Helmet>
      <div className="lvm-song-library__header">
        <div className="lvm-song-library__heading">
          <h1 title={t('songs.titleTooltip')}>{t('songs.title')}</h1>
          {languageChipCodes.length > 0 ? (
            <div className="tagbar" aria-label={t('songs.languageAria')}>
              {languageChipCodes.map((code) => (
                <Chip
                  key={code}
                  variant="filter"
                  selected={selectedLanguage === code}
                  onClick={() => setSelectedLanguage(code)}
                  title={t('songs.languageTooltip', { language: getLanguageChipLabel(code) })}
                >
                  {getLanguageChipLabel(code)}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lvm-song-library__filters">
          <Input
            id="search"
            type="search"
            ref={searchRef}
            value={q}
            onChange={(e)=> setQ(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t('songs.searchPlaceholder')}
            aria-label={t('songs.searchAria')}
          />
          <div className="lvm-song-library__toggles">
            <label>
              <input
                type="checkbox"
                checked={lyricsOn}
                onChange={(e)=> setLyricsOn(e.target.checked)}
              />
              <span className="meta" title={t('songs.lyricsContainTooltip')}>{t('songs.lyricsContain')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={communityOnly}
                onChange={(e)=> setCommunityOnly(e.target.checked)}
              />
              <span className="meta" title={t('songs.communitySetlistTooltip')}>{t('songs.communitySetlist')}</span>
            </label>
          </div>

          <div className="lvm-song-library__tags">
            <div className="tagbar">
              <Chip variant="filter" selected={selectedTags.length===0} onClick={clearTags}>{t('songs.all')}</Chip>
              {allTags.map((tag) => (
                <Chip
                  key={tag.key}
                  variant="filter"
                  selected={selectedTags.includes(tag.key)}
                  onClick={() => toggleTag(tag.key)}
                >{tag.label}</Chip>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="lvm-song-library__results"
        role="region"
        ref={resultsRef}
        onKeyDown={onResultsKeyDown}
      >
        {catalogLoading && items.length === 0 ? <p role="status">{t('home:loading')}</p> : null}
        {catalogError ? (
          <div role="alert" className="lvm-song-library__feedback">
            <p>{t('home:errorTitle')}. {t('home:errorDescription')}</p>
            <button type="button" className="lvm-song-library__retry" onClick={retryCatalog}>{t('home:retry')}</button>
          </div>
        ) : null}
        {!catalogLoading && !catalogError && items.length === 0 ? (
          <p role="status">{t('home:emptyTitle')}</p>
        ) : null}
        {!catalogLoading && !catalogError && items.length > 0 && results.length === 0 ? (
          <p role="status">{t('songs.noResults')}</p>
        ) : null}
        <div className="lvm-song-library__grid" role="listbox" aria-label={t('songs.resultsAria')}>
          {resultParts.translated.map((s, i) => (
            <SongLibraryCard
              song={s}
              key={s.id}
              role="option"
              ref={(el) => (optionRefs.current[i] = el)}
              tabIndex={i === activeIndex ? 0 : -1}
              aria-selected={i === activeIndex}
              active={i === activeIndex}
              personalLabel={s.reviewStatus === 'submitted' ? t('songs.pending') : t('songs.personal')}
            />
          ))}

          {resultParts.translated.length > 0 && resultParts.fallback.length > 0 ? (
            <div className="lvm-song-library__divider" role="separator">
              <span>{t('songs.noTranslation')}</span>
            </div>
          ) : null}

          {resultParts.fallback.map((s, i) => {
            const idx = i + resultParts.translated.length
            return (
              <SongLibraryCard
                song={s}
                key={s.id}
                role="option"
                ref={(el) => (optionRefs.current[idx] = el)}
                tabIndex={idx === activeIndex ? 0 : -1}
                aria-selected={idx === activeIndex}
                active={idx === activeIndex}
                personalLabel={s.reviewStatus === 'submitted' ? t('songs.pending') : t('songs.personal')}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

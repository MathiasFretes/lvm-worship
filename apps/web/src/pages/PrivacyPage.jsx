import React, { useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import privacyMarkdown from '../content/privacy-policy.md?raw'
import '../styles/posts.css'

// Renders the hosted Privacy Policy at /privacy from the final markdown source in
// src/content/. Markdown → HTML via marked, sanitized with DOMPurify, and styled
// with the shared .lvm-prose rules. Edit the .md to update.
export default function PrivacyPage() {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(privacyMarkdown, { async: false })),
    []
  )

  return (
    <div className="container lvm-post-detail">
      <Helmet>
        <title>Privacy Policy · La Voz Misionera</title>
        <meta name="description" content="How La Voz Misionera handles your data and privacy." />
      </Helmet>
      <div
        className="lvm-post-detail__content lvm-prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

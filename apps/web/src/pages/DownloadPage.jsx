import React from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { AppleIcon, QrCodeIcon } from '../components/Icons'

const SITE_URL = 'https://lavozmisionera.com'
const APP_STORE_URL = 'https://apps.apple.com/us/app/lavozmisionera/id6787127446'
// public/ assets are served from the site root and referenced by URL, not
// imported (matches SpriteAvatar's /sprites/ usage).
const APP_STORE_BADGE = '/badges/app-store-badge.svg'
const DOWNLOAD_QR = '/badges/download-qr.svg'

export default function DownloadPage(){
  const { t } = useTranslation('pages')

  return (
    <div className="container lvm-download">
      <Helmet>
        <title>{t('download.metaTitle')}</title>
        <meta name="description" content={t('download.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/download`} />
      </Helmet>

      <h1>{t('download.title')}</h1>
      <p className="lvm-download__lede">{t('download.lede')}</p>

      <div className="lvm-download__platforms">
        <section className="lvm-download__card" aria-labelledby="lvm-download-ios">
          <h2 id="lvm-download-ios" className="lvm-download__cardTitle">
            <AppleIcon />
            {t('download.ios.title')}
          </h2>
          <p className="lvm-download__cardBody">{t('download.ios.body')}</p>
          {/* Apple requires the unmodified official badge artwork, so it is an
              <img> rather than a token-styled button. Self-hosted from
              public/badges/ — no third-party request. */}
          <a
            className="lvm-download__badgeLink"
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              className="lvm-download__badge"
              src={APP_STORE_BADGE}
              alt={t('download.ios.badgeAlt')}
              width="120"
              height="40"
            />
          </a>
        </section>

        {/* Android is deliberately inert: no <a>, no href. A disabled link is
            still a dead link. */}
        <section
          className="lvm-download__card lvm-download__card--pending"
          aria-labelledby="lvm-download-android"
        >
          <h2 id="lvm-download-android" className="lvm-download__cardTitle">
            {t('download.android.title')}
          </h2>
          <p className="lvm-download__cardBody">{t('download.android.body')}</p>
          <p className="lvm-download__pendingChip">{t('download.android.comingSoon')}</p>
        </section>
      </div>

      <section className="lvm-download__qr" aria-labelledby="lvm-download-qr">
        <h2 id="lvm-download-qr" className="lvm-download__cardTitle">
          <QrCodeIcon />
          {t('download.qr.title')}
        </h2>
        <p className="lvm-download__cardBody">{t('download.qr.body')}</p>
        {/* Encodes /download rather than the App Store listing, so the same
            code keeps working when Android ships. Regenerate with:
            npx qrcode -t svg -o public/badges/download-qr.svg -w 512 --qzone 2 \
              "https://lavozmisionera.com/download" */}
        <img
          className="lvm-download__qrImage"
          src={DOWNLOAD_QR}
          alt={t('download.qr.alt')}
          width="176"
          height="176"
        />
      </section>
    </div>
  )
}

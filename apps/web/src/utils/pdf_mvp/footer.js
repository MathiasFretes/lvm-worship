import { getPdfFooterDisclaimer, isDisclaimerEnabled } from '../../config/disclaimer'

export function drawPdfFooter(doc, layout){
  if (!isDisclaimerEnabled()) return
  const text = getPdfFooterDisclaimer()
  if (!text || !doc || !layout) return
  const fontSize = 8
  try { doc.setFont('helvetica', 'normal') } catch {}
  try { doc.setFontSize(fontSize) } catch {}
  try { doc.setTextColor(90, 90, 90) } catch {}
  const x = layout.pageWidth / 2
  const y = layout.pageHeight - layout.bottom + Math.ceil(fontSize * 0.3)
  try { doc.text(text, x, y, { align: 'center', maxWidth: layout.pageWidth - layout.left * 2 }) } catch {}
}

export function applyFooterToAllPages(
  doc,
  margins,
  page,
  opts = {}
){
  if (!isDisclaimerEnabled()) return
  const n = (typeof doc.getNumberOfPages === 'function') ? doc.getNumberOfPages() : 1
  const start = Math.min(n, Math.max(1, Math.trunc(Number(opts.startPage) || 1)))
  const originalPage = doc.internal?.getCurrentPageInfo?.().pageNumber
  for (let i = start; i <= n; i++){
    try { doc.setPage(i) } catch {}
    drawPdfFooter(doc, { left: margins.left, bottom: margins.bottom, pageWidth: page.w, pageHeight: page.h })
  }
  if (originalPage) {
    try { doc.setPage(originalPage) } catch {}
  }
}

export default { drawPdfFooter, applyFooterToAllPages }

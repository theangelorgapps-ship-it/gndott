import { jsPDF } from 'jspdf'
let fonts: Promise<string[]> | undefined
async function fontData() {
  return fonts ??= Promise.all(['Regular', 'Bold', 'Italic', 'BoldItalic'].map(async style => {
    const response = await fetch(`/fonts/NotoSans-${style}.ttf`)
    if (!response.ok) throw new Error('Font unavailable')
    const data = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192))
    return btoa(binary)
  })).catch(error => { fonts = undefined; throw error })
}
type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; mark?: boolean; href?: string }
/** Semantic text and embedded fonts keep the PDF searchable and preserve inline formatting. */
export async function createNotePdf(title: string, html: string) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const data = await fontData()
  ;['normal', 'bold', 'italic', 'bolditalic'].forEach((style, i) => {
    pdf.addFileToVFS(`Noto-${style}.ttf`, data[i])
    pdf.addFont(`Noto-${style}.ttf`, 'Noto', style)
  })
  const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight()
  const margin = 48, maxW = pageW - margin * 2
  let y = margin
  const fit = (height: number) => { if (y + height > pageH - margin) { pdf.addPage(); y = margin } }
  function font(run: Run, size: number) {
    pdf.setFont('Noto', run.bold && run.italic ? 'bolditalic' : run.bold ? 'bold' : run.italic ? 'italic' : 'normal')
    pdf.setFontSize(size)
  }
  function paragraph(runs: Run[], size = 11, indent = 0, align = 'left') {
    const width = maxW - indent
    let line: (Run & { width: number })[] = [], used = 0
    function flush() {
      if (!line.length) return
      fit(size * 1.65)
      let x = margin + indent + (align === 'center' ? (width - used) / 2 : align === 'right' ? width - used : 0)
      for (const token of line) {
        font(token, size)
        if (token.mark) { pdf.setFillColor(255, 236, 157); pdf.rect(x, y - size, token.width, size * 1.3, 'F') }
        pdf.setTextColor(token.href ? 35 : 25, token.href ? 93 : 25, token.href ? 160 : 30)
        pdf.text(token.text, x, y)
        if (token.underline || token.href || token.strike) {
          pdf.setDrawColor(60); pdf.setLineWidth(.5)
          const lineY = token.strike ? y - size * .3 : y + 2
          pdf.line(x, lineY, x + token.width, lineY)
        }
        if (token.href) pdf.link(x, y - size, token.width, size * 1.3, { url: token.href })
        x += token.width
      }
      y += size * 1.65; line = []; used = 0
    }
    for (const run of runs) {
      font(run, size)
      for (const part of run.text.split(/(\n|[ \t]+)/)) {
        if (!part) continue
        if (part === '\n') { flush(); continue }
        let remaining = part
        while (remaining) {
          font(run, size)
          if (!line.length && /^\s+$/.test(remaining)) break
          let token = remaining, tokenWidth = pdf.getTextWidth(token)
          if (tokenWidth > width) {
            if (line.length) flush()
            let end = 1
            while (end < remaining.length && pdf.getTextWidth(remaining.slice(0, end + 1)) <= width) end++
            token = remaining.slice(0, end); tokenWidth = pdf.getTextWidth(token)
          } else if (used + tokenWidth > width) { flush(); continue }
          line.push({ ...run, text: token, width: tokenWidth }); used += tokenWidth
          remaining = remaining.slice(token.length)
          if (remaining) flush()
        }
      }
    }
    flush(); y += 8
  }
  const inline = (node: Node, inherited: Omit<Run, 'text'> = {}): Run[] => {
    if (node.nodeType === Node.TEXT_NODE) return [{ ...inherited, text: node.textContent || '' }]
    if (!(node instanceof Element)) return []
    const tag = node.tagName
    if (tag === 'BR') return [{ ...inherited, text: '\n' }]
    const href = tag === 'A' ? node.getAttribute('href') || '' : inherited.href
    const style = { ...inherited, bold: inherited.bold || ['STRONG', 'B'].includes(tag), italic: inherited.italic || ['EM', 'I'].includes(tag), underline: inherited.underline || tag === 'U', strike: inherited.strike || tag === 'S', mark: inherited.mark || tag === 'MARK', href: href && /^(https?:|mailto:)/i.test(href) ? href : undefined }
    return [...node.childNodes].flatMap(child => inline(child, style))
  }
  paragraph([{ text: 'GoodNews Halobox · My Notes' }], 10)
  paragraph([{ text: title, bold: true }], 21)
  paragraph([{ text: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }], 9)
  y += 10
  const body = new DOMParser().parseFromString(html, 'text/html').body
  function render(node: Element, indent = 0) {
    const tag = node.tagName
    if (tag === 'UL' || tag === 'OL') {
      ;[...node.children].forEach((li, i) => {
        const children = [...li.childNodes].filter(child => !(child instanceof Element && ['UL', 'OL'].includes(child.tagName)))
        paragraph([{ text: tag === 'OL' ? `${i + 1}. ` : '• ' }, ...children.flatMap(child => inline(child))], 11, indent + 14)
        ;[...li.children].filter(child => ['UL', 'OL'].includes(child.tagName)).forEach(child => render(child, indent + 14))
      }); return
    }
    if (tag === 'HR') { fit(18); pdf.setDrawColor(200); pdf.line(margin, y, pageW - margin, y); y += 18; return }
    const heading = /^H[123]$/.test(tag)
    paragraph(inline(node, { bold: heading, italic: tag === 'BLOCKQUOTE' }), tag === 'H1' ? 20 : tag === 'H2' ? 17 : tag === 'H3' ? 14 : 11, indent + (tag === 'BLOCKQUOTE' ? 14 : 0), (node as HTMLElement).style.textAlign)
  }
  ;[...body.children].forEach(node => render(node))
  if (!body.children.length) paragraph([{ text: body.textContent || '' }])
  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setFont('Noto', 'normal'); pdf.setFontSize(8); pdf.setTextColor(120)
    pdf.text(`${i} / ${pages}`, pageW - margin, pageH - 24, { align: 'right' })
  }
  return pdf
}
export async function downloadNotePdf(title: string, html: string) {
  const pdf = await createNotePdf(title, html)
  pdf.save(`${title.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 80) || 'Halobox note'}.pdf`)
}

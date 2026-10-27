// PDF reports, built in the browser with jsPDF (loaded only when someone exports).
//
// Describe a report as a list of blocks and call downloadReport(). Every page gets a footer with the optional
// footerNote (the Earnings page passes its estimate disclaimer here, so it is repeated on every page of every
// export), the page number and the date.
//
// The built-in PDF fonts only cover Western European characters. Anything outside that range, such as
// non-Latin scripts in a track title, is printed as "?" rather than breaking the file.

import type { jsPDF } from 'jspdf'

export interface PdfTable {
  head: string[]
  rows: string[][]
  /** Per column; numbers should be 'right'. Defaults to left. */
  align?: ('left' | 'right')[]
  /** Relative column widths, e.g. [3, 1, 1]. Defaults to equal. */
  widths?: number[]
}

export type PdfBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string; muted?: boolean }
  | { type: 'stats'; items: { label: string; value: string }[] }
  | { type: 'table'; table: PdfTable }
  | { type: 'bars'; title?: string; items: { label: string; value: number }[]; format?: (n: number) => string }

export interface PdfReport {
  title: string
  subtitle?: string
  /** File name including .pdf */
  fileName: string
  blocks: PdfBlock[]
  /** Printed in the footer of every page. */
  footerNote?: string
  brand?: string
}

const NAVY: [number, number, number] = [11, 52, 112]
const BLUE: [number, number, number] = [10, 125, 232]
const INK: [number, number, number] = [30, 30, 30]
const MUTED: [number, number, number] = [110, 110, 110]
const RULE: [number, number, number] = [210, 214, 222]
const ZEBRA: [number, number, number] = [244, 246, 250]

const PAGE = { w: 595.28, h: 841.89 }
const MARGIN = 48
const LINE = 1.35

const safe = (s: string) =>
  String(s ?? '').normalize('NFC').replace(/[^\u0020-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u20ac]/g, '?')

export async function buildReport(spec: PdfReport): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = PAGE.w - MARGIN * 2
  const brand = spec.brand ?? 'Track Record'

  // Reserve room at the bottom of every page for the footer.
  doc.setFont('helvetica', 'normal').setFontSize(8)
  const noteLines: string[] = spec.footerNote ? doc.splitTextToSize(safe(spec.footerNote), width) : []
  const footerH = 22 + noteLines.length * 10
  const limit = PAGE.h - MARGIN - footerH
  let y = MARGIN

  const ensure = (h: number) => {
    if (y + h <= limit) return false
    doc.addPage()
    y = MARGIN
    return true
  }
  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const font = (style: 'normal' | 'bold', size: number) => doc.setFont('helvetica', style).setFontSize(size)

  // Title block
  font('bold', 10); color(BLUE); doc.text(safe(brand), MARGIN, y + 8)
  y += 30
  font('bold', 22); color(NAVY)
  const titleLines: string[] = doc.splitTextToSize(safe(spec.title), width)
  doc.text(titleLines, MARGIN, y + 16)
  y += titleLines.length * 26
  if (spec.subtitle) {
    font('normal', 11); color(MUTED)
    const sub: string[] = doc.splitTextToSize(safe(spec.subtitle), width)
    doc.text(sub, MARGIN, y + 4)
    y += sub.length * 14 + 4
  }
  doc.setDrawColor(...RULE).setLineWidth(1).line(MARGIN, y + 6, MARGIN + width, y + 6)
  y += 22

  for (const b of spec.blocks) {
    if (b.type === 'heading') {
      ensure(40)
      font('bold', 13); color(NAVY)
      doc.text(safe(b.text), MARGIN, y + 12)
      y += 26
    } else if (b.type === 'text') {
      font('normal', 10); color(b.muted ? MUTED : INK)
      const lines: string[] = doc.splitTextToSize(safe(b.text), width)
      for (const l of lines) { ensure(14); doc.text(l, MARGIN, y + 10); y += 10 * LINE }
      y += 8
    } else if (b.type === 'stats') {
      const n = Math.max(1, b.items.length)
      const gap = 10
      const w = (width - gap * (n - 1)) / n
      ensure(56)
      b.items.forEach((it, i) => {
        const x = MARGIN + i * (w + gap)
        doc.setFillColor(...ZEBRA).roundedRect(x, y, w, 48, 6, 6, 'F')
        font('normal', 8.5); color(MUTED); doc.text(safe(it.label), x + 10, y + 16)
        font('bold', 15); color(NAVY); doc.text(safe(it.value), x + 10, y + 36)
      })
      y += 48 + 16
    } else if (b.type === 'table') {
      drawTable(b.table)
    } else if (b.type === 'bars') {
      drawBars(b)
    }
  }

  function drawTable(t: PdfTable) {
    const weights = t.widths ?? t.head.map(() => 1)
    const sum = weights.reduce((a, c) => a + c, 0)
    const cols = weights.map((w) => (w / sum) * width)
    const pad = 5
    const right = (i: number) => t.align?.[i] === 'right'
    const x0 = (i: number) => MARGIN + cols.slice(0, i).reduce((a, c) => a + c, 0)

    const header = () => {
      doc.setFillColor(...NAVY).rect(MARGIN, y, width, 20, 'F')
      font('bold', 9); doc.setTextColor(255, 255, 255)
      t.head.forEach((h, i) => {
        right(i) ? doc.text(safe(h), x0(i) + cols[i] - pad, y + 13.5, { align: 'right' }) : doc.text(safe(h), x0(i) + pad, y + 13.5)
      })
      y += 20
    }

    ensure(20 + 22)
    header()
    t.rows.forEach((row, r) => {
      font('normal', 9)
      const cells = row.map((c, i) => doc.splitTextToSize(safe(c), cols[i] - pad * 2) as string[])
      const h = Math.max(...cells.map((c) => c.length)) * 9 * LINE + 8
      if (ensure(h)) header()
      if (r % 2 === 1) doc.setFillColor(...ZEBRA).rect(MARGIN, y, width, h, 'F')
      color(INK)
      cells.forEach((lines, i) => {
        lines.forEach((l, k) => {
          const ty = y + 12 + k * 9 * LINE
          right(i) ? doc.text(l, x0(i) + cols[i] - pad, ty, { align: 'right' }) : doc.text(l, x0(i) + pad, ty)
        })
      })
      y += h
    })
    doc.setDrawColor(...RULE).setLineWidth(0.5).line(MARGIN, y, MARGIN + width, y)
    y += 18
  }

  function drawBars(b: Extract<PdfBlock, { type: 'bars' }>) {
    const fmt = b.format ?? ((n: number) => String(n))
    const max = Math.max(1, ...b.items.map((i) => i.value))
    const labelW = 120, valueW = 70
    const barW = width - labelW - valueW - 10
    if (b.title) { ensure(40); font('bold', 11); color(NAVY); doc.text(safe(b.title), MARGIN, y + 10); y += 22 }
    for (const it of b.items) {
      ensure(20)
      font('normal', 9); color(INK)
      const label = (doc.splitTextToSize(safe(it.label), labelW - 6) as string[])[0] ?? ''
      doc.text(label, MARGIN, y + 11)
      doc.setFillColor(...ZEBRA).rect(MARGIN + labelW, y + 3, barW, 11, 'F')
      doc.setFillColor(...BLUE).rect(MARGIN + labelW, y + 3, Math.max(1, (it.value / max) * barW), 11, 'F')
      doc.text(safe(fmt(it.value)), MARGIN + width, y + 11, { align: 'right' })
      y += 20
    }
    y += 10
  }

  // Footer on every page
  const pages = doc.getNumberOfPages()
  const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    const fy = PAGE.h - MARGIN - footerH + 8
    doc.setDrawColor(...RULE).setLineWidth(0.5).line(MARGIN, fy, MARGIN + width, fy)
    font('normal', 8); color(MUTED)
    noteLines.forEach((l, i) => doc.text(l, MARGIN, fy + 12 + i * 10))
    const by = fy + 12 + noteLines.length * 10 + 2
    doc.text(`${safe(brand)}  |  ${stamp}`, MARGIN, by)
    doc.text(`Page ${p} of ${pages}`, MARGIN + width, by, { align: 'right' })
  }
  return doc
}

export async function downloadReport(spec: PdfReport): Promise<void> {
  const doc = await buildReport(spec)
  doc.save(spec.fileName)
}

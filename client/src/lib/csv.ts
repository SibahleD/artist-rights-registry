// A small CSV reader for distributor exports, so no parsing library has to be shipped.
// Handles a byte-order mark, quoted fields (with "" for a quote and line breaks inside quotes),
// CRLF or LF, and comma, semicolon or tab separators (picked from the first lines).

export type Delimiter = ',' | ';' | '\t'

export function detectDelimiter(text: string): Delimiter {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n')
  let best: Delimiter = ','
  let bestCount = -1
  for (const d of [',', ';', '\t'] as const) {
    // Count separators outside quotes only.
    let n = 0, quoted = false
    for (const ch of sample) { if (ch === '"') quoted = !quoted; else if (ch === d && !quoted) n++ }
    if (n > bestCount) { best = d; bestCount = n }
  }
  return best
}

export function parseCsv(input: string, delimiter?: Delimiter): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const d = delimiter ?? detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const endCell = () => { row.push(cell); cell = '' }
  const endRow = () => { endCell(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = [] }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === d) endCell()
    else if (ch === '\n') endRow()
    else if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow() }
    else cell += ch
  }
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

/** The row that holds the column names: the first row with at least three filled cells, else the first row. */
export function findHeaderRow(rows: string[][]): number {
  const i = rows.slice(0, 15).findIndex((r) => r.filter((c) => c.trim()).length >= 3)
  return i === -1 ? 0 : i
}

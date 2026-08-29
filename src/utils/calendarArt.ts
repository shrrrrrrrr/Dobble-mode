const FONT: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00', '00', '00', '00', '00', '11', '11'],
}

const DATE_COLOR = '#5b4236'
const CELL = 20
const GAP_COLS = 1
const CANVAS_SIZE = 800

function drawPixelText(ctx: CanvasRenderingContext2D, text: string, centerX: number, centerY: number, cell: number, color: string) {
  const chars = text.split('')
  const widths = chars.map(ch => FONT[ch]?.[0].length ?? 0)
  const totalCols = widths.reduce((sum, w) => sum + w, 0) + GAP_COLS * (chars.length - 1)
  const rows = 7
  let colOffset = Math.round(centerX - (totalCols * cell) / 2)
  const top = Math.round(centerY - (rows * cell) / 2)
  ctx.fillStyle = color
  chars.forEach((ch, index) => {
    const glyph = FONT[ch]
    if (glyph) {
      glyph.forEach((row, ry) => {
        row.split('').forEach((bit, rx) => {
          if (bit === '1') {
            ctx.fillRect(colOffset + rx * cell, top + ry * cell, cell, cell)
          }
        })
      })
    }
    colOffset += (widths[index] + GAP_COLS) * cell
  })
}

export function buildCalendarArt(date: Date): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_SIZE
      canvas.height = CANVAS_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve('')
        return
      }
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      const text = `${date.getMonth() + 1}.${date.getDate()}`
      drawPixelText(ctx, text, 416, 492, CELL, DATE_COLOR)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve('')
    img.src = '/assets/calendar/desk-calendar-clean.png'
  })
}

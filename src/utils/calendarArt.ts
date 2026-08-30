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

function isCalendarForeground(red: number, green: number, blue: number) {
  const darkOutline = red < 150 && green < 125 && blue < 115
  const coralHeader = red > 205 && green < 175 && blue < 155
  const warmPaper = red > 225 && green > 200 && blue < 245 && red - blue > 10
  return darkOutline || coralHeader || warmPaper
}

function removeOuterBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = ctx.getImageData(0, 0, width, height)
  const seen = new Uint8Array(width * height)
  const queue: number[] = []
  const add = (x: number, y: number) => {
    const index = y * width + x
    if (seen[index]) return
    seen[index] = 1
    queue.push(index)
  }
  for (let x = 0; x < width; x += 1) { add(x, 0); add(x, height - 1) }
  for (let y = 1; y < height - 1; y += 1) { add(0, y); add(width - 1, y) }
  while (queue.length) {
    const index = queue.pop()!
    const offset = index * 4
    const red = pixels.data[offset]
    const green = pixels.data[offset + 1]
    const blue = pixels.data[offset + 2]
    if (isCalendarForeground(red, green, blue)) continue
    pixels.data[offset + 3] = 0
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) add(x - 1, y)
    if (x < width - 1) add(x + 1, y)
    if (y > 0) add(x, y - 1)
    if (y < height - 1) add(x, y + 1)
  }
  ctx.putImageData(pixels, 0, 0)
  let left = width
  let top = height
  let right = 0
  let bottom = 0
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (pixels.data[(y * width + x) * 4 + 3] === 0) continue
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
  }
  return { left, top, right, bottom }
}

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
      const bounds = removeOuterBackground(ctx, CANVAS_SIZE, CANVAS_SIZE)
      const cropped = document.createElement('canvas')
      cropped.width = bounds.right - bounds.left + 1
      cropped.height = bounds.bottom - bounds.top + 1
      const croppedContext = cropped.getContext('2d')
      if (!croppedContext) { resolve(''); return }
      croppedContext.imageSmoothingEnabled = false
      croppedContext.drawImage(canvas, -bounds.left, -bounds.top)
      const text = `${date.getMonth() + 1}.${date.getDate()}`
      drawPixelText(croppedContext, text, 416 - bounds.left, 492 - bounds.top, CELL, DATE_COLOR)
      resolve(cropped.toDataURL('image/png'))
    }
    img.onerror = () => resolve('')
    img.src = '/assets/calendar/desk-calendar-clean.png'
  })
}

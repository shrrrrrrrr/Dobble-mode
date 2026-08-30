import { compressImage } from './image'
import type { RecapMediaFrame } from '../types'

const MAX_MEDIA_FILES = 6
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const VIDEO_FRACTIONS = [.14, .28, .43, .58, .72, .86]

function waitFor(target: EventTarget, event: string) {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); reject(new Error('媒体读取失败，请换一个文件重试。')) }
    const cleanup = () => { target.removeEventListener(event, done); target.removeEventListener('error', failed) }
    target.addEventListener(event, done, { once: true })
    target.addEventListener('error', failed, { once: true })
  })
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); reject(new Error('视频定位失败。')) }
    const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', failed) }
    video.addEventListener('seeked', done, { once: true })
    video.addEventListener('error', failed, { once: true })
    video.currentTime = time
  })
}

function drawPreview(source: CanvasImageSource, width: number, height: number) {
  const edge = 480
  const scale = Math.min(1, edge / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('无法生成回忆画面。')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return { canvas, context }
}

function frameSignal(context: CanvasRenderingContext2D, width: number, height: number) {
  const sample = document.createElement('canvas')
  sample.width = 24
  sample.height = 16
  const sampleContext = sample.getContext('2d', { willReadFrequently: true })
  if (!sampleContext) return { quality: 0, fingerprint: [0, 0, 0] }
  sampleContext.drawImage(context.canvas, 0, 0, width, height, 0, 0, sample.width, sample.height)
  const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data
  let brightness = 0
  let square = 0
  const color = [0, 0, 0]
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2]
    brightness += luminance
    square += luminance * luminance
    color[0] += pixels[index]
    color[1] += pixels[index + 1]
    color[2] += pixels[index + 2]
  }
  const count = pixels.length / 4
  const mean = brightness / count
  const variance = Math.max(0, square / count - mean * mean)
  return { quality: Math.sqrt(variance) + Math.min(mean, 180) * .16, fingerprint: color.map(value => value / count) }
}

function differentEnough(next: number[], selected: number[][]) {
  return selected.every(previous => Math.hypot(next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]) > 18)
}

export async function createRecapMedia(files: FileList | File[]): Promise<RecapMediaFrame[]> {
  const selected = Array.from(files).slice(0, MAX_MEDIA_FILES)
  const output: RecapMediaFrame[] = []
  for (const file of selected) {
    if (file.type.startsWith('image/')) {
      output.push({ id: crypto.randomUUID(), kind: 'image', dataUrl: await compressImage(file, 640, .76), sourceName: file.name })
    } else if (file.type.startsWith('video/')) {
      output.push(...await sampleVideo(file, Math.min(3, MAX_MEDIA_FILES - output.length)))
    }
    if (output.length >= MAX_MEDIA_FILES) break
  }
  return output
}

async function sampleVideo(file: File, count: number): Promise<RecapMediaFrame[]> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error('用于回忆采样的视频不能超过 100 MB。')
  const video = document.createElement('video')
  const objectUrl = URL.createObjectURL(file)
  video.src = objectUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'
  try {
    await waitFor(video, 'loadedmetadata')
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= .5) throw new Error('视频时长过短，无法生成回忆画面。')
    const candidates: { frame: RecapMediaFrame; quality: number; fingerprint: number[] }[] = []
    for (const fraction of VIDEO_FRACTIONS) {
      await seek(video, Math.min(duration - .12, Math.max(.12, duration * fraction)))
      const { canvas, context } = drawPreview(video, video.videoWidth, video.videoHeight)
      const signal = frameSignal(context, canvas.width, canvas.height)
      if (signal.quality < 18) continue
      candidates.push({ frame: { id: crypto.randomUUID(), kind: 'video', dataUrl: canvas.toDataURL('image/jpeg', .76), sourceName: file.name, capturedAt: Math.round(video.currentTime * 1000) }, ...signal })
    }
    const result: RecapMediaFrame[] = []
    const fingerprints: number[][] = []
    for (const candidate of candidates.sort((a, b) => b.quality - a.quality)) {
      if (differentEnough(candidate.fingerprint, fingerprints)) {
        result.push(candidate.frame)
        fingerprints.push(candidate.fingerprint)
      }
      if (result.length === count) break
    }
    return result.sort((a, b) => (a.capturedAt ?? 0) - (b.capturedAt ?? 0))
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}
export async function compressImage(file: File, maxEdge = 1280, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20 MB。')
  const source = await readFile(file)
  const image = await loadImage(source)
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法处理这张图片')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = source
  })
}

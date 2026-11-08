import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const DEFAULT_WARMUP_SECONDS = 1
export const MAX_WARMUP_SECONDS = 10

// Picked by comparing test shots of the boiler display: full sensor size, extra sharpness and contrast,
// and no noise smoothing (it softens the digits)
const IMAGE_ARGS = [
  '--mode', '2592:1944',
  '--width', '2592',
  '--height', '1944',
  '--quality', '95',
  '--sharpness', '2',
  '--contrast', '1.3',
  '--denoise', 'off',
]

// Only one process can open the camera, so photos are taken one at a time
let queue: Promise<unknown> = Promise.resolve()

export function takePhoto({ warmupSeconds = DEFAULT_WARMUP_SECONDS } = {}): Promise<Buffer> {
  const photo = queue.then(() => capture(warmupSeconds))
  queue = photo.catch(() => {})
  return photo
}

// The OV5647 is a CSI ribbon camera, driven by rpicam-apps (preinstalled on Raspberry Pi OS), not GPIO.
// --timeout is the warm-up before the shot, which lets auto exposure settle in dim light
async function capture(warmupSeconds: number): Promise<Buffer> {
  try {
    const { stdout } = await run(
      'rpicam-still',
      [
        '--nopreview',
        ...IMAGE_ARGS,
        '--timeout', String(warmupSeconds * 1000),
        '--output', '-',
      ],
      {
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024,
        // A full-size JPEG takes a while to encode on a Pi 1
        timeout: warmupSeconds * 1000 + 40_000,
        killSignal: 'SIGKILL',
      },
    )
    return stdout
  } catch (error) {
    throw new Error(describeFailure(error))
  }
}

function describeFailure(error: unknown): string {
  const { killed, code, stderr } = error as { killed?: boolean; code?: string; stderr?: Buffer }
  if (killed) return 'Camera timed out'
  if (code === 'ENOENT') return 'rpicam-still is not installed'
  const lastLine = stderr?.toString().trim().split('\n').at(-1)
  return lastLine ? `Camera failed: ${lastLine}` : 'Camera failed'
}

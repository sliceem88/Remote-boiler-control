import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const DEFAULT_WARMUP_SECONDS = 1
export const MAX_WARMUP_SECONDS = 10

// Telegram recompresses photos to ~1280px anyway, so a smaller frame uploads faster from a Pi 2
const WIDTH = 1600
const HEIGHT = 1200

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
        '--width', String(WIDTH),
        '--height', String(HEIGHT),
        '--timeout', String(warmupSeconds * 1000),
        '--output', '-',
      ],
      {
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024,
        timeout: warmupSeconds * 1000 + 20_000,
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

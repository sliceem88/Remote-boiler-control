import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

// The OV5647 is a CSI ribbon camera, driven by rpicam-apps (preinstalled on Raspberry Pi OS), not GPIO
export async function takePhoto(): Promise<Buffer> {
  const { stdout } = await run('rpicam-still', ['--nopreview', '--timeout', '1000', '--output', '-'], {
    encoding: 'buffer',
    maxBuffer: 20 * 1024 * 1024,
  })
  return stdout
}

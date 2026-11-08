import { setTimeout as sleep } from 'node:timers/promises'
import { RaspberryPi_4B } from 'opengpio'

// BCM pins wired to the relay board inputs IN1..IN8
const PINS = ['GPIO5', 'GPIO6', 'GPIO13', 'GPIO19', 'GPIO26', 'GPIO16', 'GPIO20', 'GPIO21'] as const

// Most 8-channel relay boards switch a relay ON when its input is pulled LOW
const ACTIVE_LOW = true

// Pause between relays while testing, so each click is distinct
const TEST_GAP_MS = 500

export const RELAY_COUNT = PINS.length

const outputs = PINS.map((pin) => {
  const output = RaspberryPi_4B.output(pin)
  output.value = ACTIVE_LOW // start with every relay off
  return output
})

export function setRelay(channel: number, on: boolean) {
  outputs[channel - 1].value = on !== ACTIVE_LOW
}

export function getRelayStates(): boolean[] {
  return outputs.map((output) => output.value !== ACTIVE_LOW)
}

// Relay actions run one at a time, so two commands never fight over a relay
let queue: Promise<unknown> = Promise.resolve()

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task)
  queue = result.catch(() => {})
  return result
}

// Close the relay for durationMs, then open it again (always, even on error)
async function pulse(channel: number, durationMs: number) {
  setRelay(channel, true)
  try {
    await sleep(durationMs)
  } finally {
    setRelay(channel, false)
  }
}

export function pulseRelay(channel: number, durationMs: number): Promise<void> {
  return runExclusive(() => pulse(channel, durationMs))
}

// Pulse every relay in turn; onStep runs just before each one
export function testRelays(durationMs: number, onStep?: (channel: number) => Promise<unknown>): Promise<void> {
  return runExclusive(async () => {
    for (let channel = 1; channel <= RELAY_COUNT; channel++) {
      await onStep?.(channel)
      await pulse(channel, durationMs)
      await sleep(TEST_GAP_MS)
    }
  })
}

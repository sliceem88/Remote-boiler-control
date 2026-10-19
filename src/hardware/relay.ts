import { RaspberryPi_4B } from 'opengpio'

// BCM pins wired to the relay board inputs IN1..IN8
const PINS = ['GPIO5', 'GPIO6', 'GPIO13', 'GPIO16', 'GPIO19', 'GPIO20', 'GPIO21', 'GPIO26'] as const

// Most 8-channel relay boards switch a relay ON when its input is pulled LOW
const ACTIVE_LOW = true

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

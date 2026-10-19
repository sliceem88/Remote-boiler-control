import { readdir, readFile } from 'node:fs/promises'

// DS18B20 is read through the kernel 1-Wire driver (dtoverlay=w1-gpio, data on GPIO4)
const W1_DEVICES = '/sys/bus/w1/devices'

export async function readTemperature(): Promise<number> {
  const sensor = (await readdir(W1_DEVICES)).find((name) => name.startsWith('28-'))
  if (!sensor) throw new Error('No DS18B20 sensor found')

  const milliCelsius = await readFile(`${W1_DEVICES}/${sensor}/temperature`, 'utf8')
  return Number(milliCelsius) / 1000
}

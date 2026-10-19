# Remote-boiler-control
Boiler control through raspberry PI GPIO ports and Camera

## Stack

| Part | Library |
| --- | --- |
| HTTP server | [Hono](https://hono.dev) + `@hono/node-server` |
| Database | SQLite via `better-sqlite3` (file: `data/boiler.db`) |
| Telegram bot | [grammY](https://grammy.dev) (long polling, no public URL needed) |
| Relays (8 channel) | [`opengpio`](https://github.com/ExpeditionExploration/opengpio) (libgpiod 2) |
| Camera OV5647 | `rpicam-still` CLI (CSI ribbon camera, not GPIO) |
| Temperature (DS18B20) | Kernel 1-Wire driver, read from `/sys/bus/w1/devices` |

TypeScript runs directly on Node (type stripping, Node >= 22.18), so there is no build step.

## Wiring (BCM numbering)

| Device | Pin |
| --- | --- |
| Relay IN1..IN8 | GPIO5, GPIO6, GPIO13, GPIO16, GPIO19, GPIO20, GPIO21, GPIO26 |
| DS18B20 data | GPIO4 (pin 7), with a 4.7 kΩ resistor between data and 3.3V |
| Camera | CSI camera connector |

Relay pins and active-low logic are set in `src/hardware/relay.ts`. The boiler side of the relays is mains voltage, so get it wired by someone qualified.

## Raspberry Pi setup

1. Flash **Raspberry Pi OS Lite (64-bit)** with Raspberry Pi Imager. In its settings, enable SSH and set Wi-Fi.
2. Install Node 24 and the build tools:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt install -y nodejs build-essential python3 libgpiod-dev gpiod
   ```
3. Add the 1-Wire line to `/boot/firmware/config.txt`, then reboot:
   ```
   dtoverlay=w1-gpio
   ```
4. Check the camera with `rpicam-hello --list-cameras`. If no camera is listed, set `camera_auto_detect=0` and add `dtoverlay=ov5647` in `config.txt`.
5. Install and run:
   ```bash
   npm install
   cp .env.example .env   # then fill it in
   npm start
   ```

## Local development (no Raspberry Pi)

`opengpio` can't be compiled without libgpiod 2, so skip its build and run it mocked:

```bash
npm install --ignore-scripts && npm rebuild better-sqlite3
cp .env.example .env   # set OPENGPIO_MOCKED=true
npm run dev
```

On a laptop, `/temp` and `/photo` reply with an error because the sensor and camera aren't there.

## Telegram bot

1. In Telegram, open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Choose a display name, then a username ending in `bot` (e.g. `my_boiler_bot`).
3. BotFather replies with a token like `123456789:AAH...`. Put it in `.env` as `TELEGRAM_BOT_TOKEN`. Keep it secret: anyone with the token controls the bot.
4. Start the app and open your bot at `https://t.me/<username>`, or search for the username in Telegram. Press **Start**.
5. The bot replies `Access denied. Your Telegram user id is ...`. Put that id in `TELEGRAM_ALLOWED_USER_IDS` (comma-separated for several people) and restart.

Commands (also shown in Telegram's menu button):

| Command | What it does |
| --- | --- |
| `/help` | List commands |
| `/photo` | Send a camera photo |
| `/temp` | Read the temperature |
| `/relay` | Show all relay states |
| `/relay 3 on` | Switch relay 3 on (or `off`) |
| any text | Saved to SQLite and echoed back |

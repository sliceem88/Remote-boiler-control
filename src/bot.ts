import { Bot, type Context, InputFile } from 'grammy'
import { saveMessage } from './db.ts'
import { MAX_WARMUP_SECONDS, takePhoto } from './hardware/camera.ts'
import { getRelayStates, pulseRelay, RELAY_COUNT, setRelay, testRelays } from './hardware/relay.ts'
import { readTemperature } from './hardware/temperature.ts'

const SHORT_MS = 100
const TAP_MS = 500
const HOLD_MS = 2000
const TEST_PRESS_MS = 1000

// Each command presses a boiler button: the relay closes for holdMs, then opens again, then the bot
// replies with `text` and a photo of the boiler.
// Channels are relay board inputs: 1 = GPIO5, 2 = GPIO6, 3 = GPIO13, 4 = GPIO19.
// Channel 3 is one physical button (short press = Back, 2 s hold = Start / Stop), channel 4 is Menu / Enter.
const BUTTONS = [
  { command: 'plus', text: 'Plus temperature', channel: 1, holdMs: SHORT_MS },
  { command: 'minus', text: 'Minus temperature', channel: 2, holdMs: SHORT_MS },
  { command: 'start', text: 'Start', channel: 3, holdMs: HOLD_MS },
  { command: 'stop', text: 'Stop', channel: 3, holdMs: HOLD_MS },
  { command: 'back', text: 'Back', channel: 3, holdMs: SHORT_MS },
  { command: 'menu', text: 'Menu', channel: 4, holdMs: TAP_MS },
  { command: 'enter', text: 'Enter', channel: 4, holdMs: TAP_MS },
]

const COMMANDS = [
  { command: 'help', description: 'Show available commands' },
  ...BUTTONS.map(({ command, text, channel, holdMs }) => ({
    command,
    description: `${text} (relay ${channel}, ${holdMs / 1000} s)`,
  })),
  { command: 'test', description: 'Pulse every relay in turn: /test run' },
  { command: 'photo', description: `Take a camera photo, e.g. /photo 5 for a longer warm-up (1-${MAX_WARMUP_SECONDS} s)` },
  { command: 'temp', description: 'Read boiler temperature' },
  { command: 'relay', description: 'Show relays, or switch one: /relay 1 on' },
]

const HELP_TEXT = COMMANDS.map(({ command, description }) => `/${command} - ${description}`).join('\n')

const allowedUserIds = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? '')
  .split(',')
  .filter(Boolean)
  .map(Number)

// Never throws, so it can run in the background without crashing the bot
async function sendStatusPhoto(ctx: Context) {
  try {
    await ctx.replyWithChatAction('upload_photo')
    await ctx.replyWithPhoto(new InputFile(await takePhoto(), 'photo.jpg'))
  } catch (error) {
    console.error(error)
    await ctx
      .reply(`Photo failed: ${error instanceof Error ? error.message : String(error)}`)
      .catch((replyError) => console.error('Could not report the error:', replyError))
  }
}

export async function startBot(token: string) {
  const bot = new Bot(token)

  // The bot is public, so only listed users may control the boiler
  bot.use(async (ctx, next) => {
    if (ctx.from && allowedUserIds.includes(ctx.from.id)) return next()
    // Only answer in private chats: channels and groups are ignored silently
    if (ctx.chat?.type === 'private') await ctx.reply(`Access denied. Your Telegram user id is ${ctx.from?.id}`)
  })

  bot.command('help', (ctx) => ctx.reply(HELP_TEXT))

  for (const { command, text, channel, holdMs } of BUTTONS) {
    bot.command(command, async (ctx) => {
      await pulseRelay(channel, holdMs)
      await ctx.reply(text)
      // Not awaited: a slow photo must not delay the next button press
      void sendStatusPhoto(ctx)
    })
  }

  // Closes every relay, so anything wired to the boiler buttons gets pressed: needs an explicit "run"
  bot.command('test', async (ctx) => {
    if (ctx.match.trim() !== 'run') {
      return ctx.reply(`This closes all ${RELAY_COUNT} relays in turn, so every boiler button wired to them is pressed. Send /test run to go ahead.`)
    }
    await ctx.reply(`Testing ${RELAY_COUNT} relays, one at a time`)
    await testRelays(TEST_PRESS_MS, async (channel) => {
      await ctx.reply(`Relay ${channel}`)
    })
    await ctx.reply('Test finished')
  })

  bot.command('photo', async (ctx) => {
    const arg = ctx.match.trim()
    const warmupSeconds = arg ? Number(arg) : undefined
    if (warmupSeconds !== undefined && !(warmupSeconds >= 1 && warmupSeconds <= MAX_WARMUP_SECONDS)) {
      return ctx.reply(`Usage: /photo [warm-up seconds, 1-${MAX_WARMUP_SECONDS}]`)
    }
    await ctx.replyWithChatAction('upload_photo')
    await ctx.replyWithPhoto(new InputFile(await takePhoto({ warmupSeconds }), 'photo.jpg'))
  })

  bot.command('temp', async (ctx) => {
    await ctx.reply(`Temperature: ${(await readTemperature()).toFixed(1)} °C`)
  })

  bot.command('relay', async (ctx) => {
    const [channel, state] = ctx.match.split(/\s+/)
    if (channel) {
      const index = Number(channel)
      if (!Number.isInteger(index) || index < 1 || index > RELAY_COUNT || !['on', 'off'].includes(state)) {
        return ctx.reply(`Usage: /relay <1-${RELAY_COUNT}> <on|off>`)
      }
      setRelay(index, state === 'on')
    }
    await ctx.reply(getRelayStates().map((on, i) => `Relay ${i + 1}: ${on ? 'ON' : 'off'}`).join('\n'))
  })

  bot.on('message:text', async (ctx) => {
    saveMessage(ctx.chat.id, ctx.message.text)
    await ctx.reply(`You said: ${ctx.message.text}`)
  })

  bot.catch(async ({ ctx, error }) => {
    console.error(error)
    // If this reply fails too (e.g. the bot was kicked from the chat), only log it: crashing would loop on the same update
    await ctx
      .reply(`Error: ${error instanceof Error ? error.message : String(error)}`)
      .catch((replyError) => console.error('Could not report the error:', replyError))
  })

  await bot.api.setMyCommands(COMMANDS)
  // Commands sent while the Pi was off are dropped, so a queued /start or /plus never fires at boot
  await bot.start({
    drop_pending_updates: true,
    onStart: (me) => console.log(`Telegram bot @${me.username} started`),
  })
}

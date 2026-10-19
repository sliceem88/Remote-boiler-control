import { Bot, InputFile } from 'grammy'
import { saveMessage } from './db.ts'
import { takePhoto } from './hardware/camera.ts'
import { getRelayStates, RELAY_COUNT, setRelay } from './hardware/relay.ts'
import { readTemperature } from './hardware/temperature.ts'

const COMMANDS = [
  { command: 'help', description: 'Show available commands' },
  { command: 'photo', description: 'Take a camera photo' },
  { command: 'temp', description: 'Read boiler temperature' },
  { command: 'relay', description: 'Show relays, or switch one: /relay 1 on' },
]

const HELP_TEXT = COMMANDS.map(({ command, description }) => `/${command} - ${description}`).join('\n')

const allowedUserIds = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? '')
  .split(',')
  .filter(Boolean)
  .map(Number)

export async function startBot(token: string) {
  const bot = new Bot(token)

  // The bot is public, so only listed users may control the boiler
  bot.use(async (ctx, next) => {
    if (ctx.from && allowedUserIds.includes(ctx.from.id)) return next()
    await ctx.reply(`Access denied. Your Telegram user id is ${ctx.from?.id}`)
  })

  bot.command(['start', 'help'], (ctx) => ctx.reply(HELP_TEXT))

  bot.command('photo', async (ctx) => {
    await ctx.replyWithPhoto(new InputFile(await takePhoto(), 'photo.jpg'))
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
    await ctx.reply(`Error: ${error instanceof Error ? error.message : String(error)}`)
  })

  await bot.api.setMyCommands(COMMANDS)
  await bot.start({ onStart: (me) => console.log(`Telegram bot @${me.username} started`) })
}

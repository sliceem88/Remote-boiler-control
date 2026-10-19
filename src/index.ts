import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { startBot } from './bot.ts'

const app = new Hono()

app.get('/', (c) => c.text('Hello World!'))

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`)
})

const token = process.env.TELEGRAM_BOT_TOKEN
if (token) {
  startBot(token)
} else {
  console.warn('TELEGRAM_BOT_TOKEN is not set, Telegram bot is disabled')
}

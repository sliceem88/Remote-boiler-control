import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dataDir = join(import.meta.dirname, '..', 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new Database(join(dataDir, 'boiler.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

const insertMessage = db.prepare('INSERT INTO messages (chat_id, text) VALUES (?, ?)')

export function saveMessage(chatId: number, text: string) {
  insertMessage.run(chatId, text)
}

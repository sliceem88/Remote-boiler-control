import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
// Built into Node (22.5+), so there is no native module to compile on the Pi
import { DatabaseSync } from 'node:sqlite'

const dataDir = join(import.meta.dirname, '..', 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(join(dataDir, 'boiler.db'))
db.exec('PRAGMA journal_mode = WAL')

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
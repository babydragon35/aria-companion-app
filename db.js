import BetterSqlite3 from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Simple SQLite database for Aria's data.
// In production, you can swap this for PostgreSQL, MongoDB, or any database.

export class Database {
  constructor(filename) {
    this.db = new BetterSqlite3(filename);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'text',
        content TEXT,
        media_url TEXT,
        media_prompt TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        significance TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS companion_state (
        user_id TEXT PRIMARY KEY,
        mood TEXT,
        mood_context TEXT,
        inner_life TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, created_at);
    `);
  }

  // ─── Messages ───
  createMessage(userId, role, contentType, content, extra = {}) {
    const id = uuidv4();
    this.db.prepare(
      `INSERT INTO messages (id, user_id, role, content_type, content, media_url, media_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, role, contentType, content || '', extra.media_url || null, extra.media_prompt || null);
    return { id, user_id: userId, role, content_type: contentType, content, ...extra };
  }

  getMessages(userId, limit = 50) {
    return this.db.prepare(
      `SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(userId, limit).reverse();
  }

  getRecentMessages(userId, limit = 10) {
    return this.db.prepare(
      `SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(userId, limit).reverse();
  }

  getLastMessageTime(userId) {
    const row = this.db.prepare(
      `SELECT created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId);
    return row ? new Date(row.created_at + 'Z').getTime() : 0;
  }

  // ─── Memories ───
  createMemory(userId, content, significance = '') {
    const id = uuidv4();
    this.db.prepare(
      `INSERT INTO memories (id, user_id, content, significance) VALUES (?, ?, ?, ?)`
    ).run(id, userId, content, significance);
  }

  getMemories(userId, limit = 10) {
    return this.db.prepare(
      `SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(userId, limit);
  }

  // ─── Companion State ───
  getCompanionState(userId) {
    return this.db.prepare(
      `SELECT * FROM companion_state WHERE user_id = ?`
    ).get(userId);
  }

  updateCompanionState(userId, mood, moodContext, innerLife) {
    const existing = this.getCompanionState(userId);
    if (existing) {
      this.db.prepare(
        `UPDATE companion_state SET mood = ?, mood_context = ?, inner_life = ?, updated_at = datetime('now')
         WHERE user_id = ?`
      ).run(mood, moodContext || existing.mood_context, innerLife || existing.inner_life, userId);
    } else {
      this.db.prepare(
        `INSERT INTO companion_state (user_id, mood, mood_context, inner_life) VALUES (?, ?, ?, ?)`
      ).run(userId, mood, moodContext || '', innerLife || '');
    }
  }

  // ─── Users (derived from messages) ───
  getAllUsers() {
    return this.db.prepare(
      `SELECT DISTINCT user_id FROM messages`
    ).all().map(r => r.user_id);
  }
}
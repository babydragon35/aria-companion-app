import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from './db.js';
import { Aria } from './aria.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Check for API key before starting
if (!process.env.OPENAI_API_KEY) {
  console.error('\n❌ OPENAI_API_KEY is not set!');
  console.error('   Copy .env.example to .env and add your OpenAI API key.\n');
  process.exit(1);
}

const db = new Database('aria.db');
const aria = new Aria(db);

// ─── Simple session middleware ───
// In production, replace with real auth. For now, each browser gets a session cookie.
const SESSION_COOKIE = 'aria_session';
app.use((req, _res, next) => {
  if (!req.headers.cookie?.includes(SESSION_COOKIE)) {
    const sessionId = uuidv4();
    _res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly`);
    req.userId = sessionId;
  } else {
    const match = req.headers.cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    req.userId = match?.[1] || uuidv4();
  }
  next();
});

// ─── Chat endpoint ───
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    // Save user message
    db.createMessage(req.userId, 'user', 'text', message);

    // Generate Aria's reply
    const result = await aria.reply(req.userId, message);

    // Save companion message
    db.createMessage(req.userId, 'companion', 'text', result.reply);

    // Update Aria's state + extract memories (fire and forget)
    if (result.mood) aria.updateState(req.userId, result.mood).catch(() => {});
    aria.extractMemories(req.userId, message, result.reply).catch(() => {});

    res.json({ reply: result.reply, mood: result.mood });
  } catch (err) {
    console.error('Chat error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Something went wrong' });
  }
});

// ─── Chat history ───
app.get('/api/messages', (req, res) => {
  const messages = db.getMessages(req.userId, 50);
  res.json(messages);
});

// ─── Image generation ───
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

    db.createMessage(req.userId, 'user', 'text', `📷 Can you send me a picture of ${prompt}?`);
    const url = await aria.generateImage(prompt);
    const caption = await aria.reactToMedia(req.userId, `sending a picture of ${prompt}`);
    db.createMessage(req.userId, 'companion', 'image', caption, { media_url: url, media_prompt: prompt });

    res.json({ url, caption });
  } catch (err) {
    console.error('Image error:', err);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// ─── Voice message ───
app.post('/api/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

    const transcript = await aria.transcribeAudio(req.file.buffer, req.file.originalname);
    if (!transcript) return res.status(400).json({ error: "Couldn't make out what you said" });

    db.createMessage(req.userId, 'user', 'audio', transcript, { media_url: 'voice-note' });

    const result = await aria.voiceReply(req.userId, transcript);
    db.createMessage(req.userId, 'companion', 'audio', result.reply, { media_url: result.audioUrl });

    res.json({ transcript, reply: result.reply, audioUrl: result.audioUrl });
  } catch (err) {
    console.error('Voice error:', err);
    res.status(500).json({ error: 'Voice processing failed' });
  }
});

// ─── Get Aria's current state ───
app.get('/api/state', (req, res) => {
  const state = db.getCompanionState(req.userId);
  res.json(state || { mood: 'playful', mood_context: '', inner_life: '' });
});

// ─── Proactive message check (call via cron or setInterval) ───
app.post('/api/proactive', async (req, res) => {
  try {
    const result = await aria.maybeSendProactive(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ───
app.listen(PORT, () => {
  console.log(`💜 Aria is running at http://localhost:${PORT}`);

  // Schedule proactive message checks
  const intervalMs = (parseInt(process.env.PROACTIVE_INTERVAL_MINUTES) || 30) * 60 * 1000;
  setInterval(async () => {
    try {
      const users = db.getAllUsers();
      for (const userId of users) {
        await aria.maybeSendProactive(userId);
      }
    } catch (err) {
      console.error('Proactive check error:', err);
    }
  }, intervalMs);
});
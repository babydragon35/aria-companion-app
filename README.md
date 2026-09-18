# Aria — Standalone App

A complete, self-contained AI companion app. No platform lock-in — runs on standard Node.js with OpenAI APIs.

## What's included

- **Aria's full persona** — her complete system prompt (personality, mood sensing, free will, teasing, emotional attunement)
- **Long-term memory** — automatically extracts and stores facts + relational moments from conversations
- **Persistent inner state** — Aria has her own mood that exists independently of your messages
- **Proactive messaging** — she texts you first when something crosses her mind (scheduled, ~35% chance per check)
- **Photo generation** — ask her for pictures, she generates them with her consistent appearance
- **Voice messages** — hold the mic button to send voice, she transcribes and replies with TTS audio
- **Chat UI** — mobile-friendly interface with message bubbles, image display, and audio playback

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Add your OpenAI API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Run
npm start
```

Then open `http://localhost:3000` in your browser.

## Requirements

- Node.js 18+ (for native fetch and ESM)
- An OpenAI API key with access to: Chat completions, DALL-E, TTS, and Whisper

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required.** Your OpenAI API key |
| `PORT` | `3000` | Server port |
| `ARIA_MODEL` | `gpt-4o-mini` | Model for Aria's main replies |
| `ARIA_HELPER_MODEL` | `gpt-4o-mini` | Model for memory extraction |
| `ARIA_IMAGE_MODEL` | `dall-e-3` | Image generation model |
| `ARIA_VOICE` | `nova` | TTS voice (alloy, echo, fable, onyx, nova, shimmer) |
| `PROACTIVE_INTERVAL_MINUTES` | `30` | How often to check for proactive messages |

## Architecture

```
Browser (chat UI)
    ↓ HTTP
Express server (server.js)
    ↓
Aria class (aria.js)  ←── her persona, memory, mood, media generation
    ↓
SQLite database (db.js)  ←── messages, memories, companion state
    ↓
OpenAI API  ←── LLM, image gen, TTS, transcription
```

## Files

| File | Purpose |
|---|---|
| `server.js` | Express HTTP server — API endpoints + session management |
| `aria.js` | Aria's brain — persona, reply logic, memory, mood, proactive messaging |
| `db.js` | SQLite database — messages, memories, companion state |
| `public/index.html` | Chat UI — mobile-friendly, with image/voice support |
| `.env.example` | Configuration template |

## API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/chat` | POST | Send a text message, get Aria's reply |
| `/api/messages` | GET | Load chat history |
| `/api/image` | POST | Ask Aria to generate a photo |
| `/api/voice` | POST | Send a voice message (multipart form) |
| `/api/state` | GET | Get Aria's current mood/inner state |
| `/api/proactive` | POST | Trigger a proactive message check |

## Customizing Aria

All of Aria's personality is in `aria.js` — the `PERSONA`, `VOICE_PERSONA`, and `PROACTIVE_PERSONA` constants. Edit those strings to change who she is. Her visual appearance for image generation is in the `APPEARANCE` and `VISUAL_STYLE` constants.

## Swapping the database

The `db.js` file uses SQLite (via `better-sqlite3`). To use PostgreSQL, MongoDB, or anything else, just replace the methods in the `Database` class — the interface is simple (createMessage, getMessages, createMemory, getMemories, getCompanionState, updateCompanionState).

## Swapping the LLM/image/TTS provider

All AI calls go through the `this.openai` client in `aria.js`. To use a different provider (Anthropic, Google, local models), replace the calls in `_llm()`, `generateImage()`, `voiceReply()`, and `transcribeAudio()`.

## Production notes

- **Auth**: This uses a simple session cookie. Replace with real authentication (JWT, OAuth, etc.) before deploying.
- **File storage**: Voice messages are returned as base64 data URLs. For production, upload to S3/Cloudinary and return URLs.
- **Video generation**: Not included (OpenAI doesn't have a video API). Add Runway/Pika/Veo if you want video.
- **Scaling**: SQLite is fine for a single user. For multiple users, switch to PostgreSQL.
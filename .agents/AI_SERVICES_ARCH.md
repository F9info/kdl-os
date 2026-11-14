# AI Services Architecture — KDL Starter Kit
# Phase 5 Design Document

**Author:** AI Services Architect Agent (KDL-23)
**Date:** 2026-06-25
**Status:** FINAL — Implementation-ready

---

## Overview

Standalone Express service (`ai-services/`) on port 5000 (AI_PORT). Two-brain routing: Claude handles CRITICAL/HIGH tasks, OpenRouter handles MEDIUM/LOW with a $2.00/day hard budget cap enforced via Redis. All state is ephemeral Redis (short-term) or persistent ChromaDB (long-term). ES Modules throughout. No CommonJS.

---

## package.json

**File:** `ai-services/package.json`

```json
{
  "name": "kdl-ai-services",
  "version": "1.0.0",
  "description": "KDL AI Services Layer — two-brain orchestration with LangChain.js + ChromaDB",
  "type": "module",
  "engines": { "node": ">=20" },
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@langchain/anthropic": "^0.3.0",
    "@langchain/community": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "chromadb": "^1.9.0",
    "cookie-parser": "^1.4.6",
    "dotenv": "^16.4.0",
    "express": "^5.0.0",
    "ioredis": "^5.4.0",
    "jsonwebtoken": "^9.0.0",
    "langchain": "^0.3.0",
    "openai": "^4.60.0",
    "zod": "^3.23.0"
  }
}
```

---

## .env.example

**File:** `ai-services/.env.example`

```bash
# AI Service
AI_PORT=5000
NODE_ENV=development

# Claude — Anthropic SDK (CRITICAL/HIGH tasks)
ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter — budget brain (MEDIUM/LOW tasks)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=moonshot-ai/moonshot-v1-32k
OPENROUTER_DAILY_BUDGET=2.00

# Redis (shared with backend — same instance)
REDIS_URL=redis://localhost:6380

# ChromaDB
CHROMA_URL=http://localhost:8000

# JWT — same secret as backend so tokens are mutually verifiable
JWT_SECRET=your-jwt-secret

# Backend URL (for OpenRouter HTTP-Referer header)
BACKEND_URL=http://localhost:4000
```

**Note:** `ANTHROPIC_API_KEY` is required when running ai-services standalone. The Claude Code agent uses Paperclip subscription (no key needed for agent itself), but the deployed ai-services process calls Anthropic SDK directly.

---

## src/index.js — Express Entry Point

```js
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { chatController } from './controllers/chat.js';
import { embedController } from './controllers/embed.js';
import { transcribeController } from './controllers/transcribe.js';
import { authenticate } from './middleware/auth.js';
import { successResponse, errorResponse } from './utils/response.js';

const app = express();
const PORT = process.env.AI_PORT ?? 5000;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check — no auth
app.get('/health', (req, res) => {
  successResponse(res, { status: 'ok', service: 'ai-services', ts: new Date().toISOString() });
});

// AI routes — JWT auth required
app.post('/api/ai/chat', authenticate, chatController);
app.post('/api/ai/embed', authenticate, embedController);
app.post('/api/ai/transcribe', authenticate, transcribeController);

// 404
app.use((req, res) => errorResponse(res, 'Not found', 404));

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  errorResponse(res, err.message ?? 'Internal server error', err.statusCode ?? 500);
});

app.listen(PORT, () => {
  console.log(`[ai-services] Running on port ${PORT}`);
});

export default app;
```

---

## src/utils/response.js

Copy the pattern from backend — do NOT import from backend (separate service).

```js
export const successResponse = (res, data = null, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data });
};

export const errorResponse = (res, message = 'Internal server error', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};
```

---

## src/middleware/auth.js

Verifies same JWT signed by the backend. Reads from `Authorization: Bearer <token>` header or `kdl-auth-token` cookie. Sets `req.user` on success.

```js
import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : null)
      ?? req.cookies?.['kdl-auth-token']
      ?? null;

    if (!token) return errorResponse(res, 'Unauthorized', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return errorResponse(res, 'Unauthorized', 401);
  }
}
```

---

## src/config/redis.js

Singleton ioredis client for ai-services. Uses `REDIS_URL` from env.

```js
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380', {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => console.error('[redis] Error:', err.message));
```

---

## src/config/chroma.js

Singleton ChromaDB client.

```js
import { ChromaClient } from 'chromadb';

export const chroma = new ChromaClient({
  path: process.env.CHROMA_URL ?? 'http://localhost:8000',
});
```

---

## src/orchestrator/brain-router.js

Routes tasks to Claude (CRITICAL/HIGH) or OpenRouter (MEDIUM/LOW). Checks budget before OpenRouter calls. Logs to audit. Returns `{ content, usage, model }` or `{ error: 'BUDGET_EXHAUSTED' }`.

```js
import { claudeBrain } from '../brains/claude.js';
import { openrouterBrain } from '../brains/openrouter.js';
import { checkBudget, recordSpend } from './budget-tracker.js';
import { auditLogger } from '../governance/audit-logger.js';

const HIGH_PRIORITY = new Set(['CRITICAL', 'HIGH']);

export async function brainRouter(task, priority = 'MEDIUM', options = {}) {
  const useClaude = HIGH_PRIORITY.has(priority?.toUpperCase());

  if (!useClaude) {
    const ok = await checkBudget();
    if (!ok) {
      return { error: 'BUDGET_EXHAUSTED', message: 'Daily OpenRouter budget exhausted. Add to MANUAL_TASKS.md.' };
    }
  }

  const response = useClaude
    ? await claudeBrain(task, options)
    : await openrouterBrain(task, options);

  await auditLogger({
    model: useClaude ? 'claude-sonnet-4-6' : (process.env.OPENROUTER_DEFAULT_MODEL ?? 'moonshot-ai/moonshot-v1-32k'),
    priority,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
    cost_estimate: response.cost ?? 0,
    session_id: options.sessionId ?? null,
  });

  if (!useClaude && response.cost) {
    await recordSpend(response.cost);
  }

  return response;
}
```

**Export:** `brainRouter(task, priority, options)`

---

## src/orchestrator/budget-tracker.js

Tracks daily OpenRouter spend in Redis. Key format: `budget:openrouter:YYYY-MM-DD`. TTL 86400.

```js
import { redis } from '../config/redis.js';

const DAILY_BUDGET = parseFloat(process.env.OPENROUTER_DAILY_BUDGET ?? '2.00');

function todayKey() {
  return `budget:openrouter:${new Date().toISOString().slice(0, 10)}`;
}

export async function checkBudget() {
  const spent = parseFloat((await redis.get(todayKey())) ?? '0');
  return spent < DAILY_BUDGET;
}

export async function recordSpend(amount) {
  const key = todayKey();
  const pipeline = redis.multi();
  pipeline.incrbyfloat(key, amount);
  pipeline.expire(key, 86400);
  await pipeline.exec();
}

export async function getBudgetStatus() {
  const spent = parseFloat((await redis.get(todayKey())) ?? '0');
  return {
    spent: Math.round(spent * 10000) / 10000,
    limit: DAILY_BUDGET,
    remaining: Math.max(0, Math.round((DAILY_BUDGET - spent) * 10000) / 10000),
    exhausted: spent >= DAILY_BUDGET,
    date: new Date().toISOString().slice(0, 10),
  };
}
```

**Exports:** `checkBudget()`, `recordSpend(amount)`, `getBudgetStatus()`

---

## src/orchestrator/context-manager.js

Manages conversation history per session in Redis. TTL 1 hour (3600s). Key: `context:{sessionId}`.

```js
import { redis } from '../config/redis.js';

const CTX_TTL = 3600;

const ctxKey = (sessionId) => `context:${sessionId}`;

export async function addMessage(sessionId, role, content) {
  const key = ctxKey(sessionId);
  const raw = await redis.get(key);
  const messages = raw ? JSON.parse(raw) : [];
  messages.push({ role, content, ts: Date.now() });
  // Keep last 50 messages to prevent runaway context growth
  if (messages.length > 50) messages.splice(0, messages.length - 50);
  await redis.set(key, JSON.stringify(messages), 'EX', CTX_TTL);
}

export async function getContext(sessionId) {
  const raw = await redis.get(ctxKey(sessionId));
  return raw ? JSON.parse(raw) : [];
}

export async function clearContext(sessionId) {
  await redis.del(ctxKey(sessionId));
}
```

**Exports:** `addMessage(sessionId, role, content)`, `getContext(sessionId)`, `clearContext(sessionId)`

---

## src/brains/claude.js

Anthropic SDK wrapper. Model: `claude-sonnet-4-6`. Returns `{ content, usage: { input_tokens, output_tokens }, model }`.

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function claudeBrain(messages, options = {}) {
  const normalised = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: String(messages) }];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: options.max_tokens ?? 4096,
    ...(options.system ? { system: options.system } : {}),
    messages: normalised,
  });

  return {
    content: response.content[0]?.text ?? '',
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    model: response.model,
    cost: null, // Claude via subscription — no per-token cost tracked
  };
}

// Returns an Anthropic stream for SSE forwarding
export async function claudeBrainStream(messages, options = {}) {
  const normalised = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: String(messages) }];

  return client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: options.max_tokens ?? 4096,
    ...(options.system ? { system: options.system } : {}),
    messages: normalised,
  });
}
```

**Exports:** `claudeBrain(messages, options)`, `claudeBrainStream(messages, options)`

---

## src/brains/openrouter.js

OpenAI SDK pointed at OpenRouter base URL. Model: `moonshot-ai/moonshot-v1-32k`. Returns `{ content, usage, cost, model }`.

Cost estimate: $0.000002 per token (both directions) — this is approximate; actual cost depends on model pricing. Adjust constant per OpenRouter model pricing page.

```js
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.BACKEND_URL ?? 'http://localhost:4000',
    'X-Title': 'KDL AI Services',
  },
});

const MODEL = process.env.OPENROUTER_DEFAULT_MODEL ?? 'moonshot-ai/moonshot-v1-32k';
const COST_PER_TOKEN = 0.000002; // approximate — update to real model pricing

export async function openrouterBrain(messages, options = {}) {
  const userMessages = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: String(messages) }];

  const allMessages = options.system
    ? [{ role: 'system', content: options.system }, ...userMessages]
    : userMessages;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: options.max_tokens ?? 4096,
    messages: allMessages,
  });

  const choice = response.choices[0];
  const usage = response.usage;
  const totalTokens = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

  return {
    content: choice?.message?.content ?? '',
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
    cost: totalTokens * COST_PER_TOKEN,
    model: response.model ?? MODEL,
  };
}

// Embedding via OpenRouter (uses OpenAI-compatible /embeddings endpoint)
export async function openrouterEmbed(text) {
  const response = await client.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: typeof text === 'string' ? text : text.join(' '),
  });
  return response.data[0]?.embedding ?? [];
}
```

**Exports:** `openrouterBrain(messages, options)`, `openrouterEmbed(text)`

---

## src/memory/short-term.js

Redis-backed session memory. Key: `mem:short:{sessionId}:{key}`. TTL 3600.

```js
import { redis } from '../config/redis.js';

const DEFAULT_TTL = 3600;

export async function setMemory(sessionId, key, value, ttl = DEFAULT_TTL) {
  await redis.set(`mem:short:${sessionId}:${key}`, JSON.stringify(value), 'EX', ttl);
}

export async function getMemory(sessionId, key) {
  const raw = await redis.get(`mem:short:${sessionId}:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteMemory(sessionId, key) {
  await redis.del(`mem:short:${sessionId}:${key}`);
}

export async function clearSessionMemory(sessionId) {
  const keys = await redis.keys(`mem:short:${sessionId}:*`);
  if (keys.length > 0) await redis.del(keys);
}
```

**Exports:** `setMemory`, `getMemory`, `deleteMemory`, `clearSessionMemory`

---

## src/memory/long-term.js

ChromaDB-backed vector store. Collection: `kdl_long_term_memory`. Embeddings via `openrouterEmbed`.

```js
import { chroma } from '../config/chroma.js';
import { openrouterEmbed } from '../brains/openrouter.js';

const COLLECTION = 'kdl_long_term_memory';

let col = null;

async function getCollection() {
  if (!col) {
    col = await chroma.getOrCreateCollection({ name: COLLECTION });
  }
  return col;
}

export async function storeMemory(id, document, metadata = {}) {
  const c = await getCollection();
  const embedding = await openrouterEmbed(document);
  await c.upsert({
    ids: [id],
    documents: [document],
    embeddings: [embedding],
    metadatas: [{ ...metadata, stored_at: new Date().toISOString() }],
  });
}

export async function searchMemory(query, nResults = 5) {
  const c = await getCollection();
  const embedding = await openrouterEmbed(query);
  const results = await c.query({
    queryEmbeddings: [embedding],
    nResults,
  });
  return (results.documents[0] ?? []).map((doc, i) => ({
    document: doc,
    metadata: results.metadatas[0]?.[i] ?? {},
    distance: results.distances[0]?.[i] ?? null,
  }));
}

export async function deleteMemory(id) {
  const c = await getCollection();
  await c.delete({ ids: [id] });
}
```

**Exports:** `storeMemory(id, document, metadata)`, `searchMemory(query, nResults)`, `deleteMemory(id)`

---

## src/knowledge/ingest.js

Chunk documents, embed via OpenRouter, store in ChromaDB collection `kdl_knowledge`.

```js
import { chroma } from '../config/chroma.js';
import { openrouterEmbed } from '../brains/openrouter.js';
import { randomUUID } from 'crypto';

const COLLECTION = 'kdl_knowledge';
const CHUNK_SIZE = 512;   // characters
const CHUNK_OVERLAP = 64; // characters

let col = null;

async function getCollection() {
  if (!col) {
    col = await chroma.getOrCreateCollection({ name: COLLECTION });
  }
  return col;
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

export async function ingestDocument(content, metadata = {}) {
  const c = await getCollection();
  const chunks = chunkText(content);
  const ids = chunks.map(() => randomUUID());
  const embeddings = await Promise.all(chunks.map(openrouterEmbed));

  await c.upsert({
    ids,
    documents: chunks,
    embeddings,
    metadatas: chunks.map((_, i) => ({
      ...metadata,
      chunk_index: i,
      total_chunks: chunks.length,
      ingested_at: new Date().toISOString(),
    })),
  });

  return { chunks: chunks.length, ids };
}
```

**Exports:** `ingestDocument(content, metadata)`

---

## src/knowledge/retrieve.js

Embed query, similarity search ChromaDB `kdl_knowledge`, return top-k chunks.

```js
import { chroma } from '../config/chroma.js';
import { openrouterEmbed } from '../brains/openrouter.js';

const COLLECTION = 'kdl_knowledge';

let col = null;

async function getCollection() {
  if (!col) {
    col = await chroma.getOrCreateCollection({ name: COLLECTION });
  }
  return col;
}

export async function retrieveChunks(query, nResults = 5) {
  const c = await getCollection();
  const embedding = await openrouterEmbed(query);
  const results = await c.query({
    queryEmbeddings: [embedding],
    nResults,
  });
  return (results.documents[0] ?? []).map((doc, i) => ({
    content: doc,
    metadata: results.metadatas[0]?.[i] ?? {},
    distance: results.distances[0]?.[i] ?? null,
  }));
}
```

**Exports:** `retrieveChunks(query, nResults)`

---

## src/chains/rag-chain.js

Full RAG pipeline: retrieve relevant chunks → inject into prompt → call brainRouter.

```js
import { retrieveChunks } from '../knowledge/retrieve.js';
import { brainRouter } from '../orchestrator/brain-router.js';
import { addMessage, getContext } from '../orchestrator/context-manager.js';

export async function ragChain(query, sessionId, priority = 'MEDIUM', options = {}) {
  const [chunks, history] = await Promise.all([
    retrieveChunks(query, 5),
    getContext(sessionId),
  ]);

  const contextBlock = chunks.length > 0
    ? `Relevant context:\n${chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')}`
    : '';

  const systemPrompt = [
    'You are a helpful AI assistant for the KDL Starter Kit platform.',
    contextBlock,
  ].filter(Boolean).join('\n\n');

  const messages = [
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: query },
  ];

  const response = await brainRouter(messages, priority, {
    system: systemPrompt,
    sessionId,
    ...options,
  });

  if (!response.error) {
    await Promise.all([
      addMessage(sessionId, 'user', query),
      addMessage(sessionId, 'assistant', response.content),
    ]);
  }

  return response;
}
```

**Exports:** `ragChain(query, sessionId, priority, options)`

---

## src/governance/audit-logger.js

Logs all AI calls to Redis list `ai:audit:log`. Keeps last 1000 entries (LTRIM).

```js
import { redis } from '../config/redis.js';

const AUDIT_KEY = 'ai:audit:log';
const MAX_ENTRIES = 1000;

export async function auditLogger({ model, priority, input_tokens, output_tokens, cost_estimate, session_id = null }) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    model,
    priority,
    input_tokens,
    output_tokens,
    cost_estimate,
    session_id,
  });

  const pipeline = redis.multi();
  pipeline.lpush(AUDIT_KEY, entry);
  pipeline.ltrim(AUDIT_KEY, 0, MAX_ENTRIES - 1);
  await pipeline.exec();
}

export async function getAuditLog(limit = 100) {
  const entries = await redis.lrange(AUDIT_KEY, 0, limit - 1);
  return entries.map((e) => JSON.parse(e));
}
```

**Exports:** `auditLogger({ model, priority, input_tokens, output_tokens, cost_estimate, session_id })`, `getAuditLog(limit)`

---

## src/governance/compliance.js

PII scrubber. Strips emails, phone numbers, credit card patterns, and SSNs from AI inputs before they reach the model.

```js
const PII_PATTERNS = [
  { name: 'email',       re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,       replacement: '[EMAIL]' },
  { name: 'phone_us',    re: /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g,   replacement: '[PHONE]' },
  { name: 'credit_card', re: /\b(?:\d[ \-]?){13,16}\b/g,                                 replacement: '[CC]'    },
  { name: 'ssn',         re: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,                          replacement: '[SSN]'   },
];

export function scrubInput(text) {
  if (typeof text !== 'string') return text;
  let scrubbed = text;
  for (const { re, replacement } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(re, replacement);
  }
  return scrubbed;
}

export function scrubMessages(messages) {
  if (!Array.isArray(messages)) return scrubInput(messages);
  return messages.map((m) => ({ ...m, content: scrubInput(m.content) }));
}
```

**Exports:** `scrubInput(text)`, `scrubMessages(messages)`

---

## src/agents/base.js

Base agent class. Has brain (brainRouter), memory (short-term + long-term), tools array. Hard `maxIterations` cap. Custom loop — does NOT rely on LangChain AgentExecutor for iteration control.

```js
import { brainRouter } from '../orchestrator/brain-router.js';
import { getMemory, setMemory } from '../memory/short-term.js';
import { searchMemory } from '../memory/long-term.js';

const MAX_ITERATIONS = 10;

export class BaseAgent {
  constructor({ sessionId, priority = 'MEDIUM', tools = [], maxIterations = MAX_ITERATIONS }) {
    this.sessionId = sessionId;
    this.priority = priority;
    this.tools = tools;
    this.maxIterations = maxIterations;
  }

  async run(task, context = {}) {
    let iterations = 0;
    let currentTask = task;
    let result = null;

    while (iterations < this.maxIterations) {
      iterations++;

      const relevantMemory = await searchMemory(currentTask, 3);
      const memoryContext = relevantMemory.map((m) => m.document).join('\n');

      const prompt = this._buildPrompt(currentTask, memoryContext, context);
      const response = await brainRouter(prompt, this.priority, { sessionId: this.sessionId });

      if (response.error) {
        return { error: response.error, iterations };
      }

      result = response.content;

      const done = await this._isTaskComplete(result, currentTask);
      if (done) break;

      currentTask = await this._getNextStep(result, currentTask);
    }

    if (iterations >= this.maxIterations) {
      console.warn(`[BaseAgent] maxIterations (${this.maxIterations}) reached for session ${this.sessionId}`);
    }

    return { result, iterations };
  }

  _buildPrompt(task, memoryContext, _context) {
    const parts = ['You are an AI agent. Complete the task below.'];
    if (memoryContext) parts.push(`Relevant memory:\n${memoryContext}`);
    parts.push(`Task: ${task}`);
    return parts.join('\n\n');
  }

  async _isTaskComplete(result, _originalTask) {
    return result.toLowerCase().includes('done') || result.toLowerCase().includes('complete');
  }

  async _getNextStep(result, _originalTask) {
    return result;
  }
}
```

---

## src/agents/research.js

Research agent: gathers and synthesises information. Overrides `_buildPrompt` for research context. Priority: HIGH (uses Claude).

```js
import { BaseAgent } from './base.js';
import { ragChain } from '../chains/rag-chain.js';

export class ResearchAgent extends BaseAgent {
  constructor(opts) {
    super({ priority: 'HIGH', ...opts });
  }

  _buildPrompt(task, memoryContext, context) {
    const parts = [
      'You are a research agent. Gather, analyse, and synthesise accurate information.',
      memoryContext ? `Memory context:\n${memoryContext}` : null,
      context.sources ? `Available sources:\n${context.sources}` : null,
      `Research task: ${task}`,
      'Respond with: FINDINGS: <findings> | DONE',
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  async run(task, context = {}) {
    // Use RAG chain to enrich with knowledge base before agent loop
    const ragResult = await ragChain(task, this.sessionId, 'HIGH');
    if (ragResult.error) return { error: ragResult.error, iterations: 0 };
    const enrichedContext = { ...context, ragContext: ragResult.content };
    return super.run(task, enrichedContext);
  }
}
```

---

## src/agents/content.js

Content generation agent. Overrides `_buildPrompt` for writing tasks. Priority: MEDIUM (uses OpenRouter).

```js
import { BaseAgent } from './base.js';

export class ContentAgent extends BaseAgent {
  constructor(opts) {
    super({ priority: 'MEDIUM', ...opts });
  }

  _buildPrompt(task, memoryContext, context) {
    const parts = [
      'You are a content generation agent. Produce high-quality written content.',
      memoryContext ? `Context:\n${memoryContext}` : null,
      context.tone ? `Tone: ${context.tone}` : null,
      context.format ? `Format: ${context.format}` : null,
      `Content task: ${task}`,
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  async _isTaskComplete(result) {
    return result.length > 100;
  }
}
```

---

## src/agents/task.js

Task execution agent. Follows explicit steps. Priority: configurable (defaults LOW for CRUD-style tasks).

```js
import { BaseAgent } from './base.js';

export class TaskAgent extends BaseAgent {
  constructor(opts) {
    super({ priority: 'LOW', ...opts });
  }

  _buildPrompt(task, memoryContext, context) {
    const parts = [
      'You are a task execution agent. Follow instructions precisely.',
      memoryContext ? `Context:\n${memoryContext}` : null,
      context.steps ? `Steps:\n${context.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : null,
      `Task: ${task}`,
      'Respond with COMPLETE when done.',
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  async _isTaskComplete(result) {
    return /complete/i.test(result);
  }
}
```

---

## src/tools/rag.js

LangChain DynamicTool wrapping ragChain.

```js
import { DynamicTool } from '@langchain/core/tools';
import { ragChain } from '../chains/rag-chain.js';

export function createRagTool(sessionId, priority = 'MEDIUM') {
  return new DynamicTool({
    name: 'rag_search',
    description: 'Search the knowledge base for relevant information. Input: query string.',
    func: async (query) => {
      const result = await ragChain(query, sessionId, priority);
      return result.error ? `Error: ${result.error}` : result.content;
    },
  });
}
```

---

## src/tools/search.js

LangChain DynamicTool wrapping MeiliSearch. Uses `MEILISEARCH_HOST` and `MEILI_MASTER_KEY` from env.

```js
import { DynamicTool } from '@langchain/core/tools';

const MEILI_HOST = process.env.MEILISEARCH_HOST ?? 'http://localhost:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY ?? '';

export function createSearchTool(index = 'all') {
  return new DynamicTool({
    name: 'meilisearch',
    description: 'Full-text search across indexed content. Input: search query string.',
    func: async (query) => {
      const url = `${MEILI_HOST}/indexes/${index}/search`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MEILI_KEY}`,
        },
        body: JSON.stringify({ q: query, limit: 5 }),
      });
      if (!res.ok) return `Search failed: ${res.status}`;
      const data = await res.json();
      const hits = data.hits ?? [];
      if (hits.length === 0) return 'No results found.';
      return hits.map((h, i) => `[${i + 1}] ${JSON.stringify(h)}`).join('\n');
    },
  });
}
```

---

## src/tools/memory.js

LangChain DynamicTool wrapping long-term memory search.

```js
import { DynamicTool } from '@langchain/core/tools';
import { searchMemory } from '../memory/long-term.js';

export function createMemoryTool() {
  return new DynamicTool({
    name: 'long_term_memory',
    description: 'Search long-term vector memory for stored knowledge. Input: query string.',
    func: async (query) => {
      const results = await searchMemory(query, 3);
      if (results.length === 0) return 'No relevant memories found.';
      return results.map((r, i) => `[${i + 1}] ${r.document}`).join('\n');
    },
  });
}
```

---

## src/workflows/base.js

Base workflow class. Hard `maxIterations` cap. `steps` is an array of `{ name, fn }`. Writes to BLOCKERS.md on cap hit.

```js
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const BLOCKERS_PATH = join(process.cwd(), '..', 'BLOCKERS.md');

export class BaseWorkflow {
  constructor({ name, steps = [], maxIterations = 20 }) {
    this.name = name;
    this.steps = steps;
    this.maxIterations = maxIterations;
  }

  async run(input) {
    let iterations = 0;
    let state = { input, results: [], currentStep: 0 };

    while (state.currentStep < this.steps.length && iterations < this.maxIterations) {
      iterations++;
      const step = this.steps[state.currentStep];

      try {
        const stepResult = await step.fn(state);
        state.results.push({ step: step.name, output: stepResult, iteration: iterations });
        state.currentStep = await this._nextStep(state, stepResult);
      } catch (err) {
        state.results.push({ step: step.name, error: err.message, iteration: iterations });
        break;
      }
    }

    if (iterations >= this.maxIterations) {
      await this._writeBlockers(`Workflow "${this.name}" hit maxIterations (${this.maxIterations}). State: ${JSON.stringify(state.results.slice(-3))}`);
    }

    return { state, iterations, completed: iterations < this.maxIterations };
  }

  async _nextStep(state, _result) {
    return state.currentStep + 1;
  }

  async _writeBlockers(message) {
    try {
      let existing = '';
      try { existing = await readFile(BLOCKERS_PATH, 'utf8'); } catch { /* file may not exist */ }
      const entry = `\n## ${new Date().toISOString()} — ${this.name}\n${message}\n`;
      await writeFile(BLOCKERS_PATH, existing + entry, 'utf8');
    } catch { /* non-fatal */ }
  }
}
```

---

## src/workflows/deterministic.js

Fixed step sequence. Steps run in declaration order regardless of output. Extends BaseWorkflow.

```js
import { BaseWorkflow } from './base.js';

export class DeterministicWorkflow extends BaseWorkflow {
  constructor(opts) {
    super(opts);
  }

  async _nextStep(state, _result) {
    return state.currentStep + 1;
  }
}
```

**Usage:**
```js
const wf = new DeterministicWorkflow({
  name: 'content-pipeline',
  maxIterations: 5,
  steps: [
    { name: 'fetch', fn: async (state) => fetchData(state.input) },
    { name: 'process', fn: async (state) => process(state.results.at(-1).output) },
    { name: 'publish', fn: async (state) => publish(state.results.at(-1).output) },
  ],
});
```

---

## src/workflows/non-deterministic.js

Agent-driven step selection. After each step, the agent decides the next step index or `'done'`. Extends BaseWorkflow.

```js
import { BaseWorkflow } from './base.js';
import { brainRouter } from '../orchestrator/brain-router.js';

export class NonDeterministicWorkflow extends BaseWorkflow {
  constructor(opts) {
    super({ priority: 'HIGH', ...opts });
    this.priority = opts.priority ?? 'HIGH';
    this.sessionId = opts.sessionId ?? 'workflow-default';
  }

  async _nextStep(state, lastResult) {
    const stepNames = this.steps.map((s, i) => `${i}: ${s.name}`).join(', ');
    const prompt = [
      `You are directing a workflow. Current step: ${state.currentStep} (${this.steps[state.currentStep]?.name}).`,
      `Result: ${String(lastResult).slice(0, 500)}`,
      `Available steps: ${stepNames}`,
      `Completed: ${state.results.map((r) => r.step).join(', ')}`,
      `Reply with ONLY a step index number, or "done" to finish.`,
    ].join('\n');

    const response = await brainRouter(prompt, this.priority, { sessionId: this.sessionId });
    const text = response.content?.trim() ?? '';

    if (text.toLowerCase() === 'done') return this.steps.length; // exits loop
    const idx = parseInt(text, 10);
    return isNaN(idx) || idx < 0 || idx >= this.steps.length
      ? state.currentStep + 1
      : idx;
  }
}
```

---

## src/controllers/chat.js

POST /api/ai/chat handler. Validates input with Zod. Calls ragChain. Handles BUDGET_EXHAUSTED by writing to MANUAL_TASKS.md.

```js
import { z } from 'zod';
import { ragChain } from '../chains/rag-chain.js';
import { scrubMessages } from '../governance/compliance.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { appendFile } from 'fs/promises';
import { join } from 'path';

const MANUAL_TASKS_PATH = join(process.cwd(), '..', 'MANUAL_TASKS.md');

const chatSchema = z.object({
  message: z.string().min(1).max(32768),
  sessionId: z.string().min(1).max(128),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
});

export async function chatController(req, res) {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    const { message, sessionId, priority } = parsed.data;
    const scrubbed = scrubMessages(message);

    const response = await ragChain(scrubbed, sessionId, priority);

    if (response.error === 'BUDGET_EXHAUSTED') {
      const line = `\n- [${new Date().toISOString()}] Chat task deferred (budget exhausted). Session: ${sessionId}. Message: ${message.slice(0, 100)}\n`;
      await appendFile(MANUAL_TASKS_PATH, line).catch(() => {});
      return errorResponse(res, 'AI budget exhausted for today. Task logged to MANUAL_TASKS.md.', 503);
    }

    return successResponse(res, { response: response.content, sessionId });
  } catch (err) {
    return errorResponse(res, err.message ?? 'Chat failed', 500);
  }
}
```

---

## src/controllers/embed.js

POST /api/ai/embed handler. Validates input with Zod. Returns embedding vector via OpenRouter.

```js
import { z } from 'zod';
import { openrouterEmbed } from '../brains/openrouter.js';
import { successResponse, errorResponse } from '../utils/response.js';

const embedSchema = z.object({
  text: z.string().min(1).max(8192),
});

export async function embedController(req, res) {
  try {
    const parsed = embedSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    const embedding = await openrouterEmbed(parsed.data.text);
    return successResponse(res, { embedding, dimensions: embedding.length });
  } catch (err) {
    return errorResponse(res, err.message ?? 'Embed failed', 500);
  }
}
```

---

## src/controllers/transcribe.js

POST /api/ai/transcribe — stub, returns 501 Not Implemented. Planned for Whisper integration.

```js
import { errorResponse } from '../utils/response.js';

export function transcribeController(_req, res) {
  return errorResponse(res, 'Transcription not yet implemented. Planned: Whisper API integration.', 501);
}
```

---

## Dependency Graph

```
index.js
├── middleware/auth.js          → jsonwebtoken
├── controllers/chat.js         → chains/rag-chain.js → governance/compliance.js
│                                                      → orchestrator/brain-router.js → brains/claude.js
│                                                                                     → brains/openrouter.js
│                                                                                     → orchestrator/budget-tracker.js → config/redis.js
│                                                                                     → governance/audit-logger.js → config/redis.js
│                                                      → orchestrator/context-manager.js → config/redis.js
│                                                      → knowledge/retrieve.js → config/chroma.js
│                                                                              → brains/openrouter.js (embed)
├── controllers/embed.js        → brains/openrouter.js (embed)
└── controllers/transcribe.js   (stub)
```

---

## Redis Key Namespace

| Key Pattern | Purpose | TTL |
|---|---|---|
| `context:{sessionId}` | Conversation history | 3600s |
| `mem:short:{sessionId}:{key}` | Session memory | 3600s |
| `budget:openrouter:YYYY-MM-DD` | Daily spend tracker | 86400s |
| `ai:audit:log` | Audit log list (LPUSH/LTRIM) | None (max 1000 entries) |

---

## ChromaDB Collections

| Collection | Purpose | Embedding source |
|---|---|---|
| `kdl_knowledge` | Knowledge base chunks (ingest/retrieve) | OpenRouter |
| `kdl_long_term_memory` | Agent long-term memory | OpenRouter |

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PORT` | No | `5000` | Express port |
| `NODE_ENV` | No | `development` | Runtime environment |
| `ANTHROPIC_API_KEY` | Yes (for Claude brain) | — | Anthropic API key |
| `OPENROUTER_API_KEY` | Yes (for budget brain) | — | OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `OPENROUTER_DEFAULT_MODEL` | No | `moonshot-ai/moonshot-v1-32k` | Budget brain model |
| `OPENROUTER_DAILY_BUDGET` | No | `2.00` | Daily spend cap (USD) |
| `REDIS_URL` | No | `redis://localhost:6380` | Redis connection URL |
| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB URL |
| `JWT_SECRET` | Yes | — | Same JWT_SECRET as backend |
| `BACKEND_URL` | No | `http://localhost:4000` | For OpenRouter HTTP-Referer |
| `MEILISEARCH_HOST` | No | `http://localhost:7700` | MeiliSearch URL |
| `MEILI_MASTER_KEY` | No | — | MeiliSearch API key |

---

## Standards Checklist (Non-Negotiable)

- [x] ES Modules (`import/export`) — no CommonJS anywhere
- [x] Every async function wrapped in try/catch
- [x] Zod validation in all controllers
- [x] `successResponse` / `errorResponse` in all handlers (copied from backend, not imported)
- [x] `maxIterations` hard cap in BaseAgent (10) and BaseWorkflow (20)
- [x] On maxIterations hit → write to BLOCKERS.md (BaseWorkflow)
- [x] Budget exhausted → write to MANUAL_TASKS.md (chat controller)
- [x] PII scrubbing via compliance.js before any model call (chat controller)
- [x] All AI calls logged to audit (audit-logger via brain-router)
- [x] Node.js 20+ required (`"engines": { "node": ">=20" }`)
- [x] No hardcoded secrets — all config from env
- [x] 404 catch-all before error handler in index.js
- [x] Health check at GET /health returns `successResponse`

---

## Implementation Order for Builder Agent

1. `src/utils/response.js` — no deps
2. `src/config/redis.js` — no deps
3. `src/config/chroma.js` — no deps
4. `src/middleware/auth.js` — deps: utils/response.js
5. `src/governance/audit-logger.js` — deps: config/redis.js
6. `src/governance/compliance.js` — no deps
7. `src/orchestrator/budget-tracker.js` — deps: config/redis.js
8. `src/orchestrator/context-manager.js` — deps: config/redis.js
9. `src/brains/claude.js` — deps: @anthropic-ai/sdk
10. `src/brains/openrouter.js` — deps: openai
11. `src/orchestrator/brain-router.js` — deps: brains, budget-tracker, audit-logger
12. `src/memory/short-term.js` — deps: config/redis.js
13. `src/memory/long-term.js` — deps: config/chroma.js, brains/openrouter.js
14. `src/knowledge/ingest.js` — deps: config/chroma.js, brains/openrouter.js
15. `src/knowledge/retrieve.js` — deps: config/chroma.js, brains/openrouter.js
16. `src/chains/rag-chain.js` — deps: knowledge, orchestrator
17. `src/tools/rag.js` — deps: chains/rag-chain.js
18. `src/tools/search.js` — no deps beyond fetch
19. `src/tools/memory.js` — deps: memory/long-term.js
20. `src/agents/base.js` — deps: orchestrator, memory
21. `src/agents/research.js` — deps: agents/base.js, chains/rag-chain.js
22. `src/agents/content.js` — deps: agents/base.js
23. `src/agents/task.js` — deps: agents/base.js
24. `src/workflows/base.js` — no deps
25. `src/workflows/deterministic.js` — deps: workflows/base.js
26. `src/workflows/non-deterministic.js` — deps: workflows/base.js, orchestrator/brain-router.js
27. `src/controllers/chat.js` — deps: chains, governance
28. `src/controllers/embed.js` — deps: brains/openrouter.js
29. `src/controllers/transcribe.js` — deps: utils/response.js
30. `src/index.js` — wires everything
31. `package.json` — all deps listed above
32. `.env.example` — all vars listed above

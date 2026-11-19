# 🎭 Mythicalore — Universal Character Card Roleplay Engine

A high-performance, universal, and card-driven roleplay engine built with **React (Vite), TypeScript, Tailwind CSS, Dexie (IndexedDB), and Node.js + Express**.

Unlike conventional simulators, Aetheria is **universal** and **specification-compliant**: import character cards in either `.png` (with embedded `tEXt`/`zTXt` chunks) or `.json` (SillyTavern / Character Card V2 & V3 specification), switch protagonist personas with 1-click, and roleplay across any genre (Cyberpunk, Grimdark Fantasy, Sci-Fi, Modern Noir, Horror, etc.).

---

## 🌟 Key Capabilities

### 1. Universal Character Card Engine & PNG Chunk Parser
- **Binary PNG Chunk Decoding**: Uses `png-chunks-extract`, `png-chunks-encode`, and `pako` for `zTXt` zlib decompression. Automatically extracts embedded `chara` and `ccv3` base64 UTF-8 JSON payloads and avatar blobs directly in the browser.
- **Embedded Lorebook Extraction**: Automatically extracts `character_book.entries` into Tier 3 keyword-triggered codices.
- **Dynamic Macro Substitution**: Resolves `{{char}}`, `{{user}}`, `{{persona}}`, `{{scenario}}`, `<BOT>`, `<USER>` across identity, scenario, first message, examples, and system instructions.
- **In-App Card Vault & Editor**: Search, filter by genre or favorites, drag-and-drop import, live macro substitution preview, and re-export back to `.json` or `.png` with re-encoded embedded metadata chunks.

### 2. Protagonist Persona System (User Cards)
- Dedicated User Persona library (Name, Avatar, Gender, Physique/Apparel, Psychological Traits, Background Lore, Lorebook/Moveset).
- Instant 1-click persona switcher across chat sessions.

### 3. Multi-Tier Memory Engine & Context Optimization
- **Tier 1: Sliding Window (Active Context)**: Only the latest $N$ user turns (default 10, customizable) are dispatched directly to the LLM. UI windowing hides older turns by default with a `+ Show Older Turns (X hidden)` expander button to eliminate mobile DOM lag.
- **Tier 2: Asynchronous Rolling Summary**: Dedicated background summarizer model digests pruned history every 10 turns and updates a cohesive `rollingSummary` permanently injected into context.
- **Tier 3: Pinned Memories & Keyword-Triggered Lorebook**: Pin facts, relationship breakthroughs, or plot events indefinitely. Lorebook entries are scanned against active scenes and injected within a token budget.

### 4. Dedicated Dual-Model Pipeline & BYOK
- **Primary Roleplay Model (BYOK)**: Connect OpenRouter, OpenAI, Anthropic (Claude), Google Gemini, Groq, Mistral, and local OpenAI-compatible endpoints (`llama.cpp` / `llama-server`, Ollama, LM Studio, vLLM via custom base URL).
- **Dedicated Background Summarizer Model**: Completely isolated credential and model configuration (e.g. ultra-fast Groq Llama 3.3 70B, Gemini Flash, or GPT-4o-mini) to digest history without consuming primary model tokens or interrupting ongoing chat generation.
- **Named Summarizer Profiles**: Save, edit, switch, and ping-test named summarizer profiles.

### 5. Advanced Samplers & Provider Parameter Sanitization
- Interactive sliders for: `temperature`, `top_p`, `min_p`, `top_k`, `frequency_penalty`, `presence_penalty`, `repetition_penalty`, `max_tokens`, and `min_tokens` (with system directive enforcement).
- **Capability Whitelist**: Backend proxy automatically strips unsupported parameters (e.g., strips `min_p`, `top_k`, `repetition_penalty` for OpenAI; maps Anthropic top-level `system` and `x-api-key`; passes full samplers to OpenRouter and local llama-server).

### 6. Interactive Chat & Diagnostics
- **Message Cards**: Distinct avatar badges (`YOU` vs `NPC`), formatted narration (`*actions*`), highlighted dialogue bubbles (`"speech"`), inline editing, and 1-click text copying.
- **Multi-Swipe Generation**: Swipe left/right (`< 2/3 >`) to navigate alternate rollouts, or generate new swipes on the fly.
- **Input Capsule**: Auto-growing textarea, `(OOC: ...)` director steering button, cumulative chronicle token pill, and draft token counter.
- **Turn Prompt Inspector Modal (`👁️ Inspect`)**: View the exact assembled system prompt with macros resolved, active sliding window, triggered lorebook entries, token breakdown, and 1-click "Copy Full Dispatched Payload".
- **Client-Side Persistence & Portability**: All data persisted in IndexedDB via Dexie to avoid localStorage 5MB limits. 1-click workspace export/import as JSON.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v22)
- npm 9+

### Installation & Launch
```bash
# Install dependencies
npm install

# Start both backend proxy (port 3001) and Vite client (port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser.

### Building for Production
```bash
# Builds both Vite client and TypeScript backend
npm run build

# Start production server
npm start
```

### Running Test Suite
```bash
npm test
```

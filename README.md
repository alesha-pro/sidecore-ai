

# Sidecore AI

**AI assistant that lives in Chrome's Side Panel.**  
Summarize pages. Ask questions across tabs. Use any LLM provider.

[Install](#installation)  •  [Features](#features)  •  [How it works](#how-it-works)  •  [Development](#development)  •  [Privacy](#privacy)

  




---

## Why Sidecore AI?

You have 12 tabs open. You need a quick summary. Or you want to ask a question that spans multiple articles.

**Without Sidecore AI:** copy text from each tab, paste into ChatGPT, lose formatting, hit token limits, repeat.

**With Sidecore AI:** click the icon, type `@` to select tabs, ask your question. Done.

---

## Features

- **Side Panel chat** &mdash; always visible alongside your browsing, no tab switching
- **Multi-tab context** &mdash; select multiple tabs with `@` mentions and query across all of them
- **Smart extraction** &mdash; converts pages to clean markdown via [Readability](https://github.com/mozilla/readability), with optimized extractors for Reddit and X/Twitter
- **Bring your own AI** &mdash; works with any OpenAI-compatible API:
  - OpenAI, Anthropic (via proxy), Google Gemini
  - Ollama, LM Studio, OpenRouter, Together AI
  - Any custom endpoint
- **Context menu** &mdash; right-click any page for "Summarize" or "Ask about this page"
- **Budget-aware** &mdash; intelligently manages token budgets across multiple tabs
- **Privacy-first** &mdash; zero telemetry, zero tracking. Everything stays local

---

## How it works

```
1. Click extension icon  ──>  Side Panel opens
2. Go to Settings        ──>  Enter your API key & endpoint
3. Type @ in chat        ──>  Pick tabs as context
4. Ask your question     ──>  Get an answer
```

Content is extracted on-demand from tabs you explicitly select. Requests go directly to your configured provider &mdash; Sidecore AI never sees your data.

---

## Installation

### Chrome Web Store

> https://chromewebstore.google.com/detail/sidecore-ai/eknmcilipdfdpobhbfcpnfbgepdfodjk

### From source (developer mode)

**Prerequisites:** Node.js 18+, npm

```bash
# Clone the repo
git clone https://github.com/alesha-pro/sidecore-ai.git
cd sidecore-ai

# Install dependencies
npm install

# Build for production
npm run build
```

Then load in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3/` folder
5. Click the Sidecore AI icon in the toolbar to open the Side Panel

---

## Development

```bash
npm run dev      # Dev server with hot reload (auto-opens Chrome)
npm run build    # Production build  ──>  .output/chrome-mv3/
npm run zip      # Create distributable .zip
```

`npm run dev` launches Chrome with the extension pre-loaded. Edit files and see changes instantly.

### Tech stack


| Layer      | Technology                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Framework  | [WXT](https://wxt.dev) (Manifest V3)                                                                       |
| UI         | [Preact](https://preactjs.com) + TypeScript                                                                |
| Styling    | Tailwind CSS v3                                                                                            |
| Extraction | [Readability](https://github.com/mozilla/readability) + [Turndown](https://github.com/mixmark-io/turndown) |
| Build      | Vite                                                                                                       |


### Architecture

```
src/
├── entrypoints/
│   ├── sidepanel/                    # Main UI (Preact app)
│   ├── background.ts                # Service worker
│   └── article-extractor.content.ts # On-demand content extractor
├── components/                      # UI components
├── lib/
│   ├── llm/                         # OpenAI-compatible client
│   ├── storage.ts                   # Chrome storage wrapper
│   └── types.ts                     # Shared types
└── background/
    └── extraction/                  # Tab extraction + budgeting
```

**Data flow:**

1. User selects tabs via `@` mention picker
2. Side panel sends `extract-tabs` message to background service worker
3. Background injects content extractor into selected tabs
4. Extractor converts HTML to Markdown (Readability + Turndown)
5. Background applies context budget, returns extracted content
6. Side panel builds prompt with context, calls LLM API
7. Streaming response rendered in chat

---

## Supported providers

Any service with an OpenAI-compatible `/v1/chat/completions` endpoint:


| Provider          | Base URL                       |
| ----------------- | ------------------------------ |
| OpenAI            | `https://api.openai.com/v1`    |
| OpenRouter        | `https://openrouter.ai/api/v1` |
| Together AI       | `https://api.together.xyz/v1`  |
| Ollama (local)    | `http://localhost:11434/v1`    |
| LM Studio (local) | `http://localhost:1234/v1`     |
| Any compatible    | Your endpoint URL              |


---

## Privacy

- **No telemetry.** No analytics. No tracking pixels. No data collection.
- **No backend.** Sidecore AI has no server. There is nothing to phone home to.
- **Local storage only.** Settings and chat history live in `chrome.storage.local` on your device.
- **You control the data flow.** Content is sent only to the AI provider you configure.
- **Minimal permissions.** Host access is optional and requested at runtime only when needed.

---

## Permissions


| Permission                | Why                                                                |
| ------------------------- | ------------------------------------------------------------------ |
| `sidePanel`               | Display the chat UI                                                |
| `storage`                 | Save settings & chat history locally                               |
| `tabs`                    | List tabs for context selection                                    |
| `activeTab`               | Extract from current tab on user action                            |
| `scripting`               | Inject content extractor on demand                                 |
| `contextMenus`            | Right-click quick actions                                          |
| `<all_urls>` *(optional)* | Multi-tab extraction & custom API endpoints (requested at runtime) |


---

## License

[ISC](LICENSE)

---

Built with Preact, WXT, and too many open tabs.
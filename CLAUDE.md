# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sidepanel AI Agent** — Chrome Extension (Manifest V3) с AI-ассистентом в Chrome Side Panel. Извлекает контент из выбранных вкладок, конвертирует в Markdown, отправляет в OpenAI-compatible LLM endpoint.

**Core Value:** Быстрое summary/Q&A по контенту нескольких вкладок без копипасты.

**Status:** v1 complete. All core functionality working.

## Commands

```bash
npm run dev      # Start dev server with hot reload, opens Chrome with extension
npm run build    # Production build to .output/chrome-mv3/
npm run zip      # Create distributable zip
```

After `npm run dev`, the extension loads automatically. Click extension icon to open side panel.

## Architecture

### Tech Stack
- **WXT** — Extension framework (handles manifest, entrypoints, HMR)
- **Preact** — UI (lighter than React, same API)
- **Tailwind CSS v3** — Styling (PostCSS compatible with WXT/Vite)
- **TypeScript** — Type safety throughout
- **Readability + Turndown** — Content extraction (HTML → Markdown)

### Directory Structure

```
src/
├── entrypoints/
│   ├── sidepanel/          # Main UI (App.tsx, main.tsx)
│   ├── background.ts       # Service worker, handles extraction requests
│   └── article-extractor.content.ts  # Injected on-demand, not auto-loaded
├── components/             # Preact components (ChatInput, TabPicker, etc.)
├── hooks/                  # Custom hooks (useTabs)
├── lib/
│   ├── llm/               # OpenAI-compatible client (types, errors, fetch)
│   ├── storage.ts         # Chrome storage wrapper
│   ├── tabs.ts            # Tab querying utilities
│   └── types.ts           # Shared types
├── shared/
│   └── extraction.ts      # Extraction types shared between background/UI
└── background/
    └── extraction/        # Tab extraction orchestration
```

### Data Flow

1. **User selects tabs** via TabPicker (`@` trigger or button)
2. **User sends message** → App.tsx captures selection
3. **Sidepanel → Background** via `chrome.runtime.sendMessage({ type: 'extract-tabs' })`
4. **Background** injects `article-extractor.content.ts` via `chrome.scripting.executeScript`
5. **Extractor** runs Readability → Turndown → returns Markdown
6. **Background** applies budget, returns `ExtractedTabContent[]`
7. **Sidepanel** builds system message with extracted content, calls LLM
8. **Response** displayed in chat

### Key Files

| File | Purpose |
|------|---------|
| `wxt.config.ts` | Manifest config (permissions, side_panel) |
| `src/entrypoints/background.ts` | Service worker, message routing |
| `src/entrypoints/sidepanel/App.tsx` | Main app state, send flow |
| `src/background/extraction/extractTabs.ts` | Extraction orchestration + budgeting |
| `src/entrypoints/article-extractor.content.ts` | Injected extractor (Readability+Turndown) |
| `src/lib/llm/client.ts` | OpenAI-compatible API calls |

### MV3 Constraints

- **Service worker is event-driven** — no persistent state, use chrome.storage
- **Strict CSP** — no eval, no remote code, no inline scripts
- **On-demand injection** — content scripts via `executeScript`, not persistent `content_scripts`

### Extraction Pattern

The article-extractor uses WXT's content script with a never-matching pattern (`matches: ['https://never-match-this-domain-wxt-dev-mode.invalid/*']`) to prevent auto-injection while satisfying WXT's build requirement. It's manually injected via:

```typescript
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['content-scripts/article-extractor.js'],
});
```

### Budget Enforcement

Context budget (default 50,000 chars) is applied deterministically:
1. Active tab first
2. Other tabs sorted by index ascending
3. Truncate when budget exceeded, set `truncated: true`

## Debugging

- **Background script:** `chrome://extensions` → Details → Inspect views: service worker
- **Content scripts:** Page DevTools (F12) → Console (look for `[article-extractor]` logs)
- **Sidepanel:** Right-click on sidepanel → Inspect

## Planning (GSD)

Project uses GSD workflow. Planning artifacts in `.planning/`:

```
.planning/
├── PROJECT.md      # Core value, constraints, decisions
├── REQUIREMENTS.md # Requirement traceability
├── ROADMAP.md      # Phases and progress
├── STATE.md        # Current position, accumulated context
└── phases/         # Per-phase plans, summaries, verification
```

**GSD Commands:**
- `/gsd:progress` — show current state
- `/gsd:quick <task>` — quick task with atomic commits
- `/gsd:new-milestone` — start v2 planning
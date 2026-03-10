# Privacy Policy — Sidecore AI

**Last updated:** March 10, 2026

## Overview

Sidecore AI is a Chrome extension that helps users interact with web page content through AI-powered chat. This privacy policy describes how the extension handles user data.

## Data Collection

**Sidecore AI does not collect, store, or transmit any user data to the extension developer.** There are no analytics, tracking, telemetry, or advertising services embedded in this extension.

## Data Stored Locally

The following data is stored locally on your device using Chrome's built-in `chrome.storage.local` API:

- **Settings:** LLM provider URL, API key, selected model, UI preferences
- **Chat history:** Conversation messages between you and the AI assistant

This data never leaves your device except as described below. It can be cleared at any time by removing the extension.

## Data Sent to Third Parties

When you send a message, the extension transmits the following to the **LLM API provider you configure** (e.g., OpenAI, OpenRouter, or any OpenAI-compatible endpoint):

- Your chat message
- Extracted text content from browser tabs you explicitly select
- Your API key (for authentication with your chosen provider)

**You control which provider receives your data** by configuring the API endpoint in the extension settings. The extension developer has no access to this data.

No data is sent anywhere until you explicitly configure an API provider and send a message.

## Permissions

The extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Display the chat interface in Chrome's side panel |
| `storage` | Save settings and chat history locally |
| `tabs` | Read tab titles and URLs for the tab picker |
| `activeTab` | Access content of the current tab when you interact with the extension |
| `scripting` | Inject the content extractor to read page text |
| `contextMenus` | Add right-click menu actions ("Summarize page", "Ask about page") |
| `<all_urls>` (optional) | Extract content from multiple tabs (requested at runtime only when needed) |

## Children's Privacy

Sidecore AI is not directed at children under 13 and does not knowingly collect data from children.

## Changes

This privacy policy may be updated from time to time. Changes will be reflected in this document with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/alesha-pro/sidecore-ai/issues

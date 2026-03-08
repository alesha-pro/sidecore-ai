import type { Chat, ChatSummary, Message } from './types';

const CHATS_KEY = 'chats';
const MAX_TOOL_OUTPUT_CHARS = 8_000;
const MAX_CONTEXT_SOURCES = 4;
const MAX_CONTEXT_CHARS_PER_SOURCE = 1_500;
const MAX_CONTEXT_TOTAL_CHARS = 6_000;
const CONTEXT_SOURCE_PATTERN = /\[(\d+)\]\s([^\n]+)\nSource:\s([^\n]+)\n\n([\s\S]*?)(?=\n\n\[\d+\]\s|\s*$)/g;

function truncateWithNotice(content: string, maxChars: number, notice: string): string {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}\n\n${notice}`;
}

function compactStoredContextMessage(message: Message): Message {
  let remainingChars = MAX_CONTEXT_TOTAL_CHARS;
  const sourceBlocks = Array.from(message.content.matchAll(CONTEXT_SOURCE_PATTERN));

  if (sourceBlocks.length === 0) {
    return {
      ...message,
      content: truncateWithNotice(
        message.content,
        MAX_CONTEXT_TOTAL_CHARS,
        '[Saved context compressed for storage. Re-extract the source if you need the full text.]'
      ),
    };
  }

  const compactedSections: string[] = [];
  for (const match of sourceBlocks.slice(0, MAX_CONTEXT_SOURCES)) {
    if (remainingChars <= 0) {
      break;
    }

    const [, id, title, url, body] = match;
    const maxBodyChars = Math.min(MAX_CONTEXT_CHARS_PER_SOURCE, remainingChars);
    const trimmedBody = body.trim();
    const excerpt = trimmedBody.length > maxBodyChars
      ? `${trimmedBody.slice(0, maxBodyChars)}\n\n[Excerpt truncated in saved chat]`
      : trimmedBody;

    compactedSections.push(`[${id}] ${title}\nSource: ${url}\n\n${excerpt}`);
    remainingChars -= excerpt.length;
  }

  return {
    ...message,
    content: 'Saved context snapshot from previous turn. This copy is compressed to reduce storage usage.\n\n'
      + compactedSections.join('\n\n'),
  };
}

function compactMessageForStorage(message: Message): Message {
  if (message.contentMessageId) {
    return compactStoredContextMessage(message);
  }

  if (message.role === 'tool') {
    return {
      ...message,
      content: truncateWithNotice(
        message.content,
        MAX_TOOL_OUTPUT_CHARS,
        '[Tool output truncated in saved chat. Re-run the tool to recover the full result.]'
      ),
    };
  }

  return message;
}

function compactChatForStorage(chat: Chat): Chat {
  return {
    ...chat,
    messages: chat.messages.map(compactMessageForStorage),
  };
}

/**
 * List all chats with summary information.
 * Returns summaries sorted by updatedAt (most recent first).
 */
export async function listChats(): Promise<ChatSummary[]> {
  try {
    const result = await chrome.storage.local.get([CHATS_KEY]);
    const chats: Record<string, Chat> = result[CHATS_KEY] || {};

    const summaries: ChatSummary[] = Object.values(chats).map((chat) => ({
      id: chat.id,
      title: chat.title,
      messageCount: chat.messages.length,
      updatedAt: chat.updatedAt,
    }));

    // Sort by updatedAt descending (most recent first)
    summaries.sort((a, b) => b.updatedAt - a.updatedAt);

    return summaries;
  } catch (error) {
    console.error('Failed to list chats:', error);
    return [];
  }
}

/**
 * Load a single chat by ID.
 * Returns null if chat doesn't exist.
 */
export async function loadChat(id: string): Promise<Chat | null> {
  try {
    const result = await chrome.storage.local.get([CHATS_KEY]);
    const chats: Record<string, Chat> = result[CHATS_KEY] || {};
    return chats[id] || null;
  } catch (error) {
    console.error('Failed to load chat:', error);
    return null;
  }
}

/**
 * Save (upsert) a chat.
 * Creates new if doesn't exist, updates if exists.
 */
export async function saveChat(chat: Chat): Promise<void> {
  try {
    const result = await chrome.storage.local.get([CHATS_KEY]);
    const chats: Record<string, Chat> = result[CHATS_KEY] || {};
    const compactedChats = Object.fromEntries(
      Object.entries(chats).map(([id, existingChat]) => [id, compactChatForStorage(existingChat)])
    );

    compactedChats[chat.id] = compactChatForStorage(chat);

    await chrome.storage.local.set({ [CHATS_KEY]: compactedChats });
  } catch (error) {
    console.error('Failed to save chat:', error);
    throw new Error('Failed to save chat');
  }
}

/**
 * Delete a chat by ID.
 */
export async function deleteChat(id: string): Promise<void> {
  try {
    const result = await chrome.storage.local.get([CHATS_KEY]);
    const chats: Record<string, Chat> = result[CHATS_KEY] || {};

    delete chats[id];

    await chrome.storage.local.set({ [CHATS_KEY]: chats });
  } catch (error) {
    console.error('Failed to delete chat:', error);
    throw new Error('Failed to delete chat');
  }
}

/**
 * Delete all chats.
 */
export async function clearAllChats(): Promise<void> {
  try {
    await chrome.storage.local.set({ [CHATS_KEY]: {} });
  } catch (error) {
    console.error('Failed to clear chats:', error);
    throw new Error('Failed to clear chats');
  }
}

/**
 * Create a new empty chat with UUID id.
 */
export async function createChat(): Promise<Chat> {
  const now = Date.now();
  const chat: Chat = {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  return chat;
}

/**
 * Storage statistics for monitoring usage.
 */
export interface StorageStats {
  totalChats: number;
  totalMessages: number;
  estimatedBytes: number;
  quotaBytes: number;          // chrome.storage.local.QUOTA_BYTES (5MB default)
  usagePercent: number;
}

/**
 * Get storage statistics.
 * Provides insight into chrome.storage.local usage.
 *
 * Default quota: 5MB (chrome.storage.local.QUOTA_BYTES = 5242880)
 * Estimated capacity: ~500-1000 chats with average 20 messages each
 * Average message size: ~500 bytes (including thinking blocks)
 *
 * Recommendation: Consider unlimitedStorage permission if heavy usage expected.
 */
export async function getStorageStats(): Promise<StorageStats> {
  try {
    const result = await chrome.storage.local.get([CHATS_KEY]);
    const chats: Record<string, Chat> = result[CHATS_KEY] || {};
    const json = JSON.stringify(chats);
    const estimatedBytes = new Blob([json]).size;

    const totalMessages = Object.values(chats).reduce(
      (sum, chat) => sum + chat.messages.length,
      0
    );

    return {
      totalChats: Object.keys(chats).length,
      totalMessages,
      estimatedBytes,
      quotaBytes: chrome.storage.local.QUOTA_BYTES, // 5242880 (5MB)
      usagePercent: (estimatedBytes / chrome.storage.local.QUOTA_BYTES) * 100,
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return {
      totalChats: 0,
      totalMessages: 0,
      estimatedBytes: 0,
      quotaBytes: chrome.storage.local.QUOTA_BYTES,
      usagePercent: 0,
    };
  }
}

/**
 * Search chats by title, message content, and source URLs.
 * Returns matching ChatSummary[] sorted by updatedAt (most recent first).
 * Case-insensitive. Empty/whitespace query returns all chats.
 */
export async function searchChats(query: string): Promise<ChatSummary[]> {
  try {
    const trimmed = query.trim().toLowerCase();
    const result = await chrome.storage.local.get([CHATS_KEY]);
    const chats: Record<string, Chat> = result[CHATS_KEY] || {};

    const chatArray = Object.values(chats);

    const matches = trimmed
      ? chatArray.filter((chat) => {
          // Search title
          if (chat.title.toLowerCase().includes(trimmed)) return true;
          // Search message content and source URLs
          return chat.messages.some(
            (msg) => msg.content.toLowerCase().includes(trimmed)
          );
        })
      : chatArray;

    const summaries: ChatSummary[] = matches.map((chat) => ({
      id: chat.id,
      title: chat.title,
      messageCount: chat.messages.length,
      updatedAt: chat.updatedAt,
    }));

    summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    return summaries;
  } catch (error) {
    console.error('Failed to search chats:', error);
    return [];
  }
}

/**
 * Prune old chats when storage exceeds threshold.
 * Keeps the most recent N chats, deletes the rest.
 *
 * @param keepCount Number of recent chats to keep (default: 50)
 * @returns Number of chats deleted
 */
export async function pruneOldChats(keepCount: number = 50): Promise<number> {
  try {
    const result = await chrome.storage.local.get([CHATS_KEY]);
    const chats: Record<string, Chat> = result[CHATS_KEY] || {};

    const chatArray = Object.values(chats);

    if (chatArray.length <= keepCount) {
      return 0; // Nothing to prune
    }

    // Sort by updatedAt descending
    chatArray.sort((a, b) => b.updatedAt - a.updatedAt);

    // Keep only the most recent N
    const toKeep = chatArray.slice(0, keepCount);
    const newChats: Record<string, Chat> = {};
    toKeep.forEach((chat) => {
      newChats[chat.id] = chat;
    });

    await chrome.storage.local.set({ [CHATS_KEY]: newChats });

    return chatArray.length - keepCount;
  } catch (error) {
    console.error('Failed to prune old chats:', error);
    return 0;
  }
}

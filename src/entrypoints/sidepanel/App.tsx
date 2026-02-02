import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import ChatHistory from '../../components/ChatHistory';
import ChatList from '../../components/ChatList';
import { MentionInput } from '../../components/MentionInput';
import SettingsForm from '../../components/SettingsForm';
import { ExtractionStatus } from '../../components/ExtractionStatus';
import { SelectedTabsBar } from '../../components/SelectedTabsBar';
import { PromptDebugView } from '../../components/PromptDebugView';
import { ModelSelectorPopup } from '../../components/ModelSelectorPopup';
import { useTabs } from '../../hooks/useTabs';
import { getSettings, saveSettings } from '../../lib/storage';
import type { Message, Settings, TabSelection, Chat, ChatSummary } from '../../lib/types';
import { DEFAULT_SETTINGS, DEFAULT_TAB_SELECTION, SUPPORTED_LANGUAGES } from '../../lib/types';
import { createChatCompletion } from '../../lib/llm/client';
import { LLMError } from '../../lib/llm/errors';
import type { ChatMessage as LLMChatMessage } from '../../lib/llm/types';
import type { ExtractedTabContent } from '../../shared/extraction';
import type { TabInfo } from '../../lib/tabs';
import { createStreamingClient } from '../../lib/streaming/streaming-client';
import { extractThinking } from '../../lib/thinking';
import {
  listChats,
  loadChat,
  saveChat,
  deleteChat,
  createChat,
} from '../../lib/chat-storage';
import { runAgentLoop, AgentLoopCallbacks } from '../../lib/agent/agent-loop';
import type { StreamingToolCallDelta } from '../../lib/streaming/streaming-types';
import type { ToolCall } from '../../lib/types';
import { toolRegistry, toToolDefinition } from '../../lib/tools';
import { registerBuiltInTools } from '../../lib/tools/builtins';
import { McpToolManager } from '../../lib/mcp';

// Helper function to get language instruction
function getLanguageInstruction(languageCode: string): string {
  if (languageCode === 'auto') return '';
  const language = SUPPORTED_LANGUAGES.find((lang) => lang.code === languageCode);
  if (!language) return '';
  return `IMPORTANT: Always respond in ${language.label}.\n\n`;
}

// Helper function to get current date and time
function getCurrentDateTime(): string {
  const now = new Date();
  return now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [llmError, setLLMError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mcpManagerRef = useRef(new McpToolManager(toolRegistry));

  const [tabSelection, setTabSelection] = useState<TabSelection>(DEFAULT_TAB_SELECTION);
  const [isTabPickerOpen, setIsTabPickerOpen] = useState(false);

  const [extractionResults, setExtractionResults] = useState<ExtractedTabContent[]>([]);

  // Debug view state
  const [isDebugViewOpen, setIsDebugViewOpen] = useState(false);
  const [currentInputContent, setCurrentInputContent] = useState('');
  const [previewExtraction, setPreviewExtraction] = useState<ExtractedTabContent[]>([]);
  const [isPreviewExtracting, setIsPreviewExtracting] = useState(false);

  // Model selector popup state
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Chat management state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showChatList, setShowChatList] = useState(false);

  const isStreaming = useMemo(
    () => messages.some((message) => message.isStreaming),
    [messages]
  );

  const handleTabClosed = useCallback((tabId: number) => {
    setTabSelection((prev) => ({
      ...prev,
      selectedTabIds: new Set(Array.from(prev.selectedTabIds).filter((id) => id !== tabId)),
    }));
  }, []);

  const { tabs, activeTab } = useTabs(handleTabClosed);

  useEffect(() => {
    const loadSettingsAndChats = async () => {
      try {
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);

        if (!loadedSettings.baseUrl || !loadedSettings.apiKey) {
          setShowSettings(true);
        }

        // Load chats
        const chatList = await listChats();
        setChats(chatList);

        // Load most recent chat or create new one
        if (chatList.length > 0) {
          const mostRecent = chatList[0];
          const chat = await loadChat(mostRecent.id);
          if (chat) {
            setCurrentChatId(chat.id);
            setMessages(chat.messages);
          }
        } else {
          // Create initial chat
          const newChat = await createChat();
          await saveChat(newChat);
          setCurrentChatId(newChat.id);
          setMessages([]);
          setChats([{
            id: newChat.id,
            title: newChat.title,
            messageCount: 0,
            updatedAt: newChat.updatedAt,
          }]);
        }
      } catch (error) {
        console.error('Failed to load settings or chats:', error);
        setSettings({ ...DEFAULT_SETTINGS });
        setShowSettings(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettingsAndChats();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Sync MCP tools when mcpServers setting changes
  useEffect(() => {
    if (settings?.mcpServers) {
      const disabledServers = new Set(settings.disabledServers ?? []);
      const enabledServers = settings.mcpServers.filter(
        (server) => !disabledServers.has(server.id)
      );
      mcpManagerRef.current.sync(enabledServers).catch((error) => {
        console.error('[App] MCP tool sync failed:', error);
      });
    }
  }, [settings?.mcpServers, settings?.disabledServers]);

  // Auto-save current chat when messages change
  useEffect(() => {
    const saveChatAsync = async () => {
      if (!currentChatId || messages.length === 0) return;

      try {
        // Auto-generate title from first user message if still "New Chat"
        const currentChat = await loadChat(currentChatId);
        if (!currentChat) return;

        let title = currentChat.title;
        if (title === 'New Chat' && messages.length > 0) {
          const firstUserMessage = messages.find((m) => m.role === 'user');
          if (firstUserMessage) {
            title = firstUserMessage.content.slice(0, 50);
            if (firstUserMessage.content.length > 50) {
              title += '...';
            }
          }
        }

        const updatedChat: Chat = {
          ...currentChat,
          title,
          messages,
          updatedAt: Date.now(),
        };

        await saveChat(updatedChat);

        // Update chats list
        const updatedChats = await listChats();
        setChats(updatedChats);
      } catch (error) {
        console.error('Failed to auto-save chat:', error);
      }
    };

    saveChatAsync();
  }, [messages, currentChatId]);

  const handleSaveSettings = async (newSettings: Settings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);
    setShowSettings(false);
  };

  const getSelectedTabs = useCallback((overrideTabIds?: number[]) => {
    const selected: TabInfo[] = [];
    const tabIdsToUse = overrideTabIds ?? Array.from(tabSelection.selectedTabIds);

    if (tabSelection.includeActiveTab && activeTab) {
      selected.push(activeTab);
    }

    for (const tabId of tabIdsToUse) {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab && tab.id !== activeTab?.id) {
        selected.push(tab);
      }
    }

    return selected;
  }, [tabSelection, tabs, activeTab]);

  const selectedTabsForInput = useMemo(() => {
    return Array.from(tabSelection.selectedTabIds)
      .map(id => tabs.find(t => t.id === id))
      .filter((t): t is TabInfo => t !== undefined);
  }, [tabSelection.selectedTabIds, tabs]);

  const handleRemoveTab = useCallback((tabId: number) => {
    setTabSelection((prev) => {
      const newSet = new Set(prev.selectedTabIds);
      newSet.delete(tabId);
      return {
        ...prev,
        selectedTabIds: newSet,
      };
    });
  }, []);

  const handleSelectTab = useCallback((tabId: number) => {
    setTabSelection((prev) => {
      const nextSelected = new Set(prev.selectedTabIds);
      nextSelected.add(tabId);
      return {
        ...prev,
        selectedTabIds: nextSelected,
      };
    });
  }, []);

  const handleToggleActiveTab = useCallback((include: boolean) => {
    setTabSelection((prev) => ({
      ...prev,
      includeActiveTab: include,
    }));
  }, []);

  // Extract content for preview (called when debug view opens)
  const extractForPreview = useCallback(async () => {
    if (!settings) return;

    const selectedTabs = getSelectedTabs();
    if (selectedTabs.length === 0) {
      setPreviewExtraction([]);
      return;
    }

    setIsPreviewExtracting(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'extract-tabs',
        tabs: selectedTabs,
        budget: settings.contextBudget,
      });

      if (response.success) {
        setPreviewExtraction(response.results);
      } else {
        console.error('Preview extraction failed:', response.error);
        setPreviewExtraction([]);
      }
    } catch (error) {
      console.error('Preview extraction error:', error);
      setPreviewExtraction([]);
    } finally {
      setIsPreviewExtracting(false);
    }
  }, [settings, getSelectedTabs]);

  // Build preview messages for debug view (uses real extracted content)
  const buildPreviewMessages = useCallback((content: string): LLMChatMessage[] => {
    if (!settings) return [];

    const preview: LLMChatMessage[] = [];

    // 1. System prompt with optional language instruction
    if (settings.systemPrompt?.trim() || settings.responseLanguage !== 'auto') {
      const languageInstruction = getLanguageInstruction(settings.responseLanguage);
      const systemPromptContent = `Current date and time: ${getCurrentDateTime()}\n\n` + languageInstruction + (settings.systemPrompt || '');
      if (systemPromptContent.trim()) {
        preview.push({
          role: 'system',
          content: systemPromptContent,
        });
      }
    }

    // 2. Context from extracted content (real extraction, not placeholder)
    const successfulExtractions = previewExtraction.filter((r) => !r.error && r.markdown);
    if (successfulExtractions.length > 0) {
      const systemMessage = 'Context sources:\n\n' + successfulExtractions
        .map((r) => `## ${r.title}\nSource: ${r.url}\n\n${r.markdown}`)
        .join('\n\n');
      preview.push({
        role: 'system',
        content: systemMessage,
      });
    }

    // 3. Conversation history (include tool_calls and tool metadata)
    preview.push(...messages.map((msg) => {
      const apiMsg: LLMChatMessage = {
        role: msg.role,
        content: msg.content,
      };

      // Include tool_calls for assistant messages
      if (msg.role === 'assistant' && msg.tool_calls) {
        apiMsg.tool_calls = msg.tool_calls;
      }

      // Include tool_call_id and name for tool messages
      if (msg.role === 'tool') {
        if (msg.tool_call_id) {
          apiMsg.tool_call_id = msg.tool_call_id;
        }
        if (msg.name) {
          apiMsg.name = msg.name;
        }
      }

      return apiMsg;
    }));

    // 4. Current user message
    if (content.trim()) {
      preview.push({
        role: 'user',
        content,
      });
    }

    return preview;
  }, [settings, previewExtraction, messages]);

  // Preview messages for debug view
  const previewMessages = useMemo(() => {
    return buildPreviewMessages(currentInputContent);
  }, [buildPreviewMessages, currentInputContent]);

  // Handle input changes from MentionInput
  const handleInputChange = useCallback((content: string) => {
    setCurrentInputContent(content);
  }, []);

  // Handle debug view toggle - extract content when opening
  const handleDebugViewToggle = useCallback(() => {
    const willOpen = !isDebugViewOpen;
    setIsDebugViewOpen(willOpen);
    if (willOpen) {
      extractForPreview();
    }
  }, [isDebugViewOpen, extractForPreview]);

  const handleSendMessage = async (content: string, tabIds: number[] = []) => {
    if (!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel) {
      return;
    }

    const selectedTabs = getSelectedTabs(tabIds);
    console.log('Selected tabs for context:', selectedTabs.map(t => ({ id: t.id, title: t.title })));

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setTabSelection(DEFAULT_TAB_SELECTION);
    setIsTabPickerOpen(false);

    setLLMError(null);
    setIsLLMLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      let extractionResults: ExtractedTabContent[] = [];
      if (selectedTabs.length > 0) {
        const response = await chrome.runtime.sendMessage({
          type: 'extract-tabs',
          tabs: selectedTabs,
          budget: settings.contextBudget,
        });

        if (response.success) {
          extractionResults = response.results;
          setExtractionResults(extractionResults);
        } else {
          console.error('Extraction failed:', response.error);
        }
      }

      const successfulExtractions = extractionResults.filter((r) => !r.error && r.markdown);
      let systemMessage = '';
      if (successfulExtractions.length > 0) {
        systemMessage = 'Context sources:\n\n' + successfulExtractions
          .map((r) => `## ${r.title}\nSource: ${r.url}\n\n${r.markdown}`)
          .join('\n\n');
      }

      // Build API messages
      const apiMessages: LLMChatMessage[] = [];

      // 1. Add system prompt first with optional language instruction
      if (settings.systemPrompt?.trim() || settings.responseLanguage !== 'auto') {
        const languageInstruction = getLanguageInstruction(settings.responseLanguage);
        const systemPromptContent = `Current date and time: ${getCurrentDateTime()}\n\n` + languageInstruction + (settings.systemPrompt || '');
        if (systemPromptContent.trim()) {
          apiMessages.push({
            role: 'system' as const,
            content: systemPromptContent,
          });
        }
      }

      // 2. Add system message with context if available
      if (systemMessage) {
        apiMessages.push({
          role: 'system' as const,
          content: systemMessage,
        });
      }

      // 3. Add conversation history (include tool_calls for assistant, tool_call_id/name for tool messages)
      apiMessages.push(...messages.map((msg) => {
        const apiMsg: LLMChatMessage = {
          role: msg.role,
          content: msg.content,
        };

        // Include tool_calls for assistant messages
        if (msg.role === 'assistant' && msg.tool_calls) {
          apiMsg.tool_calls = msg.tool_calls;
        }

        // Include tool_call_id and name for tool messages
        if (msg.role === 'tool') {
          if (msg.tool_call_id) {
            apiMsg.tool_call_id = msg.tool_call_id;
          }
          if (msg.name) {
            apiMsg.name = msg.name;
          }
        }

        return apiMsg;
      }));

      // 4. Add current user message
      apiMessages.push({
        role: 'user' as const,
        content,
      });

      // Always use agentic loop with automatic tool execution
      // Register built-in tools and get definitions
      registerBuiltInTools(toolRegistry);
      const disabledTools = new Set(settings.disabledTools ?? []);
      const disabledServers = new Set(settings.disabledServers ?? []);
      const tools = (await toolRegistry.getTools())
        .filter((tool) => {
          if (disabledTools.has(tool.name)) return false;
          if (tool.source === 'mcp' && tool.serverId) {
            return !disabledServers.has(tool.serverId);
          }
          return true;
        })
        .map(toToolDefinition);

      // Create executeTool callback
      const executeTool = async (name: string, args: unknown) => {
        const tool = toolRegistry.get(name);
        if (!tool) {
          return { error: 'Tool not found', name };
        }
        return await tool.execute(args);
      };

      // Create streaming message placeholder for agent mode
      const agentStreamingMessageId = crypto.randomUUID();
      setMessages((prev) => [...prev, {
        id: agentStreamingMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }]);

      // Track current streaming message ID (changes on each iteration after tool results)
      let currentStreamingId = agentStreamingMessageId;

      // Define streaming callbacks for agent mode
      const agentCallbacks: AgentLoopCallbacks = {
        onContentDelta: (contentDelta: string) => {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.id === currentStreamingId) {
              return [...prev.slice(0, -1), {
                ...lastMessage,
                content: lastMessage.content + contentDelta,
              }];
            }
            return prev;
          });
        },
        onToolCallDelta: (delta: StreamingToolCallDelta) => {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.id === currentStreamingId) {
              // Initialize tool_calls array if not present
              const existingToolCalls = lastMessage.tool_calls || [];
              const toolCallsMap = new Map<number, ToolCall>(
                existingToolCalls.map((tc, idx) => [idx, tc])
              );

              const index = delta.index;
              const existing = toolCallsMap.get(index);

              if (existing) {
                // Append to existing tool call arguments
                if (delta.function?.arguments) {
                  toolCallsMap.set(index, {
                    ...existing,
                    function: {
                      ...existing.function,
                      arguments: existing.function.arguments + delta.function.arguments,
                    },
                  });
                }
              } else {
                // Create new tool call
                toolCallsMap.set(index, {
                  id: delta.id || '',
                  type: 'function',
                  function: {
                    name: delta.function?.name || '',
                    arguments: delta.function?.arguments || '',
                  },
                });
              }

              return [...prev.slice(0, -1), {
                ...lastMessage,
                tool_calls: Array.from(toolCallsMap.values()),
              }];
            }
            return prev;
          });
        },
        onIterationStart: (iteration: number) => {
          console.log(`[agent] Starting iteration ${iteration}`);
          // On iteration > 0, finalize previous streaming message and create new placeholder
          if (iteration > 0) {
            const newStreamingId = crypto.randomUUID();
            currentStreamingId = newStreamingId;
            setMessages((prev) => {
              // Find and finalize any streaming assistant message (may not be last due to tool messages)
              const streamingIdx = prev.findIndex(
                (m) => m.role === 'assistant' && m.isStreaming
              );
              let updatedPrev = prev;
              if (streamingIdx !== -1) {
                const streamingMessage = prev[streamingIdx];
                updatedPrev = [
                  ...prev.slice(0, streamingIdx),
                  { ...streamingMessage, isStreaming: false },
                  ...prev.slice(streamingIdx + 1),
                ];
              }
              // Add new streaming placeholder for this iteration
              return [...updatedPrev, {
                id: newStreamingId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                isStreaming: true,
              }];
            });
          }
        },
        onToolResult: (toolCallId: string, name: string, result: unknown) => {
          // Add tool result message to UI
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCallId,
            name,
            timestamp: Date.now(),
          }]);
        },
      };

      // Run the agent loop with streaming callbacks (clone apiMessages to avoid mutation)
      const result = await runAgentLoop({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.defaultModel,
        messages: [...apiMessages],
        tools,
        executeTool,
        maxIterations: settings.agentMaxIterations,
        timeoutMs: settings.agentTimeoutMs,
        signal: abortControllerRef.current.signal,
        callbacks: agentCallbacks,
      });

      // Extract thinking from final message and finalize streaming
      const { thinking, mainContent } = extractThinking(
        result.finalMessage.content ?? '',
        result.finalMessage.reasoning_content
      );

      // Finalize the last streaming message with extracted thinking
      // Find any streaming assistant message (may not be last due to tool messages)
      setMessages((prev) => {
        const streamingIdx = prev.findIndex(
          (m) => m.role === 'assistant' && m.isStreaming
        );
        if (streamingIdx === -1) {
          return prev;
        }
        const streamingMessage = prev[streamingIdx];
        return [
          ...prev.slice(0, streamingIdx),
          {
            ...streamingMessage,
            content: mainContent,
            thinking: thinking || undefined,
            isStreaming: false,
            timestamp: Date.now(),
          },
          ...prev.slice(streamingIdx + 1),
        ];
      });
    } catch (error) {
      if (error instanceof LLMError) {
        setLLMError(error.userMessage);
        console.error(error.toLogString());
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        // Agent loop or request was aborted
        console.log('Request aborted successfully.');
        setLLMError('Generation stopped.');
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, isStreaming: false },
            ];
          }
          return prev;
        });
      } else if (abortControllerRef.current?.signal.aborted) {
        console.log('LLM request aborted successfully.');
        setLLMError('Generation stopped.');
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, isStreaming: false },
            ];
          }
          return prev;
        });
      } else if (error instanceof Error && (
        error.message === 'Agent loop timed out' ||
        error.message === 'Agent loop exceeded max iterations'
      )) {
        // Agent loop specific errors - show user-friendly message
        setLLMError(error.message);
        console.error('Agent loop error:', error.message);
      } else {
        setLLMError('An unexpected error occurred. Please try again.');
        console.error('LLM request error:', error);
      }
    } finally {
      setIsLLMLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLLMLoading(false);
  }, []);

  const handleModelChange = useCallback(async (model: string) => {
    if (!settings) return;

    const updatedSavedModels = settings.savedModels.includes(model)
      ? settings.savedModels
      : [...settings.savedModels, model];

    const updatedSettings: Settings = {
      ...settings,
      defaultModel: model,
      savedModels: updatedSavedModels,
    };

    try {
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save model change:', error);
    }
  }, [settings]);

  // Chat management handlers
  const handleNewChat = useCallback(async () => {
    try {
      const newChat = await createChat();
      await saveChat(newChat);
      setCurrentChatId(newChat.id);
      setMessages([]);
      setExtractionResults([]); // Reset extraction status for new chat
      setPreviewExtraction([]); // Reset preview extraction for new chat
      const updatedChats = await listChats();
      setChats(updatedChats);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  }, []);

  const handleSelectChat = useCallback(async (id: string) => {
    try {
      const chat = await loadChat(id);
      if (chat) {
        setCurrentChatId(chat.id);
        setMessages(chat.messages);
        setExtractionResults([]); // Reset extraction status when switching chats
        setPreviewExtraction([]); // Reset preview extraction when switching chats
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  }, []);

  const handleDeleteChat = useCallback(async (id: string) => {
    try {
      await deleteChat(id);
      const updatedChats = await listChats();
      setChats(updatedChats);

      // If deleted current chat, switch to another or create new
      if (id === currentChatId) {
        if (updatedChats.length > 0) {
          await handleSelectChat(updatedChats[0].id);
        } else {
          await handleNewChat();
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  }, [currentChatId, handleSelectChat, handleNewChat]);

  const handleEditMessage = useCallback(async (id: string, newContent: string) => {
    // Find the message being edited
    const messageIndex = messages.findIndex((m) => m.id === id);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];

    // If it's a user message, remove it and all messages after, then re-send
    if (message.role === 'user') {
      // Abort any in-flight request (if streaming)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setIsLLMLoading(false);
      }

      // Remove the edited message and all after it (handleSendMessage will add new one)
      const messagesToKeep = messages.slice(0, messageIndex);
      setMessages(messagesToKeep);

      // Clear any errors
      setLLMError(null);

      // Re-send the message with updated content (creates new user message)
      await handleSendMessage(newContent);
    } else {
      // Just update the message content (for assistant messages)
      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = { ...message, content: newContent };
      setMessages(updatedMessages);
    }
  }, [messages, handleSendMessage]);

  const handleDeleteMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Mini header with chat list toggle only */}
      <header className="flex items-center px-3 py-2 bg-white border-b border-gray-200">
        <button
          type="button"
          onClick={() => setShowChatList(!showChatList)}
          className={`p-1 transition-colors ${
            showChatList
              ? 'text-blue-600 hover:bg-blue-50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          } rounded`}
          title={showChatList ? 'Hide chat list' : 'Show chat list'}
          aria-label="Toggle chat list"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </header>

      {showSettings ? (
        <SettingsForm
          settings={settings || DEFAULT_SETTINGS}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {showChatList && (
            <ChatList
              chats={chats}
              currentChatId={currentChatId}
              onSelectChat={handleSelectChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteChat}
            />
          )}
          <div className="flex flex-col flex-1 min-w-0">
            {settings?.showExtractionStatus && (
              <ExtractionStatus results={extractionResults} />
            )}
            <ChatHistory
              messages={messages}
              isLoading={isLLMLoading && !isStreaming}
              error={llmError}
              isStreaming={isStreaming}
              onStop={handleStopStreaming}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
            />
            <SelectedTabsBar
              tabs={selectedTabsForInput}
              includeActiveTab={tabSelection.includeActiveTab}
              activeTab={activeTab}
              onRemoveTab={handleRemoveTab}
              onToggleActiveTab={handleToggleActiveTab}
            />
            {settings?.showDebugPrompt && (
              <PromptDebugView
                messages={previewMessages}
                isOpen={isDebugViewOpen}
                onToggle={handleDebugViewToggle}
                isLoading={isPreviewExtracting}
              />
            )}
            <MentionInput
              onSend={handleSendMessage}
              disabled={!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel || isLLMLoading || isStreaming}
              selectedTabs={selectedTabsForInput}
              onRemoveTab={handleRemoveTab}
              availableTabs={tabs}
              onSelectTab={handleSelectTab}
              isPickerOpen={isTabPickerOpen}
              onPickerOpenChange={setIsTabPickerOpen}
              onInputChange={handleInputChange}
              currentModel={settings?.defaultModel || ''}
              onModelClick={() => setShowModelSelector(true)}
              onSettingsClick={() => setShowSettings(!showSettings)}
              includeActiveTab={tabSelection.includeActiveTab}
              onActiveTabChange={handleToggleActiveTab}
            />
          </div>
        </div>
      )}

      {/* Model Selector Popup */}
      {settings && (
        <ModelSelectorPopup
          isOpen={showModelSelector}
          onClose={() => setShowModelSelector(false)}
          currentModel={settings.defaultModel}
          savedModels={settings.savedModels}
          onModelChange={(model) => {
            handleModelChange(model);
            setShowModelSelector(false);
          }}
        />
      )}
    </div>
  );
}

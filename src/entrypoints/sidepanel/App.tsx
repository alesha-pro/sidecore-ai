import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import ChatHistory from '../../components/ChatHistory';
import ChatList from '../../components/ChatList';
import { MentionInput } from '../../components/MentionInput';
import SettingsForm from '../../components/SettingsForm';
import { ExtractionStatus } from '../../components/ExtractionStatus';
import { SelectedTabsBar } from '../../components/SelectedTabsBar';
import { PromptDebugView } from '../../components/PromptDebugView';
import { ModelSelectorPopup } from '../../components/ModelSelectorPopup';
import { ChevronLeft, MessageSquarePlus, Settings, Sparkles } from 'lucide-preact';
import { cn } from '../../lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useTabs } from '../../hooks/useTabs';
import { getSettings, saveSettings } from '../../lib/storage';
import type { Message, Settings, TabSelection, Chat, ChatSummary, CitationMap } from '../../lib/types';
import { DEFAULT_SETTINGS, DEFAULT_TAB_SELECTION, SUPPORTED_LANGUAGES } from '../../lib/types';
import { LLMError } from '../../lib/llm/errors';
import type { ChatMessage as LLMChatMessage } from '../../lib/llm/types';
import type { ExtractedTabContent } from '../../shared/extraction';
import type { TabInfo } from '../../lib/tabs';
import { extractThinking } from '../../lib/thinking';
import {
  listChats,
  loadChat,
  saveChat,
  deleteChat,
  createChat,
  searchChats,
} from '../../lib/chat-storage';
import { runAgentLoop, AgentLoopCallbacks } from '../../lib/agent/agent-loop';
import type { StreamingToolCallDelta } from '../../lib/streaming/streaming-types';
import type { ToolCall } from '../../lib/types';
import { toolRegistry, toToolDefinition } from '../../lib/tools';
import { McpToolManager } from '../../lib/mcp';
import { assembleContext } from '../../lib/context-assembler';
import { generateTitle } from '../../lib/title-generator';
import { generateSuggestions } from '../../lib/suggestion-generator';
import { TypewriterTitle } from '../../components/TypewriterTitle';

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

type View = 'chat-list' | 'chat' | 'settings';

export default function App() {
  useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentView, setCurrentView] = useState<View>('chat-list');
  const [previousView, setPreviousView] = useState<View | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [llmError, setLLMError] = useState<string | null>(null);
  const [streamingChats, setStreamingChats] = useState<Map<string, { abortController: AbortController }>>(new Map());
  const mcpManagerRef = useRef(new McpToolManager(toolRegistry));

  const [tabSelection, setTabSelection] = useState<TabSelection>(DEFAULT_TAB_SELECTION);
  const [isTabPickerOpen, setIsTabPickerOpen] = useState(false);

  const [extractionResults, setExtractionResults] = useState<ExtractedTabContent[]>([]);

  // Citation map for current context (maps [1], [2] to source URLs)
  const [citationMap, setCitationMap] = useState<CitationMap>({});

  // Debug view state
  const [isDebugViewOpen, setIsDebugViewOpen] = useState(false);
  const [currentInputContent, setCurrentInputContent] = useState('');
  const [previewExtraction, setPreviewExtraction] = useState<ExtractedTabContent[]>([]);
  const [isPreviewExtracting, setIsPreviewExtracting] = useState(false);

  // Model selector popup state
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Title generation animation state
  const [animatingTitle, setAnimatingTitle] = useState<string | null>(null);
  const [isTitleAnimating, setIsTitleAnimating] = useState(false);

  // Chat management state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState<ChatSummary[]>([]);

  // Derive current chat's streaming state
  const isCurrentChatStreaming = currentChatId ? streamingChats.has(currentChatId) : false;

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
        console.log('[App] Loaded settings, mcpServers:', loadedSettings.mcpServers);
        setSettings(loadedSettings);

        if (!loadedSettings.baseUrl || !loadedSettings.apiKey) {
          setPreviousView('chat-list');
          setCurrentView('settings');
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
        setCurrentView('settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettingsAndChats();
  }, []);

  // Store streamingChats in a ref for cleanup to avoid re-running effect on every Map update
  const streamingChatsRef = useRef(streamingChats);
  streamingChatsRef.current = streamingChats;

  useEffect(() => {
    return () => {
      // Abort all streaming chats on unmount (only runs once on unmount)
      streamingChatsRef.current.forEach(({ abortController }) => {
        abortController.abort();
      });
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
        if (title === 'New Chat' && messages.length > 0 && !settings?.titleGenEnabled) {
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

  // Debounced chat search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setFilteredChats(chats);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await searchChats(trimmed);
      setFilteredChats(results);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, chats]);

  const navigateTo = useCallback((view: View) => {
    setPreviousView(currentView);
    setCurrentView(view);
    setAnimatingTitle(null);
    setIsTitleAnimating(false);
  }, [currentView]);

  const handleBack = useCallback(() => {
    if (previousView) {
      setCurrentView(previousView);
      setPreviousView(null);
    } else {
      setCurrentView('chat-list');
    }
  }, [previousView]);

  const handleSaveSettings = async (newSettings: Settings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);
    navigateTo('chat');
  };

  const getSelectedTabs = useCallback((overrideTabIds?: number[], overrideTabs?: TabInfo[]) => {
    const selected: TabInfo[] = [];

    // If explicit tab IDs are provided (e.g., from context menu), use ONLY those
    // This bypasses tabSelection state entirely to avoid race conditions
    if (overrideTabIds && overrideTabIds.length > 0) {
      for (const tabId of overrideTabIds) {
        // First check override tabs (passed directly, no state dependency)
        const overrideTab = overrideTabs?.find((t) => t.id === tabId);
        if (overrideTab) {
          selected.push(overrideTab);
          continue;
        }
        // Fall back to tabs state
        const tab = tabs.find((t) => t.id === tabId);
        if (tab) {
          selected.push(tab);
        }
      }
      return selected;
    }

    // Otherwise use tabSelection state (normal UI flow)
    if (tabSelection.includeActiveTab && activeTab) {
      selected.push(activeTab);
    }

    for (const tabId of Array.from(tabSelection.selectedTabIds)) {
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

  const handleToolToggle = useCallback((toolName: string) => {
    if (!settings) return;
    const isDisabled = settings.disabledTools.includes(toolName);
    const disabledTools = isDisabled
      ? settings.disabledTools.filter((name) => name !== toolName)
      : [...settings.disabledTools, toolName];
    const newSettings = { ...settings, disabledTools };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings]);

  const handleProfileChange = useCallback((profileId: string | null) => {
    if (!settings) return;
    const newSettings = { ...settings, activePromptProfileId: profileId };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings]);

  const handleServerToggle = useCallback((serverId: string) => {
    if (!settings) return;
    const isDisabled = settings.disabledServers.includes(serverId);
    const disabledServers = isDisabled
      ? settings.disabledServers.filter((id) => id !== serverId)
      : [...settings.disabledServers, serverId];
    const newSettings = { ...settings, disabledServers };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings]);

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

  // Build preview messages for debug view (uses assembleContext for accurate representation)
  const buildPreviewMessages = useCallback((content: string): LLMChatMessage[] => {
    if (!settings) return [];

    // Build system prompt (same as handleSendMessage)
    const languageInstruction = getLanguageInstruction(settings.responseLanguage);
    const activeProfile = settings.activePromptProfileId
      ? settings.promptProfiles.find(p => p.id === settings.activePromptProfileId)
      : null;
    const profileInstruction = activeProfile ? `## Active Profile: ${activeProfile.name}\n${activeProfile.prompt}\n\n` : '';
    const systemPromptContent = `Current date and time: ${getCurrentDateTime()}\n\n` + languageInstruction + profileInstruction + (settings.systemPrompt || '');

    // Build tab content from preview extraction (if any)
    const successfulExtractions = previewExtraction.filter((r) => !r.error && r.markdown);
    const tabContentSystemMessage = successfulExtractions.length > 0
      ? 'Context from the following sources. Cite sources using [1], [2], etc. when referencing information:\n\n' + successfulExtractions
        .map((r, index) => `[${index + 1}] ${r.title}\nSource: ${r.url}\n\n${r.markdown}`)
        .join('\n\n')
      : null;

    // Use the same assembleContext as the real send flow
    const { apiMessages } = assembleContext({
      messages,
      userContent: content.trim() || '(empty)',
      systemPrompt: systemPromptContent.trim() ? systemPromptContent : '',
      tabContentSystemMessage,
      modelContextLimit: settings.modelContextLimit,
    });

    return apiMessages;
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

  const handleSendMessage = async (content: string, tabIds: number[] = [], overrideChatId?: string, overrideTabs?: TabInfo[]) => {
    if (!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel) {
      return;
    }

    // Capture chatId at start to handle chat switching during streaming
    // overrideChatId bypasses stale closure (used by context menu actions)
    const chatId = overrideChatId || currentChatId;
    if (!chatId) return;

    const selectedTabs = getSelectedTabs(tabIds, overrideTabs);
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

    // Create new AbortController and add to streamingChats Map
    const abortController = new AbortController();
    setStreamingChats((prev) => new Map(prev).set(chatId, { abortController }));

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

      // Content-as-history: inject extracted content into message history
      if (successfulExtractions.length > 0) {
        const contentMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: 'Context from the following sources. Cite sources using [1], [2], etc. when referencing information:\n\n' + successfulExtractions
            .map((r, index) => `[${index + 1}] ${r.title}\nSource: ${r.url}\n\n${r.markdown}`)
            .join('\n\n'),
          timestamp: Date.now(),
          contentMessageId: crypto.randomUUID(), // marks as content injection
        };
        setMessages((prev) => [
          ...prev.filter(m => !m.contentMessageId),  // Remove old content messages
          contentMsg,
        ]);
      }

      // Build system prompt
      const languageInstruction = getLanguageInstruction(settings.responseLanguage);
      const activeProfile = settings.activePromptProfileId
        ? settings.promptProfiles.find(p => p.id === settings.activePromptProfileId)
        : null;
      const profileInstruction = activeProfile ? `## Active Profile: ${activeProfile.name}\n${activeProfile.prompt}\n\n` : '';
      const systemPromptContent = `Current date and time: ${getCurrentDateTime()}\n\n` + languageInstruction + profileInstruction + (settings.systemPrompt || '');

      // Build tab content string (only if we just extracted, otherwise null)
      const tabContentSystemMessage = successfulExtractions.length > 0
        ? 'Context from the following sources. Cite sources using [1], [2], etc. when referencing information:\n\n' + successfulExtractions
          .map((r, index) => `[${index + 1}] ${r.title}\nSource: ${r.url}\n\n${r.markdown}`)
          .join('\n\n')
        : null;

      // Assemble context with smart management (compression, trimming, etc.)
      const { apiMessages, citationMap: newCitationMap } = assembleContext({
        messages, // Current history (before userMessage due to React batching)
        userContent: content,
        systemPrompt: systemPromptContent.trim() ? systemPromptContent : '',
        tabContentSystemMessage,
        modelContextLimit: settings.modelContextLimit,
      });

      // Store citation map for rendering clickable citations
      setCitationMap(newCitationMap);

      // Always use agentic loop with automatic tool execution
      // Get tool definitions (built-in tools registered at module init)
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
        signal: abortController.signal,
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

      // Fire-and-forget: generate title after first LLM response
      if (settings.titleGenEnabled) {
        loadChat(chatId).then((chat) => {
          if (chat && chat.title === 'New Chat') {
            generateTitle(settings, content, mainContent).then(async (title) => {
              if (!title) return;
              const freshChat = await loadChat(chatId);
              if (!freshChat) return;
              const updatedChat: Chat = { ...freshChat, title, updatedAt: Date.now() };
              await saveChat(updatedChat);
              const updatedChats = await listChats();
              setChats(updatedChats);
              setAnimatingTitle(title);
              setIsTitleAnimating(true);
            }).catch((err) => {
              console.error('[App] Title generation failed:', err);
            });
          }
        });
      }

      // Fire-and-forget: generate follow-up suggestions using small model
      const finalMessageId = currentStreamingId;
      generateSuggestions(settings, content, mainContent, settings.responseLanguage).then((suggestions) => {
        if (suggestions.length === 0) return;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === finalMessageId);
          if (idx === -1) return prev;
          return [
            ...prev.slice(0, idx),
            { ...prev[idx], suggestions },
            ...prev.slice(idx + 1),
          ];
        });
      }).catch((err) => {
        console.error('[App] Suggestion generation failed:', err);
      });
    } catch (error) {
      // Clean up any streaming assistant message on all error types
      setMessages((prev) => {
        const streamingIdx = prev.findIndex(
          (m) => m.role === 'assistant' && m.isStreaming
        );
        if (streamingIdx === -1) return prev;
        const streamingMessage = prev[streamingIdx];
        // Remove empty streaming placeholders, finalize non-empty ones
        if (!streamingMessage.content && !streamingMessage.tool_calls?.length) {
          return [...prev.slice(0, streamingIdx), ...prev.slice(streamingIdx + 1)];
        }
        return [
          ...prev.slice(0, streamingIdx),
          { ...streamingMessage, isStreaming: false },
          ...prev.slice(streamingIdx + 1),
        ];
      });

      if (error instanceof LLMError) {
        setLLMError(error.userMessage);
        console.error(error.toLogString());
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Request aborted successfully.');
        setLLMError('Generation stopped.');
      } else if (abortController.signal.aborted) {
        console.log('LLM request aborted successfully.');
        setLLMError('Generation stopped.');
      } else if (error instanceof Error && (
        error.message === 'Agent loop timed out' ||
        error.message === 'Agent loop exceeded max iterations'
      )) {
        setLLMError(error.message);
        console.error('Agent loop error:', error.message);
      } else {
        setLLMError('An unexpected error occurred. Please try again.');
        console.error('LLM request error:', error);
      }
    } finally {
      // Remove chatId from streamingChats Map
      setStreamingChats((prev) => {
        const next = new Map(prev);
        next.delete(chatId);
        return next;
      });
    }
  };

  // Handle pending context menu action (stored in session storage by background)
  // Uses storage.onChanged listener to react when sidepanel is already open
  useEffect(() => {
    // Wait for settings to load
    if (!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel) {
      console.log('[App] Context menu handler: waiting for settings...');
      return;
    }

    const processPendingAction = async () => {
      console.log('[App] Checking for pending context menu action...');
      const result = await chrome.storage.session.get('pendingContextMenuAction');
      const pending = result.pendingContextMenuAction;

      if (!pending) {
        console.log('[App] No pending action found');
        return;
      }

      console.log('[App] Found pending action:', pending.action, 'timestamp:', pending.timestamp);

      // Clear immediately to prevent re-execution
      await chrome.storage.session.remove('pendingContextMenuAction');
      console.log('[App] Cleared pending action from storage');

      // Check if action is recent (within 10 seconds)
      const age = Date.now() - pending.timestamp;
      if (age > 10000) {
        console.log('[App] Action too old, ignoring. Age:', age, 'ms');
        return;
      }

      const { action } = pending;
      console.log('[App] Processing action:', action);

      // Always create a new chat for context menu actions
      const newChat = await createChat();
      await saveChat(newChat);
      setCurrentChatId(newChat.id);
      setMessages([]);
      setExtractionResults([]);
      setPreviewExtraction([]);
      const updatedChats = await listChats();
      setChats(updatedChats);
      console.log('[App] Created new chat:', newChat.id);

      // Switch to chat view
      setCurrentView('chat');

      // Set the specific tab from context menu as context (not activeTab which may be stale)
      setTabSelection({
        includeActiveTab: false,
        selectedTabIds: new Set([pending.tab.id]),
      });
      console.log('[App] Set tab selection with explicit tab ID:', pending.tab.id);

      // Trigger action based on menu item
      if (action === 'summarize-page') {
        console.log('[App] Sending summarize request for tab:', pending.tab.id);
        // Pass explicit chatId and TabInfo to bypass all stale closure/state issues
        const tabInfo: TabInfo = {
          id: pending.tab.id,
          title: pending.tab.title || 'Untitled',
          url: pending.tab.url || '',
          favIconUrl: pending.tab.favIconUrl,
          active: true,
          windowId: 0,
          index: 0,
        };
        await handleSendMessage(
          'Please summarize this page concisely, highlighting the key points.',
          [pending.tab.id],
          newChat.id,
          [tabInfo]
        );
      }
      // 'ask-about-page' just prepares context, user types question
    };

    // Check on mount (for when sidepanel was closed)
    processPendingAction();

    // Listen for storage changes (for when sidepanel is already open)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'session' && changes.pendingContextMenuAction?.newValue) {
        console.log('[App] Storage changed, new pending action detected');
        processPendingAction();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    console.log('[App] Context menu storage listener registered');

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      console.log('[App] Context menu storage listener removed');
    };
  }, [settings]);

  const handleStopStreaming = useCallback(() => {
    if (!currentChatId) return;
    const streamingChat = streamingChats.get(currentChatId);
    if (streamingChat) {
      streamingChat.abortController.abort();
      setStreamingChats((prev) => {
        const next = new Map(prev);
        next.delete(currentChatId);
        return next;
      });
    }
  }, [currentChatId, streamingChats]);

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
      setAnimatingTitle(null);
      setIsTitleAnimating(false);
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
        setAnimatingTitle(null);
        setIsTitleAnimating(false);
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
      if (currentChatId) {
        const streamingChat = streamingChats.get(currentChatId);
        if (streamingChat) {
          streamingChat.abortController.abort();
          setStreamingChats((prev) => {
            const next = new Map(prev);
            next.delete(currentChatId);
            return next;
          });
        }
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
  }, [messages, currentChatId, streamingChats, handleSendMessage]);

  const handleDeleteMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleRegenerate = useCallback(() => {
    if (!currentChatId || isCurrentChatStreaming) return;

    // Find the latest assistant message (searching backwards)
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    // Find the preceding user message (skip tool messages between user and assistant)
    let precedingUserIdx = -1;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && !messages[i].contentMessageId) {
        precedingUserIdx = i;
        break;
      }
    }
    if (precedingUserIdx === -1) return;

    const userContent = messages[precedingUserIdx].content;

    // Remove everything from the assistant message onward (assistant + trailing tool messages)
    const messagesToKeep = messages.slice(0, lastAssistantIdx);
    // Also remove the preceding user message since handleSendMessage will add a new one
    const messagesWithoutUser = messagesToKeep.slice(0, precedingUserIdx);
    setMessages(messagesWithoutUser);

    // Clear error state so regeneration starts clean
    setLLMError(null);

    // Re-send with the same user content
    handleSendMessage(userContent);
  }, [currentChatId, isCurrentChatStreaming, messages, handleSendMessage]);

  const handleSuggestionClick = useCallback((text: string) => {
    if (isCurrentChatStreaming) return;
    handleSendMessage(text);
  }, [isCurrentChatStreaming, handleSendMessage]);

  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center h-screen',
        'bg-background',
        'dark:bg-background-dark'
      )}>
        <div className={cn(
          'text-sm',
          'text-text-secondary',
          'dark:text-text-secondary-dark'
        )}>Loading...</div>
      </div>
    );
  }

  const currentChat = chats.find(c => c.id === currentChatId);

  return (
    <div className={cn(
      'flex flex-col h-screen overflow-x-hidden',
      'bg-background',
      'dark:bg-background-dark'
    )}>
      {/* NAV-02: Header with back button */}
      <header className={cn(
        'flex items-center gap-2 px-4 py-1.5 shrink-0 min-w-0',
        'bg-surface border-b border-border',
        'dark:bg-surface-dark dark:border-border-dark'
      )}>
        {/* Back button (not shown on chat-list) */}
        {currentView !== 'chat-list' && (
          <button
            type="button"
            onClick={handleBack}
            className={cn(
              'p-1 -ml-1.5 rounded-lg flex-shrink-0',
              'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark'
            )}
            aria-label="Back"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Logo and Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Sparkles
            size={20}
            className={cn(
              'flex-shrink-0',
              'text-accent',
              'dark:text-accent-dark'
            )}
          />
          <h1 className={cn(
            'text-sm font-semibold truncate',
            'text-text-primary',
            'dark:text-text-primary-dark'
          )}>
            {currentView === 'chat-list' && 'Chats'}
            {currentView === 'chat' && (
              <TypewriterTitle
                text={animatingTitle || currentChat?.title || 'New Chat'}
                animate={isTitleAnimating}
                onAnimationComplete={() => {
                  setIsTitleAnimating(false);
                  setAnimatingTitle(null);
                }}
              />
            )}
            {currentView === 'settings' && 'Settings'}
          </h1>
        </div>

        {/* Actions */}
        {currentView === 'chat-list' && (
          <>
            <button
              type="button"
              onClick={() => { handleNewChat(); navigateTo('chat'); }}
              className={cn(
                'p-1 rounded-lg flex-shrink-0',
                'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark'
              )}
              aria-label="New chat"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className={cn(
                'p-1 rounded-lg flex-shrink-0',
                'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark'
              )}
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          </>
        )}

        {currentView === 'settings' && (
          <button
            type="button"
            onClick={() => { handleNewChat(); navigateTo('chat'); }}
            className={cn(
              'p-1 rounded-lg flex-shrink-0',
              'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark'
            )}
            aria-label="New chat"
          >
            <MessageSquarePlus size={16} />
          </button>
        )}

        {currentView === 'chat' && (
          <>
            <button
              type="button"
              onClick={() => handleNewChat()}
              className={cn(
                'p-1 rounded-lg flex-shrink-0',
                'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark'
              )}
              aria-label="New chat"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className={cn(
                'p-1 rounded-lg flex-shrink-0',
                'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark'
              )}
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          </>
        )}
      </header>

      {/* NAV-01: Chat list as full-screen view */}
      {currentView === 'chat-list' && (
        <div className="animate-slide-in-from-left motion-reduce:animate-none">
          <ChatList
            chats={filteredChats}
            currentChatId={currentChatId}
            onSelectChat={(id) => {
              handleSelectChat(id);
              navigateTo('chat');
            }}
            onDeleteChat={handleDeleteChat}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      )}

      {/* Chat view - contains all streaming logic */}
      {currentView === 'chat' && (
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden @container">
          {settings?.showExtractionStatus && (
            <ExtractionStatus results={extractionResults} />
          )}
          <ChatHistory
            messages={messages}
            isLoading={isCurrentChatStreaming && !isStreaming}
            error={llmError}
            isStreaming={isStreaming}
            onStop={handleStopStreaming}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onRegenerate={handleRegenerate}
            citationMap={citationMap}
            onSuggestionClick={handleSuggestionClick}
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
            disabled={!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel || isCurrentChatStreaming}
            selectedTabs={selectedTabsForInput}
            onRemoveTab={handleRemoveTab}
            availableTabs={tabs}
            onSelectTab={handleSelectTab}
            isPickerOpen={isTabPickerOpen}
            onPickerOpenChange={setIsTabPickerOpen}
            onInputChange={handleInputChange}
            currentModel={settings?.defaultModel || ''}
            onModelClick={() => setShowModelSelector(true)}
            onSettingsClick={() => navigateTo('settings')}
            includeActiveTab={tabSelection.includeActiveTab}
            onActiveTabChange={handleToggleActiveTab}
            disabledTools={settings?.disabledTools ?? []}
            disabledServers={settings?.disabledServers ?? []}
            mcpServers={settings?.mcpServers ?? []}
            onToolToggle={handleToolToggle}
            onServerToggle={handleServerToggle}
            promptProfiles={settings?.promptProfiles ?? []}
            activePromptProfileId={settings?.activePromptProfileId ?? null}
            onProfileChange={handleProfileChange}
          />
        </div>
      )}

      {/* NAV-03: Settings as separate screen */}
      {currentView === 'settings' && (
        <div className="animate-slide-in-from-right motion-reduce:animate-none">
          <SettingsForm
            settings={settings || DEFAULT_SETTINGS}
            onSave={handleSaveSettings}
            onCancel={handleBack}
          />
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

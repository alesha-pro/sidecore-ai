import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import ChatHistory from '../../components/ChatHistory';
import { MentionInput } from '../../components/MentionInput';
import SettingsForm from '../../components/SettingsForm';
import { ContextBar } from '../../components/ContextBar';
import { ExtractionStatus } from '../../components/ExtractionStatus';
import { SelectedTabsBar } from '../../components/SelectedTabsBar';
import { useTabs } from '../../hooks/useTabs';
import { getSettings, saveSettings } from '../../lib/storage';
import type { Message, Settings, TabSelection } from '../../lib/types';
import { DEFAULT_SETTINGS, DEFAULT_TAB_SELECTION } from '../../lib/types';
import { createChatCompletion } from '../../lib/llm/client';
import { LLMError } from '../../lib/llm/errors';
import type { ChatMessage as LLMChatMessage } from '../../lib/llm/types';
import type { ExtractedTabContent } from '../../shared/extraction';
import type { TabInfo } from '../../lib/tabs';
import { createStreamingClient } from '../../lib/streaming/streaming-client';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [llmError, setLLMError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [tabSelection, setTabSelection] = useState<TabSelection>(DEFAULT_TAB_SELECTION);
  const [isTabPickerOpen, setIsTabPickerOpen] = useState(false);

  const [extractionResults, setExtractionResults] = useState<ExtractedTabContent[]>([]);

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
    const loadSettings = async () => {
      try {
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);

        if (!loadedSettings.baseUrl || !loadedSettings.apiKey) {
          setShowSettings(true);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setSettings({ ...DEFAULT_SETTINGS });
        setShowSettings(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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

      const apiMessages: LLMChatMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      if (systemMessage) {
        apiMessages.push({
          role: 'system' as const,
          content: systemMessage,
        });
      }

      apiMessages.push({
        role: 'user' as const,
        content,
      });

      if (settings.stream) {
        const streamingMessageId = crypto.randomUUID();
        setMessages((prev) => [...prev, {
          id: streamingMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        }]);

        const streamUrl = `${settings.baseUrl}/chat/completions`;
        const generator = createStreamingClient(streamUrl, {
          apiKey: settings.apiKey,
          body: {
            model: settings.defaultModel,
            messages: apiMessages,
          },
          signal: abortControllerRef.current.signal,
        });

        for await (const chunk of generator) {
          if (abortControllerRef.current.signal.aborted) {
            console.log('Streaming aborted by user.');
            break;
          }

          if (chunk.type === 'data' && typeof chunk.payload === 'object' && 'choices' in chunk.payload) {
            const delta = chunk.payload.choices[0].delta.content || '';
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.id === streamingMessageId) {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, content: lastMessage.content + delta },
                ];
              }
              return prev;
            });
          } else if (chunk.type === 'error') {
            console.error('Streaming error:', chunk.payload);
            setLLMError( (chunk.payload as {message: string}).message || 'Streaming error');
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.id === streamingMessageId) {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    content: lastMessage.content + `\n\n**Error: ${(chunk.payload as {message: string}).message || 'Stream interrupted'}**`,
                    isStreaming: false,
                    isError: true,
                  },
                ];
              }
              return prev;
            });
            break;
          }
        }

        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.id === streamingMessageId) {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, isStreaming: false, timestamp: Date.now() },
            ];
          }
          return prev;
        });

      } else {
        const response = await createChatCompletion(
          settings.baseUrl,
          settings.apiKey,
          {
            model: settings.defaultModel,
            messages: apiMessages,
          }
        );

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.choices[0].message.content,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      if (error instanceof LLMError) {
        setLLMError(error.userMessage);
        console.error(error.toLogString());
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
      }
      else {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">AI Agent</h1>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            showSettings
              ? 'text-blue-600 border-blue-600 bg-blue-50'
              : 'text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
          aria-pressed={showSettings}
        >
          Settings
        </button>
      </header>

      {showSettings ? (
        <SettingsForm
          settings={settings || DEFAULT_SETTINGS}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      ) : (
        <>
          <ContextBar
            activeTab={activeTab}
            selection={tabSelection}
            onSelectionChange={setTabSelection}
            onOpenPicker={() => setIsTabPickerOpen(true)}
          />
          <ExtractionStatus results={extractionResults} />
          <SelectedTabsBar
            tabs={selectedTabsForInput}
            includeActiveTab={tabSelection.includeActiveTab}
            activeTab={activeTab}
            onRemoveTab={handleRemoveTab}
            onToggleActiveTab={handleToggleActiveTab}
          />
          <ChatHistory
            messages={messages}
            isLoading={isLLMLoading && !isStreaming}
            error={llmError}
            isStreaming={isStreaming}
            onStop={handleStopStreaming}
          />
          <MentionInput
            onSend={handleSendMessage}
            disabled={!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel || isLLMLoading || isStreaming}
            selectedTabs={selectedTabsForInput}
            onRemoveTab={handleRemoveTab}
            availableTabs={tabs}
            onSelectTab={handleSelectTab}
            isPickerOpen={isTabPickerOpen}
            onPickerOpenChange={setIsTabPickerOpen}
          />
        </>
      )}
    </div>
  );
}

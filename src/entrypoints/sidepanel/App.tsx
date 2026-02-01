import { useState, useEffect, useCallback } from 'preact/hooks';
import ChatHistory from '../../components/ChatHistory';
import ChatInput from '../../components/ChatInput';
import SettingsForm from '../../components/SettingsForm';
import { ContextBar } from '../../components/ContextBar';
import { useTabs } from '../../hooks/useTabs';
import { getSettings, saveSettings } from '../../lib/storage';
import type { Message, Settings, TabSelection } from '../../lib/types';
import { DEFAULT_SETTINGS, DEFAULT_TAB_SELECTION } from '../../lib/types';
import { createChatCompletion } from '../../lib/llm/client';
import { LLMError } from '../../lib/llm/errors';
import type { ChatMessage } from '../../lib/llm/types';
import type { ExtractedTabContent } from '../../shared/extraction';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [llmError, setLLMError] = useState<string | null>(null);

  // Tab selection state (ephemeral - resets after sending)
  const [tabSelection, setTabSelection] = useState<TabSelection>(DEFAULT_TAB_SELECTION);
  const [isTabPickerOpen, setIsTabPickerOpen] = useState(false);

  // Extraction results state (for per-tab status display)
  const [extractionResults, setExtractionResults] = useState<ExtractedTabContent[]>([]);

  // Use tabs hook
  const { tabs, activeTab } = useTabs();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);

        // If no settings configured, show settings form
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

  const handleSaveSettings = async (newSettings: Settings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);
    setShowSettings(false);
  };

  // Get all selected tabs for context (will be used in Phase 4)
  const getSelectedTabs = useCallback(() => {
    const selected: typeof tabs = [];

    if (tabSelection.includeActiveTab && activeTab) {
      selected.push(activeTab);
    }

    for (const tabId of tabSelection.selectedTabIds) {
      const tab = tabs.find((t) => t.id === tabId);
      // Avoid duplicates (if activeTab is also in selectedTabIds)
      if (tab && tab.id !== activeTab?.id) {
        selected.push(tab);
      }
    }

    return selected;
  }, [tabSelection, tabs, activeTab]);

  const handleSendMessage = async (content: string) => {
    // Early return if settings incomplete
    if (!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel) {
      return;
    }

    // Get selected tabs before sending
    const selectedTabs = getSelectedTabs();
    console.log('Selected tabs for context:', selectedTabs.map(t => ({ id: t.id, title: t.title })));

    // Add user message to state
    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);

    // Reset tab selection after capture (CTX-03: ephemeral selection)
    setTabSelection(DEFAULT_TAB_SELECTION);
    setIsTabPickerOpen(false);

    // Reset error and set loading state
    setLLMError(null);
    setIsLLMLoading(true);

    try {
      // Extract content from selected tabs
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

      // Build system message from successful extractions
      const successfulExtractions = extractionResults.filter((r) => !r.error && r.markdown);
      let systemMessage = '';
      if (successfulExtractions.length > 0) {
        systemMessage = 'Context sources:\n\n' + successfulExtractions
          .map((r) => `## ${r.title}\nSource: ${r.url}\n\n${r.markdown}`)
          .join('\n\n');
      }

      // Build API messages from existing messages plus new user message
      const apiMessages: ChatMessage[] = [
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      // Add system message with context if available
      if (systemMessage) {
        apiMessages.push({
          role: 'system' as const,
          content: systemMessage,
        });
      }

      // Add user message
      apiMessages.push({
        role: 'user' as const,
        content,
      });

      // Call LLM API
      const response = await createChatCompletion(
        settings.baseUrl,
        settings.apiKey,
        {
          model: settings.defaultModel,
          messages: apiMessages,
        }
      );

      // Create assistant message from response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.choices[0].message.content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      if (error instanceof LLMError) {
        setLLMError(error.userMessage);
        console.error(error.toLogString());
      } else {
        setLLMError('An unexpected error occurred. Please try again.');
        console.error('LLM request error:', error);
      }
    } finally {
      setIsLLMLoading(false);
    }
  };

  const handleTriggerTabPicker = () => {
    setIsTabPickerOpen(true);
  };

  // Show loading state while fetching settings
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
            tabs={tabs}
            selection={tabSelection}
            onSelectionChange={setTabSelection}
            isPickerOpen={isTabPickerOpen}
            onPickerOpenChange={setIsTabPickerOpen}
          />
          <ChatHistory messages={messages} isLoading={isLLMLoading} error={llmError} />
          <ChatInput
            onSend={handleSendMessage}
            disabled={!settings?.baseUrl || !settings?.apiKey || !settings?.defaultModel || isLLMLoading}
            onTriggerTabPicker={handleTriggerTabPicker}
          />
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'preact/hooks';
import ChatHistory from '../../components/ChatHistory';
import ChatInput from '../../components/ChatInput';
import SettingsForm from '../../components/SettingsForm';
import { getSettings, saveSettings } from '../../lib/storage';
import type { Message, Settings } from '../../lib/types';
import { DEFAULT_SETTINGS } from '../../lib/types';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
    // Note: LLM integration comes in Phase 2
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
          <ChatHistory messages={messages} />
          <ChatInput
            onSend={handleSendMessage}
            disabled={!settings?.baseUrl || !settings?.apiKey}
          />
        </>
      )}
    </div>
  );
}

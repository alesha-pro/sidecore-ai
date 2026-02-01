import { useState } from 'preact/hooks';
import ChatHistory from '../../components/ChatHistory';
import ChatInput from '../../components/ChatInput';
import type { Message } from '../../lib/types';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);

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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">AI Agent</h1>
        <button
          type="button"
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Settings
        </button>
      </header>
      <ChatHistory messages={messages} />
      <ChatInput onSend={handleSendMessage} />
    </div>
  );
}

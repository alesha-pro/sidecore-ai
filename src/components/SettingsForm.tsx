import { useState, useEffect } from 'preact/hooks';
import type { MCPServer, Tool } from '../lib/tools';
import { getMockServers, getMockTools, getServers, getTools } from '../lib/tools';
import type { Settings, McpHeader } from '../lib/types';
import { DEFAULT_SYSTEM_PROMPT, SUPPORTED_LANGUAGES } from '../lib/types';
import { normalizeBaseUrl, validateBaseUrl } from '../lib/urlNormalization';
import { listModels } from '../lib/llm/client';
import { LLMError } from '../lib/llm/errors';

interface McpServerDraft {
  name: string;
  url: string;
  headers: McpHeader[];
}

interface SettingsFormProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  contextBudget?: string;
  systemPrompt?: string;
  agentMaxIterations?: string;
  agentTimeoutMs?: string;
}

const emptyMcpServerDraft = (): McpServerDraft => ({
  name: '',
  url: '',
  headers: [],
});

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function SettingsForm({ settings, onSave, onCancel }: SettingsFormProps) {
  const [formData, setFormData] = useState<Settings>(settings);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);

  // MCP Server draft state
  const [mcpDraft, setMcpDraft] = useState<McpServerDraft>(emptyMcpServerDraft());
  const [mcpUrlError, setMcpUrlError] = useState<string | null>(null);

  // Reset form when settings prop changes
  useEffect(() => {
    setFormData(settings);
    setErrors({});
    setSaveError(null);
    setMcpDraft(emptyMcpServerDraft());
    setMcpUrlError(null);
  }, [settings]);

  useEffect(() => {
    let isMounted = true;

    const loadTools = async () => {
      try {
        const [tools, servers] = await Promise.all([getTools(), getServers()]);

        if (!isMounted) {
          return;
        }

        if (tools.length === 0 && servers.length === 0) {
          const [mockTools, mockServers] = await Promise.all([getMockTools(), getMockServers()]);
          if (!isMounted) {
            return;
          }
          setAvailableTools(mockTools);
          setAvailableServers(mockServers);
          return;
        }

        setAvailableTools(tools);
        setAvailableServers(servers);
      } catch (error) {
        console.error('Failed to load tools:', error);
        if (!isMounted) {
          return;
        }
        setAvailableTools([]);
        setAvailableServers([]);
      }
    };

    loadTools();

    return () => {
      isMounted = false;
    };
  }, []);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Base URL validation
    const baseUrlError = validateBaseUrl(formData.baseUrl);
    if (baseUrlError) {
      newErrors.baseUrl = baseUrlError;
    }

    // API key: required (no format validation - varies by provider)
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API Key is required';
    }

    // Default model: required (string input for flexibility)
    if (!formData.defaultModel.trim()) {
      newErrors.defaultModel = 'Default model is required';
    }

    // Context budget: must be reasonable range
    if (formData.contextBudget < 1000) {
      newErrors.contextBudget = 'Minimum budget is 1,000 characters';
    } else if (formData.contextBudget > 1000000) {
      newErrors.contextBudget = 'Maximum budget is 1,000,000 characters';
    }

    // Agent max iterations: 1-25
    if (formData.agentMaxIterations < 1) {
      newErrors.agentMaxIterations = 'Minimum is 1 iteration';
    } else if (formData.agentMaxIterations > 25) {
      newErrors.agentMaxIterations = 'Maximum is 25 iterations';
    }

    // Agent timeout: 60s - 15min
    if (formData.agentTimeoutMs < 60_000) {
      newErrors.agentTimeoutMs = 'Minimum timeout is 60,000 ms (1 minute)';
    } else if (formData.agentTimeoutMs > 900_000) {
      newErrors.agentTimeoutMs = 'Maximum timeout is 900,000 ms (15 minutes)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaveError(null);

    if (!validate()) {
      return;
    }

    setIsSaving(true);

    try {
      // Normalize base URL before saving
      const normalizedSettings: Settings = {
        ...formData,
        baseUrl: normalizeBaseUrl(formData.baseUrl),
        apiKey: formData.apiKey.trim(),
        defaultModel: formData.defaultModel.trim(),
      };

      await onSave(normalizedSettings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof Settings) => (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    let value: string | number | boolean;

    if (field === 'contextBudget' || field === 'agentMaxIterations' || field === 'agentTimeoutMs') {
      value = parseInt(target.value, 10) || 0;
    } else if (field === 'showDebugPrompt' || field === 'showExtractionStatus' || field === 'agentMode') {
      value = (target as HTMLInputElement).checked;
    } else {
      value = target.value;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field as keyof FormErrors]: undefined }));
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError(null);

    try {
      const normalizedBaseUrl = normalizeBaseUrl(formData.baseUrl);
      const models = await listModels(normalizedBaseUrl, formData.apiKey);
      setConnectionStatus('success');

      // Save models to savedModels for persistence
      const modelIds = models.map(m => m.id);
      setFormData((prev) => ({
        ...prev,
        savedModels: modelIds,
        // Auto-select first model if defaultModel is empty
        defaultModel: prev.defaultModel.trim() || (modelIds[0] ?? ''),
      }));
    } catch (error) {
      setConnectionStatus('error');
      if (error instanceof LLMError) {
        setConnectionError(error.userMessage);
        console.error(error.toLogString());
      } else {
        setConnectionError('Failed to connect. Please check your settings.');
        console.error('Connection test error:', error);
      }
    }
  };


  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>

        {saveError && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {saveError}
          </div>
        )}

        {/* Section 1: LLM Provider */}
        <details open className="border border-gray-200 rounded-lg bg-white">
          <summary className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded-lg select-none">
            LLM Provider
          </summary>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 mt-2 pt-4">
            {/* Base URL */}
            <div>
              <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Base URL
              </label>
              <input
                id="baseUrl"
                type="text"
                value={formData.baseUrl}
                onInput={handleChange('baseUrl')}
                placeholder="api.openai.com"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.baseUrl ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-describedby={errors.baseUrl ? 'baseUrl-error' : 'baseUrl-hint'}
              />
              {errors.baseUrl ? (
                <p id="baseUrl-error" className="mt-1 text-sm text-red-600">
                  {errors.baseUrl}
                </p>
              ) : (
                <p id="baseUrl-hint" className="mt-1 text-xs text-gray-500">
                  Will be normalized to https://...../v1
                </p>
              )}
            </div>

            {/* API Key */}
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onInput={handleChange('apiKey')}
                placeholder="sk-..."
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.apiKey ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-describedby={errors.apiKey ? 'apiKey-error' : undefined}
              />
              {errors.apiKey && (
                <p id="apiKey-error" className="mt-1 text-sm text-red-600">
                  {errors.apiKey}
                </p>
              )}
            </div>

            {/* Test Connection */}
            <div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing' || !formData.baseUrl.trim() || !formData.apiKey.trim()}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connectionStatus === 'testing' && 'Testing...'}
                {connectionStatus === 'success' && '✓ Connected'}
                {(connectionStatus === 'idle' || connectionStatus === 'error') && 'Test Connection'}
              </button>
              {connectionError && (
                <p className="mt-2 text-sm text-red-600">{connectionError}</p>
              )}
            </div>

            {/* Default Model */}
            <div>
              <label htmlFor="defaultModel" className="block text-sm font-medium text-gray-700 mb-1">
                Default Model
              </label>
              {formData.savedModels.length > 0 ? (
                <select
                  id="defaultModel"
                  value={formData.defaultModel}
                  onChange={handleChange('defaultModel')}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.defaultModel ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-describedby={errors.defaultModel ? 'defaultModel-error' : 'defaultModel-hint'}
                >
                  <option value="">Select a model...</option>
                  {formData.savedModels.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="defaultModel"
                  type="text"
                  value={formData.defaultModel}
                  onInput={handleChange('defaultModel')}
                  placeholder="gpt-4o"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.defaultModel ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-describedby={errors.defaultModel ? 'defaultModel-error' : 'defaultModel-hint'}
                />
              )}
              {errors.defaultModel ? (
                <p id="defaultModel-error" className="mt-1 text-sm text-red-600">
                  {errors.defaultModel}
                </p>
              ) : (
                <p id="defaultModel-hint" className="mt-1 text-xs text-gray-500">
                  Click 'Test Connection' to load available models
                </p>
              )}
            </div>
          </div>
        </details>

        {/* Section 2: System Prompt */}
        <details open className="border border-gray-200 rounded-lg bg-white">
          <summary className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded-lg select-none">
            System Prompt
          </summary>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 mt-2 pt-4">
            {/* Response Language */}
            <div>
              <label htmlFor="responseLanguage" className="block text-sm font-medium text-gray-700 mb-1">
                Response Language
              </label>
              <select
                id="responseLanguage"
                value={formData.responseLanguage}
                onChange={handleChange('responseLanguage')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Language for AI responses
              </p>
            </div>

            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
              </label>
              <textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onInput={handleChange('systemPrompt')}
                rows={8}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="Define the AI assistant's role and behavior..."
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">
                  {formData.systemPrompt.length.toLocaleString()} characters
                </p>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, systemPrompt: DEFAULT_SYSTEM_PROMPT }))}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Reset to default
                </button>
              </div>
            </div>
          </div>
        </details>

        {/* Section 3: Advanced */}
        <details className="border border-gray-200 rounded-lg bg-white">
          <summary className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded-lg select-none">
            Advanced
          </summary>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 mt-2 pt-4">
            {/* Context Budget */}
            <div>
              <label htmlFor="contextBudget" className="block text-sm font-medium text-gray-700 mb-1">
                Context Budget (characters)
              </label>
              <input
                id="contextBudget"
                type="number"
                value={formData.contextBudget}
                onInput={handleChange('contextBudget')}
                min="1000"
                max="1000000"
                step="1000"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.contextBudget ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-describedby={errors.contextBudget ? 'contextBudget-error' : 'contextBudget-hint'}
              />
              {errors.contextBudget ? (
                <p id="contextBudget-error" className="mt-1 text-sm text-red-600">
                  {errors.contextBudget}
                </p>
              ) : (
                <p id="contextBudget-hint" className="mt-1 text-xs text-gray-500">
                  Maximum extracted content per request. Default: 50,000
                </p>
              )}
            </div>

            {/* Show Extraction Status */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  id="showExtractionStatus"
                  type="checkbox"
                  checked={formData.showExtractionStatus}
                  onChange={handleChange('showExtractionStatus')}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Show Extraction Status</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Shows extraction results after each message
                  </p>
                </div>
              </label>
            </div>

            {/* Show Debug Prompt */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  id="showDebugPrompt"
                  type="checkbox"
                  checked={formData.showDebugPrompt}
                  onChange={handleChange('showDebugPrompt')}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Show Debug Prompt</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Shows the full prompt being sent to the LLM
                  </p>
                </div>
              </label>
            </div>

            {/* Web Search (Exa) API Key */}
            <div>
              <label htmlFor="exaApiKey" className="block text-sm font-medium text-gray-700 mb-1">
                Web Search (Exa) API Key
              </label>
              <input
                id="exaApiKey"
                type="password"
                value={formData.exaApiKey}
                onInput={handleChange('exaApiKey')}
                placeholder="exa_..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-describedby="exaApiKey-hint"
              />
              <p id="exaApiKey-hint" className="mt-1 text-xs text-gray-500">
                Optional. Required for the Web Search tool. Get your key at exa.ai
              </p>
            </div>
          </div>
        </details>

        {/* Section 4: Agent Mode */}
        <details className="border border-gray-200 rounded-lg bg-white">
          <summary className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded-lg select-none">
            Agent Mode
          </summary>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 mt-2 pt-4">
            {/* Agent Mode Toggle */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  id="agentMode"
                  type="checkbox"
                  checked={formData.agentMode}
                  onChange={handleChange('agentMode')}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Enable Agent Mode</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Allows the AI to automatically call tools and iterate
                  </p>
                </div>
              </label>
            </div>

            {/* Max Iterations */}
            <div>
              <label htmlFor="agentMaxIterations" className="block text-sm font-medium text-gray-700 mb-1">
                Max Iterations
              </label>
              <input
                id="agentMaxIterations"
                type="number"
                value={formData.agentMaxIterations}
                onInput={handleChange('agentMaxIterations')}
                min="1"
                max="25"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.agentMaxIterations ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-describedby={errors.agentMaxIterations ? 'agentMaxIterations-error' : 'agentMaxIterations-hint'}
              />
              {errors.agentMaxIterations ? (
                <p id="agentMaxIterations-error" className="mt-1 text-sm text-red-600">
                  {errors.agentMaxIterations}
                </p>
              ) : (
                <p id="agentMaxIterations-hint" className="mt-1 text-xs text-gray-500">
                  Maximum tool call cycles (1-25). Default: 15
                </p>
              )}
            </div>

            {/* Timeout */}
            <div>
              <label htmlFor="agentTimeoutMs" className="block text-sm font-medium text-gray-700 mb-1">
                Timeout (ms)
              </label>
              <input
                id="agentTimeoutMs"
                type="number"
                value={formData.agentTimeoutMs}
                onInput={handleChange('agentTimeoutMs')}
                min="60000"
                max="900000"
                step="1000"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.agentTimeoutMs ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-describedby={errors.agentTimeoutMs ? 'agentTimeoutMs-error' : 'agentTimeoutMs-hint'}
              />
              {errors.agentTimeoutMs ? (
                <p id="agentTimeoutMs-error" className="mt-1 text-sm text-red-600">
                  {errors.agentTimeoutMs}
                </p>
              ) : (
                <p id="agentTimeoutMs-hint" className="mt-1 text-xs text-gray-500">
                  Maximum agent run time (60,000-900,000 ms). Default: 300,000 (5 min)
                </p>
              )}
            </div>
          </div>
        </details>

        {/* Section 5: Tools & Capabilities */}
        <details className="border border-gray-200 rounded-lg bg-white">
          <summary className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded-lg select-none">
            Tools &amp; Capabilities
          </summary>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 mt-2 pt-4">
            <p className="text-xs text-gray-500">
              Enable or disable specific tools and MCP servers available to Agent Mode.
            </p>

            <div>
              <div className="text-sm font-medium text-gray-900">Built-in Tools</div>
              <div className="mt-2 space-y-2">
                {availableTools.filter((tool) => tool.source === 'built-in').length === 0 ? (
                  <p className="text-xs text-gray-500">No built-in tools registered yet.</p>
                ) : (
                  availableTools
                    .filter((tool) => tool.source === 'built-in')
                    .map((tool) => (
                      <div key={tool.name} className="p-2 rounded-lg border border-gray-200">
                        <div className="text-sm font-medium text-gray-900">{tool.name}</div>
                        <div className="text-xs text-gray-500">{tool.description}</div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-900">MCP Servers</div>
              <div className="mt-2 space-y-3">
                {availableServers.length === 0 ? (
                  <p className="text-xs text-gray-500">No MCP servers connected.</p>
                ) : (
                  availableServers.map((server) => (
                    <div key={server.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {server.name || server.id}
                        </div>
                        <div className="text-xs text-gray-500">Status: {server.status}</div>
                      </div>

                      <div className="mt-3 space-y-2 pl-6">
                        {server.tools.length === 0 ? (
                          <p className="text-xs text-gray-500">No tools registered for this server.</p>
                        ) : (
                          server.tools.map((tool) => (
                            <div key={tool.name} className="p-2 rounded-lg border border-gray-200">
                              <div className="text-sm font-medium text-gray-900">{tool.name}</div>
                              <div className="text-xs text-gray-500">{tool.description}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </details>

        {/* Section 6: MCP Servers */}
        <details className="border border-gray-200 rounded-lg bg-white">
          <summary className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded-lg select-none">
            MCP Servers
          </summary>
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 mt-2 pt-4">
            <p className="text-xs text-gray-500">
              Add MCP (Model Context Protocol) servers to provide additional tools in Agent Mode.
            </p>

            {/* Existing servers list */}
            {formData.mcpServers.length > 0 && (
              <div className="space-y-2">
                {formData.mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {server.name || 'Unnamed Server'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {server.url}
                      </div>
                      {server.headers.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {server.headers.length} header{server.headers.length === 1 ? '' : 's'}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          mcpServers: prev.mcpServers.filter((s) => s.id !== server.id),
                        }));
                      }}
                      className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove server"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <title>Remove server</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new server form */}
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700">Add Server</div>

              {/* Server Name */}
              <div>
                <label htmlFor="mcpServerName" className="block text-xs text-gray-600 mb-1">
                  Name (optional)
                </label>
                <input
                  id="mcpServerName"
                  type="text"
                  value={mcpDraft.name}
                  onInput={(e) => setMcpDraft((prev) => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
                  placeholder="My MCP Server"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Server URL */}
              <div>
                <label htmlFor="mcpServerUrl" className="block text-xs text-gray-600 mb-1">
                  URL (required)
                </label>
                <input
                  id="mcpServerUrl"
                  type="text"
                  value={mcpDraft.url}
                  onInput={(e) => {
                    setMcpDraft((prev) => ({ ...prev, url: (e.target as HTMLInputElement).value }));
                    setMcpUrlError(null);
                  }}
                  placeholder="https://mcp-server.example.com/mcp"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    mcpUrlError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {mcpUrlError && (
                  <p className="mt-1 text-xs text-red-600">{mcpUrlError}</p>
                )}
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="block text-xs text-gray-600">Headers (optional)</div>
                  <button
                    type="button"
                    onClick={() => {
                      setMcpDraft((prev) => ({
                        ...prev,
                        headers: [...prev.headers, { key: '', value: '' }],
                      }));
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    + Add header
                  </button>
                </div>
                {mcpDraft.headers.length > 0 && (
                  <div className="space-y-2">
                    {mcpDraft.headers.map((header, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={header.key}
                          onInput={(e) => {
                            const newHeaders = [...mcpDraft.headers];
                            newHeaders[idx] = { ...newHeaders[idx], key: (e.target as HTMLInputElement).value };
                            setMcpDraft((prev) => ({ ...prev, headers: newHeaders }));
                          }}
                          placeholder="Header name"
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={header.value}
                          onInput={(e) => {
                            const newHeaders = [...mcpDraft.headers];
                            newHeaders[idx] = { ...newHeaders[idx], value: (e.target as HTMLInputElement).value };
                            setMcpDraft((prev) => ({ ...prev, headers: newHeaders }));
                          }}
                          placeholder="Value"
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newHeaders = mcpDraft.headers.filter((_, i) => i !== idx);
                            setMcpDraft((prev) => ({ ...prev, headers: newHeaders }));
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove header"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-4 h-4"
                          >
                            <title>Remove header</title>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Server Button */}
              <button
                type="button"
                onClick={() => {
                  // Validate URL
                  const trimmedUrl = mcpDraft.url.trim();
                  if (!trimmedUrl) {
                    setMcpUrlError('URL is required');
                    return;
                  }
                  if (!isValidHttpUrl(trimmedUrl)) {
                    setMcpUrlError('URL must be a valid http:// or https:// URL');
                    return;
                  }

                  // Create new server config
                  const newServer = {
                    id: crypto.randomUUID(),
                    name: mcpDraft.name.trim(),
                    url: trimmedUrl,
                    headers: mcpDraft.headers
                      .filter((h) => h.key.trim() && h.value.trim())
                      .map((h) => ({ key: h.key.trim(), value: h.value.trim() })),
                  };

                  // Add to formData
                  setFormData((prev) => ({
                    ...prev,
                    mcpServers: [...prev.mcpServers, newServer],
                  }));

                  // Reset draft
                  setMcpDraft(emptyMcpServerDraft());
                  setMcpUrlError(null);
                }}
                disabled={!mcpDraft.url.trim()}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Server
              </button>
            </div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

import type { ComponentChildren } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { MCPServer, Tool } from '../lib/tools';
import { getMockServers, getMockTools, getServers, getTools } from '../lib/tools';
import type { Settings, McpHeader } from '../lib/types';
import { DEFAULT_SYSTEM_PROMPT, SUPPORTED_LANGUAGES, LLM_PROVIDERS } from '../lib/types';
import { normalizeBaseUrl, validateBaseUrl } from '../lib/urlNormalization';
import { listModels } from '../lib/llm/client';
import { LLMError } from '../lib/llm/errors';
import { applyTheme } from '../hooks/useTheme';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../lib/utils';
import { Input } from './ui/Input';
import { Toggle } from './ui/Toggle';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Divider } from './ui/Divider';

interface McpServerDraft {
  name: string;
  url: string;
  headers: McpHeader[];
}

interface SettingsFormProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onCancel: () => void;
  header?: ComponentChildren;
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

function getProviderFromUrl(url: string): string {
  const normalized = url.trim().toLowerCase();
  const provider = LLM_PROVIDERS.find(
    p => p.id !== 'custom' && normalized === p.baseUrl.toLowerCase()
  );
  return provider?.id ?? 'custom';
}

export default function SettingsForm({ settings, onSave, onCancel, header }: SettingsFormProps) {
  const [formData, setFormData] = useState<Settings>(settings);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const savedThemeRef = useRef(settings.theme);

  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);

  // Provider selection state
  const [selectedProvider, setSelectedProvider] = useState(() =>
    getProviderFromUrl(settings.baseUrl)
  );

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
    savedThemeRef.current = settings.theme;
    setSelectedProvider(getProviderFromUrl(settings.baseUrl));
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

      console.log('[SettingsForm] Saving settings, mcpServers:', normalizedSettings.mcpServers);

      await onSave(normalizedSettings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = (mode: Settings['theme']) => {
    setFormData((prev) => ({
      ...prev,
      theme: mode,
    }));
    applyTheme(mode);
  };

  const handleCancel = () => {
    applyTheme(savedThemeRef.current);
    onCancel();
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

  const handleProviderChange = (e: Event) => {
    const providerId = (e.target as HTMLSelectElement).value;
    setSelectedProvider(providerId);

    const provider = LLM_PROVIDERS.find(p => p.id === providerId);
    if (provider && provider.id !== 'custom') {
      setFormData(prev => ({ ...prev, baseUrl: provider.baseUrl }));
      // Clear baseUrl error since we're using a known-good URL
      setErrors(prev => ({ ...prev, baseUrl: undefined }));
      // Reset connection status since URL changed
      setConnectionStatus('idle');
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

  const handleToolToggle = (toolName: string) => {
    setFormData((prev) => {
      const isDisabled = prev.disabledTools.includes(toolName);
      const disabledTools = isDisabled
        ? prev.disabledTools.filter((name) => name !== toolName)
        : [...prev.disabledTools, toolName];

      return {
        ...prev,
        disabledTools,
      };
    });
  };

  const handleServerToggle = (serverId: string) => {
    setFormData((prev) => {
      const isDisabled = prev.disabledServers.includes(serverId);
      const disabledServers = isDisabled
        ? prev.disabledServers.filter((id) => id !== serverId)
        : [...prev.disabledServers, serverId];

      return {
        ...prev,
        disabledServers,
      };
    });
  };


  return (
    <div className={cn(
      'flex-1 overflow-y-auto p-6',
      'bg-background dark:bg-background-dark'
    )}>
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
        <h2 className={cn(
          'text-xl font-semibold',
          'text-text-primary dark:text-text-primary-dark'
        )}>Settings</h2>

        {header && (
          <div>
            {header}
          </div>
        )}

        <details open className={cn(
          'rounded-lg border border-border bg-surface',
          'dark:bg-surface-dark dark:border-border-dark'
        )}>
          <summary className={cn(
            'px-4 py-3 cursor-pointer select-none',
            'text-base font-semibold text-text-primary',
            'hover:bg-surface-hover',
            'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
          )}>
            Appearance
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3">
            <ThemeToggle value={formData.theme} onChange={handleThemeChange} />
          </div>
        </details>

        {saveError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:text-red-400 dark:bg-red-950 dark:border-red-900">
            {saveError}
          </div>
        )}

        {/* Section 1: LLM Provider */}
        <details open className={cn(
          'rounded-lg border border-border bg-surface',
          'dark:bg-surface-dark dark:border-border-dark'
        )}>
          <summary className={cn(
            'px-4 py-3 cursor-pointer select-none',
            'text-base font-semibold text-text-primary',
            'hover:bg-surface-hover',
            'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
          )}>
            LLM Provider
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            {/* Provider */}
            <Select
              id="provider"
              label="Provider"
              value={selectedProvider}
              onChange={handleProviderChange}
            >
              {LLM_PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </Select>

            {/* Base URL */}
            <Input
              id="baseUrl"
              label="Base URL"
              type="text"
              value={formData.baseUrl}
              onInput={(e) => {
                handleChange('baseUrl')(e);
                setSelectedProvider('custom');
                setConnectionStatus('idle');
              }}
              placeholder="api.openai.com"
              error={errors.baseUrl}
            />
            {!errors.baseUrl && (
              <p className={cn(
                'mt-1 text-xs',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Will be normalized to https://...../v1
              </p>
            )}

            {/* API Key */}
            <Input
              id="apiKey"
              label="API Key"
              type="password"
              value={formData.apiKey}
              onInput={handleChange('apiKey')}
              placeholder="sk-..."
              error={errors.apiKey}
            />

            {/* Test Connection */}
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing' || !formData.baseUrl.trim() || !formData.apiKey.trim()}
                className="w-full"
              >
                {connectionStatus === 'testing' && 'Testing...'}
                {connectionStatus === 'success' && '✓ Connected'}
                {(connectionStatus === 'idle' || connectionStatus === 'error') && 'Test Connection'}
              </Button>
              {connectionError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{connectionError}</p>
              )}
            </div>

            {/* Default Model */}
            {formData.savedModels.length > 0 ? (
              <Select
                id="defaultModel"
                label="Default Model"
                value={formData.defaultModel}
                onChange={handleChange('defaultModel')}
                error={errors.defaultModel}
              >
                <option value="">Select a model...</option>
                {formData.savedModels.map((modelId) => (
                  <option key={modelId} value={modelId}>
                    {modelId}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id="defaultModel"
                label="Default Model"
                type="text"
                value={formData.defaultModel}
                onInput={handleChange('defaultModel')}
                placeholder="gpt-4o"
                error={errors.defaultModel}
              />
            )}
            {!errors.defaultModel && (
              <p className={cn(
                'mt-1 text-xs',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Click 'Test Connection' to load available models
              </p>
            )}
          </div>
        </details>

        {/* Section 2: System Prompt */}
        <details open className={cn(
          'rounded-lg border border-border bg-surface',
          'dark:bg-surface-dark dark:border-border-dark'
        )}>
          <summary className={cn(
            'px-4 py-3 cursor-pointer select-none',
            'text-base font-semibold text-text-primary',
            'hover:bg-surface-hover',
            'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
          )}>
            System Prompt
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            {/* Response Language */}
            <Select
              id="responseLanguage"
              label="Response Language"
              value={formData.responseLanguage}
              onChange={handleChange('responseLanguage')}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </Select>
            <p className={cn(
              'mt-1 text-xs',
              'text-text-secondary dark:text-text-secondary-dark'
            )}>
              Language for AI responses
            </p>

            <div>
              <label htmlFor="systemPrompt" className={cn(
                'block text-sm font-medium mb-1',
                'text-text-primary dark:text-text-primary-dark'
              )}>
                System Prompt
              </label>
              <textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onInput={handleChange('systemPrompt')}
                rows={8}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-md border font-mono',
                  'bg-background border-border text-text-primary',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                  'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
                )}
                placeholder="Define the AI assistant's role and behavior..."
              />
              <div className="flex justify-between mt-1">
                <p className={cn(
                  'text-xs',
                  'text-text-secondary dark:text-text-secondary-dark'
                )}>
                  {formData.systemPrompt.length.toLocaleString()} characters
                </p>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, systemPrompt: DEFAULT_SYSTEM_PROMPT }))}
                  className={cn(
                    'text-xs',
                    'text-accent hover:opacity-80',
                    'dark:text-accent-dark'
                  )}
                >
                  Reset to default
                </button>
              </div>
            </div>
          </div>
        </details>

        {/* Section 3: Advanced */}
        <details className={cn(
          'rounded-lg border border-border bg-surface',
          'dark:bg-surface-dark dark:border-border-dark'
        )}>
          <summary className={cn(
            'px-4 py-3 cursor-pointer select-none',
            'text-base font-semibold text-text-primary',
            'hover:bg-surface-hover',
            'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
          )}>
            Advanced
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            {/* Context Budget */}
            <Input
              id="contextBudget"
              label="Context Budget (characters)"
              type="number"
              value={formData.contextBudget}
              onInput={handleChange('contextBudget')}
              min="1000"
              max="1000000"
              step="1000"
              error={errors.contextBudget}
            />
            {!errors.contextBudget && (
              <p className={cn(
                'mt-1 text-xs',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Maximum extracted content per request. Default: 50,000
              </p>
            )}

            {/* Show Extraction Status */}
            <div className="flex flex-col gap-1">
              <Toggle
                checked={formData.showExtractionStatus}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showExtractionStatus: checked }))}
                label="Show Extraction Status"
              />
              <p className={cn(
                'text-xs ml-11',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Shows extraction results after each message
              </p>
            </div>

            {/* Show Debug Prompt */}
            <div className="flex flex-col gap-1">
              <Toggle
                checked={formData.showDebugPrompt}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showDebugPrompt: checked }))}
                label="Show Debug Prompt"
              />
              <p className={cn(
                'text-xs ml-11',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Shows the full prompt being sent to the LLM
              </p>
            </div>
          </div>
        </details>

        {/* Section 4: Agent Settings */}
        <details className={cn(
          'rounded-lg border border-border bg-surface',
          'dark:bg-surface-dark dark:border-border-dark'
        )}>
          <summary className={cn(
            'px-4 py-3 cursor-pointer select-none',
            'text-base font-semibold text-text-primary',
            'hover:bg-surface-hover',
            'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
          )}>
            Agent Settings
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            <p className={cn(
              'text-xs',
              'text-text-secondary dark:text-text-secondary-dark'
            )}>
              Configure limits for the AI agent's tool execution behavior.
            </p>

            {/* Max Iterations */}
            <Input
              id="agentMaxIterations"
              label="Max Iterations"
              type="number"
              value={formData.agentMaxIterations}
              onInput={handleChange('agentMaxIterations')}
              min="1"
              max="25"
              error={errors.agentMaxIterations}
            />
            {!errors.agentMaxIterations && (
              <p className={cn(
                'mt-1 text-xs',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Maximum tool call cycles (1-25). Default: 15
              </p>
            )}

            {/* Timeout */}
            <Input
              id="agentTimeoutMs"
              label="Timeout (ms)"
              type="number"
              value={formData.agentTimeoutMs}
              onInput={handleChange('agentTimeoutMs')}
              min="60000"
              max="900000"
              step="1000"
              error={errors.agentTimeoutMs}
            />
            {!errors.agentTimeoutMs && (
              <p className={cn(
                'mt-1 text-xs',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Maximum agent run time (60,000-900,000 ms). Default: 300,000 (5 min)
              </p>
            )}
          </div>
        </details>

        {/* Section 5: Tools & Capabilities */}
        <details className={cn(
          'rounded-lg border border-border bg-surface',
          'dark:bg-surface-dark dark:border-border-dark'
        )}>
          <summary className={cn(
            'px-4 py-3 cursor-pointer select-none',
            'text-base font-semibold text-text-primary',
            'hover:bg-surface-hover',
            'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
          )}>
            Tools &amp; Capabilities
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            <p className={cn(
              'text-xs',
              'text-text-secondary dark:text-text-secondary-dark'
            )}>
              Enable or disable specific tools and MCP servers available to Agent Mode.
            </p>

            <div>
              <div className={cn(
                'text-sm font-medium',
                'text-text-primary dark:text-text-primary-dark'
              )}>Built-in Tools</div>
              <div className="mt-2 space-y-2">
                {availableTools.filter((tool) => tool.source === 'built-in').length === 0 ? (
                  <p className={cn(
                    'text-xs',
                    'text-text-secondary dark:text-text-secondary-dark'
                  )}>No built-in tools registered yet.</p>
                ) : (
                  availableTools
                    .filter((tool) => tool.source === 'built-in')
                    .map((tool) => {
                      const isDisabled = formData.disabledTools.includes(tool.name);
                      return (
                        <label
                          key={tool.name}
                          className={cn(
                            'flex items-start gap-2 p-2 rounded-lg border',
                            isDisabled
                              ? 'bg-surface-hover border-border opacity-60'
                              : 'bg-background border-border',
                            'dark:bg-background-dark dark:border-border-dark'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={!isDisabled}
                            onChange={() => handleToolToggle(tool.name)}
                            className="mt-1 h-4 w-4 rounded focus:ring-2 focus:ring-accent"
                          />
                          <div className="min-w-0">
                            <div className={cn(
                              'text-sm font-medium',
                              'text-text-primary dark:text-text-primary-dark'
                            )}>{tool.name}</div>
                            <div className={cn(
                              'text-xs',
                              'text-text-secondary dark:text-text-secondary-dark'
                            )}>{tool.description}</div>
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            </div>

            <div>
              <div className={cn(
                'text-sm font-medium',
                'text-text-primary dark:text-text-primary-dark'
              )}>MCP Servers</div>
              <div className="mt-2 space-y-3">
                {availableServers.length === 0 ? (
                  <p className={cn(
                    'text-xs',
                    'text-text-secondary dark:text-text-secondary-dark'
                  )}>No MCP servers connected.</p>
                ) : (
                  availableServers.map((server) => {
                    const serverDisabled = formData.disabledServers.includes(server.id);
                    return (
                      <div key={server.id} className={cn(
                        'border border-border rounded-lg p-3',
                        'dark:border-border-dark'
                      )}>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!serverDisabled}
                            onChange={() => handleServerToggle(server.id)}
                            className="mt-1 h-4 w-4 rounded focus:ring-2 focus:ring-accent"
                          />
                          <div className="min-w-0">
                            <div className={cn(
                              'text-sm font-medium',
                              'text-text-primary dark:text-text-primary-dark'
                            )}>
                              {server.name || server.id}
                            </div>
                            <div className={cn(
                              'text-xs',
                              'text-text-secondary dark:text-text-secondary-dark'
                            )}>Status: {server.status}</div>
                          </div>
                        </label>

                        <div className={cn(
                          'mt-3 space-y-2 pl-6',
                          serverDisabled && 'opacity-50'
                        )}>
                          {server.tools.length === 0 ? (
                            <p className={cn(
                              'text-xs',
                              'text-text-secondary dark:text-text-secondary-dark'
                            )}>No tools registered for this server.</p>
                          ) : (
                            server.tools.map((tool) => {
                              const toolDisabled = formData.disabledTools.includes(tool.name);
                              return (
                                <label
                                  key={tool.name}
                                  className={cn(
                                    'flex items-start gap-2 p-2 rounded-lg border',
                                    serverDisabled || toolDisabled
                                      ? 'bg-surface-hover border-border opacity-60'
                                      : 'bg-background border-border',
                                    'dark:bg-background-dark dark:border-border-dark'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!toolDisabled}
                                    onChange={() => handleToolToggle(tool.name)}
                                    disabled={serverDisabled}
                                    className="mt-1 h-4 w-4 rounded focus:ring-2 focus:ring-accent"
                                  />
                                  <div className="min-w-0">
                                    <div className={cn(
                                      'text-sm font-medium',
                                      'text-text-primary dark:text-text-primary-dark'
                                    )}>{tool.name}</div>
                                    <div className={cn(
                                      'text-xs',
                                      'text-text-secondary dark:text-text-secondary-dark'
                                    )}>{tool.description}</div>
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </details>

        {/* Section 6: MCP Servers */}
        <details className={cn(
          'rounded-lg border border-border bg-surface',
          'dark:bg-surface-dark dark:border-border-dark'
        )}>
          <summary className={cn(
            'px-4 py-3 cursor-pointer select-none',
            'text-base font-semibold text-text-primary',
            'hover:bg-surface-hover',
            'dark:text-text-primary-dark dark:hover:bg-surface-hover-dark'
          )}>
            MCP Servers
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            <p className={cn(
              'text-xs',
              'text-text-secondary dark:text-text-secondary-dark'
            )}>
              Add MCP (Model Context Protocol) servers to provide additional tools in Agent Mode.
            </p>

            {/* Existing servers list */}
            {formData.mcpServers.length > 0 && (
              <div className="space-y-2">
                {formData.mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      'bg-surface-hover',
                      'dark:bg-surface-hover-dark'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        'text-sm font-medium truncate',
                        'text-text-primary dark:text-text-primary-dark'
                      )}>
                        {server.name || 'Unnamed Server'}
                      </div>
                      <div className={cn(
                        'text-xs truncate',
                        'text-text-secondary dark:text-text-secondary-dark'
                      )}>
                        {server.url}
                      </div>
                      {server.headers.length > 0 && (
                        <div className={cn(
                          'text-xs mt-1',
                          'text-text-tertiary dark:text-text-tertiary-dark'
                        )}>
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
                      className={cn(
                        'ml-2 p-1 transition-colors',
                        'text-text-tertiary hover:text-red-600',
                        'dark:text-text-tertiary-dark dark:hover:text-red-400'
                      )}
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
            <div className={cn(
              'space-y-3 pt-2 border-t',
              'border-border dark:border-border-dark'
            )}>
              <div className={cn(
                'text-sm font-medium',
                'text-text-primary dark:text-text-primary-dark'
              )}>Add Server</div>

              {/* Server Name */}
              <Input
                id="mcpServerName"
                label="Name (optional)"
                type="text"
                value={mcpDraft.name}
                onInput={(e) => setMcpDraft((prev) => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
                placeholder="My MCP Server"
              />

              {/* Server URL */}
              <Input
                id="mcpServerUrl"
                label="URL (required)"
                type="text"
                value={mcpDraft.url}
                onInput={(e) => {
                  setMcpDraft((prev) => ({ ...prev, url: (e.target as HTMLInputElement).value }));
                  setMcpUrlError(null);
                }}
                placeholder="https://mcp-server.example.com/mcp"
                error={mcpUrlError || undefined}
              />

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-1">
                <div className={cn(
                  'block text-xs',
                  'text-text-secondary dark:text-text-secondary-dark'
                )}>Headers (optional)</div>
                <button
                    type="button"
                    onClick={() => {
                      setMcpDraft((prev) => ({
                        ...prev,
                        headers: [...prev.headers, { key: '', value: '' }],
                      }));
                    }}
                    className={cn(
                      'text-xs',
                      'text-accent hover:opacity-80',
                      'dark:text-accent-dark'
                    )}
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
                          className={cn(
                            'flex-1 px-2 py-1.5 text-sm rounded border',
                            'bg-background border-border text-text-primary',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
                          )}
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
                          className={cn(
                            'flex-1 px-2 py-1.5 text-sm rounded border',
                            'bg-background border-border text-text-primary',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newHeaders = mcpDraft.headers.filter((_, i) => i !== idx);
                            setMcpDraft((prev) => ({ ...prev, headers: newHeaders }));
                          }}
                          className={cn(
                            'p-1.5 transition-colors',
                            'text-text-tertiary hover:text-red-600',
                            'dark:text-text-tertiary-dark dark:hover:text-red-400'
                          )}
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
              <Button
                type="button"
                variant="secondary"
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
                className="w-full"
              >
                Add Server
              </Button>
            </div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

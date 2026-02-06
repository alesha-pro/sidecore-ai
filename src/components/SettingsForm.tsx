import type { ComponentChildren } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { MCPServer, Tool } from '../lib/tools';
import { getMockServers, getMockTools, getServers, getTools } from '../lib/tools';
import type { Settings, McpHeader } from '../lib/types';
import { DEFAULT_SYSTEM_PROMPT, SUPPORTED_LANGUAGES, LLM_PROVIDERS } from '../lib/types';
import type { SlashCommand } from '../lib/types';
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
  onAutoSave?: (settings: Settings) => Promise<void>;
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
  modelContextLimit?: string;
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

export default function SettingsForm({ settings, onSave, onAutoSave, onCancel, header }: SettingsFormProps) {
  const [formData, setFormData] = useState<Settings>(settings);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const savedThemeRef = useRef(settings.theme);
  const isAutoSaving = useRef(false);

  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);

  // Provider selection state
  const [selectedProvider, setSelectedProvider] = useState(() =>
    getProviderFromUrl(settings.baseUrl)
  );

  // MCP Server draft state
  const [mcpDraft, setMcpDraft] = useState<McpServerDraft>(emptyMcpServerDraft());
  const [mcpUrlError, setMcpUrlError] = useState<string | null>(null);

  // Title generation provider state
  const [titleGenSelectedProvider, setTitleGenSelectedProvider] = useState(() =>
    getProviderFromUrl(settings.titleGenBaseUrl)
  );
  const [titleGenConnectionStatus, setTitleGenConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [titleGenConnectionError, setTitleGenConnectionError] = useState<string | null>(null);

  // Slash command editing state
  const [editingCommand, setEditingCommand] = useState<SlashCommand | null>(null);
  const [commandDraft, setCommandDraft] = useState({ name: '', description: '', prompt: '' });
  const [commandError, setCommandError] = useState<string | null>(null);

  // Reset form when settings prop changes (skip for auto-save to preserve editing states)
  useEffect(() => {
    if (isAutoSaving.current) return;
    setFormData(settings);
    setErrors({});
    setSaveError(null);
    setMcpDraft(emptyMcpServerDraft());
    setMcpUrlError(null);
    savedThemeRef.current = settings.theme;
    setSelectedProvider(getProviderFromUrl(settings.baseUrl));
    setTitleGenSelectedProvider(getProviderFromUrl(settings.titleGenBaseUrl));
    setTitleGenConnectionStatus('idle');
    setTitleGenConnectionError(null);
    setEditingCommand(null);
    setCommandDraft({ name: '', description: '', prompt: '' });
    setCommandError(null);
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

    // Model context limit: must be reasonable range
    if (formData.modelContextLimit < 4000) {
      newErrors.modelContextLimit = 'Minimum is 4,000 tokens';
    } else if (formData.modelContextLimit > 2000000) {
      newErrors.modelContextLimit = 'Maximum is 2,000,000 tokens';
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

    if (field === 'contextBudget' || field === 'modelContextLimit' || field === 'agentMaxIterations' || field === 'agentTimeoutMs') {
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

  const handleTitleGenProviderChange = (e: Event) => {
    const providerId = (e.target as HTMLSelectElement).value;
    setTitleGenSelectedProvider(providerId);
    const provider = LLM_PROVIDERS.find(p => p.id === providerId);
    if (provider && provider.id !== 'custom') {
      setFormData(prev => ({ ...prev, titleGenBaseUrl: provider.baseUrl }));
      setTitleGenConnectionStatus('idle');
    }
  };

  const handleTitleGenTestConnection = async () => {
    setTitleGenConnectionStatus('testing');
    setTitleGenConnectionError(null);
    try {
      const normalizedBaseUrl = normalizeBaseUrl(formData.titleGenBaseUrl);
      const models = await listModels(normalizedBaseUrl, formData.titleGenApiKey);
      setTitleGenConnectionStatus('success');
      const modelIds = models.map(m => m.id);
      setFormData((prev) => ({
        ...prev,
        titleGenSavedModels: modelIds,
        titleGenModel: prev.titleGenModel.trim() || (modelIds[0] ?? ''),
      }));
    } catch (error) {
      setTitleGenConnectionStatus('error');
      if (error instanceof LLMError) {
        setTitleGenConnectionError(error.userMessage);
      } else {
        setTitleGenConnectionError('Failed to connect. Please check your settings.');
      }
    }
  };

  // Auto-save for CRUD operations (profiles, commands, MCP servers)
  // Uses onAutoSave (no navigation) when available, falls back to onSave
  const persistSettings = (updatedData: Settings) => {
    isAutoSaving.current = true;
    const normalized: Settings = {
      ...updatedData,
      baseUrl: normalizeBaseUrl(updatedData.baseUrl),
      apiKey: updatedData.apiKey.trim(),
      defaultModel: updatedData.defaultModel.trim(),
    };
    const save = onAutoSave ?? onSave;
    save(normalized).catch(err => {
      console.error('[SettingsForm] Auto-save failed:', err);
    }).finally(() => {
      setTimeout(() => { isAutoSaving.current = false; }, 50);
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


        {/* Section: Slash Commands */}
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
            Slash Commands
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            <p className={cn(
              'text-xs',
              'text-text-secondary dark:text-text-secondary-dark'
            )}>
              Create custom slash commands (e.g., /review, /fix) with prompt templates that appear when you type "/" in chat.
            </p>

            {/* Command list */}
            <div className="space-y-2">
              {formData.customSlashCommands.map((command) => (
                <div
                  key={command.id}
                  className={cn(
                    'flex items-start justify-between p-2 rounded-lg',
                    'bg-surface-hover dark:bg-surface-hover-dark'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      'text-sm font-medium truncate',
                      'text-text-primary dark:text-text-primary-dark'
                    )}>
                      /{command.name}
                    </div>
                    <div className={cn(
                      'text-xs truncate',
                      'text-text-secondary dark:text-text-secondary-dark'
                    )}>
                      {command.description || command.prompt.slice(0, 60) + (command.prompt.length > 60 ? '...' : '')}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommand(command);
                        setCommandDraft({ name: command.name, description: command.description, prompt: command.prompt });
                        setCommandError(null);
                      }}
                      className={cn(
                        'p-1 transition-colors',
                        'text-text-tertiary hover:text-text-primary',
                        'dark:text-text-tertiary-dark dark:hover:text-text-primary-dark'
                      )}
                      title="Edit command"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <title>Edit</title>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newCommands = formData.customSlashCommands.filter(c => c.id !== command.id);
                        const updated = { ...formData, customSlashCommands: newCommands };
                        setFormData(updated);
                        persistSettings(updated);
                      }}
                      className={cn(
                        'p-1 transition-colors',
                        'text-text-tertiary hover:text-red-600',
                        'dark:text-text-tertiary-dark dark:hover:text-red-400'
                      )}
                      title="Delete command"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <title>Delete</title>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit/Create command form */}
            {editingCommand ? (
              <div className={cn(
                'space-y-3 pt-2 border-t',
                'border-border dark:border-border-dark'
              )}>
                <div className={cn(
                  'text-sm font-medium',
                  'text-text-primary dark:text-text-primary-dark'
                )}>Edit Command</div>
                <div>
                  <Input
                    id="commandName"
                    label="Name"
                    type="text"
                    value={commandDraft.name}
                    onInput={(e) => {
                      setCommandDraft(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }));
                      setCommandError(null);
                    }}
                    placeholder="review"
                  />
                  <p className={cn(
                    'mt-1 text-xs',
                    'text-text-secondary dark:text-text-secondary-dark'
                  )}>
                    Command name (letters, numbers, hyphens, underscores)
                  </p>
                </div>
                <Input
                  id="commandDescription"
                  label="Description"
                  type="text"
                  value={commandDraft.description}
                  onInput={(e) => {
                    setCommandDraft(prev => ({ ...prev, description: (e.target as HTMLInputElement).value }));
                    setCommandError(null);
                  }}
                  placeholder="Review code for issues"
                />
                <div>
                  <label htmlFor="commandPrompt" className={cn(
                    'block text-sm font-medium mb-1',
                    'text-text-primary dark:text-text-primary-dark'
                  )}>Prompt</label>
                  <textarea
                    id="commandPrompt"
                    value={commandDraft.prompt}
                    onInput={(e) => {
                      setCommandDraft(prev => ({ ...prev, prompt: (e.target as HTMLTextAreaElement).value }));
                      setCommandError(null);
                    }}
                    rows={4}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-md border font-mono',
                      'bg-background border-border text-text-primary',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                      'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
                    )}
                    placeholder="Review the following code for bugs, security issues..."
                  />
                </div>
                {commandError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{commandError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const trimmedName = commandDraft.name.trim();
                      const trimmedPrompt = commandDraft.prompt.trim();
                      if (!trimmedName) { setCommandError('Name is required'); return; }
                      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) { setCommandError('Name can only contain letters, numbers, hyphens, and underscores'); return; }
                      if (!trimmedPrompt) { setCommandError('Prompt is required'); return; }
                      const updated = {
                        ...formData,
                        customSlashCommands: formData.customSlashCommands.map(c =>
                          c.id === editingCommand.id
                            ? { ...c, name: trimmedName, description: commandDraft.description.trim(), prompt: trimmedPrompt }
                            : c
                        ),
                      };
                      setFormData(updated);
                      persistSettings(updated);
                      setEditingCommand(null);
                      setCommandDraft({ name: '', description: '', prompt: '' });
                    }}
                    className="flex-1"
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setEditingCommand(null); setCommandDraft({ name: '', description: '', prompt: '' }); setCommandError(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className={cn(
                'space-y-3 pt-2 border-t',
                'border-border dark:border-border-dark'
              )}>
                <div className={cn(
                  'text-sm font-medium',
                  'text-text-primary dark:text-text-primary-dark'
                )}>Add Command</div>
                <div>
                  <Input
                    id="newCommandName"
                    label="Name"
                    type="text"
                    value={commandDraft.name}
                    onInput={(e) => {
                      setCommandDraft(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }));
                      setCommandError(null);
                    }}
                    placeholder="review"
                  />
                  <p className={cn(
                    'mt-1 text-xs',
                    'text-text-secondary dark:text-text-secondary-dark'
                  )}>
                    Command name (letters, numbers, hyphens, underscores)
                  </p>
                </div>
                <Input
                  id="newCommandDescription"
                  label="Description"
                  type="text"
                  value={commandDraft.description}
                  onInput={(e) => {
                    setCommandDraft(prev => ({ ...prev, description: (e.target as HTMLInputElement).value }));
                    setCommandError(null);
                  }}
                  placeholder="Review code for issues"
                />
                <div>
                  <label htmlFor="newCommandPrompt" className={cn(
                    'block text-sm font-medium mb-1',
                    'text-text-primary dark:text-text-primary-dark'
                  )}>Prompt</label>
                  <textarea
                    id="newCommandPrompt"
                    value={commandDraft.prompt}
                    onInput={(e) => {
                      setCommandDraft(prev => ({ ...prev, prompt: (e.target as HTMLTextAreaElement).value }));
                      setCommandError(null);
                    }}
                    rows={4}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-md border font-mono',
                      'bg-background border-border text-text-primary',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                      'dark:bg-background-dark dark:border-border-dark dark:text-text-primary-dark'
                    )}
                    placeholder="Review the following code for bugs, security issues..."
                  />
                </div>
                {commandError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{commandError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const trimmedName = commandDraft.name.trim();
                      const trimmedPrompt = commandDraft.prompt.trim();
                      if (!trimmedName) { setCommandError('Name is required'); return; }
                      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) { setCommandError('Name can only contain letters, numbers, hyphens, and underscores'); return; }
                      if (!trimmedPrompt) { setCommandError('Prompt is required'); return; }
                      const newCommand: SlashCommand = {
                        id: crypto.randomUUID(),
                        name: trimmedName,
                        description: commandDraft.description.trim(),
                        prompt: trimmedPrompt,
                      };
                      const updated = {
                        ...formData,
                        customSlashCommands: [...formData.customSlashCommands, newCommand],
                      };
                      setFormData(updated);
                      persistSettings(updated);
                      setCommandDraft({ name: '', description: '', prompt: '' });
                      setCommandError(null);
                    }}
                    className="flex-1"
                    disabled={!commandDraft.name.trim() || !commandDraft.prompt.trim()}
                  >
                    Add Command
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const updated = { ...formData, customSlashCommands: [] };
                      setFormData(updated);
                      persistSettings(updated);
                    }}
                  >
                    Reset Defaults
                  </Button>
                </div>
              </div>
            )}
          </div>
        </details>

        {/* Section: Title Generation */}
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
            Title Generation
          </summary>
          <Divider className="my-0" />
          <div className="px-4 pb-4 pt-3 space-y-4">
            <p className={cn(
              'text-xs',
              'text-text-secondary dark:text-text-secondary-dark'
            )}>
              Automatically generate chat titles using LLM after the first response.
            </p>

            <div className="flex flex-col gap-1">
              <Toggle
                checked={formData.titleGenEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, titleGenEnabled: checked }))}
                label="Enable Title Generation"
              />
            </div>

            {formData.titleGenEnabled && (
              <>
                <div className="flex flex-col gap-1">
                  <Toggle
                    checked={formData.titleGenUseSameProvider}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, titleGenUseSameProvider: checked }))}
                    label="Use same provider as main model"
                  />
                </div>

                {!formData.titleGenUseSameProvider && (
                  <>
                    <Select
                      id="titleGenProvider"
                      label="Provider"
                      value={titleGenSelectedProvider}
                      onChange={handleTitleGenProviderChange}
                    >
                      {LLM_PROVIDERS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </Select>

                    <Input
                      id="titleGenBaseUrl"
                      label="Base URL"
                      type="text"
                      value={formData.titleGenBaseUrl}
                      onInput={(e) => {
                        setFormData(prev => ({ ...prev, titleGenBaseUrl: (e.target as HTMLInputElement).value }));
                        setTitleGenSelectedProvider('custom');
                        setTitleGenConnectionStatus('idle');
                      }}
                      placeholder="api.openai.com"
                    />

                    <Input
                      id="titleGenApiKey"
                      label="API Key"
                      type="password"
                      value={formData.titleGenApiKey}
                      onInput={(e) => setFormData(prev => ({ ...prev, titleGenApiKey: (e.target as HTMLInputElement).value }))}
                      placeholder="sk-..."
                    />

                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleTitleGenTestConnection}
                        disabled={titleGenConnectionStatus === 'testing' || !formData.titleGenBaseUrl.trim() || !formData.titleGenApiKey.trim()}
                        className="w-full"
                      >
                        {titleGenConnectionStatus === 'testing' && 'Testing...'}
                        {titleGenConnectionStatus === 'success' && '\u2713 Connected'}
                        {(titleGenConnectionStatus === 'idle' || titleGenConnectionStatus === 'error') && 'Test Connection'}
                      </Button>
                      {titleGenConnectionError && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{titleGenConnectionError}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Model selector */}
                {(() => {
                  const modelsList = formData.titleGenUseSameProvider
                    ? formData.savedModels
                    : formData.titleGenSavedModels;
                  return modelsList.length > 0 ? (
                    <Select
                      id="titleGenModel"
                      label="Model"
                      value={formData.titleGenModel}
                      onChange={(e) => setFormData(prev => ({ ...prev, titleGenModel: (e.target as HTMLSelectElement).value }))}
                    >
                      <option value="">Use default model</option>
                      {modelsList.map((modelId) => (
                        <option key={modelId} value={modelId}>
                          {modelId}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id="titleGenModel"
                      label="Model"
                      type="text"
                      value={formData.titleGenModel}
                      onInput={(e) => setFormData(prev => ({ ...prev, titleGenModel: (e.target as HTMLInputElement).value }))}
                      placeholder="gpt-4o-mini (leave empty for default)"
                    />
                  );
                })()}
              </>
            )}
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

            {/* Model Context Limit */}
            <Input
              id="modelContextLimit"
              label="Model Context Limit (tokens)"
              type="number"
              value={formData.modelContextLimit}
              onInput={handleChange('modelContextLimit')}
              min="4000"
              max="2000000"
              step="1000"
              error={errors.modelContextLimit}
            />
            {!errors.modelContextLimit && (
              <p className={cn(
                'mt-1 text-xs',
                'text-text-secondary dark:text-text-secondary-dark'
              )}>
                Maximum tokens for conversation context. Default: 128,000
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
                        const updated = {
                          ...formData,
                          mcpServers: formData.mcpServers.filter((s) => s.id !== server.id),
                        };
                        setFormData(updated);
                        persistSettings(updated);
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

                  // Add to formData and auto-save
                  const updated = {
                    ...formData,
                    mcpServers: [...formData.mcpServers, newServer],
                  };
                  setFormData(updated);
                  persistSettings(updated);

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

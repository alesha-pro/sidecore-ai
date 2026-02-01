import { useState, useEffect } from 'preact/hooks';
import type { Settings } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';
import { normalizeBaseUrl, validateBaseUrl } from '../lib/urlNormalization';

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
}

export default function SettingsForm({ settings, onSave, onCancel }: SettingsFormProps) {
  const [formData, setFormData] = useState<Settings>(settings);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset form when settings prop changes
  useEffect(() => {
    setFormData(settings);
    setErrors({});
    setSaveError(null);
  }, [settings]);

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
    const target = e.target as HTMLInputElement;
    const value = field === 'contextBudget' ? parseInt(target.value, 10) || 0 : target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Provider Settings</h2>

        {saveError && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {saveError}
          </div>
        )}

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

        {/* Default Model */}
        <div>
          <label htmlFor="defaultModel" className="block text-sm font-medium text-gray-700 mb-1">
            Default Model
          </label>
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
          {errors.defaultModel ? (
            <p id="defaultModel-error" className="mt-1 text-sm text-red-600">
              {errors.defaultModel}
            </p>
          ) : (
            <p id="defaultModel-hint" className="mt-1 text-xs text-gray-500">
              Model discovery will be available in Settings after connection test
            </p>
          )}
        </div>

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

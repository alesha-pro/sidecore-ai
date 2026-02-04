import { useEffect, useRef } from 'preact/hooks';
import { Wrench, Globe } from 'lucide-preact';
import { cn } from '../lib/utils';
import { Toggle } from './ui/Toggle';
import { builtInTools } from '../lib/tools/builtins';
import type { McpServerConfig } from '../lib/types';

interface ToolsQuickToggleProps {
  isOpen: boolean;
  onClose: () => void;
  disabledTools: string[];
  disabledServers: string[];
  mcpServers: McpServerConfig[];
  onToolToggle: (toolName: string) => void;
  onServerToggle: (serverId: string) => void;
}

export function ToolsQuickToggle({
  isOpen,
  onClose,
  disabledTools,
  disabledServers,
  mcpServers,
  onToolToggle,
  onServerToggle,
}: ToolsQuickToggleProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close from the opening click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  console.log('[ToolsQuickToggle] mcpServers:', mcpServers);

  return (
    <div
      ref={popupRef}
      className={cn(
        'absolute bottom-full mb-2 left-0 z-50',
        'w-72 max-h-96 overflow-y-auto',
        'bg-surface border border-border rounded-lg shadow-lg',
        'dark:bg-surface-dark dark:border-border-dark',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-150'
      )}
    >
      <div className="p-3 space-y-3">
        {/* Built-in Tools Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
            <Wrench size={14} />
            <span>Built-in Tools</span>
          </div>
          <div className="space-y-1.5">
            {builtInTools.map((tool) => {
              const isEnabled = !disabledTools.includes(tool.name);
              return (
                <div
                  key={tool.name}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <label
                    htmlFor={`tool-${tool.name}`}
                    className="text-sm text-text-primary dark:text-text-primary-dark cursor-pointer flex-1 min-w-0"
                  >
                    <span className="truncate block">{tool.name}</span>
                    {tool.description && (
                      <span className="text-xs text-text-secondary dark:text-text-secondary-dark line-clamp-1">
                        {tool.description}
                      </span>
                    )}
                  </label>
                  <Toggle
                    id={`tool-${tool.name}`}
                    checked={isEnabled}
                    onCheckedChange={() => onToolToggle(tool.name)}
                    aria-label={`Toggle ${tool.name}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* MCP Servers Section */}
        {mcpServers.length > 0 && (
          <div className="space-y-2">
            <div className="border-t border-border dark:border-border-dark" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary dark:text-text-secondary-dark">
              <Globe size={14} />
              <span>MCP Servers</span>
            </div>
            <div className="space-y-1.5">
              {mcpServers.map((server) => {
                const isEnabled = !disabledServers.includes(server.id);

                return (
                  <div
                    key={server.id}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <label
                      htmlFor={`server-${server.id}`}
                      className="text-sm text-text-primary dark:text-text-primary-dark cursor-pointer flex-1 min-w-0"
                    >
                      <span className="truncate block">{server.name}</span>
                      <span className="text-xs text-text-secondary dark:text-text-secondary-dark truncate block">
                        {server.url}
                      </span>
                    </label>
                    <Toggle
                      id={`server-${server.id}`}
                      checked={isEnabled}
                      onCheckedChange={() => onServerToggle(server.id)}
                      aria-label={`Toggle ${server.name}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

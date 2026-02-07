/**
 * PermissionBanner — in-app pre-prompt for permission requests
 *
 * Shows a non-intrusive banner explaining why permission is needed
 * with Grant/Skip actions. Replaces raw chrome.permissions.request()
 * dialogs with user-friendly context.
 */

import { cn } from '../lib/utils';
import { ShieldCheck, X } from 'lucide-preact';

export type PermissionBannerType = 'multi-tab' | 'external-origin';

interface PermissionBannerProps {
  type: PermissionBannerType;
  /** For external-origin: the domain being accessed */
  domain?: string;
  onGrant: () => void;
  onDismiss: () => void;
}

const MESSAGES: Record<PermissionBannerType, { title: string; description: (domain?: string) => string; grantLabel: string; dismissLabel: string }> = {
  'multi-tab': {
    title: 'Multi-tab access needed',
    description: () => 'To read content from multiple tabs, the extension needs broader site access. This is a one-time request.',
    grantLabel: 'Grant access',
    dismissLabel: 'Use active tab only',
  },
  'external-origin': {
    title: 'Network access needed',
    description: (domain) => `Allow the extension to connect to ${domain || 'this service'}? Required for this operation.`,
    grantLabel: 'Allow',
    dismissLabel: 'Skip',
  },
};

export function PermissionBanner({ type, domain, onGrant, onDismiss }: PermissionBannerProps) {
  const msg = MESSAGES[type];

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 mx-2 mb-2 rounded-xl',
      'bg-accent-subtle border border-accent/20',
      'dark:bg-accent-subtle-dark dark:border-accent-dark/20',
      'animate-fade-in motion-reduce:animate-none'
    )}>
      <ShieldCheck size={18} className={cn(
        'flex-shrink-0 mt-0.5',
        'text-accent',
        'dark:text-accent-dark'
      )} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs font-medium mb-0.5',
          'text-text-primary',
          'dark:text-text-primary-dark'
        )}>
          {msg.title}
        </p>
        <p className={cn(
          'text-xs mb-2',
          'text-text-secondary',
          'dark:text-text-secondary-dark'
        )}>
          {msg.description(domain)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onGrant}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-lg',
              'bg-accent text-white',
              'hover:bg-accent/90',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'dark:bg-accent-dark dark:hover:bg-accent-dark/90'
            )}
          >
            {msg.grantLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-lg',
              'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'dark:text-text-secondary-dark dark:hover:text-text-primary-dark dark:hover:bg-surface-hover-dark'
            )}
          >
            {msg.dismissLabel}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'p-0.5 rounded flex-shrink-0',
          'text-text-tertiary hover:text-text-secondary',
          'dark:text-text-tertiary-dark dark:hover:text-text-secondary-dark'
        )}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

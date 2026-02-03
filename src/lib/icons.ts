/** Standard icon sizes for consistent UI. Use with Lucide Preact icons. */
export const ICON_SIZE = {
  /** 16px - Inline with text, small UI elements */
  sm: 16,
  /** 20px - Buttons, form elements, toolbar items */
  md: 20,
  /** 24px - Headers, prominent actions, empty states */
  lg: 24,
} as const;

export type IconSize = keyof typeof ICON_SIZE;

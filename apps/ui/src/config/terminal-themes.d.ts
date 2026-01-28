/**
 * Terminal themes that match the app themes
 * Each theme provides colors for xterm.js terminal emulator
 */
import type { ThemeMode } from '@/store/app-store';
import { type UIFontOption } from '@/config/ui-font-options';
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
  searchMatchBackground: string;
  searchMatchBorder: string;
  searchActiveMatchBackground: string;
  searchActiveMatchBorder: string;
}
/**
 * Terminal font options for user selection
 *
 * Uses the same fonts as UI_MONO_FONT_OPTIONS for consistency across the app.
 * All fonts listed here are bundled with the app via @fontsource packages
 * or are system fonts with appropriate fallbacks.
 */
export type TerminalFontOption = UIFontOption;
/**
 * Terminal font options - reuses UI_MONO_FONT_OPTIONS with terminal-specific default
 *
 * The 'default' value means "use the default terminal font" (Menlo/Monaco)
 */
export declare const TERMINAL_FONT_OPTIONS: readonly UIFontOption[];
/**
 * Default terminal font family
 * Uses the DEFAULT_FONT_VALUE sentinel which maps to Menlo/Monaco
 */
export declare const DEFAULT_TERMINAL_FONT: any;
/**
 * Get the actual font family CSS value for terminal
 * Converts DEFAULT_FONT_VALUE to the actual Menlo/Monaco font stack
 */
export declare function getTerminalFontFamily(fontValue: string | undefined): string;
declare const terminalThemes: Record<ThemeMode, TerminalTheme>;
/**
 * Get terminal theme for the given app theme
 * For "system" theme, it checks the user's system preference
 */
export declare function getTerminalTheme(theme: ThemeMode): TerminalTheme;
export default terminalThemes;
//# sourceMappingURL=terminal-themes.d.ts.map

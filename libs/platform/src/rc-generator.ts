/**
 * RC Generator - Generate shell configuration files for custom terminal prompts
 *
 * This module generates bash/zsh/sh configuration files that sync with Automaker's themes,
 * providing custom prompts with theme-matched colors while preserving user's existing RC files.
 */

import type { ThemeMode } from '@automaker/types';

/**
 * Terminal configuration options
 */
export interface TerminalConfig {
  enabled: boolean;
  customPrompt: boolean;
  promptFormat: 'standard' | 'minimal' | 'powerline' | 'starship';
  showGitBranch: boolean;
  showGitStatus: boolean;
  customAliases: string;
  customEnvVars: Record<string, string>;
  rcFileVersion?: number;
}

/**
 * Terminal theme colors (hex values)
 */
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
}

/**
 * ANSI color codes for shell prompts
 */
export interface ANSIColors {
  user: string;
  host: string;
  path: string;
  gitBranch: string;
  gitDirty: string;
  prompt: string;
  reset: string;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number {
  return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2));
}

/**
 * xterm-256 color palette (simplified - standard colors + 6x6x6 RGB cube + grayscale)
 */
const XTERM_256_PALETTE: Array<{ r: number; g: number; b: number }> = [];

// Standard colors (0-15) - already handled by ANSI basic colors
// RGB cube (16-231): 6x6x6 cube with levels 0, 95, 135, 175, 215, 255
const levels = [0, 95, 135, 175, 215, 255];
for (let r = 0; r < 6; r++) {
  for (let g = 0; g < 6; g++) {
    for (let b = 0; b < 6; b++) {
      XTERM_256_PALETTE.push({ r: levels[r], g: levels[g], b: levels[b] });
    }
  }
}

// Grayscale (232-255): 24 shades from #080808 to #eeeeee
for (let i = 0; i < 24; i++) {
  const gray = 8 + i * 10;
  XTERM_256_PALETTE.push({ r: gray, g: gray, b: gray });
}

/**
 * Convert hex color to closest xterm-256 color code
 */
export function hexToXterm256(hex: string): number {
  const rgb = hexToRgb(hex);
  let closestIndex = 16; // Start from RGB cube
  let minDistance = Infinity;

  XTERM_256_PALETTE.forEach((color, index) => {
    const distance = colorDistance(rgb, color);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index + 16; // Offset by 16 (standard colors)
    }
  });

  return closestIndex;
}

/**
 * Get ANSI color codes from theme colors
 */
export function getThemeANSIColors(theme: TerminalTheme): ANSIColors {
  return {
    user: `\\[\\e[38;5;${hexToXterm256(theme.cyan)}m\\]`,
    host: `\\[\\e[38;5;${hexToXterm256(theme.blue)}m\\]`,
    path: `\\[\\e[38;5;${hexToXterm256(theme.yellow)}m\\]`,
    gitBranch: `\\[\\e[38;5;${hexToXterm256(theme.magenta)}m\\]`,
    gitDirty: `\\[\\e[38;5;${hexToXterm256(theme.red)}m\\]`,
    prompt: `\\[\\e[38;5;${hexToXterm256(theme.green)}m\\]`,
    reset: '\\[\\e[0m\\]',
  };
}

/**
 * Escape shell special characters in user input
 */
function shellEscape(str: string): string {
  return str.replace(/([`$\\"])/g, '\\$1');
}

/**
 * Validate environment variable name
 */
function isValidEnvVarName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Generate common shell functions (git prompt, etc.)
 */
export function generateCommonFunctions(config: TerminalConfig): string {
  const gitPrompt = config.showGitBranch
    ? `
automaker_git_prompt() {
  local branch=""
  local dirty=""

  # Check if we're in a git repository
  if git rev-parse --git-dir > /dev/null 2>&1; then
    # Get current branch name
    branch=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)

    ${
      config.showGitStatus
        ? `
    # Check if working directory is dirty
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      dirty="*"
    fi
    `
        : ''
    }

    if [ -n "$branch" ]; then
      echo -n " ($branch$dirty)"
    fi
  fi
}
`
    : `
automaker_git_prompt() {
  # Git prompt disabled
  echo -n ""
}
`;

  return `#!/bin/sh
# Automaker Terminal Configuration - Common Functions v1.0

${gitPrompt}
`;
}

/**
 * Generate prompt based on format
 */
function generatePrompt(format: TerminalConfig['promptFormat'], colors: ANSIColors): string {
  switch (format) {
    case 'minimal':
      return `PS1="${colors.path}\\w${colors.reset}\\$(automaker_git_prompt) ${colors.prompt}\\$${colors.reset} "`;

    case 'powerline':
      return `PS1="┌─[${colors.user}\\u${colors.reset}@${colors.host}\\h${colors.reset}]─[${colors.path}\\w${colors.reset}]\\$(automaker_git_prompt)\\n└─${colors.prompt}\\$${colors.reset} "`;

    case 'starship':
      return `PS1="${colors.user}\\u${colors.reset}@${colors.host}\\h${colors.reset} in ${colors.path}\\w${colors.reset}\\$(automaker_git_prompt)\\n${colors.prompt}❯${colors.reset} "`;

    case 'standard':
    default:
      return `PS1="[${colors.user}\\u${colors.reset}@${colors.host}\\h${colors.reset}] ${colors.path}\\w${colors.reset}\\$(automaker_git_prompt) ${colors.prompt}\\$${colors.reset} "`;
  }
}

/**
 * Generate Zsh prompt based on format
 */
function generateZshPrompt(format: TerminalConfig['promptFormat'], colors: ANSIColors): string {
  // Convert bash-style \u, \h, \w to zsh-style %n, %m, %~
  // Remove bash-style escaping \[ \] (not needed in zsh)
  const zshColors = {
    user: colors.user
      .replace(/\\[\[\]\\e]/g, '')
      .replace(/\\e/g, '%{')
      .replace(/m\\]/g, 'm%}'),
    host: colors.host
      .replace(/\\[\[\]\\e]/g, '')
      .replace(/\\e/g, '%{')
      .replace(/m\\]/g, 'm%}'),
    path: colors.path
      .replace(/\\[\[\]\\e]/g, '')
      .replace(/\\e/g, '%{')
      .replace(/m\\]/g, 'm%}'),
    gitBranch: colors.gitBranch
      .replace(/\\[\[\]\\e]/g, '')
      .replace(/\\e/g, '%{')
      .replace(/m\\]/g, 'm%}'),
    gitDirty: colors.gitDirty
      .replace(/\\[\[\]\\e]/g, '')
      .replace(/\\e/g, '%{')
      .replace(/m\\]/g, 'm%}'),
    prompt: colors.prompt
      .replace(/\\[\[\]\\e]/g, '')
      .replace(/\\e/g, '%{')
      .replace(/m\\]/g, 'm%}'),
    reset: colors.reset
      .replace(/\\[\[\]\\e]/g, '')
      .replace(/\\e/g, '%{')
      .replace(/m\\]/g, 'm%}'),
  };

  switch (format) {
    case 'minimal':
      return `PROMPT="${zshColors.path}%~${zshColors.reset}\\$(automaker_git_prompt) ${zshColors.prompt}%#${zshColors.reset} "`;

    case 'powerline':
      return `PROMPT="┌─[${zshColors.user}%n${zshColors.reset}@${zshColors.host}%m${zshColors.reset}]─[${zshColors.path}%~${zshColors.reset}]\\$(automaker_git_prompt)
└─${zshColors.prompt}%#${zshColors.reset} "`;

    case 'starship':
      return `PROMPT="${zshColors.user}%n${zshColors.reset}@${zshColors.host}%m${zshColors.reset} in ${zshColors.path}%~${zshColors.reset}\\$(automaker_git_prompt)
${zshColors.prompt}❯${zshColors.reset} "`;

    case 'standard':
    default:
      return `PROMPT="[${zshColors.user}%n${zshColors.reset}@${zshColors.host}%m${zshColors.reset}] ${zshColors.path}%~${zshColors.reset}\\$(automaker_git_prompt) ${zshColors.prompt}%#${zshColors.reset} "`;
  }
}

/**
 * Generate custom aliases section
 */
function generateAliases(config: TerminalConfig): string {
  if (!config.customAliases) return '';

  // Escape and validate aliases
  const escapedAliases = shellEscape(config.customAliases);
  return `
# Custom aliases
${escapedAliases}
`;
}

/**
 * Generate custom environment variables section
 */
function generateEnvVars(config: TerminalConfig): string {
  if (!config.customEnvVars || Object.keys(config.customEnvVars).length === 0) {
    return '';
  }

  const validEnvVars = Object.entries(config.customEnvVars)
    .filter(([name]) => isValidEnvVarName(name))
    .map(([name, value]) => `export ${name}="${shellEscape(value)}"`)
    .join('\n');

  return validEnvVars
    ? `
# Custom environment variables
${validEnvVars}
`
    : '';
}

/**
 * Generate bashrc configuration
 */
export function generateBashrc(theme: TerminalTheme, config: TerminalConfig): string {
  const colors = getThemeANSIColors(theme);
  const promptLine = generatePrompt(config.promptFormat, colors);

  return `#!/bin/bash
# Automaker Terminal Configuration v1.0
# This file is automatically generated - manual edits will be overwritten

# Source user's original bashrc first (preserves user configuration)
if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

# Load Automaker theme colors
AUTOMAKER_THEME="\${AUTOMAKER_THEME:-dark}"
if [ -f "\${BASH_SOURCE%/*}/themes/$AUTOMAKER_THEME.sh" ]; then
    source "\${BASH_SOURCE%/*}/themes/$AUTOMAKER_THEME.sh"
fi

# Load common functions (git prompt)
if [ -f "\${BASH_SOURCE%/*}/common.sh" ]; then
    source "\${BASH_SOURCE%/*}/common.sh"
fi

# Set custom prompt (only if enabled)
if [ "$AUTOMAKER_CUSTOM_PROMPT" = "true" ]; then
    ${promptLine}
fi
${generateAliases(config)}${generateEnvVars(config)}
# Load user customizations (if exists)
if [ -f "\${BASH_SOURCE%/*}/user-custom.sh" ]; then
    source "\${BASH_SOURCE%/*}/user-custom.sh"
fi
`;
}

/**
 * Generate zshrc configuration
 */
export function generateZshrc(theme: TerminalTheme, config: TerminalConfig): string {
  const colors = getThemeANSIColors(theme);
  const promptLine = generateZshPrompt(config.promptFormat, colors);

  return `#!/bin/zsh
# Automaker Terminal Configuration v1.0
# This file is automatically generated - manual edits will be overwritten

# Source user's original zshrc first (preserves user configuration)
if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc"
fi

# Load Automaker theme colors
AUTOMAKER_THEME="\${AUTOMAKER_THEME:-dark}"
if [ -f "\${ZDOTDIR:-\${0:a:h}}/themes/$AUTOMAKER_THEME.sh" ]; then
    source "\${ZDOTDIR:-\${0:a:h}}/themes/$AUTOMAKER_THEME.sh"
fi

# Load common functions (git prompt)
if [ -f "\${ZDOTDIR:-\${0:a:h}}/common.sh" ]; then
    source "\${ZDOTDIR:-\${0:a:h}}/common.sh"
fi

# Set custom prompt (only if enabled)
if [ "$AUTOMAKER_CUSTOM_PROMPT" = "true" ]; then
    ${promptLine}
fi
${generateAliases(config)}${generateEnvVars(config)}
# Load user customizations (if exists)
if [ -f "\${ZDOTDIR:-\${0:a:h}}/user-custom.sh" ]; then
    source "\${ZDOTDIR:-\${0:a:h}}/user-custom.sh"
fi
`;
}

/**
 * Generate theme color exports for shell
 */
export function generateThemeColors(theme: TerminalTheme): string {
  const colors = getThemeANSIColors(theme);

  return `#!/bin/sh
# Automaker Theme Colors
# This file is automatically generated - manual edits will be overwritten

# ANSI color codes for prompt
export COLOR_USER="${colors.user}"
export COLOR_HOST="${colors.host}"
export COLOR_PATH="${colors.path}"
export COLOR_GIT_BRANCH="${colors.gitBranch}"
export COLOR_GIT_DIRTY="${colors.gitDirty}"
export COLOR_PROMPT="${colors.prompt}"
export COLOR_RESET="${colors.reset}"
`;
}

/**
 * Get shell name from file extension
 */
export function getShellName(rcFile: string): 'bash' | 'zsh' | 'sh' | null {
  if (rcFile.endsWith('.sh') && rcFile.includes('bashrc')) return 'bash';
  if (rcFile.endsWith('.zsh') || rcFile.endsWith('.zshrc')) return 'zsh';
  if (rcFile.endsWith('.sh')) return 'sh';
  return null;
}

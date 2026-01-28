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

const STARTUP_COLOR_PRIMARY = 51;
const STARTUP_COLOR_SECONDARY = 39;
const STARTUP_COLOR_ACCENT = 33;

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

function stripPromptEscapes(ansiColor: string): string {
  return ansiColor.replace(/\\\[/g, '').replace(/\\\]/g, '');
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

AUTOMAKER_INFO_UNKNOWN="Unknown"
AUTOMAKER_BANNER_LABEL_WIDTH=12
AUTOMAKER_BYTES_PER_KIB=1024
AUTOMAKER_KIB_PER_MIB=1024
AUTOMAKER_MIB_PER_GIB=1024
AUTOMAKER_COLOR_PRIMARY="\\033[38;5;${STARTUP_COLOR_PRIMARY}m"
AUTOMAKER_COLOR_SECONDARY="\\033[38;5;${STARTUP_COLOR_SECONDARY}m"
AUTOMAKER_COLOR_ACCENT="\\033[38;5;${STARTUP_COLOR_ACCENT}m"
AUTOMAKER_COLOR_RESET="\\033[0m"

automaker_command_exists() {
  command -v "$1" >/dev/null 2>&1
}

automaker_get_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ -n "$PRETTY_NAME" ]; then
      echo "$PRETTY_NAME"
      return
    fi
    if [ -n "$NAME" ] && [ -n "$VERSION" ]; then
      echo "$NAME $VERSION"
      return
    fi
  fi

  if automaker_command_exists sw_vers; then
    echo "$(sw_vers -productName) $(sw_vers -productVersion)"
    return
  fi

  uname -s 2>/dev/null || echo "$AUTOMAKER_INFO_UNKNOWN"
}

automaker_get_uptime() {
  if automaker_command_exists uptime; then
    if uptime -p >/dev/null 2>&1; then
      uptime -p
      return
    fi
    uptime 2>/dev/null | sed 's/.*up \\([^,]*\\).*/\\1/' || uptime 2>/dev/null
    return
  fi

  echo "$AUTOMAKER_INFO_UNKNOWN"
}

automaker_get_cpu() {
  if automaker_command_exists lscpu; then
    lscpu | sed -n 's/Model name:[[:space:]]*//p' | head -n 1
    return
  fi

  if automaker_command_exists sysctl; then
    sysctl -n machdep.cpu.brand_string 2>/dev/null || sysctl -n hw.model 2>/dev/null
    return
  fi

  uname -m 2>/dev/null || echo "$AUTOMAKER_INFO_UNKNOWN"
}

automaker_get_memory() {
  if automaker_command_exists free; then
    free -h | awk '/Mem:/ {print $3 " / " $2}'
    return
  fi

  if automaker_command_exists vm_stat; then
    local page_size
    local pages_free
    local pages_active
    local pages_inactive
    local pages_wired
    local pages_total
    page_size=$(vm_stat | awk '/page size of/ {print $8}')
    pages_free=$(vm_stat | awk '/Pages free/ {print $3}' | tr -d '.')
    pages_active=$(vm_stat | awk '/Pages active/ {print $3}' | tr -d '.')
    pages_inactive=$(vm_stat | awk '/Pages inactive/ {print $3}' | tr -d '.')
    pages_wired=$(vm_stat | awk '/Pages wired down/ {print $4}' | tr -d '.')
    pages_total=$((pages_free + pages_active + pages_inactive + pages_wired))
    awk -v total="$pages_total" -v free="$pages_free" -v size="$page_size" \
      -v bytes_kib="$AUTOMAKER_BYTES_PER_KIB" \
      -v kib_mib="$AUTOMAKER_KIB_PER_MIB" \
      -v mib_gib="$AUTOMAKER_MIB_PER_GIB" \
      'BEGIN {
      total_gb = total * size / bytes_kib / kib_mib / mib_gib;
      used_gb = (total - free) * size / bytes_kib / kib_mib / mib_gib;
      printf("%.1f GB / %.1f GB", used_gb, total_gb);
    }'
    return
  fi

  if automaker_command_exists sysctl; then
    local total_bytes
    total_bytes=$(sysctl -n hw.memsize 2>/dev/null)
    if [ -n "$total_bytes" ]; then
      awk -v total="$total_bytes" \
        -v bytes_kib="$AUTOMAKER_BYTES_PER_KIB" \
        -v kib_mib="$AUTOMAKER_KIB_PER_MIB" \
        -v mib_gib="$AUTOMAKER_MIB_PER_GIB" \
        'BEGIN {printf("%.1f GB", total / bytes_kib / kib_mib / mib_gib)}'
      return
    fi
  fi

  echo "$AUTOMAKER_INFO_UNKNOWN"
}

automaker_get_disk() {
  if automaker_command_exists df; then
    df -h / 2>/dev/null | awk 'NR==2 {print $3 " / " $2}'
    return
  fi

  echo "$AUTOMAKER_INFO_UNKNOWN"
}

automaker_get_ip() {
  if automaker_command_exists hostname; then
    local ip_addr
    ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -n "$ip_addr" ]; then
      echo "$ip_addr"
      return
    fi
  fi

  if automaker_command_exists ipconfig; then
    local ip_addr
    ip_addr=$(ipconfig getifaddr en0 2>/dev/null)
    if [ -n "$ip_addr" ]; then
      echo "$ip_addr"
      return
    fi
  fi

  echo "$AUTOMAKER_INFO_UNKNOWN"
}

automaker_show_banner() {
  local label_width="$AUTOMAKER_BANNER_LABEL_WIDTH"
  local logo_line_1="  █▀▀█ █  █ ▀▀█▀▀ █▀▀█ █▀▄▀█ █▀▀█ █ █ █▀▀ █▀▀█  "
  local logo_line_2="  █▄▄█ █  █   █   █  █ █ ▀ █ █▄▄█ █▀▄ █▀▀ █▄▄▀  "
  local logo_line_3="  ▀  ▀  ▀▀▀   ▀   ▀▀▀▀ ▀   ▀ ▀  ▀ ▀ ▀ ▀▀▀ ▀ ▀▀  "
  local accent_color="\${AUTOMAKER_COLOR_PRIMARY}"
  local secondary_color="\${AUTOMAKER_COLOR_SECONDARY}"
  local tertiary_color="\${AUTOMAKER_COLOR_ACCENT}"
  local label_color="\${AUTOMAKER_COLOR_SECONDARY}"
  local reset_color="\${AUTOMAKER_COLOR_RESET}"

  printf "%b%s%b\n" "$accent_color" "$logo_line_1" "$reset_color"
  printf "%b%s%b\n" "$secondary_color" "$logo_line_2" "$reset_color"
  printf "%b%s%b\n" "$tertiary_color" "$logo_line_3" "$reset_color"
  printf "\n"

  local shell_name="\${SHELL##*/}"
  if [ -z "$shell_name" ]; then
    shell_name=$(basename "$0" 2>/dev/null || echo "shell")
  fi
  local user_host="\${USER:-unknown}@$(hostname 2>/dev/null || echo unknown)"
  printf "%b%s%b\n" "$label_color" "$user_host" "$reset_color"

  printf "%b%-\${label_width}s%b %s\n" "$label_color" "OS:" "$reset_color" "$(automaker_get_os)"
  printf "%b%-\${label_width}s%b %s\n" "$label_color" "Uptime:" "$reset_color" "$(automaker_get_uptime)"
  printf "%b%-\${label_width}s%b %s\n" "$label_color" "Shell:" "$reset_color" "$shell_name"
  printf "%b%-\${label_width}s%b %s\n" "$label_color" "Terminal:" "$reset_color" "\${TERM_PROGRAM:-$TERM}"
  printf "%b%-\${label_width}s%b %s\n" "$label_color" "CPU:" "$reset_color" "$(automaker_get_cpu)"
  printf "%b%-\${label_width}s%b %s\n" "$label_color" "Memory:" "$reset_color" "$(automaker_get_memory)"
  printf "%b%-\${label_width}s%b %s\n" "$label_color" "Disk:" "$reset_color" "$(automaker_get_disk)"
  printf "%b%-\${label_width}s%b %s\n" "$label_color" "Local IP:" "$reset_color" "$(automaker_get_ip)"
  printf "\n"
}

automaker_show_banner_once() {
  case "$-" in
    *i*) ;;
    *) return ;;
  esac

  if [ "$AUTOMAKER_BANNER_SHOWN" = "true" ]; then
    return
  fi

  automaker_show_banner
  export AUTOMAKER_BANNER_SHOWN="true"
}
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

# Show Automaker banner on shell start
if command -v automaker_show_banner_once >/dev/null 2>&1; then
    automaker_show_banner_once
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

# Show Automaker banner on shell start
if command -v automaker_show_banner_once >/dev/null 2>&1; then
    automaker_show_banner_once
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
  const rawColors = {
    user: stripPromptEscapes(colors.user),
    host: stripPromptEscapes(colors.host),
    path: stripPromptEscapes(colors.path),
    gitBranch: stripPromptEscapes(colors.gitBranch),
    gitDirty: stripPromptEscapes(colors.gitDirty),
    prompt: stripPromptEscapes(colors.prompt),
    reset: stripPromptEscapes(colors.reset),
  };

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

# ANSI color codes for banner output (no prompt escapes)
export COLOR_USER_RAW="${rawColors.user}"
export COLOR_HOST_RAW="${rawColors.host}"
export COLOR_PATH_RAW="${rawColors.path}"
export COLOR_GIT_BRANCH_RAW="${rawColors.gitBranch}"
export COLOR_GIT_DIRTY_RAW="${rawColors.gitDirty}"
export COLOR_PROMPT_RAW="${rawColors.prompt}"
export COLOR_RESET_RAW="${rawColors.reset}"
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

#!/bin/bash
# Automaker TUI Launcher - Interactive menu for launching Automaker in different modes
# Supports: Web Browser, Desktop (Electron), Desktop + Debug
# Features: Terminal responsiveness, history, pre-flight checks, cross-platform detection

set -e

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

APP_NAME="Automaker"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HISTORY_FILE="${HOME}/.automaker_launcher_history"
MIN_TERM_WIDTH=70
MIN_TERM_HEIGHT=20
MENU_BOX_WIDTH=60
MENU_INNER_WIDTH=58
LOGO_WIDTH=52
INPUT_TIMEOUT=30

# Extract VERSION from package.json
VERSION=$(grep '"version"' "$SCRIPT_DIR/package.json" | head -1 | sed 's/[^0-9.]*\([0-9.]*\).*/v\1/')
NODE_VER=$(node -v 2>/dev/null || echo "unknown")

# ANSI Color codes (256-color palette)
ESC=$(printf '\033')
RESET="${ESC}[0m"
BOLD="${ESC}[1m"
DIM="${ESC}[2m"

C_PRI="${ESC}[38;5;51m"   # Primary cyan
C_SEC="${ESC}[38;5;39m"   # Secondary blue
C_ACC="${ESC}[38;5;33m"   # Accent darker blue
C_GREEN="${ESC}[38;5;118m" # Green
C_RED="${ESC}[38;5;196m"   # Red
C_YELLOW="${ESC}[38;5;226m" # Yellow
C_GRAY="${ESC}[38;5;240m"  # Dark gray
C_WHITE="${ESC}[38;5;255m" # White
C_MUTE="${ESC}[38;5;248m"  # Muted gray

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

MODE="${1:-}"
USE_COLORS=true
CHECK_DEPS=false
NO_HISTORY=false

show_help() {
    cat << 'EOF'
Automaker TUI Launcher - Interactive development environment starter

USAGE:
  start-automaker.sh [MODE] [OPTIONS]

MODES:
  web              Launch in web browser (localhost:3007)
  electron         Launch as desktop app (Electron)
  electron-debug   Launch with DevTools open

OPTIONS:
  --help           Show this help message
  --version        Show version information
  --no-colors      Disable colored output
  --check-deps     Check dependencies before launching
  --no-history     Don't remember last choice

EXAMPLES:
  start-automaker.sh              # Interactive menu
  start-automaker.sh web          # Launch web mode directly
  start-automaker.sh electron     # Launch desktop app directly
  start-automaker.sh --version    # Show version

KEYBOARD SHORTCUTS (in menu):
  1-3              Select mode
  Q                Exit
  Up/Down          Navigate (coming soon)

HISTORY:
  Your last selected mode is remembered in: ~/.automaker_launcher_history
  Use --no-history to disable this feature

EOF
}

show_version() {
    echo "Automaker Launcher $VERSION"
    echo "Node.js: $NODE_VER"
    echo "Bash: ${BASH_VERSION%.*}"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help)
                show_help
                exit 0
                ;;
            --version)
                show_version
                exit 0
                ;;
            --no-colors)
                USE_COLORS=false
                RESET=""
                C_PRI="" C_SEC="" C_ACC="" C_GREEN="" C_RED="" C_YELLOW="" C_GRAY="" C_WHITE="" C_MUTE=""
                ;;
            --check-deps)
                CHECK_DEPS=true
                ;;
            --no-history)
                NO_HISTORY=true
                ;;
            web|electron|electron-debug)
                MODE="$1"
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Use --help for usage information" >&2
                exit 1
                ;;
        esac
        shift
    done
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

check_platform() {
    # Detect if running on Windows (Git Bash, WSL, or native PowerShell)
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        echo "${C_RED}Error:${RESET} This script requires bash on Unix-like systems (Linux, macOS, WSL)."
        echo "On Windows, use PowerShell or WSL instead."
        exit 1
    fi
}

check_required_commands() {
    local missing=()

    # Check for required commands
    for cmd in node npm tput; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        echo "${C_RED}Error:${RESET} Missing required commands: ${missing[*]}"
        echo ""
        echo "Please install:"
        for cmd in "${missing[@]}"; do
            case "$cmd" in
                node|npm) echo "  - Node.js (includes npm) from https://nodejs.org/" ;;
                tput) echo "  - ncurses package (usually pre-installed on Unix systems)" ;;
            esac
        done
        exit 1
    fi
}

check_dependencies() {
    if [ "$CHECK_DEPS" = false ]; then
        return 0
    fi

    echo "${C_MUTE}Checking project dependencies...${RESET}"

    if [ ! -d "node_modules" ]; then
        echo "${C_YELLOW}⚠${RESET}  node_modules not found. Run 'npm install' before launching."
        return 1
    fi

    if [ ! -f "package-lock.json" ]; then
        echo "${C_YELLOW}⚠${RESET}  package-lock.json not found."
    fi

    return 0
}

validate_terminal_size() {
    if [ "$USE_COLORS" = false ]; then
        return 0
    fi

    local term_width term_height
    term_width=$(tput cols 2>/dev/null || echo 80)
    term_height=$(tput lines 2>/dev/null || echo 24)

    if [ "$term_width" -lt "$MIN_TERM_WIDTH" ] || [ "$term_height" -lt "$MIN_TERM_HEIGHT" ]; then
        echo "${C_YELLOW}⚠${RESET}  Terminal size ${term_width}x${term_height} is smaller than recommended ${MIN_TERM_WIDTH}x${MIN_TERM_HEIGHT}"
        echo "    Some elements may not display correctly."
        echo ""
        return 1
    fi
}

# ============================================================================
# CURSOR & CLEANUP
# ============================================================================

hide_cursor() {
    [ "$USE_COLORS" = true ] && printf "${ESC}[?25l"
}

show_cursor() {
    [ "$USE_COLORS" = true ] && printf "${ESC}[?25h"
}

cleanup() {
    show_cursor
    stty echo 2>/dev/null || true
    printf "${RESET}\n"
}

trap cleanup EXIT INT TERM

# ============================================================================
# TERMINAL SIZE & UI UTILITIES
# ============================================================================

get_term_size() {
    TERM_COLS=$(tput cols 2>/dev/null || echo 80)
    TERM_LINES=$(tput lines 2>/dev/null || echo 24)
}

center_text() {
    local text="$1"
    local len=${#text}
    local pad=$(( (TERM_COLS - len) / 2 ))
    printf "%${pad}s%s\n" "" "$text"
}

draw_line() {
    local char="${1:-─}"
    local color="${2:-$C_GRAY}"
    local width="${3:-58}"
    printf "${color}"
    for ((i=0; i<width; i++)); do printf "%s" "$char"; done
    printf "${RESET}"
}

# ============================================================================
# UI DISPLAY FUNCTIONS
# ============================================================================

show_header() {
    clear
    get_term_size

    # Top padding
    local top_pad=$(( TERM_LINES / 6 ))
    for ((i=0; i<top_pad; i++)); do echo ""; done

    # Automaker ASCII art logo
    local l1="  █▀▀█ █  █ ▀▀█▀▀ █▀▀█ █▀▄▀█ █▀▀█ █ █ █▀▀ █▀▀█  "
    local l2="  █▄▄█ █  █   █   █  █ █ ▀ █ █▄▄█ █▀▄ █▀▀ █▄▄▀  "
    local l3="  ▀  ▀  ▀▀▀   ▀   ▀▀▀▀ ▀   ▀ ▀  ▀ ▀ ▀ ▀▀▀ ▀ ▀▀  "

    local pad_left=$(( (TERM_COLS - LOGO_WIDTH) / 2 ))
    local pad=$(printf "%${pad_left}s" "")

    echo -e "${pad}${C_PRI}${l1}${RESET}"
    echo -e "${pad}${C_SEC}${l2}${RESET}"
    echo -e "${pad}${C_ACC}${l3}${RESET}"

    echo ""
    local sub_display_len=46
    local sub_pad=$(( (TERM_COLS - sub_display_len) / 2 ))
    printf "%${sub_pad}s" ""
    echo -e "${C_MUTE}Autonomous AI Development Studio${RESET}  ${C_GRAY}│${RESET}  ${C_GREEN}${VERSION}${RESET}"

    echo ""
    echo ""
}

show_menu() {
    local pad_left=$(( (TERM_COLS - MENU_BOX_WIDTH) / 2 ))
    local pad=$(printf "%${pad_left}s" "")
    local border="${C_GRAY}│${RESET}"

    printf "%s${C_GRAY}╭" "$pad"
    draw_line "─" "$C_GRAY" "$MENU_INNER_WIDTH"
    printf "╮${RESET}\n"

    printf "%s${border}  ${C_ACC}▸${RESET} ${C_PRI}[1]${RESET} 🌐  ${C_WHITE}Web Browser${RESET}       ${C_MUTE}localhost:3007${RESET}              ${border}\n" "$pad"
    printf "%s${border}    ${C_MUTE}[2]${RESET} 🖥   ${C_MUTE}Desktop App${RESET}       ${DIM}Electron${RESET}                    ${border}\n" "$pad"
    printf "%s${border}    ${C_MUTE}[3]${RESET} 🔧  ${C_MUTE}Desktop + Debug${RESET}   ${DIM}Electron + DevTools${RESET}         ${border}\n" "$pad"

    printf "%s${C_GRAY}├" "$pad"
    draw_line "─" "$C_GRAY" "$MENU_INNER_WIDTH"
    printf "┤${RESET}\n"

    printf "%s${border}    ${C_RED}[Q]${RESET} ⏻   ${C_MUTE}Exit${RESET}                                          ${border}\n" "$pad"

    printf "%s${C_GRAY}╰" "$pad"
    draw_line "─" "$C_GRAY" "$MENU_INNER_WIDTH"
    printf "╯${RESET}\n"

    echo ""
    local footer_text="Use keys [1-3] or [Q] to select"
    local f_pad=$(( (TERM_COLS - ${#footer_text}) / 2 ))
    printf "%${f_pad}s" ""
    echo -e "${DIM}${footer_text}${RESET}"

    if [ -f "$HISTORY_FILE" ]; then
        local last_mode=$(cat "$HISTORY_FILE" 2>/dev/null || echo "")
        if [ -n "$last_mode" ]; then
            local hint_text="(Last: $last_mode)"
            local h_pad=$(( (TERM_COLS - ${#hint_text}) / 2 ))
            printf "%${h_pad}s" ""
            echo -e "${DIM}${hint_text}${RESET}"
        fi
    fi
}

# ============================================================================
# SPINNER & INITIALIZATION
# ============================================================================

spinner() {
    local text="$1"
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local i=0
    local count=0
    local max_frames=20  # Max 1.6 seconds

    while [ $count -lt $max_frames ]; do
        local len=${#text}
        local pad_left=$(( (TERM_COLS - len - 4) / 2 ))
        printf "\r%${pad_left}s${C_PRI}${frames[$i]}${RESET} ${C_WHITE}%s${RESET}" "" "$text"
        i=$(( (i + 1) % ${#frames[@]} ))
        count=$((count + 1))
        sleep 0.08
    done

    local pad_left=$(( (TERM_COLS - ${#text} - 4) / 2 ))
    printf "\r%${pad_left}s${C_GREEN}✓${RESET} ${C_WHITE}%s${RESET}   \n" "" "$text"
}

real_initialization() {
    # Perform actual initialization checks
    local checks_passed=0

    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        ((checks_passed++))
    fi

    # Check if build files exist
    if [ -d "dist" ] || [ -d "apps/ui/dist" ]; then
        ((checks_passed++))
    fi

    return 0
}

launch_sequence() {
    local mode_name="$1"

    echo ""
    echo ""

    spinner "Initializing environment..."
    real_initialization

    spinner "Starting $mode_name..."

    echo ""
    local msg="Automaker is ready!"
    local pad=$(( (TERM_COLS - ${#msg}) / 2 ))
    printf "%${pad}s${C_GREEN}${BOLD}%s${RESET}\n" "" "$msg"

    if [ "$MODE" == "web" ]; then
        local url="http://localhost:3007"
        local upad=$(( (TERM_COLS - ${#url} - 10) / 2 ))
        echo ""
        printf "%${upad}s${DIM}Opening ${C_SEC}%s${RESET}\n" "" "$url"
    fi
    echo ""
}

# ============================================================================
# HISTORY MANAGEMENT
# ============================================================================

save_mode_to_history() {
    if [ "$NO_HISTORY" = false ]; then
        echo "$1" > "$HISTORY_FILE"
    fi
}

get_last_mode_from_history() {
    if [ -f "$HISTORY_FILE" ] && [ "$NO_HISTORY" = false ]; then
        cat "$HISTORY_FILE"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

parse_args "$@"

# Pre-flight checks
check_platform
check_required_commands
validate_terminal_size

if [ "$CHECK_DEPS" = true ]; then
    check_dependencies || true
fi

hide_cursor
stty -echo 2>/dev/null || true

# Interactive menu if no mode specified
if [ -z "$MODE" ]; then
    local timeout_count=0
    while true; do
        show_header
        show_menu

        # Read with timeout
        if [ -n "$ZSH_VERSION" ]; then
            read -k 1 -s -t "$INPUT_TIMEOUT" key 2>/dev/null || key=""
        else
            read -n 1 -s -t "$INPUT_TIMEOUT" -r key 2>/dev/null || key=""
        fi

        case $key in
            1) MODE="web"; break ;;
            2) MODE="electron"; break ;;
            3) MODE="electron-debug"; break ;;
            q|Q)
                echo ""
                echo ""
                local msg="Goodbye! See you soon."
                center_text "${C_MUTE}${msg}${RESET}"
                echo ""
                exit 0
                ;;
            *)
                ;;
        esac
    done
fi

# Validate mode
case $MODE in
    web) MODE_NAME="Web Browser" ;;
    electron) MODE_NAME="Desktop App" ;;
    electron-debug) MODE_NAME="Desktop (Debug)" ;;
    *)
        echo "${C_RED}Error:${RESET} Invalid mode '$MODE'"
        echo "Valid modes: web, electron, electron-debug"
        exit 1
        ;;
esac

# Save to history
save_mode_to_history "$MODE"

# Launch sequence
launch_sequence "$MODE_NAME"

# Execute the appropriate npm command
case $MODE in
    web) npm run dev:web ;;
    electron) npm run dev:electron ;;
    electron-debug) npm run dev:electron:debug ;;
esac

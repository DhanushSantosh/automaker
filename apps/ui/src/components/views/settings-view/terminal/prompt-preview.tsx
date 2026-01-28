/**
 * Prompt Preview - Shows a live preview of the custom terminal prompt
 */

import { cn } from '@/lib/utils';
import type { ThemeMode } from '@automaker/types';
import { getTerminalTheme } from '@/config/terminal-themes';

interface PromptPreviewProps {
  format: 'standard' | 'minimal' | 'powerline' | 'starship';
  theme: ThemeMode;
  showGitBranch: boolean;
  showGitStatus: boolean;
  className?: string;
}

export function PromptPreview({
  format,
  theme,
  showGitBranch,
  showGitStatus,
  className,
}: PromptPreviewProps) {
  const terminalTheme = getTerminalTheme(theme);

  // Generate preview text based on format
  const renderPrompt = () => {
    const user = 'user';
    const host = 'automaker';
    const path = '~/projects/automaker';
    const branch = showGitBranch ? 'main' : null;
    const dirty = showGitStatus && showGitBranch ? '*' : '';

    const gitInfo = branch ? ` (${branch}${dirty})` : '';

    switch (format) {
      case 'minimal':
        return (
          <div className="font-mono text-sm leading-relaxed">
            <span style={{ color: terminalTheme.yellow }}>{path}</span>
            {gitInfo && <span style={{ color: terminalTheme.magenta }}>{gitInfo}</span>}
            <span style={{ color: terminalTheme.green }}> $</span>
            <span className="ml-1 animate-pulse">▊</span>
          </div>
        );

      case 'powerline':
        return (
          <div className="font-mono text-sm leading-relaxed space-y-1">
            <div>
              <span style={{ color: terminalTheme.cyan }}>┌─[</span>
              <span style={{ color: terminalTheme.cyan }}>{user}</span>
              <span style={{ color: terminalTheme.foreground }}>@</span>
              <span style={{ color: terminalTheme.blue }}>{host}</span>
              <span style={{ color: terminalTheme.cyan }}>]─[</span>
              <span style={{ color: terminalTheme.yellow }}>{path}</span>
              <span style={{ color: terminalTheme.cyan }}>]</span>
              {gitInfo && <span style={{ color: terminalTheme.magenta }}>{gitInfo}</span>}
            </div>
            <div>
              <span style={{ color: terminalTheme.cyan }}>└─</span>
              <span style={{ color: terminalTheme.green }}>$</span>
              <span className="ml-1 animate-pulse">▊</span>
            </div>
          </div>
        );

      case 'starship':
        return (
          <div className="font-mono text-sm leading-relaxed space-y-1">
            <div>
              <span style={{ color: terminalTheme.cyan }}>{user}</span>
              <span style={{ color: terminalTheme.foreground }}>@</span>
              <span style={{ color: terminalTheme.blue }}>{host}</span>
              <span style={{ color: terminalTheme.foreground }}> in </span>
              <span style={{ color: terminalTheme.yellow }}>{path}</span>
              {branch && (
                <>
                  <span style={{ color: terminalTheme.foreground }}> on </span>
                  <span style={{ color: terminalTheme.magenta }}>
                    {branch}
                    {dirty}
                  </span>
                </>
              )}
            </div>
            <div>
              <span style={{ color: terminalTheme.green }}>❯</span>
              <span className="ml-1 animate-pulse">▊</span>
            </div>
          </div>
        );

      case 'standard':
      default:
        return (
          <div className="font-mono text-sm leading-relaxed">
            <span style={{ color: terminalTheme.cyan }}>[{user}</span>
            <span style={{ color: terminalTheme.foreground }}>@</span>
            <span style={{ color: terminalTheme.blue }}>{host}</span>
            <span style={{ color: terminalTheme.cyan }}>]</span>
            <span style={{ color: terminalTheme.yellow }}> {path}</span>
            {gitInfo && <span style={{ color: terminalTheme.magenta }}>{gitInfo}</span>}
            <span style={{ color: terminalTheme.green }}> $</span>
            <span className="ml-1 animate-pulse">▊</span>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        'bg-[var(--terminal-bg)] text-[var(--terminal-fg)]',
        'shadow-inner',
        className
      )}
      style={
        {
          '--terminal-bg': terminalTheme.background,
          '--terminal-fg': terminalTheme.foreground,
        } as React.CSSProperties
      }
    >
      <div className="mb-2 text-xs text-muted-foreground opacity-70">Preview</div>
      {renderPrompt()}
    </div>
  );
}

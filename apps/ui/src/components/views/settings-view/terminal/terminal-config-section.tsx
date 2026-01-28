/**
 * Terminal Config Section - Custom terminal configurations with theme synchronization
 *
 * This component provides UI for enabling custom terminal prompts that automatically
 * sync with Automaker's 40 themes. It's an opt-in feature that generates shell configs
 * in .automaker/terminal/ without modifying user's existing RC files.
 */

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wand2, GitBranch, Info, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { PromptPreview } from './prompt-preview';

export function TerminalConfigSection() {
  const { theme, globalSettings, updateGlobalSettings } = useAppStore();
  const [localEnvVars, setLocalEnvVars] = useState<Array<{ key: string; value: string }>>(
    Object.entries(globalSettings?.terminalConfig?.customEnvVars || {}).map(([key, value]) => ({
      key,
      value,
    }))
  );

  const terminalConfig = globalSettings?.terminalConfig || {
    enabled: false,
    customPrompt: true,
    promptFormat: 'standard' as const,
    showGitBranch: true,
    showGitStatus: true,
    customAliases: '',
    customEnvVars: {},
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (enabled) {
      // Show confirmation when enabling
      const confirmed = window.confirm(
        'Enable custom terminal configurations?\n\n' +
          'This will:\n' +
          '• Create shell config files in .automaker/terminal/\n' +
          '• Set custom prompts that match your app theme\n' +
          '• Not modify your existing ~/.bashrc or ~/.zshrc\n\n' +
          'New terminals will use the custom prompt. Existing terminals are unaffected.'
      );

      if (!confirmed) return;
    }

    try {
      // Ensure all required fields are present
      const updatedConfig = {
        enabled,
        customPrompt: terminalConfig.customPrompt,
        promptFormat: terminalConfig.promptFormat,
        showGitBranch: terminalConfig.showGitBranch,
        showGitStatus: terminalConfig.showGitStatus,
        customAliases: terminalConfig.customAliases,
        customEnvVars: terminalConfig.customEnvVars,
        rcFileVersion: 1,
      };

      console.log('[TerminalConfig] Updating settings with:', updatedConfig);

      await updateGlobalSettings({
        terminalConfig: updatedConfig,
      });

      toast.success(
        enabled ? 'Custom terminal configs enabled' : 'Custom terminal configs disabled',
        {
          description: enabled
            ? 'New terminals will use custom prompts'
            : '.automaker/terminal/ will be cleaned up',
        }
      );
    } catch (error) {
      console.error('[TerminalConfig] Failed to update settings:', error);
      toast.error('Failed to update terminal config', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleUpdateConfig = async (updates: Partial<typeof terminalConfig>) => {
    await updateGlobalSettings({
      terminalConfig: {
        ...terminalConfig,
        ...updates,
      },
    });
  };

  const addEnvVar = () => {
    setLocalEnvVars([...localEnvVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    const newVars = localEnvVars.filter((_, i) => i !== index);
    setLocalEnvVars(newVars);

    // Update settings
    const envVarsObject = newVars.reduce(
      (acc, { key, value }) => {
        if (key) acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    handleUpdateConfig({ customEnvVars: envVarsObject });
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', newValue: string) => {
    const newVars = [...localEnvVars];
    newVars[index][field] = newValue;
    setLocalEnvVars(newVars);

    // Validate and update settings (only if key is valid)
    const envVarsObject = newVars.reduce(
      (acc, { key, value }) => {
        // Only include vars with valid keys (alphanumeric + underscore)
        if (key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    handleUpdateConfig({ customEnvVars: envVarsObject });
  };

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm shadow-black/5'
      )}
    >
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center border border-purple-500/20">
            <Wand2 className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            Custom Terminal Configurations
          </h2>
        </div>
        <p className="text-sm text-muted-foreground/80 ml-12">
          Generate custom shell prompts that automatically sync with your app theme. Opt-in feature
          that creates configs in .automaker/terminal/ without modifying your existing RC files.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Enable Custom Configurations</Label>
            <p className="text-xs text-muted-foreground">
              Create theme-synced shell configs in .automaker/terminal/
            </p>
          </div>
          <Switch checked={terminalConfig.enabled} onCheckedChange={handleToggleEnabled} />
        </div>

        {terminalConfig.enabled && (
          <>
            {/* Info Box */}
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 flex gap-2">
              <Info className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/80">
                <strong>How it works:</strong> Custom configs are applied to new terminals only.
                Your ~/.bashrc and ~/.zshrc are still loaded first. Close and reopen terminals to
                see changes.
              </div>
            </div>

            {/* Custom Prompt Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-foreground font-medium">Custom Prompt</Label>
                <p className="text-xs text-muted-foreground">
                  Override default shell prompt with themed version
                </p>
              </div>
              <Switch
                checked={terminalConfig.customPrompt}
                onCheckedChange={(checked) => handleUpdateConfig({ customPrompt: checked })}
              />
            </div>

            {terminalConfig.customPrompt && (
              <>
                {/* Prompt Format */}
                <div className="space-y-3">
                  <Label className="text-foreground font-medium">Prompt Format</Label>
                  <Select
                    value={terminalConfig.promptFormat}
                    onValueChange={(value: 'standard' | 'minimal' | 'powerline' | 'starship') =>
                      handleUpdateConfig({ promptFormat: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">
                        <div className="space-y-0.5">
                          <div>Standard</div>
                          <div className="text-xs text-muted-foreground">
                            [user@host] ~/path (main*) $
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="minimal">
                        <div className="space-y-0.5">
                          <div>Minimal</div>
                          <div className="text-xs text-muted-foreground">~/path (main*) $</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="powerline">
                        <div className="space-y-0.5">
                          <div>Powerline</div>
                          <div className="text-xs text-muted-foreground">
                            ┌─[user@host]─[~/path]─[main*]
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="starship">
                        <div className="space-y-0.5">
                          <div>Starship-Inspired</div>
                          <div className="text-xs text-muted-foreground">
                            user@host in ~/path on main*
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Git Info Toggles */}
                <div className="space-y-4 pl-4 border-l-2 border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Show Git Branch</Label>
                    </div>
                    <Switch
                      checked={terminalConfig.showGitBranch}
                      onCheckedChange={(checked) => handleUpdateConfig({ showGitBranch: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">*</span>
                      <Label className="text-sm">Show Git Status (dirty indicator)</Label>
                    </div>
                    <Switch
                      checked={terminalConfig.showGitStatus}
                      onCheckedChange={(checked) => handleUpdateConfig({ showGitStatus: checked })}
                      disabled={!terminalConfig.showGitBranch}
                    />
                  </div>
                </div>

                {/* Live Preview */}
                <div className="space-y-3">
                  <Label className="text-foreground font-medium">Preview</Label>
                  <PromptPreview
                    format={terminalConfig.promptFormat}
                    theme={theme}
                    showGitBranch={terminalConfig.showGitBranch}
                    showGitStatus={terminalConfig.showGitStatus}
                  />
                </div>
              </>
            )}

            {/* Custom Aliases */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-foreground font-medium">Custom Aliases</Label>
                <p className="text-xs text-muted-foreground">
                  Add shell aliases (one per line, e.g., alias ll='ls -la')
                </p>
              </div>
              <Textarea
                value={terminalConfig.customAliases}
                onChange={(e) => handleUpdateConfig({ customAliases: e.target.value })}
                placeholder="# Custom aliases&#10;alias gs='git status'&#10;alias ll='ls -la'&#10;alias ..='cd ..'"
                className="font-mono text-sm h-32"
              />
            </div>

            {/* Custom Environment Variables */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-foreground font-medium">
                    Custom Environment Variables
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add custom env vars (alphanumeric + underscore only)
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addEnvVar} className="h-8 gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>

              {localEnvVars.length > 0 && (
                <div className="space-y-2">
                  {localEnvVars.map((envVar, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <Input
                        value={envVar.key}
                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                        placeholder="VAR_NAME"
                        className={cn(
                          'font-mono text-sm flex-1',
                          envVar.key &&
                            !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(envVar.key) &&
                            'border-destructive'
                        )}
                      />
                      <Input
                        value={envVar.value}
                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                        placeholder="value"
                        className="font-mono text-sm flex-[2]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEnvVar(index)}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

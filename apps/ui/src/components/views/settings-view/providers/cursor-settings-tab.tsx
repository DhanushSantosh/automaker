import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Terminal, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getHttpApiClient } from '@/lib/http-api-client';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import type { CursorModelId, CursorModelConfig } from '@automaker/types';
import { CURSOR_MODEL_MAP } from '@automaker/types';
import {
  CursorCliStatus,
  CursorCliStatusSkeleton,
  ModelConfigSkeleton,
} from '../cli-status/cursor-cli-status';

interface CursorStatus {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  method?: string;
}

export function CursorSettingsTab() {
  // Global settings from store
  const { enabledCursorModels, cursorDefaultModel, setCursorDefaultModel, toggleCursorModel } =
    useAppStore();

  const [status, setStatus] = useState<CursorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // All available models from the model map
  const availableModels: CursorModelConfig[] = Object.values(CURSOR_MODEL_MAP);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getHttpApiClient();
      const statusResult = await api.setup.getCursorStatus();

      if (statusResult.success) {
        setStatus({
          installed: statusResult.installed ?? false,
          version: statusResult.version ?? undefined,
          authenticated: statusResult.auth?.authenticated ?? false,
          method: statusResult.auth?.method,
        });
      }
    } catch (error) {
      console.error('Failed to load Cursor settings:', error);
      toast.error('Failed to load Cursor settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDefaultModelChange = (model: CursorModelId) => {
    setIsSaving(true);
    try {
      setCursorDefaultModel(model);
      toast.success('Default model updated');
    } catch (error) {
      toast.error('Failed to update default model');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModelToggle = (model: CursorModelId, enabled: boolean) => {
    setIsSaving(true);
    try {
      toggleCursorModel(model, enabled);
    } catch (error) {
      toast.error('Failed to update models');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Usage Info skeleton */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-400/90">
            <span className="font-medium">Board View Only</span>
            <p className="text-xs text-amber-400/70 mt-1">
              Cursor is currently only available for the Kanban board agent tasks.
            </p>
          </div>
        </div>
        <CursorCliStatusSkeleton />
        <ModelConfigSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Usage Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-400/90">
          <span className="font-medium">Board View Only</span>
          <p className="text-xs text-amber-400/70 mt-1">
            Cursor is currently only available for the Kanban board agent tasks.
          </p>
        </div>
      </div>

      {/* CLI Status */}
      <CursorCliStatus status={status} isChecking={isLoading} onRefresh={loadData} />

      {/* Model Configuration - Always show (global settings) */}
      {status?.installed && (
        <div
          className={cn(
            'rounded-2xl overflow-hidden',
            'border border-border/50',
            'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
            'shadow-sm shadow-black/5'
          )}
        >
          <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 flex items-center justify-center border border-brand-500/20">
                <Terminal className="w-5 h-5 text-brand-500" />
              </div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Model Configuration
              </h2>
            </div>
            <p className="text-sm text-muted-foreground/80 ml-12">
              Configure which Cursor models are available in the feature modal
            </p>
          </div>
          <div className="p-6 space-y-6">
            {/* Default Model */}
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select
                value={cursorDefaultModel}
                onValueChange={(v) => handleDefaultModelChange(v as CursorModelId)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledCursorModels.map((modelId) => {
                    const model = CURSOR_MODEL_MAP[modelId];
                    if (!model) return null;
                    return (
                      <SelectItem key={modelId} value={modelId}>
                        <div className="flex items-center gap-2">
                          <span>{model.label}</span>
                          {model.hasThinking && (
                            <Badge variant="outline" className="text-xs">
                              Thinking
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Enabled Models */}
            <div className="space-y-3">
              <Label>Available Models</Label>
              <div className="grid gap-3">
                {availableModels.map((model) => {
                  const isEnabled = enabledCursorModels.includes(model.id);
                  const isAuto = model.id === 'auto';

                  return (
                    <div
                      key={model.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleModelToggle(model.id, !!checked)}
                          disabled={isSaving || isAuto}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{model.label}</span>
                            {model.hasThinking && (
                              <Badge variant="outline" className="text-xs">
                                Thinking
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </div>
                      </div>
                      <Badge variant={model.tier === 'free' ? 'default' : 'secondary'}>
                        {model.tier}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CursorSettingsTab;

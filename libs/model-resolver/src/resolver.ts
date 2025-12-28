/**
 * Model resolution utilities for handling model string mapping
 *
 * Provides centralized model resolution logic:
 * - Maps Claude model aliases to full model strings
 * - Passes through Cursor models unchanged (handled by CursorProvider)
 * - Provides default models per provider
 * - Handles multiple model sources with priority
 */

import { CLAUDE_MODEL_MAP, CURSOR_MODEL_MAP, DEFAULT_MODELS } from '@automaker/types';

/**
 * Resolve a model key/alias to a full model string
 *
 * @param modelKey - Model key (e.g., "opus", "cursor-composer-1", "claude-sonnet-4-20250514")
 * @param defaultModel - Fallback model if modelKey is undefined
 * @returns Full model string
 */
export function resolveModelString(
  modelKey?: string,
  defaultModel: string = DEFAULT_MODELS.claude
): string {
  console.log(
    `[ModelResolver] resolveModelString called with modelKey: "${modelKey}", defaultModel: "${defaultModel}"`
  );

  // No model specified - use default
  if (!modelKey) {
    console.log(`[ModelResolver] No model specified, using default: ${defaultModel}`);
    return defaultModel;
  }

  // Cursor model with explicit prefix (e.g., "cursor-composer-1") - pass through unchanged
  // CursorProvider will strip the prefix when calling the CLI
  if (modelKey.startsWith('cursor-')) {
    const cursorModelId = modelKey.replace('cursor-', '');
    // Verify it's a valid Cursor model
    if (cursorModelId in CURSOR_MODEL_MAP) {
      console.log(
        `[ModelResolver] Using Cursor model: ${modelKey} (valid model ID: ${cursorModelId})`
      );
      return modelKey;
    }
    // Could be a cursor-prefixed model not in our map yet - still pass through
    console.log(`[ModelResolver] Passing through cursor-prefixed model: ${modelKey}`);
    return modelKey;
  }

  // Check if it's a bare Cursor model ID (e.g., "composer-1", "auto", "gpt-4o")
  if (modelKey in CURSOR_MODEL_MAP) {
    // Return with cursor- prefix so provider routing works correctly
    const prefixedModel = `cursor-${modelKey}`;
    console.log(
      `[ModelResolver] Detected bare Cursor model ID: "${modelKey}" -> "${prefixedModel}"`
    );
    return prefixedModel;
  }

  // Full Claude model string - pass through unchanged
  if (modelKey.includes('claude-')) {
    console.log(`[ModelResolver] Using full Claude model string: ${modelKey}`);
    return modelKey;
  }

  // Look up Claude model alias
  const resolved = CLAUDE_MODEL_MAP[modelKey];
  if (resolved) {
    console.log(`[ModelResolver] Resolved Claude model alias: "${modelKey}" -> "${resolved}"`);
    return resolved;
  }

  // Unknown model key - use default
  console.warn(`[ModelResolver] Unknown model key "${modelKey}", using default: "${defaultModel}"`);
  return defaultModel;
}

/**
 * Get the effective model from multiple sources
 * Priority: explicit model > session model > default
 *
 * @param explicitModel - Explicitly provided model (highest priority)
 * @param sessionModel - Model from session (medium priority)
 * @param defaultModel - Fallback default model (lowest priority)
 * @returns Resolved model string
 */
export function getEffectiveModel(
  explicitModel?: string,
  sessionModel?: string,
  defaultModel?: string
): string {
  return resolveModelString(explicitModel || sessionModel, defaultModel);
}

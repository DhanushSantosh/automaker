/**
 * branch-utils - Shared git branch helper utilities
 *
 * Provides common git operations used by both checkout-branch-service and
 * worktree-branch-service. Extracted to avoid duplication and ensure
 * consistent behaviour across branch-related services.
 */

import { createLogger, getErrorMessage } from '@automaker/utils';
import { execGitCommand, execGitCommandWithLockRetry } from '../lib/git.js';

const logger = createLogger('BranchUtils');

// ============================================================================
// Types
// ============================================================================

export interface HasAnyChangesOptions {
  /**
   * When true, lines that refer to worktree-internal paths (containing
   * ".worktrees/" or ending with ".worktrees") are excluded from the count.
   * Use this in contexts where worktree directory entries should not be
   * considered as real working-tree changes (e.g. worktree-branch-service).
   */
  excludeWorktreePaths?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns true when a `git status --porcelain` output line refers to a
 * worktree-internal path that should be ignored when deciding whether there
 * are "real" local changes.
 */
function isExcludedWorktreeLine(line: string): boolean {
  return line.includes('.worktrees/') || line.endsWith('.worktrees');
}

// ============================================================================
// Exported Utilities
// ============================================================================

/**
 * Check if there are any changes (including untracked) that should be stashed.
 *
 * @param cwd - Working directory of the git repository / worktree
 * @param options - Optional flags controlling which lines are counted
 * @param options.excludeWorktreePaths - When true, lines matching worktree
 *   internal paths are excluded so they are not mistaken for real changes
 */
export async function hasAnyChanges(cwd: string, options?: HasAnyChangesOptions): Promise<boolean> {
  try {
    const stdout = await execGitCommand(['status', '--porcelain'], cwd);
    const lines = stdout
      .trim()
      .split('\n')
      .filter((line) => {
        if (!line.trim()) return false;
        if (options?.excludeWorktreePaths && isExcludedWorktreeLine(line)) return false;
        return true;
      });
    return lines.length > 0;
  } catch (err) {
    logger.error('hasAnyChanges: execGitCommand failed — returning false', {
      cwd,
      error: getErrorMessage(err),
    });
    return false;
  }
}

/**
 * Stash all local changes (including untracked files if requested).
 * Returns true if a stash was created, false if there was nothing to stash.
 * Throws on unexpected errors so callers abort rather than proceeding silently.
 *
 * @param cwd - Working directory of the git repository / worktree
 * @param message - Stash message
 * @param includeUntracked - When true, passes `--include-untracked` to git stash
 */
export async function stashChanges(
  cwd: string,
  message: string,
  includeUntracked: boolean = true
): Promise<boolean> {
  try {
    const args = ['stash', 'push'];
    if (includeUntracked) {
      args.push('--include-untracked');
    }
    args.push('-m', message);

    await execGitCommandWithLockRetry(args, cwd);
    return true;
  } catch (error) {
    const errorMsg = getErrorMessage(error);

    // "Nothing to stash" is benign – no work was lost, just return false
    if (
      errorMsg.toLowerCase().includes('no local changes to save') ||
      errorMsg.toLowerCase().includes('nothing to stash')
    ) {
      logger.debug('stashChanges: nothing to stash', { cwd, message, error: errorMsg });
      return false;
    }

    // Unexpected error – log full details and re-throw so the caller aborts
    // rather than proceeding with an un-stashed working tree
    logger.error('stashChanges: unexpected error during stash', {
      cwd,
      message,
      error: errorMsg,
    });
    throw new Error(`Failed to stash changes in ${cwd}: ${errorMsg}`);
  }
}

/**
 * Pop the most recent stash entry.
 * Returns an object indicating success and whether there were conflicts.
 *
 * @param cwd - Working directory of the git repository / worktree
 */
export async function popStash(
  cwd: string
): Promise<{ success: boolean; hasConflicts: boolean; error?: string }> {
  try {
    await execGitCommand(['stash', 'pop'], cwd);
    // If execGitCommand succeeds (zero exit code), there are no conflicts
    return { success: true, hasConflicts: false };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    if (errorMsg.includes('CONFLICT') || errorMsg.includes('Merge conflict')) {
      return { success: false, hasConflicts: true, error: errorMsg };
    }
    return { success: false, hasConflicts: false, error: errorMsg };
  }
}

/**
 * Check if a local branch already exists.
 *
 * @param cwd - Working directory of the git repository / worktree
 * @param branchName - The branch name to look up (without refs/heads/ prefix)
 */
export async function localBranchExists(cwd: string, branchName: string): Promise<boolean> {
  try {
    await execGitCommand(['rev-parse', '--verify', `refs/heads/${branchName}`], cwd);
    return true;
  } catch {
    return false;
  }
}

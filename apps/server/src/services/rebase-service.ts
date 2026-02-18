/**
 * RebaseService - Rebase git operations without HTTP
 *
 * Handles git rebase operations with conflict detection and reporting.
 * Follows the same pattern as merge-service.ts and cherry-pick-service.ts.
 */

import { createLogger } from '@automaker/utils';
import { execGitCommand } from '../routes/worktree/common.js';

const logger = createLogger('RebaseService');

// ============================================================================
// Types
// ============================================================================

export interface RebaseResult {
  success: boolean;
  error?: string;
  hasConflicts?: boolean;
  conflictFiles?: string[];
  aborted?: boolean;
  branch?: string;
  ontoBranch?: string;
  message?: string;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Run a git rebase operation on the given worktree.
 *
 * @param worktreePath - Path to the git worktree
 * @param ontoBranch - The branch to rebase onto (e.g., 'origin/main')
 * @returns RebaseResult with success/failure information
 */
export async function runRebase(worktreePath: string, ontoBranch: string): Promise<RebaseResult> {
  // Get current branch name before rebase
  const currentBranch = await getCurrentBranch(worktreePath);

  try {
    await execGitCommand(['rebase', ontoBranch], worktreePath);

    return {
      success: true,
      branch: currentBranch,
      ontoBranch,
      message: `Successfully rebased ${currentBranch} onto ${ontoBranch}`,
    };
  } catch (rebaseError: unknown) {
    // Check if this is a rebase conflict
    const err = rebaseError as { stdout?: string; stderr?: string; message?: string };
    const output = `${err.stdout || ''} ${err.stderr || ''} ${err.message || ''}`;
    const hasConflicts =
      output.includes('CONFLICT') ||
      output.includes('could not apply') ||
      output.includes('Resolve all conflicts') ||
      output.includes('fix conflicts');

    if (hasConflicts) {
      // Get list of conflicted files
      const conflictFiles = await getConflictFiles(worktreePath);

      // Abort the rebase to leave the repo in a clean state
      const aborted = await abortRebase(worktreePath);

      if (!aborted) {
        logger.error('Failed to abort rebase after conflict; repository may be in a dirty state', {
          worktreePath,
        });
      }

      return {
        success: false,
        error: aborted
          ? `Rebase of "${currentBranch}" onto "${ontoBranch}" aborted due to conflicts; no changes were applied.`
          : `Rebase of "${currentBranch}" onto "${ontoBranch}" failed due to conflicts and the abort also failed; repository may be in a dirty state.`,
        hasConflicts: true,
        conflictFiles,
        aborted,
        branch: currentBranch,
        ontoBranch,
      };
    }

    // Non-conflict error - propagate
    throw rebaseError;
  }
}

/**
 * Abort an in-progress rebase operation.
 *
 * @param worktreePath - Path to the git worktree
 * @returns true if abort succeeded, false if it failed (logged as warning)
 */
export async function abortRebase(worktreePath: string): Promise<boolean> {
  try {
    await execGitCommand(['rebase', '--abort'], worktreePath);
    return true;
  } catch {
    logger.warn('Failed to abort rebase after conflict');
    return false;
  }
}

/**
 * Get the list of files with unresolved conflicts.
 *
 * @param worktreePath - Path to the git worktree
 * @returns Array of file paths with conflicts
 */
export async function getConflictFiles(worktreePath: string): Promise<string[]> {
  try {
    const diffOutput = await execGitCommand(
      ['diff', '--name-only', '--diff-filter=U'],
      worktreePath
    );
    return diffOutput
      .trim()
      .split('\n')
      .filter((f) => f.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Get the current branch name for the worktree.
 *
 * @param worktreePath - Path to the git worktree
 * @returns The current branch name
 */
export async function getCurrentBranch(worktreePath: string): Promise<string> {
  const branchOutput = await execGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);
  return branchOutput.trim();
}

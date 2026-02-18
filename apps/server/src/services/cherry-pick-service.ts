/**
 * CherryPickService - Cherry-pick git operations without HTTP
 *
 * Extracted from worktree cherry-pick route to encapsulate all git
 * cherry-pick business logic in a single service. Follows the same
 * pattern as merge-service.ts.
 */

import { createLogger } from '@automaker/utils';
import { execGitCommand } from '../routes/worktree/common.js';

const logger = createLogger('CherryPickService');

// ============================================================================
// Types
// ============================================================================

export interface CherryPickOptions {
  noCommit?: boolean;
}

export interface CherryPickResult {
  success: boolean;
  error?: string;
  hasConflicts?: boolean;
  aborted?: boolean;
  cherryPicked?: boolean;
  commitHashes?: string[];
  branch?: string;
  message?: string;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Verify that each commit hash exists in the repository.
 *
 * @param worktreePath - Path to the git worktree
 * @param commitHashes - Array of commit hashes to verify
 * @returns The first invalid commit hash, or null if all are valid
 */
export async function verifyCommits(
  worktreePath: string,
  commitHashes: string[]
): Promise<string | null> {
  for (const hash of commitHashes) {
    try {
      await execGitCommand(['rev-parse', '--verify', hash], worktreePath);
    } catch {
      return hash;
    }
  }
  return null;
}

/**
 * Run the cherry-pick operation on the given worktree.
 *
 * @param worktreePath - Path to the git worktree
 * @param commitHashes - Array of commit hashes to cherry-pick (in order)
 * @param options - Cherry-pick options (e.g., noCommit)
 * @returns CherryPickResult with success/failure information
 */
export async function runCherryPick(
  worktreePath: string,
  commitHashes: string[],
  options?: CherryPickOptions
): Promise<CherryPickResult> {
  const args = ['cherry-pick'];
  if (options?.noCommit) {
    args.push('--no-commit');
  }
  args.push(...commitHashes);

  try {
    await execGitCommand(args, worktreePath);

    const branch = await getCurrentBranch(worktreePath);

    if (options?.noCommit) {
      return {
        success: true,
        cherryPicked: false,
        commitHashes,
        branch,
        message: `Staged changes from ${commitHashes.length} commit(s); no commit created due to --no-commit`,
      };
    }

    return {
      success: true,
      cherryPicked: true,
      commitHashes,
      branch,
      message: `Successfully cherry-picked ${commitHashes.length} commit(s)`,
    };
  } catch (cherryPickError: unknown) {
    // Check if this is a cherry-pick conflict
    const err = cherryPickError as { stdout?: string; stderr?: string; message?: string };
    const output = `${err.stdout || ''} ${err.stderr || ''} ${err.message || ''}`;
    const hasConflicts =
      output.includes('CONFLICT') ||
      output.includes('cherry-pick failed') ||
      output.includes('could not apply');

    if (hasConflicts) {
      // Abort the cherry-pick to leave the repo in a clean state
      const aborted = await abortCherryPick(worktreePath);

      if (!aborted) {
        logger.error(
          'Failed to abort cherry-pick after conflict; repository may be in a dirty state',
          { worktreePath }
        );
      }

      return {
        success: false,
        error: aborted
          ? 'Cherry-pick aborted due to conflicts; no changes were applied.'
          : 'Cherry-pick failed due to conflicts and the abort also failed; repository may be in a dirty state.',
        hasConflicts: true,
        aborted,
      };
    }

    // Non-conflict error - propagate
    throw cherryPickError;
  }
}

/**
 * Abort an in-progress cherry-pick operation.
 *
 * @param worktreePath - Path to the git worktree
 * @returns true if abort succeeded, false if it failed (logged as warning)
 */
export async function abortCherryPick(worktreePath: string): Promise<boolean> {
  try {
    await execGitCommand(['cherry-pick', '--abort'], worktreePath);
    return true;
  } catch {
    logger.warn('Failed to abort cherry-pick after conflict');
    return false;
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

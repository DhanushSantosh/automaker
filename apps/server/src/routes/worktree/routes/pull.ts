/**
 * POST /pull endpoint - Pull latest changes for a worktree/branch
 *
 * Enhanced pull flow with stash management and conflict detection:
 * 1. Checks for uncommitted local changes (staged and unstaged)
 * 2. If local changes exist AND stashIfNeeded is true, automatically stashes them
 * 3. Performs the git pull
 * 4. If changes were stashed, attempts to reapply via git stash pop
 * 5. Detects merge conflicts from both pull and stash reapplication
 * 6. Returns structured conflict information for AI-assisted resolution
 *
 * Note: Git repository validation (isGitRepo, hasCommits) is handled by
 * the requireValidWorktree middleware in index.ts
 */

import type { Request, Response } from 'express';
import { execGitCommand, getErrorMessage, logError } from '../common.js';

export function createPullHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, remote, stashIfNeeded } = req.body as {
        worktreePath: string;
        remote?: string;
        /** When true, automatically stash local changes before pulling and reapply after */
        stashIfNeeded?: boolean;
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: 'worktreePath required',
        });
        return;
      }

      // Get current branch name
      const branchOutput = await execGitCommand(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        worktreePath
      );
      const branchName = branchOutput.trim();

      // Check for detached HEAD state
      if (branchName === 'HEAD') {
        res.status(400).json({
          success: false,
          error: 'Cannot pull in detached HEAD state. Please checkout a branch first.',
        });
        return;
      }

      // Use specified remote or default to 'origin'
      const targetRemote = remote || 'origin';

      // Fetch latest from remote
      try {
        await execGitCommand(['fetch', targetRemote], worktreePath);
      } catch (fetchError) {
        const errorMsg = getErrorMessage(fetchError);
        res.status(500).json({
          success: false,
          error: `Failed to fetch from remote '${targetRemote}': ${errorMsg}`,
        });
        return;
      }

      // Check if there are local changes that would be overwritten
      const statusOutput = await execGitCommand(['status', '--porcelain'], worktreePath);
      const hasLocalChanges = statusOutput.trim().length > 0;

      // Parse changed files for the response
      let localChangedFiles: string[] = [];
      if (hasLocalChanges) {
        localChangedFiles = statusOutput
          .trim()
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line) => line.substring(3).trim());
      }

      // If there are local changes and stashIfNeeded is not requested, return info
      if (hasLocalChanges && !stashIfNeeded) {
        res.json({
          success: true,
          result: {
            branch: branchName,
            pulled: false,
            hasLocalChanges: true,
            localChangedFiles,
            message:
              'Local changes detected. Use stashIfNeeded to automatically stash and reapply changes.',
          },
        });
        return;
      }

      // Stash local changes if needed
      let didStash = false;
      if (hasLocalChanges && stashIfNeeded) {
        try {
          const stashMessage = `automaker-pull-stash: Pre-pull stash on ${branchName}`;
          await execGitCommand(
            ['stash', 'push', '--include-untracked', '-m', stashMessage],
            worktreePath
          );
          didStash = true;
        } catch (stashError) {
          const errorMsg = getErrorMessage(stashError);
          res.status(500).json({
            success: false,
            error: `Failed to stash local changes: ${errorMsg}`,
          });
          return;
        }
      }

      // Check if the branch has upstream tracking
      let hasUpstream = false;
      try {
        await execGitCommand(
          ['rev-parse', '--abbrev-ref', `${branchName}@{upstream}`],
          worktreePath
        );
        hasUpstream = true;
      } catch {
        // No upstream tracking - check if the remote branch exists
        try {
          await execGitCommand(
            ['rev-parse', '--verify', `${targetRemote}/${branchName}`],
            worktreePath
          );
          hasUpstream = true; // Remote branch exists, we can pull from it
        } catch {
          // Remote branch doesn't exist either
          if (didStash) {
            // Reapply stash since we won't be pulling
            try {
              await execGitCommand(['stash', 'pop'], worktreePath);
            } catch {
              // Stash pop failed - leave it in stash list for manual recovery
            }
          }
          res.status(400).json({
            success: false,
            error: `Branch '${branchName}' has no upstream branch on remote '${targetRemote}'. Push it first or set upstream with: git branch --set-upstream-to=${targetRemote}/${branchName}`,
          });
          return;
        }
      }

      // Pull latest changes
      let pullConflict = false;
      let pullConflictFiles: string[] = [];
      try {
        const pullOutput = await execGitCommand(['pull', targetRemote, branchName], worktreePath);

        // Check if we pulled any changes
        const alreadyUpToDate = pullOutput.includes('Already up to date');

        // If no stash to reapply, return success
        if (!didStash) {
          res.json({
            success: true,
            result: {
              branch: branchName,
              pulled: !alreadyUpToDate,
              hasLocalChanges: false,
              stashed: false,
              stashRestored: false,
              message: alreadyUpToDate ? 'Already up to date' : 'Pulled latest changes',
            },
          });
          return;
        }
      } catch (pullError: unknown) {
        const err = pullError as { stderr?: string; stdout?: string; message?: string };
        const errorOutput = `${err.stderr || ''} ${err.stdout || ''} ${err.message || ''}`;

        // Check for merge conflicts from the pull itself
        if (errorOutput.includes('CONFLICT') || errorOutput.includes('Automatic merge failed')) {
          pullConflict = true;
          // Get list of conflicted files
          try {
            const diffOutput = await execGitCommand(
              ['diff', '--name-only', '--diff-filter=U'],
              worktreePath
            );
            pullConflictFiles = diffOutput
              .trim()
              .split('\n')
              .filter((f) => f.trim().length > 0);
          } catch {
            // If we can't get the file list, that's okay
          }
        } else {
          // Non-conflict pull error
          if (didStash) {
            // Try to restore stash since pull failed
            try {
              await execGitCommand(['stash', 'pop'], worktreePath);
            } catch {
              // Leave stash in place for manual recovery
            }
          }

          // Check for common errors
          const errorMsg = err.stderr || err.message || 'Pull failed';
          if (errorMsg.includes('no tracking information')) {
            res.status(400).json({
              success: false,
              error: `Branch '${branchName}' has no upstream branch. Push it first or set upstream with: git branch --set-upstream-to=${targetRemote}/${branchName}`,
            });
            return;
          }

          res.status(500).json({
            success: false,
            error: errorMsg,
          });
          return;
        }
      }

      // If pull had conflicts, return conflict info (don't try stash pop)
      if (pullConflict) {
        res.json({
          success: true,
          result: {
            branch: branchName,
            pulled: true,
            hasConflicts: true,
            conflictSource: 'pull',
            conflictFiles: pullConflictFiles,
            stashed: didStash,
            stashRestored: false,
            message:
              `Pull resulted in merge conflicts. ${didStash ? 'Your local changes are still stashed.' : ''}`.trim(),
          },
        });
        return;
      }

      // Pull succeeded, now try to reapply stash
      if (didStash) {
        try {
          const stashPopOutput = await execGitCommand(['stash', 'pop'], worktreePath);
          const stashPopCombined = stashPopOutput || '';

          // Check if stash pop had conflicts
          if (
            stashPopCombined.includes('CONFLICT') ||
            stashPopCombined.includes('Merge conflict')
          ) {
            // Get conflicted files
            let stashConflictFiles: string[] = [];
            try {
              const diffOutput = await execGitCommand(
                ['diff', '--name-only', '--diff-filter=U'],
                worktreePath
              );
              stashConflictFiles = diffOutput
                .trim()
                .split('\n')
                .filter((f) => f.trim().length > 0);
            } catch {
              // If we can't get the file list, that's okay
            }

            res.json({
              success: true,
              result: {
                branch: branchName,
                pulled: true,
                hasConflicts: true,
                conflictSource: 'stash',
                conflictFiles: stashConflictFiles,
                stashed: true,
                stashRestored: true, // Stash was applied but with conflicts
                message:
                  'Pull succeeded but reapplying your stashed changes resulted in merge conflicts.',
              },
            });
            return;
          }

          // Stash pop succeeded cleanly
          res.json({
            success: true,
            result: {
              branch: branchName,
              pulled: true,
              hasConflicts: false,
              stashed: true,
              stashRestored: true,
              message: 'Pulled latest changes and restored your stashed changes.',
            },
          });
        } catch (stashPopError: unknown) {
          const err = stashPopError as { stderr?: string; stdout?: string; message?: string };
          const errorOutput = `${err.stderr || ''} ${err.stdout || ''} ${err.message || ''}`;

          // Check if stash pop failed due to conflicts
          if (errorOutput.includes('CONFLICT') || errorOutput.includes('Merge conflict')) {
            let stashConflictFiles: string[] = [];
            try {
              const diffOutput = await execGitCommand(
                ['diff', '--name-only', '--diff-filter=U'],
                worktreePath
              );
              stashConflictFiles = diffOutput
                .trim()
                .split('\n')
                .filter((f) => f.trim().length > 0);
            } catch {
              // If we can't get the file list, that's okay
            }

            res.json({
              success: true,
              result: {
                branch: branchName,
                pulled: true,
                hasConflicts: true,
                conflictSource: 'stash',
                conflictFiles: stashConflictFiles,
                stashed: true,
                stashRestored: true,
                message:
                  'Pull succeeded but reapplying your stashed changes resulted in merge conflicts.',
              },
            });
            return;
          }

          // Non-conflict stash pop error - stash is still in the stash list
          res.json({
            success: true,
            result: {
              branch: branchName,
              pulled: true,
              hasConflicts: false,
              stashed: true,
              stashRestored: false,
              message:
                'Pull succeeded but failed to reapply stashed changes. Your changes are still in the stash list.',
            },
          });
        }
      }
    } catch (error) {
      logError(error, 'Pull failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

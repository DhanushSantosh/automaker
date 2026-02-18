/**
 * POST /stash-apply endpoint - Apply or pop a stash in a worktree
 *
 * Applies a specific stash entry to the working directory.
 * Can either "apply" (keep stash) or "pop" (remove stash after applying).
 *
 * Note: Git repository validation (isGitRepo) is handled by
 * the requireGitRepoOnly middleware in index.ts
 */

import type { Request, Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage, logError } from '../common.js';

const execFileAsync = promisify(execFile);

/**
 * Retrieves the list of files with unmerged (conflicted) entries using git diff.
 */
async function getConflictedFiles(worktreePath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--diff-filter=U'], {
      cwd: worktreePath,
    });
    return stdout
      .trim()
      .split('\n')
      .filter((f) => f.trim().length > 0);
  } catch {
    // If we can't get the file list, return empty array
    return [];
  }
}

export function createStashApplyHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, stashIndex, pop } = req.body as {
        worktreePath: string;
        stashIndex: number;
        pop?: boolean;
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: 'worktreePath required',
        });
        return;
      }

      if (stashIndex === undefined || stashIndex === null) {
        res.status(400).json({
          success: false,
          error: 'stashIndex required',
        });
        return;
      }

      const idx = typeof stashIndex === 'string' ? Number(stashIndex) : stashIndex;

      if (!Number.isInteger(idx) || idx < 0) {
        res.status(400).json({
          success: false,
          error: 'stashIndex must be a non-negative integer',
        });
        return;
      }

      const stashRef = `stash@{${idx}}`;
      const operation = pop ? 'pop' : 'apply';

      try {
        const { stdout, stderr } = await execFileAsync('git', ['stash', operation, stashRef], {
          cwd: worktreePath,
        });

        const output = `${stdout}\n${stderr}`;

        // Check for conflict markers in the output
        if (output.includes('CONFLICT') || output.includes('Merge conflict')) {
          const conflictFiles = await getConflictedFiles(worktreePath);
          res.json({
            success: true,
            result: {
              applied: true,
              hasConflicts: true,
              conflictFiles,
              operation,
              stashIndex,
              message: `Stash ${operation === 'pop' ? 'popped' : 'applied'} with conflicts. Please resolve the conflicts.`,
            },
          });
          return;
        }

        res.json({
          success: true,
          result: {
            applied: true,
            hasConflicts: false,
            operation,
            stashIndex,
            message: `Stash ${operation === 'pop' ? 'popped' : 'applied'} successfully`,
          },
        });
      } catch (error) {
        const errorMsg = getErrorMessage(error);

        // Check if the error is due to conflicts
        if (errorMsg.includes('CONFLICT') || errorMsg.includes('Merge conflict')) {
          const conflictFiles = await getConflictedFiles(worktreePath);
          res.json({
            success: true,
            result: {
              applied: true,
              hasConflicts: true,
              conflictFiles,
              operation,
              stashIndex,
              message: `Stash ${operation === 'pop' ? 'popped' : 'applied'} with conflicts. Please resolve the conflicts.`,
            },
          });
          return;
        }

        throw error;
      }
    } catch (error) {
      logError(error, 'Stash apply failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

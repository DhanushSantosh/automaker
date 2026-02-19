/**
 * POST /stage-files endpoint - Stage or unstage files in a worktree
 *
 * Supports two operations:
 * 1. Stage files: `git add <files>` (adds files to the staging area)
 * 2. Unstage files: `git reset HEAD -- <files>` (removes files from staging area)
 *
 * Note: Git repository validation (isGitRepo) is handled by
 * the requireGitRepoOnly middleware in index.ts
 */

import path from 'path';
import fs from 'fs/promises';
import type { Request, Response } from 'express';
import { getErrorMessage, logError } from '../common.js';
import { execGitCommand } from '../../../lib/git.js';

export function createStageFilesHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, files, operation } = req.body as {
        worktreePath: string;
        files: string[];
        operation: 'stage' | 'unstage';
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: 'worktreePath required',
        });
        return;
      }

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'files array required and must not be empty',
        });
        return;
      }

      if (operation !== 'stage' && operation !== 'unstage') {
        res.status(400).json({
          success: false,
          error: 'operation must be "stage" or "unstage"',
        });
        return;
      }

      // Canonicalize the worktree root by resolving symlinks so that
      // path-traversal checks are reliable even when symlinks are involved.
      let canonicalRoot: string;
      try {
        canonicalRoot = await fs.realpath(worktreePath);
      } catch {
        res.status(400).json({
          success: false,
          error: 'worktreePath does not exist or is not accessible',
        });
        return;
      }

      // Validate and sanitize each file path to prevent path traversal attacks.
      // Each file entry is resolved against the canonicalized worktree root and
      // must remain within that root directory.
      const base = canonicalRoot + path.sep;
      const sanitizedFiles: string[] = [];
      for (const file of files) {
        // Reject absolute paths
        if (path.isAbsolute(file)) {
          res.status(400).json({
            success: false,
            error: `Invalid file path (absolute paths not allowed): ${file}`,
          });
          return;
        }
        // Reject entries containing '..'
        if (file.includes('..')) {
          res.status(400).json({
            success: false,
            error: `Invalid file path (path traversal not allowed): ${file}`,
          });
          return;
        }
        // Resolve the file path against the canonicalized worktree root and
        // ensure the result stays within the worktree directory.
        const resolved = path.resolve(canonicalRoot, file);
        if (resolved !== canonicalRoot && !resolved.startsWith(base)) {
          res.status(400).json({
            success: false,
            error: `Invalid file path (outside worktree directory): ${file}`,
          });
          return;
        }
        // Forward only the original relative path to git — git interprets
        // paths relative to its working directory (canonicalRoot / worktreePath),
        // so we do not need to pass the resolved absolute path.
        sanitizedFiles.push(file);
      }

      if (operation === 'stage') {
        // Stage the specified files
        await execGitCommand(['add', '--', ...sanitizedFiles], worktreePath);
      } else {
        // Unstage the specified files
        await execGitCommand(['reset', 'HEAD', '--', ...sanitizedFiles], worktreePath);
      }

      res.json({
        success: true,
        result: {
          operation,
          filesCount: sanitizedFiles.length,
        },
      });
    } catch (error) {
      logError(error, `${(req.body as { operation?: string })?.operation ?? 'stage'} files failed`);
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

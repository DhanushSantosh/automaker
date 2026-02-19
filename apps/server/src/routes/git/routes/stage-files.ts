/**
 * POST /stage-files endpoint - Stage or unstage files in the main project
 */

import path from 'path';
import type { Request, Response } from 'express';
import { getErrorMessage, logError } from '../common.js';
import { execGitCommand } from '../../../lib/git.js';

export function createStageFilesHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, files, operation } = req.body as {
        projectPath: string;
        files: string[];
        operation: 'stage' | 'unstage';
      };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath required',
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

      // Validate and sanitize each file path to prevent path traversal attacks
      const base = path.resolve(projectPath) + path.sep;
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
        // Ensure the resolved path stays within the project directory
        const resolved = path.resolve(path.join(projectPath, file));
        if (resolved !== path.resolve(projectPath) && !resolved.startsWith(base)) {
          res.status(400).json({
            success: false,
            error: `Invalid file path (outside project directory): ${file}`,
          });
          return;
        }
        sanitizedFiles.push(file);
      }

      if (operation === 'stage') {
        await execGitCommand(['add', '--', ...sanitizedFiles], projectPath);
      } else {
        await execGitCommand(['reset', 'HEAD', '--', ...sanitizedFiles], projectPath);
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

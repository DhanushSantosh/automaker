/**
 * POST /commit-log endpoint - Get recent commit history for a worktree
 *
 * Uses the same robust parsing approach as branch-commit-log-service:
 * a single `git log --name-only` call with custom separators to fetch
 * both commit metadata and file lists, avoiding N+1 git invocations.
 *
 * Note: Git repository validation (isGitRepo, hasCommits) is handled by
 * the requireValidWorktree middleware in index.ts
 */

import type { Request, Response } from 'express';
import { execGitCommand, getErrorMessage, logError } from '../common.js';

interface CommitResult {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  subject: string;
  body: string;
  files: string[];
}

export function createCommitLogHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, limit = 20 } = req.body as {
        worktreePath: string;
        limit?: number;
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: 'worktreePath required',
        });
        return;
      }

      // Clamp limit to a reasonable range
      const commitLimit = Math.min(Math.max(1, Number(limit) || 20), 100);

      // Use custom separators to parse both metadata and file lists from
      // a single git log invocation (same approach as branch-commit-log-service).
      //
      // -m causes merge commits to be diffed against each parent so all
      // files touched by the merge are listed (without -m, --name-only
      // produces no file output for merge commits because they have 2+ parents).
      // This means merge commits appear multiple times in the output (once per
      // parent), so we deduplicate by hash below and merge their file lists.
      // We over-fetch (2x the limit) to compensate for -m duplicating merge
      // commit entries, then trim the result to the requested limit.
      const COMMIT_SEP = '---COMMIT---';
      const META_END = '---META_END---';
      const fetchLimit = commitLimit * 2;

      const logOutput = await execGitCommand(
        [
          'log',
          `--max-count=${fetchLimit}`,
          '-m',
          '--name-only',
          `--format=${COMMIT_SEP}%n%H%n%h%n%an%n%ae%n%aI%n%s%n%b${META_END}`,
        ],
        worktreePath
      );

      // Split output into per-commit blocks and drop the empty first chunk
      // (the output starts with ---COMMIT---).
      const commitBlocks = logOutput.split(COMMIT_SEP).filter((block) => block.trim());

      // Use a Map to deduplicate merge commit entries (which appear once per
      // parent when -m is used) while preserving insertion order.
      const commitMap = new Map<string, CommitResult>();

      for (const block of commitBlocks) {
        const metaEndIdx = block.indexOf(META_END);
        if (metaEndIdx === -1) continue; // malformed block, skip

        // --- Parse metadata (everything before ---META_END---) ---
        const metaRaw = block.substring(0, metaEndIdx);
        const metaLines = metaRaw.split('\n');

        // The first line may be empty (newline right after COMMIT_SEP), skip it
        const nonEmptyStart = metaLines.findIndex((l) => l.trim() !== '');
        if (nonEmptyStart === -1) continue;

        const fields = metaLines.slice(nonEmptyStart);
        if (fields.length < 6) continue; // need at least hash..subject

        const hash = fields[0].trim();
        const shortHash = fields[1].trim();
        const author = fields[2].trim();
        const authorEmail = fields[3].trim();
        const date = fields[4].trim();
        const subject = fields[5].trim();
        const body = fields.slice(6).join('\n').trim();

        // --- Parse file list (everything after ---META_END---) ---
        const filesRaw = block.substring(metaEndIdx + META_END.length);
        const blockFiles = filesRaw
          .trim()
          .split('\n')
          .filter((f) => f.trim());

        // Merge file lists for duplicate entries (merge commits with -m)
        const existing = commitMap.get(hash);
        if (existing) {
          // Add new files to the existing entry's file set
          const fileSet = new Set(existing.files);
          for (const f of blockFiles) fileSet.add(f);
          existing.files = [...fileSet];
        } else {
          commitMap.set(hash, {
            hash,
            shortHash,
            author,
            authorEmail,
            date,
            subject,
            body,
            files: [...new Set(blockFiles)],
          });
        }
      }

      // Trim to the requested limit (we over-fetched to account for -m duplicates)
      const commits = [...commitMap.values()].slice(0, commitLimit);

      // Get current branch name
      const branchOutput = await execGitCommand(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        worktreePath
      );
      const branch = branchOutput.trim();

      res.json({
        success: true,
        result: {
          branch,
          commits,
          total: commits.length,
        },
      });
    } catch (error) {
      logError(error, 'Get commit log failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

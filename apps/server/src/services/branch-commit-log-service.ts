/**
 * Service for fetching branch commit log data.
 *
 * Extracts the heavy Git command execution and parsing logic from the
 * branch-commit-log route handler so the handler only validates input,
 * invokes this service, streams lifecycle events, and sends the response.
 */

import { execGitCommand } from '../routes/worktree/common.js';

// ============================================================================
// Types
// ============================================================================

export interface BranchCommit {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  subject: string;
  body: string;
  files: string[];
}

export interface BranchCommitLogResult {
  branch: string;
  commits: BranchCommit[];
  total: number;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Fetch the commit log for a specific branch (or HEAD).
 *
 * Runs a single `git log --name-only` invocation (plus `git rev-parse`
 * when branchName is omitted) inside the given worktree path and
 * returns a structured result.
 *
 * @param worktreePath - Absolute path to the worktree / repository
 * @param branchName   - Branch to query (omit or pass undefined for HEAD)
 * @param limit        - Maximum number of commits to return (clamped 1-100)
 */
export async function getBranchCommitLog(
  worktreePath: string,
  branchName: string | undefined,
  limit: number
): Promise<BranchCommitLogResult> {
  // Clamp limit to a reasonable range
  const parsedLimit = Number(limit);
  const commitLimit = Math.min(Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 20), 100);

  // Use the specified branch or default to HEAD
  const targetRef = branchName || 'HEAD';

  // Fetch commit metadata AND file lists in a single git call.
  // Uses custom record separators so we can parse both metadata and
  // --name-only output from one invocation, eliminating the previous
  // N+1 pattern that spawned a separate `git diff-tree` per commit.
  //
  // -m causes merge commits to be diffed against each parent so all
  // files touched by the merge are listed (without -m, --name-only
  // produces no file output for merge commits because they have 2+ parents).
  // This means merge commits appear multiple times in the output (once per
  // parent), so we deduplicate by hash below and merge their file lists.
  // We over-fetch (2× the limit) to compensate for -m duplicating merge
  // commit entries, then trim the result to the requested limit.
  const COMMIT_SEP = '---COMMIT---';
  const META_END = '---META_END---';
  const fetchLimit = commitLimit * 2;

  const logOutput = await execGitCommand(
    [
      'log',
      targetRef,
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
  const commitMap = new Map<string, BranchCommit>();

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

  // If branchName wasn't specified, get current branch for display
  let displayBranch = branchName;
  if (!displayBranch) {
    const branchOutput = await execGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);
    displayBranch = branchOutput.trim();
  }

  return {
    branch: displayBranch,
    commits,
    total: commits.length,
  };
}

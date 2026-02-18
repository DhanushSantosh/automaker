import { parseGitLogOutput } from '../src/lib/git-log-parser.js';

// Mock data with NUL-based separator
const mockGitOutput = `a1b2c3d4e5f67890abcd1234567890abcd1234\x00a1b2c3\x00John Doe\x00john@example.com\x002023-01-01T12:00:00Z\x00Initial commit\x00This is the commit body\x00e5f6g7h8i9j0klmnoprstuv\x00e5f6g7\x00Jane Smith\x00jane@example.com\x002023-01-02T12:00:00Z\x00Fix bug\x00Fixed the bug with ---END--- in the message\x00q1w2e3r4t5y6u7i8o9p0asdfghjkl\x00q1w2e3\x00Bob Johnson\x00bob@example.com\x002023-01-03T12:00:00Z\x00Another commit\x00Empty body\x00`;

// Mock data with problematic ---END--- in commit message
const mockOutputWithEndMarker = `a1b2c3d4e5f67890abcd1234567890abcd1234\x00a1b2c3\x00John Doe\x00john@example.com\x002023-01-01T12:00:00Z\x00Initial commit\x00This is the commit body\x00---END--- is in this message\x00e5f6g7h8i9j0klmnoprstuv\x00e5f6g7\x00Jane Smith\x00jane@example.com\x002023-01-02T12:00:00Z\x00Fix bug\x00Fixed the bug with ---END--- in the message\x00q1w2e3r4t5y6u7i8o9p0asdfghjkl\x00q1w2e3\x00Bob Johnson\x00bob@example.com\x002023-01-03T12:00:00Z\x00Another commit\x00Empty body\x00`;

console.log('Testing parseGitLogOutput with NUL-based separator...\n');

// Test 1: Normal parsing
console.log('Test 1: Normal parsing');
try {
  const commits = parseGitLogOutput(mockGitOutput);
  console.log(`✓ Parsed ${commits.length} commits successfully`);
  console.log('First commit:', commits[0]);
  console.log('Second commit:', commits[1]);
  console.log('Third commit:', commits[2]);
  console.log('');
} catch (error) {
  console.error('✗ Test 1 failed:', error);
}

// Test 2: Parsing with ---END--- in commit messages
console.log('Test 2: Parsing with ---END--- in commit messages');
try {
  const commits = parseGitLogOutput(mockOutputWithEndMarker);
  console.log(`✓ Parsed ${commits.length} commits successfully`);
  console.log('Commits with ---END--- in messages:');
  commits.forEach((commit, index) => {
    console.log(`${index + 1}. ${commit.subject}: "${commit.body}"`);
  });
  console.log('');
} catch (error) {
  console.error('✗ Test 2 failed:', error);
}

// Test 3: Empty output
console.log('Test 3: Empty output');
try {
  const commits = parseGitLogOutput('');
  console.log(`✓ Parsed ${commits.length} commits from empty output`);
  console.log('');
} catch (error) {
  console.error('✗ Test 3 failed:', error);
}

// Test 4: Output with only one commit
console.log('Test 4: Output with only one commit');
const singleCommitOutput = `a1b2c3d4e5f67890abcd1234567890abcd1234\x00a1b2c3\x00John Doe\x00john@example.com\x002023-01-01T12:00:00Z\x00Single commit\x00Single commit body\x00`;
try {
  const commits = parseGitLogOutput(singleCommitOutput);
  console.log(`✓ Parsed ${commits.length} commits successfully`);
  console.log('Single commit:', commits[0]);
  console.log('');
} catch (error) {
  console.error('✗ Test 4 failed:', error);
}

console.log('All tests completed!');

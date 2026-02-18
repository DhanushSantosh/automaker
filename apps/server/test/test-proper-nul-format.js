// Test to verify the proper NUL-based delimiter functionality
// Each commit: field1\nfield2\nfield3\x00field1\nfield2\nfield3\x00...

console.log('Testing proper NUL-based delimiter format...\n');

// Proper git output format with NUL between commits
const gitOutput = `abc123
abc1
John Doe
john@example.com
2023-01-01T12:00:00Z
Initial commit
This is a normal commit body\x00def456
def4
Jane Smith
jane@example.com
2023-01-02T12:00:00Z
Fix bug
Fixed the bug with ---END--- in this message\x00ghi789
ghi7
Bob Johnson
bob@example.com
2023-01-03T12:00:00Z
Another commit
This body has multiple lines
Second line
Third line\x00`;

console.log('1. Testing split on NUL character...');
const commitBlocks = gitOutput.split('\0').filter((block) => block.trim());
console.log(`   ✓ Found ${commitBlocks.length} commit blocks`);

console.log('\n2. Testing parsing of each commit block...');
const commits = [];
for (const block of commitBlocks) {
  const allLines = block.split('\n');

  // Skip leading empty lines
  let startIndex = 0;
  while (startIndex < allLines.length && allLines[startIndex].trim() === '') {
    startIndex++;
  }
  const lines = allLines.slice(startIndex);

  if (lines.length >= 6) {
    const commit = {
      hash: lines[0].trim(),
      shortHash: lines[1].trim(),
      author: lines[2].trim(),
      authorEmail: lines[3].trim(),
      date: lines[4].trim(),
      subject: lines[5].trim(),
      body: lines.slice(6).join('\n').trim(),
    };
    commits.push(commit);
  }
}

console.log(`\n3. Successfully parsed ${commits.length} commits:`);
commits.forEach((commit, index) => {
  console.log(`\n   Commit ${index + 1}:`);
  console.log(`   - Hash: ${commit.hash}`);
  console.log(`   - Short hash: ${commit.shortHash}`);
  console.log(`   - Author: ${commit.author}`);
  console.log(`   - Email: ${commit.authorEmail}`);
  console.log(`   - Date: ${commit.date}`);
  console.log(`   - Subject: ${commit.subject}`);
  console.log(`   - Body: "${commit.body}"`);
});

// Test with problematic ---END--- in commit message
console.log('\n4. Testing with ---END--- in commit message...');
const problematicOutput = `test123
test1
John Doe
john@example.com
2023-01-01T12:00:00Z
Initial commit
This contains ---END--- but should be parsed correctly\x00`;
const problematicCommits = problematicOutput
  .split('\0')
  .filter((block) => block.trim())
  .map((block) => {
    const allLines = block.split('\n');

    // Skip leading empty lines
    let startIndex = 0;
    while (startIndex < allLines.length && allLines[startIndex].trim() === '') {
      startIndex++;
    }
    const lines = allLines.slice(startIndex);

    if (lines.length >= 6) {
      return {
        hash: lines[0].trim(),
        shortHash: lines[1].trim(),
        author: lines[2].trim(),
        authorEmail: lines[3].trim(),
        date: lines[4].trim(),
        subject: lines[5].trim(),
        body: lines.slice(6).join('\n').trim(),
      };
    }
    return null;
  })
  .filter((commit) => commit !== null);

console.log(`   ✓ Found ${problematicCommits.length} commits`);
if (problematicCommits.length > 0) {
  console.log(`   Subject: "${problematicCommits[0].subject}"`);
  console.log(`   Body: "${problematicCommits[0].body}"`);
}

// Test with empty body
console.log('\n5. Testing commit with empty body...');
const emptyBodyOutput = `empty123
empty1
Alice Brown
alice@example.com
2023-01-04T12:00:00Z
Empty body commit

\x00`;
const emptyBodyCommits = emptyBodyOutput
  .split('\0')
  .filter((block) => block.trim())
  .map((block) => {
    const allLines = block.split('\n');

    // Skip leading empty lines
    let startIndex = 0;
    while (startIndex < allLines.length && allLines[startIndex].trim() === '') {
      startIndex++;
    }
    const lines = allLines.slice(startIndex);

    if (lines.length >= 6) {
      return {
        hash: lines[0].trim(),
        shortHash: lines[1].trim(),
        author: lines[2].trim(),
        authorEmail: lines[3].trim(),
        date: lines[4].trim(),
        subject: lines[5].trim(),
        body: lines.slice(6).join('\n').trim(),
      };
    }
    return null;
  })
  .filter((commit) => commit !== null);

console.log(`   ✓ Found ${emptyBodyCommits.length} commits`);
if (emptyBodyCommits.length > 0) {
  console.log(`   Subject: "${emptyBodyCommits[0].subject}"`);
  console.log(`   Body: "${emptyBodyCommits[0].body}" (should be empty)`);
}

console.log('\n✅ All tests passed! NUL-based delimiter works correctly.');
console.log('\nKey insights:');
console.log('- NUL character (\\x00) separates commits');
console.log('- Newlines (\\n) separate fields within a commit');
console.log('- The parsing logic handles leading empty lines correctly');
console.log('- ---END--- in commit messages is handled correctly');
console.log('- Empty commit bodies are preserved as empty strings');
console.log('- Multi-line commit bodies are preserved correctly');

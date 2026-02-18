// Simple test to understand the NUL character behavior

console.log('Testing NUL character behavior...\n');

// Create a string with NUL characters
const str1 =
  'abc123\x00abc1\x00John Doe\x00john@example.com\x002023-01-01T12:00:00Z\x00Initial commit\x00This is a normal commit body\x00';

console.log('Original string length:', str1.length);
console.log('String representation:', str1);

// Split on NUL
console.log('\n1. Split on NUL character:');
const parts = str1.split('\0');
console.log('Number of parts:', parts.length);
parts.forEach((part, index) => {
  console.log(`Part ${index}: "${part}" (length: ${part.length})`);
});

// Test with actual git format
console.log('\n2. Testing with actual git format:');
const gitFormat = `abc123\x00abc1\x00John Doe\x00john@example.com\x002023-01-01T12:00:00Z\x00Initial commit\x00Body text here\x00def456\x00def4\x00Jane Smith\x00jane@example.com\x002023-01-02T12:00:00Z\x00Second commit\x00Body with ---END--- text\x00`;

const gitParts = gitFormat.split('\0').filter((block) => block.trim());
console.log('Number of commits found:', gitParts.length);

console.log('\nAnalyzing each commit:');
gitParts.forEach((block, index) => {
  console.log(`\nCommit ${index + 1}:`);
  console.log(`Block: "${block}"`);
  const fields = block.split('\n');
  console.log(`Number of fields: ${fields.length}`);
  fields.forEach((field, fieldIndex) => {
    const fieldNames = ['hash', 'shortHash', 'author', 'authorEmail', 'date', 'subject', 'body'];
    console.log(`  ${fieldNames[fieldIndex] || `field${fieldIndex}`}: "${field}"`);
  });
});

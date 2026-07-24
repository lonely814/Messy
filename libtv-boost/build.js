// build.js — zero-dep build script for libtv-boost.user.js
// Usage: node build.js
// Reads src/style.css, src/inject.js, src/main.js → assembles libtv-boost.user.js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'libtv-boost.user.js');

/**
 * Convert a source file's lines into JS array string entries.
 * Each line becomes 'escaped_content', (with trailing comma, including last).
 * - Normalizes CRLF → LF so trailing \r doesn't end up inside strings.
 * - Escapes backslash, single quote, and control characters.
 */
function toArrayLines(str) {
  const lines = str.replace(/\r\n?/g, '\n').split('\n');
  return lines.map(line => {
    if (line === '') return "''";
    // Escape: backslash first, then single quote, then control chars
    let escaped = line.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    // Escape literal newlines that somehow survived the split
    // and other control characters to prevent JS parse errors
    escaped = escaped.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    return "'" + escaped + "'";
  });
}

function read(name) {
  return fs.readFileSync(path.join(SRC, name), 'utf-8');
}

function build() {
  // 1. Convert source files to array format
  const cssLines = toArrayLines(read('style.css'));
  const injectLines = toArrayLines(read('inject.js'));

  // 2. Read template and replace markers
  let main = read('main.js');
  main = main.replace('__INJECT_CSS__', cssLines.join(',\n'));
  main = main.replace('__INJECT_SCRIPT__', injectLines.join(',\n'));

  // 3. Write output
  fs.writeFileSync(OUT, main, 'utf-8');
  console.log('✓ Built: ' + OUT);
}

build();

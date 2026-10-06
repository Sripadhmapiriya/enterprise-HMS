import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_FILES = new Set([
  path.normalize('packages/ui/src/tokens.css'),
  path.normalize('apps/web/src/app/globals.css'),
]);

// Directories to scan
const SCAN_DIRS = [
  path.resolve('packages/ui/src'),
  path.resolve('apps/web/src'),
];

// Patterns that indicate hardcoded/fixed colors instead of semantic tokens:
// 1. Fixed Tailwind color palette classes (slate, zinc, red, cyan, emerald, etc.)
// 2. Fixed black/white classes (text-white, bg-white, text-black, bg-black, border-white, border-black)
// 3. Raw hex colors (#fff, #0891b2, etc.)
// 4. Raw rgb/rgba/hsl/hsla functions
const TAILWIND_SHADED_PALETTES = [
  'slate', 'gray', 'zinc', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
];

// Matches fixed tailwind palette utilities like bg-slate-900, text-red-500, border-cyan-200/50, etc.
// Leaves semantic tokens intact (e.g. bg-neutral-bg, text-neutral-text, etc.)
const tailwindFixedColorRegex = new RegExp(
  `\\b(bg|text|border|ring|divide|from|to|via|placeholder)-(?:(?:${TAILWIND_SHADED_PALETTES.join('|')})(?:-(?:50|100|200|300|400|500|600|700|800|900|950)|/[0-9]{1,3})?|neutral-(?:50|100|200|300|400|500|600|700|800|900|950)(?:/[0-9]{1,3})?)\\b`,
  'g'
);

const tailwindWhiteBlackRegex = /\b(bg|text|border)-(white|black)(\/[0-9]{1,3})?\b/g;

const hexColorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;

const rgbHslRegex = /\b(?:rgb|rgba|hsl|hsla)\([^)]+\)/g;

function collectFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== 'dist') {
        results = results.concat(collectFiles(fullPath));
      }
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

interface Violation {
  file: string;
  line: number;
  column: number;
  match: string;
  type: string;
}

function scanFile(filePath: string): Violation[] {
  const relative = path.relative(process.cwd(), filePath);
  if (ALLOWED_FILES.has(path.normalize(relative))) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    // Skip comments if desired, or check all code
    // Check tailwind palette
    let match: RegExpExecArray | null;

    // Reset lastIndex for global regexes
    tailwindFixedColorRegex.lastIndex = 0;
    while ((match = tailwindFixedColorRegex.exec(lineText)) !== null) {
      violations.push({
        file: relative,
        line: lineNum,
        column: match.index + 1,
        match: match[0],
        type: 'tailwind-fixed-color',
      });
    }

    tailwindWhiteBlackRegex.lastIndex = 0;
    while ((match = tailwindWhiteBlackRegex.exec(lineText)) !== null) {
      violations.push({
        file: relative,
        line: lineNum,
        column: match.index + 1,
        match: match[0],
        type: 'tailwind-white-black',
      });
    }

    hexColorRegex.lastIndex = 0;
    while ((match = hexColorRegex.exec(lineText)) !== null) {
      violations.push({
        file: relative,
        line: lineNum,
        column: match.index + 1,
        match: match[0],
        type: 'hex-color',
      });
    }

    rgbHslRegex.lastIndex = 0;
    while ((match = rgbHslRegex.exec(lineText)) !== null) {
      violations.push({
        file: relative,
        line: lineNum,
        column: match.index + 1,
        match: match[0],
        type: 'rgb-hsl-color',
      });
    }
  });

  return violations;
}

export function runCheck(): { passed: boolean; violations: Violation[]; summary: Record<string, number> } {
  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    allFiles.push(...collectFiles(dir));
  }

  const allViolations: Violation[] = [];
  const fileCounts: Record<string, number> = {};

  for (const file of allFiles) {
    const fileViolations = scanFile(file);
    if (fileViolations.length > 0) {
      const rel = path.relative(process.cwd(), file);
      fileCounts[rel] = fileViolations.length;
      allViolations.push(...fileViolations);
    }
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
    summary: fileCounts,
  };
}

if (require.main === module || process.argv[1]?.includes('check-no-hardcoded-colors')) {
  const isReportOnly = process.argv.includes('--report');
  console.log('🔍 Checking for hardcoded colors in app and component code...\n');

  const { passed, violations, summary } = runCheck();

  if (passed) {
    console.log('✅ ZERO hardcoded colors found! All styles use semantic tokens.');
    process.exit(0);
  } else {
    console.log(`❌ Found ${violations.length} hardcoded color occurrences across ${Object.keys(summary).length} files:\n`);
    const sorted = Object.entries(summary).sort((a, b) => b[1] - a[1]);
    for (const [file, count] of sorted) {
      console.log(`  - ${file}: ${count} occurrences`);
    }

    if (process.argv.includes('--verbose')) {
      console.log('\nDetailed occurrences (first 50):');
      for (const v of violations.slice(0, 50)) {
        console.log(`  ${v.file}:${v.line}:${v.column} [${v.type}] -> "${v.match}"`);
      }
    }

    if (isReportOnly) {
      console.log('\n(Report-only mode, exiting 0)');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

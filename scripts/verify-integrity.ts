import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  violations?: string[];
}

function walkDir(dir: string, filter: (file: string) => boolean): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', '.git', '.agents', '.claude'].includes(entry.name)) {
        continue;
      }
      results = results.concat(walkDir(fullPath, filter));
    } else if (filter(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Check: No "Phase" references
export function checkNoPhase(): CheckResult {
  const allFiles = walkDir(ROOT_DIR, (f) =>
    /\.(ts|tsx|js|jsx|json|md|prisma)$/.test(f)
  ).filter((f) => {
    const rel = path.relative(ROOT_DIR, f).replace(/\\/g, '/');
    return (
      !rel.includes('docs/redesign/PROGRESS.md') &&
      !rel.includes('HMS_REDESIGN_PROMPT.md') &&
      !rel.includes('tests/shell-a11y.test.ts') &&
      !rel.includes('scripts/verify-integrity.ts')
    );
  });

  const phaseRegex = /\bPhase\s*\d+\b/i;
  const violations: string[] = [];

  for (const file of allFiles) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      if (phaseRegex.test(line)) {
        const rel = path.relative(ROOT_DIR, file);
        violations.push(`${rel}:${idx + 1} - "${line.trim()}"`);
      }
    });
  }

  return {
    name: 'check:no-phase',
    passed: violations.length === 0,
    message: violations.length === 0
      ? 'Zero prohibited "Phase" references detected across all active source, schemas, seeds, and documentation.'
      : `Found ${violations.length} prohibited "Phase" references.`,
    violations,
  };
}

// 2. Check: No direct Prisma in apps/web
export function checkNoDirectPrismaInWeb(): CheckResult {
  const webDir = path.join(ROOT_DIR, 'apps', 'web', 'src');
  const webFiles = walkDir(webDir, (f) => /\.(ts|tsx)$/.test(f));
  const violations: string[] = [];

  for (const file of webFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('@prisma/client') || content.includes('@enterprise-hms/database')) {
      const rel = path.relative(ROOT_DIR, file);
      violations.push(`${rel} imports Prisma directly`);
    }
  }

  return {
    name: 'check:no-direct-prisma-in-web',
    passed: violations.length === 0,
    message: violations.length === 0
      ? 'Zero direct Prisma imports detected in apps/web. All pages use API client.'
      : `Found ${violations.length} direct Prisma imports in web app.`,
    violations,
  };
}

// 3. Check: Placeholders in shipped code
export function checkPlaceholders(): CheckResult {
  const targets = [
    path.join(ROOT_DIR, 'apps', 'web', 'src'),
    path.join(ROOT_DIR, 'apps', 'api', 'src'),
  ];
  const files: string[] = [];
  for (const t of targets) {
    files.push(...walkDir(t, (f) => /\.(ts|tsx)$/.test(f)));
  }

  const bannedPatterns = [
    /module active/i,
    /Pending donor data/i,
    /coming soon/i,
    /demo-token/i,
    /Lorem ipsum/i,
  ];

  const violations: string[] = [];

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      for (const pattern of bannedPatterns) {
        if (pattern.test(line)) {
          const rel = path.relative(ROOT_DIR, file);
          violations.push(`${rel}:${idx + 1} matches prohibited pattern ${pattern}`);
        }
      }
    });
  }

  return {
    name: 'check:placeholders',
    passed: violations.length === 0,
    message: violations.length === 0
      ? 'Zero prohibited placeholders detected in shipped API and web source.'
      : `Found ${violations.length} prohibited placeholder patterns.`,
    violations,
  };
}

// 4. Check: No committed secrets
export function checkNoCommittedSecrets(): CheckResult {
  const sensitiveFiles = ['.env', 'apps/api/.env', 'apps/web/.env'];
  const violations: string[] = [];

  for (const sf of sensitiveFiles) {
    const p = path.join(ROOT_DIR, sf);
    if (fs.existsSync(p)) {
      // Check if git tracks it
      try {
        const { execSync } = require('child_process');
        const tracked = execSync(`git ls-files ${sf}`, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
        if (tracked) {
          violations.push(`File ${sf} is tracked in git index`);
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    name: 'check:no-committed-secrets',
    passed: violations.length === 0,
    message: violations.length === 0
      ? 'No committed secrets or environment variable files in git tracking.'
      : `Found tracked secret files: ${violations.join(', ')}`,
    violations,
  };
}

export function runAllIntegrityChecks(): boolean {
  console.log('\n========================================');
  console.log('Running Monorepo Integrity Checks');
  console.log('========================================\n');

  const checks = [
    checkNoPhase(),
    checkNoDirectPrismaInWeb(),
    checkPlaceholders(),
    checkNoCommittedSecrets(),
  ];

  let allPassed = true;

  for (const check of checks) {
    if (check.passed) {
      console.log(`✓ [PASS] ${check.name}: ${check.message}`);
    } else {
      allPassed = false;
      console.error(`✗ [FAIL] ${check.name}: ${check.message}`);
      if (check.violations) {
        check.violations.forEach((v) => console.error(`    - ${v}`));
      }
    }
  }

  console.log('\n========================================\n');
  return allPassed;
}

if (require.main === module) {
  const success = runAllIntegrityChecks();
  process.exit(success ? 0 : 1);
}

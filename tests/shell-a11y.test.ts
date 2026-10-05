import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Workstream C: Shell, Navigation & Accessibility (a11y) Checks', () => {
  const webSrcDir = path.resolve(process.cwd(), 'apps/web/src');

  // Helper to recursively collect files
  function getTsxFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getTsxFiles(fullPath));
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(fullPath);
      }
    });
    return results;
  }

  it('prohibits emoji characters in apps/web/src (Icon SVG enforcement)', () => {
    const files = getTsxFiles(webSrcDir);
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const failures: Array<{ file: string; match: string }> = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(emojiRegex);
      if (match) {
        failures.push({
          file: path.relative(process.cwd(), file),
          match: match[0],
        });
      }
    });

    expect(failures).toEqual([]);
  });

  it('prohibits prohibited "Phase" terminology in apps/web/src', () => {
    const files = getTsxFiles(webSrcDir);
    const failures: Array<{ file: string; line: number; text: string }> = [];

    files.forEach((file) => {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (/\bPhase\s*\d+\b/i.test(line) || /Phase\s*\d+/i.test(line)) {
          failures.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            text: line.trim(),
          });
        }
      });
    });

    expect(failures).toEqual([]);
  });

  it('verifies that all AppShell navigation links route to existing Next.js page routes', () => {
    const appShellPath = path.resolve(webSrcDir, 'components/AppShell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf-8');

    // Extract all route string literals from NAV_SECTIONS
    const routeRegex = /route:\s*'([^']+)'/g;
    const routes: string[] = [];
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      routes.push(match[1]);
    }

    expect(routes.length).toBeGreaterThan(15);

    // Verify each route resolves to an app router directory containing page.tsx
    const appDir = path.resolve(webSrcDir, 'app/(dashboard)');
    const missingRoutes: string[] = [];

    routes.forEach((route) => {
      // Clean leading slash
      const relativeRoute = route.replace(/^\//, '');
      const possiblePagePath = path.resolve(appDir, relativeRoute, 'page.tsx');
      if (!fs.existsSync(possiblePagePath)) {
        // Also check root app dir (e.g. /login)
        const rootPagePath = path.resolve(webSrcDir, 'app', relativeRoute, 'page.tsx');
        if (!fs.existsSync(rootPagePath)) {
          missingRoutes.push(route);
        }
      }
    });

    expect(missingRoutes).toEqual([]);
  });

  it('verifies accessibility attributes across packages/ui component library', async () => {
    const uiSrcDir = path.resolve(process.cwd(), 'packages/ui/src');

    // 1. Dialog must have role="dialog", aria-modal="true", and aria-labelledby
    const dialogContent = fs.readFileSync(path.join(uiSrcDir, 'Dialog.tsx'), 'utf-8');
    expect(dialogContent).toContain('role="dialog"');
    expect(dialogContent).toContain('aria-modal="true"');
    expect(dialogContent).toContain('aria-labelledby');

    // 2. CommandPalette must have role="dialog", aria-modal="true", and keyboard navigation
    const commandContent = fs.readFileSync(path.join(uiSrcDir, 'CommandPalette.tsx'), 'utf-8');
    expect(commandContent).toContain('role="dialog"');
    expect(commandContent).toContain('aria-modal="true"');
    expect(commandContent).toContain('ArrowDown');
    expect(commandContent).toContain('ArrowUp');

    // 3. DataTable must have table semantics, aria-sort, aria-busy for skeletons, and csv export
    const dataTableContent = fs.readFileSync(path.join(uiSrcDir, 'DataTable.tsx'), 'utf-8');
    expect(dataTableContent).toContain('<table');
    expect(dataTableContent).toContain('scope="col"');
    expect(dataTableContent).toContain('aria-sort');
    expect(dataTableContent).toContain('exportToCsv');

    // 4. EmptyState and ErrorState must have appropriate aria live/status roles
    const emptyContent = fs.readFileSync(path.join(uiSrcDir, 'EmptyState.tsx'), 'utf-8');
    expect(emptyContent).toContain('role="status"');

    const errorContent = fs.readFileSync(path.join(uiSrcDir, 'ErrorState.tsx'), 'utf-8');
    expect(errorContent).toContain('role="alert"');

    // 5. Input must support aria-invalid and aria-describedby for validation
    const inputContent = fs.readFileSync(path.join(uiSrcDir, 'Input.tsx'), 'utf-8');
    expect(inputContent).toContain('aria-invalid');
    expect(inputContent).toContain('aria-describedby');
    expect(inputContent).toContain('role="alert"');
  });

  it('verifies Login page contains accessible form elements and PHI compliance notice', () => {
    const loginPath = path.resolve(webSrcDir, 'app/login/page.tsx');
    const content = fs.readFileSync(loginPath, 'utf-8');

    expect(content).toContain('type="email"');
    expect(content).toContain('type={showPassword ? \'text\' : \'password\'}');
    expect(content).toContain('role="alert"');
    expect(content).toContain('Protected Health Information (PHI)');
    expect(content).toContain('/api/v1/auth/login');
  });
});

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

let failed = false;

function getFiles(dir) {
  let results = [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    file = join(dir, file);
    const stat = statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      if (file.endsWith('page.tsx') || file.endsWith('layout.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = getFiles('apps/web/src/app');

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  // Check if it destructures params directly in the function signature
  const destructureRegex = /export\s+default\s+(?:async\s+)?function\s+\w+\s*\([^)]*\{\s*params\s*\}/;
  if (destructureRegex.test(content)) {
    // If it's a client component using use(params), it's fine
    // Or if it awaits params, it's fine
    const usesReactUse = /use\(params\)/.test(content);
    const awaitsParams = /await\s+params/.test(content);
    if (!usesReactUse && !awaitsParams) {
      console.error(`Error: File ${file} destructures params directly without awaiting or using React.use()`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('No direct params destructuring found.');
}

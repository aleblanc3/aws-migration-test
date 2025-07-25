const fs = require('fs');
const path = require('path');

const statsPath = path.resolve(__dirname, '../dist/content-assistant/stats.json');
const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

const inputs = stats.inputs || {};

// Set dependency groups
const manualGroups = {
  'angular and subdependencies': ['@angular', 'rxjs', 'zone.js', 'tslib'],
  'prime and subdependencies': ['primeng', 'primeflex', '@primeng', '@primeuix', 'primeicons'],
  'diff and subdependencies': ['highlight.js', 'prettier', 'diff2html', 'diff', 'hogan.js', '@ali-tas' ],
  'mammoth and subdependencies': ['bluebird', 'jszip', '@xmldom', 'dingbat-to-unicode', 'mammoth', 'xmlbuilder', 'underscore', 'lop', 'base64-js', 'option', ],
};

// Build flat size map
const flatSizes = {};

for (const inputPath in inputs) {
  if (!inputPath.includes('node_modules')) continue;

  const match = inputPath.match(/node_modules\/(@?[^\/]+)/);
  if (!match) continue;

  const pkg = match[1];
  const size = inputs[inputPath].bytes || 0;

  flatSizes[pkg] = (flatSizes[pkg] || 0) + size;
}

// Mark used sub-dependencies and build grouped entries
const used = new Set();
const entries = [];

for (const [groupName, deps] of Object.entries(manualGroups)) {
  let total = 0;
  const children = [];

  for (const dep of deps) {
    const size = flatSizes[dep] || 0;
    if (size > 0) {
      children.push({ dep, size });
      total += size;
      used.add(dep);
    }
  }

  entries.push({
    name: groupName,
    size: total,
    children,
  });
}

// Add ungrouped dependencies
for (const [pkg, size] of Object.entries(flatSizes)) {
  if (used.has(pkg)) continue;
  entries.push({ name: pkg, size });
}

// Sort by size
entries.sort((a, b) => b.size - a.size);

// Print results
console.log('\n\x1b[36mDependency sizes before tree-shaking:\x1b[0m');
for (const entry of entries) {
  console.log(`${entry.name}: ${(entry.size / 1024).toFixed(2)} KB`);
  if (entry.children) {
    for (const child of entry.children) {
      console.log(`- ${child.dep}: ${(child.size / 1024).toFixed(2)} KB`);
    }
  }
}
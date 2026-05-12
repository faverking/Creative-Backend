const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, 'dist', 'src');
const packageJsonPath = path.join(projectRoot, 'package.json');
const builtins = new Set(
  builtinModules.flatMap((moduleName) => [moduleName, moduleName.replace(/^node:/, '')]),
);

function readPackageJson() {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function walkJavaScriptFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkJavaScriptFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function getRootPackageName(specifier) {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/');
  }

  return specifier.split('/')[0];
}

function isRuntimePackageSpecifier(specifier) {
  return (
    specifier &&
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('node:')
  );
}

function collectRuntimeRequires(filePath, packages) {
  const source = fs.readFileSync(filePath, 'utf8');
  const requirePattern = /require\(["']([^"']+)["']\)/g;

  for (const match of source.matchAll(requirePattern)) {
    const specifier = match[1];

    if (!isRuntimePackageSpecifier(specifier)) {
      continue;
    }

    const packageName = getRootPackageName(specifier);

    if (builtins.has(packageName)) {
      continue;
    }

    if (!packages.has(packageName)) {
      packages.set(packageName, new Set());
    }

    packages.get(packageName).add(path.relative(projectRoot, filePath));
  }
}

if (!fs.existsSync(distRoot)) {
  console.error('Missing dist/src. Run `pnpm build` before checking production dependencies.');
  process.exit(1);
}

const packageJson = readPackageJson();
const dependencies = new Set(Object.keys(packageJson.dependencies || {}));
const runtimePackages = new Map();

for (const filePath of walkJavaScriptFiles(distRoot)) {
  collectRuntimeRequires(filePath, runtimePackages);
}

const missing = [...runtimePackages.entries()]
  .filter(([packageName]) => !dependencies.has(packageName))
  .sort(([left], [right]) => left.localeCompare(right));

if (missing.length === 0) {
  console.log('All runtime packages used by dist/src are declared in dependencies.');
  process.exit(0);
}

console.error('Runtime packages missing from dependencies:');
for (const [packageName, files] of missing) {
  console.error(`- ${packageName}`);
  for (const filePath of [...files].slice(0, 5)) {
    console.error(`  - ${filePath}`);
  }
}

process.exit(1);

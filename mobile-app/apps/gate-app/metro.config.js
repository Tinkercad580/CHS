// Monorepo Metro config so this app can resolve the @sahaj/shared workspace package.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// packages/* at the repo root (the API contract and client) live outside this
// workspace; Metro only bundles files inside a watched folder.
const sharedPackages = path.resolve(workspaceRoot, '../packages');
config.watchFolders = [workspaceRoot, sharedPackages];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Left at the default (false): some packages (e.g. expo-modules-core) are nested
// inside another package's node_modules rather than hoisted, and disabling
// hierarchical lookup breaks resolution of those.

// A bare import made from inside packages/* resolves as if this app made it.
// Those packages have no node_modules of their own worth using: the repo-root
// install that sits above them carries its own React, React Query and zod for
// typechecking, and resolving upward from the package would bundle those —
// a second React breaks every hook, a second React Query puts the provider
// and the hooks in different contexts. Relative imports are left alone.
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath.startsWith(sharedPackages + path.sep);
  const bare = !moduleName.startsWith('.') && !path.isAbsolute(moduleName);
  const ctx = fromShared && bare ? { ...context, originModulePath: path.join(projectRoot, 'package.json') } : context;
  return upstream ? upstream(ctx, moduleName, platform) : context.resolveRequest(ctx, moduleName, platform);
};

module.exports = config;

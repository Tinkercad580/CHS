// Monorepo Metro config so this app can resolve the @sahaj/shared workspace package.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Left at the default (false): some packages (e.g. expo-modules-core) are nested
// inside another package's node_modules rather than hoisted, and disabling
// hierarchical lookup breaks resolution of those.

module.exports = config;

const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

// Third line of defense for the `@ai-sdk/provider-utils` Metro fix (the
// primary fixes are bun's `patchedDependencies` in package.json and the
// postinstall hook — see scripts/patch-ai-provider-utils.js). If the installed
// copy is ever found unpatched, this generates a patched shim at config load
// time and redirects the package to it.
const SHIM_DIR = path.join(__dirname, ".metro-cache");
const SHIM_PATH = path.join(SHIM_DIR, "ai-provider-utils.metro.mjs");
const SOURCE_PATH = path.join(
  __dirname,
  "node_modules",
  "@ai-sdk",
  "provider-utils",
  "dist",
  "index.mjs",
);

const WRAPPER = "new Function('id', 'return import(id);')";

function ensureProviderUtilsShim() {
  try {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    if (source.includes(WRAPPER)) return;
    const patched = source.replace(
      /return import\(([^()]*)\);/g,
      (_match, id) => `return ${WRAPPER}(${id});`,
    );
    fs.mkdirSync(SHIM_DIR, { recursive: true });
    fs.writeFileSync(SHIM_PATH, patched);
  } catch {
    // Source not installed — resolver below falls through to default behavior.
  }
}

ensureProviderUtilsShim();

const config = getDefaultConfig(__dirname);
const rorkConfig = withRorkMetro(config);

const previousResolveRequest = rorkConfig.resolver.resolveRequest;
rorkConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "@ai-sdk/provider-utils" ||
    moduleName.startsWith("@ai-sdk/provider-utils/")
  ) {
    if (fs.existsSync(SHIM_PATH)) {
      return { filePath: SHIM_PATH, type: "sourceFile" };
    }
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = rorkConfig;

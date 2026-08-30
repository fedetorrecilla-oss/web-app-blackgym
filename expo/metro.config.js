const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

// `@ai-sdk/provider-utils` ships `return import(id);` in its dist bundle, which
// Metro cannot statically evaluate and fails the whole build with
// "Invalid call: import(id)". We generate a patched copy at config load time
// (i.e. on every Metro start, including CI builds) that wraps the dynamic
// import in a runtime `new Function`, and redirect resolution of the package
// to that copy. This survives dependency reinstalls.
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

function ensureProviderUtilsShim() {
  try {
    let source = fs.readFileSync(SOURCE_PATH, "utf8");
    source = source.replace(
      /return import\(([^()]*)\);/g,
      (_match, id) =>
        `return new Function('id', 'return import(id);')(${id});`,
    );
    fs.mkdirSync(SHIM_DIR, { recursive: true });
    fs.writeFileSync(SHIM_PATH, source);
  } catch {
    // Source not installed (fresh checkout before bun install) — the resolver
    // below simply falls through to the default behaviour.
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

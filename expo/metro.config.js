const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = withRorkMetro(getDefaultConfig(__dirname));

/**
 * @ai-sdk/provider-utils bundles `function importNodeModule(id) { return import(id); }`
 * which Metro cannot statically analyze ("Invalid call at line NNN: import(id)").
 * The dynamic import is Node-only dead code at runtime, so we generate a
 * Metro-safe copy (dynamic import hidden behind `new Function`) and redirect
 * resolution of `@ai-sdk/provider-utils` to it. Regenerated on each metro
 * start so it stays in sync with whatever version is installed.
 */
function makeProviderUtilsShim() {
  try {
    const pkgDir = path.dirname(
      require.resolve("@ai-sdk/provider-utils/package.json"),
    );
    const source = path.join(pkgDir, "dist", "index.mjs");
    const cacheDir = path.join(__dirname, ".metro-cache");
    const output = path.join(cacheDir, "ai-provider-utils.metro.mjs");

    const patched = fs
      .readFileSync(source, "utf8")
      .replace(
        /return\s+import\(id\);/g,
        'return new Function("id", "return import(id)")(id);',
      );

    if (
      !fs.existsSync(output) ||
      fs.readFileSync(output, "utf8") !== patched
    ) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(output, patched);
    }
    return output;
  } catch (error) {
    console.warn("[metro] @ai-sdk/provider-utils shim skipped:", error?.message);
    return null;
  }
}

const providerUtilsShim = makeProviderUtilsShim();

if (providerUtilsShim) {
  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "@ai-sdk/provider-utils") {
      return { type: "sourceFile", filePath: providerUtilsShim };
    }
    return originalResolveRequest(context, moduleName, platform);
  };
}

module.exports = config;

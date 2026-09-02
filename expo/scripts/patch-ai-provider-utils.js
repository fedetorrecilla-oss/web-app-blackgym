// Patches `@ai-sdk/provider-utils` so Metro can bundle it.
//
// The package's dist bundles contain `return import(id);` — a dynamic import
// Metro cannot statically evaluate, which fails the whole build with
// "Invalid call: import(id)". We rewrite it to a runtime-evaluated wrapper:
//
//   return new Function('id', 'return import(id);')(id);
//
// Also patches React Native's RCTTurboModule.mm — that logic lives in
// scripts/patch-rn-turbomodule.js (delegated below) and is additionally wired
// as the ./plugins/withTurboModulePatch Expo config plugin so it runs during
// `expo prebuild` even if install hooks are skipped in CI.
//
// Runs idempotently via the package.json `postinstall` hook so both patches are
// re-applied after every dependency install.
const fs = require("fs");
const path = require("path");

const FILES = [
  path.join(__dirname, "..", "node_modules", "@ai-sdk", "provider-utils", "dist", "index.mjs"),
  path.join(__dirname, "..", "node_modules", "@ai-sdk", "provider-utils", "dist", "index.js"),
];

const WRAPPER = "new Function('id', 'return import(id);')";

let patched = 0;
for (const file of FILES) {
  try {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes("return import(") || source.includes(WRAPPER)) continue;
    const updated = source.replace(
      /return import\(([^()]*)\);/g,
      (_match, id) => `return ${WRAPPER}(${id});`,
    );
    if (updated !== source) {
      fs.writeFileSync(file, updated);
      patched++;
    }
  } catch {
    // File not installed yet — nothing to patch.
  }
}

console.log(
  patched > 0
    ? `[patch-ai-provider-utils] patched ${patched} file(s).`
    : "[patch-ai-provider-utils] nothing to patch.",
);

// --- RCTTurboModule.mm: swallow NSException from async TM methods -----------
// Delegated to scripts/patch-rn-turbomodule.js, which covers BOTH crash paths
// (async void and async promise methods) and is shared with the config plugin.

const { patchRCTTurboModule } = require("./patch-rn-turbomodule");

const rnResult = patchRCTTurboModule(path.join(__dirname, ".."));
if (rnResult.status === "patched") {
  console.log(`[patch-rn-turbomodule] patched: ${rnResult.changes.join(", ")}.`);
} else if (rnResult.status === "unexpected") {
  console.warn(`[patch-rn-turbomodule] ${rnResult.status}: ${rnResult.reason}`);
}

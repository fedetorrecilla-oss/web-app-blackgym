// Expo config plugin: patches RCTTurboModule.mm during `expo prebuild`.
//
// This is the most reliable hook for CI builds — it runs on every native
// build regardless of which package manager installed dependencies, whereas
// bun patchedDependencies and postinstall hooks are not guaranteed in the
// build pipeline. The actual patch logic lives in
// scripts/patch-rn-turbomodule.js and is idempotent.
const { withDangerousMod } = require("@expo/config-plugins");
const { patchRCTTurboModule } = require("../scripts/patch-rn-turbomodule");

const withTurboModulePatch = (config) =>
  withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const result = patchRCTTurboModule(modConfig.modRequest.projectRoot);
      if (result.status === "unexpected" || result.status === "missing") {
        console.warn(
          `[withTurboModulePatch] ${result.status}${result.reason ? `: ${result.reason}` : ""}`,
        );
      }
      return modConfig;
    },
  ]);

module.exports = withTurboModulePatch;

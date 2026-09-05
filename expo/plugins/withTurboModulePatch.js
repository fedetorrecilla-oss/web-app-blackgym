// Expo config plugin: patches RCTTurboModule.mm and GUARANTEES it reaches the
// compiled binary.
//
// Two hooks, both idempotent:
//
//  1. withDangerousMod: patches node_modules during `expo prebuild`.
//
//  2. withXcodeProject: adds a Run Script build phase (first, before Compile
//     Sources) that re-applies the patch and verifies the marker on EVERY
//     xcodebuild. This is the layer that fixes the pipeline gap: CI builds use
//     the committed ios/ tree without running prebuild, and its dependency
//     install skipped both bun patchedDependencies and postinstall (builds
//     19/21/22 shipped unpatched). A build phase lives in the committed
//     pbxproj, so it runs no matter what installed node_modules — and fails
//     the build loudly if the patch cannot be applied, instead of shipping a
//     binary that crashes at launch.
//
// The actual patch logic lives in scripts/patch-rn-turbomodule.js and is
// idempotent + fail-fast (non-zero exit when it cannot patch).
const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const { patchRCTTurboModule } = require("../scripts/patch-rn-turbomodule");

const PHASE_NAME = "Black Gym - Patch and verify RN TurboModule";
const MM_PATH =
  "$SRCROOT/../node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm";
const SCRIPT_BODY = [
  "set -e",
  'node "$SRCROOT/../scripts/patch-rn-turbomodule.js"',
  `grep -q "BLACKGYM_CAPTURE_BEGIN" "${MM_PATH}"`,
  'echo "[BlackGym] RN TurboModule patch verified before Compile Sources."',
].join("\n");

const withTurboModuleBuildPhase = (config) =>
  withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const target = project.getFirstTarget();
    if (!target || !target.uuid) {
      console.warn("[withTurboModulePatch] native target not found — build phase not added");
      return modConfig;
    }

    // Idempotencia: la fase ya puede existir (ios/ commiteado + re-prebuilds).
    const phaseSection = project.hash.project.objects["PBXShellScriptBuildPhase"] || {};
    const alreadyThere = Object.keys(phaseSection).some(
      (key) => !key.endsWith("_comment") && phaseSection[key] && phaseSection[key].name === `"${PHASE_NAME}"`,
    );
    if (alreadyThere) {
      return modConfig;
    }

    project.addBuildPhase([], "PBXShellScriptBuildPhase", PHASE_NAME, target.uuid, {
      shellPath: "/bin/sh",
      shellScript: SCRIPT_BODY,
    });

    // xcode la agrega al final del target: moverla al frente para que corra
    // ANTES de Compile Sources (si no, el parche llegaría tarde).
    const nativeTarget = project.hash.project.objects["PBXNativeTarget"][target.uuid];
    const phases = nativeTarget.buildPhases;
    const last = phases.pop();
    if (last && last.comment === PHASE_NAME) {
      phases.unshift(last);
    } else if (last) {
      phases.push(last);
    }
    return modConfig;
  });

const withTurboModulePatch = (config) => {
  config = withDangerousMod(config, [
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
  config = withTurboModuleBuildPhase(config);
  return config;
};

module.exports = withTurboModulePatch;

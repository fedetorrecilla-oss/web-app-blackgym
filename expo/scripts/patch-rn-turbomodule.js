// Patches React Native's RCTTurboModule.mm so an NSException thrown by an
// async TurboModule method (void OR promise) is logged instead of crashing
// the app at launch on iOS 26 release builds.
//
// Why: upstream facebook/react-native#56265 re-throws the exception, but
// nothing on the async dispatch path catches it, so the app still terminates.
// A void method's JS side cannot receive an error at all, and a promise
// method's promise would hang — both are strictly better than a hard crash.
//
// Applied three ways so it ships regardless of the build pipeline's package
// manager:
//   1. bun patchedDependencies (patches/react-native@0.81.5.patch)
//   2. this script via package.json postinstall
//   3. the withTurboModulePatch Expo config plugin (runs during prebuild)
//
// All three produce the same final file content and are idempotent.
const fs = require("fs");
const path = require("path");

const MM_REL = path.join(
  "node_modules",
  "react-native",
  "ReactCommon",
  "react",
  "nativemodule",
  "core",
  "platform",
  "ios",
  "ReactCommon",
  "RCTTurboModule.mm",
);

const VOID_FN = "void ObjCTurboModule::performVoidMethodInvocation";
const VOID_MARKER = "[RCTTurboModule] Void method";
const PROMISE_MARKER = "[RCTTurboModule] Promise method";

// The @try/@catch/@finally block is identical in both invocation functions,
// so callers must scope this regex to the void-function slice of the file.
const VOID_CATCH_RE =
  /    @try \{\n      \[inv invokeWithTarget:strongModule\];\n    \} @catch \(NSException \*exception\) \{[\s\S]*?\n    \} @finally \{/;

const VOID_PATCHED = `    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      // App-level stability patch (see scripts/patch-rn-turbomodule.js): an
      // async void TurboModule method's JS side cannot receive an error (no
      // promise/callback), and nothing on the async dispatch path catches a
      // re-thrown exception, so it terminates the app at launch on iOS 26
      // release builds. Log the failure and keep the app running instead.
      NSLog(
          @"[RCTTurboModule] Void method %@.%@ threw %@: %@\\n%@",
          moduleName != nullptr ? [NSString stringWithUTF8String:moduleName] : @"unknown",
          [NSString stringWithUTF8String:methodNameStr.c_str()],
          exception.name,
          exception.reason ?: @"(no reason)",
          [exception callStackSymbols]);
    } @finally {`;

const PROMISE_PRISTINE = `      } else {
        @throw exception;
      }`;

const PROMISE_PATCHED = `      } else {
        // App-level stability patch (see scripts/patch-rn-turbomodule.js):
        // the re-thrown exception would terminate the app because nothing on
        // the async dispatch path catches it. Log the failure and leave the
        // promise unsettled instead of crashing.
        NSLog(
            @"[RCTTurboModule] Promise method %@.%@ threw %@: %@\\n%@",
            moduleName != nullptr ? [NSString stringWithUTF8String:moduleName] : @"unknown",
            [NSString stringWithUTF8String:methodNameStr.c_str()],
            exception.name,
            exception.reason ?: @"(no reason)",
            [exception callStackSymbols]);
      }`;

/**
 * Applies both RCTTurboModule.mm fixes idempotently.
 * @param {string} projectRoot
 * @returns {{status: "patched"|"already"|"missing"|"unexpected", changes: string[], reason?: string}}
 */
function patchRCTTurboModule(projectRoot) {
  const file = path.join(projectRoot, MM_REL);
  let source;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    return { status: "missing", changes: [] };
  }

  const idx = source.indexOf(VOID_FN);
  if (idx < 0) {
    return { status: "unexpected", changes: [], reason: "void function not found" };
  }
  let head = source.slice(0, idx);
  let tail = source.slice(idx);
  const changes = [];

  if (head.includes(PROMISE_MARKER)) {
    // Already patched.
  } else if (head.includes(PROMISE_PRISTINE)) {
    head = head.replace(PROMISE_PRISTINE, PROMISE_PATCHED);
    changes.push("promise-path");
  } else {
    return { status: "unexpected", changes: [], reason: "promise path content unrecognized" };
  }

  if (!tail.includes(VOID_MARKER)) {
    if (!VOID_CATCH_RE.test(tail)) {
      return { status: "unexpected", changes: [], reason: "void path content unrecognized" };
    }
    tail = tail.replace(VOID_CATCH_RE, VOID_PATCHED);
    changes.push("void-path");
  }

  if (!tail.includes("  (void)runtime;")) {
    tail = tail.replace(
      "    NSMutableArray *retainedObjectsForInvocation)\n{\n",
      "    NSMutableArray *retainedObjectsForInvocation)\n{\n  (void)runtime;\n",
    );
    changes.push("runtime-discard");
  }

  fs.writeFileSync(file, head + tail);
  return { status: changes.length ? "patched" : "already", changes };
}

module.exports = { patchRCTTurboModule };

if (require.main === module) {
  const result = patchRCTTurboModule(path.join(__dirname, ".."));
  if (result.status === "patched") {
    console.log(`[patch-rn-turbomodule] patched: ${result.changes.join(", ")}.`);
  } else if (result.status === "already") {
    console.log("[patch-rn-turbomodule] already patched.");
  } else {
    console.log(
      `[patch-rn-turbomodule] ${result.status}${result.reason ? `: ${result.reason}` : ""} — manual review needed.`,
    );
  }
}

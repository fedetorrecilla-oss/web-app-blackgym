// Patches `@ai-sdk/provider-utils` so Metro can bundle it.
//
// The package's dist bundles contain `return import(id);` — a dynamic import
// Metro cannot statically evaluate, which fails the whole build with
// "Invalid call: import(id)". We rewrite it to a runtime-evaluated wrapper:
//
//   return new Function('id', 'return import(id);')(id);
//
// Also patches React Native's RCTTurboModule.mm so an NSException thrown by an
// async void TurboModule method is logged instead of crashing the app at
// launch (iOS 26 release builds; upstream facebook/react-native#56265 only
// re-throws, which still terminates the app).
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

// --- RCTTurboModule.mm: swallow NSException from async void methods ---------

const TURBO_MODULE_MM = path.join(
  __dirname,
  "..",
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

const UNSAFE_VOID_CATCH =
  "      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);\n" +
  "    } @finally {";

const SAFE_VOID_CATCH =
  "      // App-level stability patch (on top of upstream facebook/react-native#56265):\n" +
  "      // converting to JSError corrupts Hermes (SIGABRT on iOS 26 release builds),\n" +
  "      // and re-throwing still terminates the app because nothing on the async\n" +
  "      // dispatch path catches the exception. A void method's JS side cannot\n" +
  "      // receive an error (no promise/callback), so log the failure and keep the\n" +
  "      // app running instead of crashing at launch.\n" +
  '      NSLog(\n' +
  '          @"[RCTTurboModule] Void method %@.%@ threw %@: %@\\n%@",\n' +
  '          moduleName != nullptr ? [NSString stringWithUTF8String:moduleName] : @"unknown",\n' +
  '          [NSString stringWithUTF8String:methodNameStr.c_str()],\n' +
  '          exception.name,\n' +
  '          exception.reason ?: @"(no reason)",\n' +
  '          [exception callStackSymbols]);\n' +
  "    } @finally {";

try {
  const source = fs.readFileSync(TURBO_MODULE_MM, "utf8");
  if (source.includes(SAFE_VOID_CATCH)) {
    console.log("[patch-rn-turbomodule] already patched.");
  } else if (source.includes(UNSAFE_VOID_CATCH)) {
    fs.writeFileSync(TURBO_MODULE_MM, source.replace(UNSAFE_VOID_CATCH, SAFE_VOID_CATCH));
    console.log("[patch-rn-turbomodule] patched RCTTurboModule.mm void-method exception handling.");
  } else {
    console.log("[patch-rn-turbomodule] unexpected RCTTurboModule.mm content — manual review needed.");
  }
} catch {
  // react-native not installed yet — nothing to patch.
}

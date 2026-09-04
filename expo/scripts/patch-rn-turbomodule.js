// Patches React Native's RCTTurboModule.mm so an NSException thrown by an
// async TurboModule method (void OR promise) is logged instead of crashing
// the app at launch on iOS 26 release builds.
//
// Why: upstream facebook/react-native#56265 re-throws the exception, but
// nothing on the async dispatch path catches it, so the app still terminates.
// A void method's JS side cannot receive an error at all, and a promise
// method's promise would hang — both are strictly better than a hard crash.
//
// V2 additionally captures the culprit (module, method, reason, stack) into
// the Black Gym report channel (Library/Caches/blackgym_last_crash.txt) and
// uploads it to the backend in the background, so a caught exception still
// tells us WHO threw it even though the app no longer terminates.
//
// Applied three ways so it ships regardless of the build pipeline's package
// manager:
//   1. bun patchedDependencies (patches/react-native@0.81.5.patch)
//   2. this script via package.json postinstall
//   3. the withTurboModulePatch Expo config plugin (runs during prebuild)
//
// All three produce the same final file content and are idempotent. The
// script also upgrades V1 (log-only) installs in place.
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
const CAPTURE_MARKER = "BLACKGYM_CAPTURE_BEGIN";

// The @try/@catch/@finally block is identical in both invocation functions,
// so callers must scope this regex to the void-function slice of the file.
const VOID_CATCH_RE =
  /    @try \{\n      \[inv invokeWithTarget:strongModule\];\n    \} @catch \(NSException \*exception\) \{[\s\S]*?\n    \} @finally \{/;

// ObjC++ snippet injected into both @catch blocks. Uses only Foundation
// (no UIKit import needed) and never blocks the calling thread.
const CAPTURE_LINES = String.raw`{
  // BLACKGYM_CAPTURE_BEGIN: guarda al culpable en el canal de reportes de
  // Black Gym y lo sube al backend en background. Así la excepción atrapada
  // sigue diciéndonos QUIÉN la lanzó aunque el app ya no termine.
  @autoreleasepool {
    NSString *bgModule = moduleName != nullptr ? [NSString stringWithUTF8String:moduleName] : @"unknown";
    NSString *bgMethod = [NSString stringWithUTF8String:methodNameStr.c_str()];
    NSString *bgReport = [NSString stringWithFormat:
        @"[Black Gym] TurboModule exception (caught; app kept running)\nat: %@\nmodule: %@\nmethod: %@\nname: %@\nreason: %@\nstack:\n%@",
        [NSDate date], bgModule, bgMethod, exception.name,
        exception.reason ?: @"(no reason)", [exception callStackSymbols]];
    NSString *bgCaches = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject ?: NSTemporaryDirectory();
    NSString *bgPath = [bgCaches stringByAppendingPathComponent:@"blackgym_last_crash.txt"];
    NSMutableString *bgExisting = [NSMutableString stringWithContentsOfFile:bgPath encoding:NSUTF8StringEncoding error:NULL];
    if (bgExisting.length > 200000) {
      bgExisting = [NSMutableString new];
    }
    if (bgExisting.length > 0) {
      [bgExisting appendString:@"\n\n====\n\n"];
    }
    [bgExisting appendString:bgReport];
    [bgExisting writeToFile:bgPath atomically:YES encoding:NSUTF8StringEncoding error:NULL];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
      @autoreleasepool {
        NSDictionary *bgPayload = @{
          @"json": @{
            @"report": bgReport,
            @"build": [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"] ?: @"?",
            @"device": [[NSProcessInfo processInfo] operatingSystemVersionString],
          },
        };
        NSData *bgBody = [NSJSONSerialization dataWithJSONObject:bgPayload options:0 error:NULL];
        if (bgBody == nil) {
          return;
        }
        NSArray<NSString *> *bgBases = @[
          [[NSBundle mainBundle] objectForInfoDictionaryKey:@"BlackGymDiagnosticsBaseURL"] ?: @"",
          [[NSBundle mainBundle] objectForInfoDictionaryKey:@"BlackGymDiagnosticsFallbackURL"] ?: @"",
        ];
        for (NSString *bgBase in bgBases) {
          if (bgBase.length == 0) {
            continue;
          }
          NSURL *bgURL = [NSURL URLWithString:[bgBase stringByAppendingString:@"/api/trpc/crash.submit"]];
          if (bgURL == nil) {
            continue;
          }
          NSMutableURLRequest *bgRequest = [NSMutableURLRequest requestWithURL:bgURL];
          bgRequest.HTTPMethod = @"POST";
          [bgRequest setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
          bgRequest.timeoutInterval = 10;
          bgRequest.HTTPBody = bgBody;
          __block BOOL bgOK = NO;
          dispatch_semaphore_t bgSem = dispatch_semaphore_create(0);
          NSURLSessionDataTask *bgTask = [[NSURLSession sharedSession]
              dataTaskWithRequest:bgRequest
              completionHandler:^(NSData *bgData, NSURLResponse *bgResponse, NSError *bgError) {
                bgOK = bgError == nil && [bgResponse isKindOfClass:[NSHTTPURLResponse class]] &&
                    ((NSHTTPURLResponse *)bgResponse).statusCode == 200;
                dispatch_semaphore_signal(bgSem);
              }];
          [bgTask resume];
          dispatch_semaphore_wait(bgSem, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(12 * NSEC_PER_SEC)));
          if (bgOK) {
            NSLog(@"[Black Gym] reporte TurboModule subido OK");
            [[NSFileManager defaultManager] removeItemAtPath:bgPath error:NULL];
            return;
          }
          NSLog(@"[Black Gym] upload TurboModule falló");
          [NSThread sleepForTimeInterval:3.0];
        }
      }
    });
  }
}`;

function captureCode(pad) {
  return CAPTURE_LINES.split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

// V1 (log-only) bodies, kept for in-place upgrades of already-patched trees.
const VOID_BODY_V1 = String.raw`    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      // App-level stability patch (on top of upstream facebook/react-native#56265):
      // converting to JSError corrupts Hermes (SIGABRT on iOS 26 release builds),
      // and re-throwing still terminates the app because nothing on the async
      // dispatch path catches the exception. A void method's JS side cannot
      // receive an error (no promise/callback), so log the failure and keep the
      // app running instead of crashing at launch.
      NSLog(
          @"[RCTTurboModule] Void method %@.%@ threw %@: %@\n%@",
          moduleName != nullptr ? [NSString stringWithUTF8String:moduleName] : @"unknown",
          [NSString stringWithUTF8String:methodNameStr.c_str()],
          exception.name,
          exception.reason ?: @"(no reason)",
          [exception callStackSymbols]);`;

const PROMISE_PATCHED_V1 = String.raw`      } else {
        // App-level stability patch (see scripts/patch-rn-turbomodule.js):
        // the re-thrown exception would terminate the app because nothing on
        // the async dispatch path catches it. Log the failure and leave the
        // promise unsettled instead of crashing.
        NSLog(
            @"[RCTTurboModule] Promise method %@.%@ threw %@: %@\n%@",
            moduleName != nullptr ? [NSString stringWithUTF8String:moduleName] : @"unknown",
            [NSString stringWithUTF8String:methodNameStr.c_str()],
            exception.name,
            exception.reason ?: @"(no reason)",
            [exception callStackSymbols]);
      }`;

// V2: V1 logging + culprit capture/upload.
const VOID_PATCHED = `${VOID_BODY_V1}
${captureCode("      ")}
    } @finally {`;

const VOID_PATCHED_V1 = `${VOID_BODY_V1}
    } @finally {`;

const PROMISE_PATCHED = `${PROMISE_PATCHED_V1.slice(0, -"      }".length)}${captureCode("        ")}
      }`;

const PROMISE_PRISTINE = `      } else {
        @throw exception;
      }`;

/**
 * Applies both RCTTurboModule.mm fixes idempotently (and upgrades V1 installs).
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
    if (head.includes(CAPTURE_MARKER)) {
      // Already V2.
    } else if (head.includes(PROMISE_PATCHED_V1)) {
      head = head.replace(PROMISE_PATCHED_V1, PROMISE_PATCHED);
      changes.push("promise-path-upgrade");
    } else {
      return { status: "unexpected", changes: [], reason: "promise path V1 unrecognized" };
    }
  } else if (head.includes(PROMISE_PRISTINE)) {
    head = head.replace(PROMISE_PRISTINE, PROMISE_PATCHED);
    changes.push("promise-path");
  } else {
    return { status: "unexpected", changes: [], reason: "promise path content unrecognized" };
  }

  if (tail.includes(VOID_MARKER)) {
    if (tail.includes(CAPTURE_MARKER)) {
      // Already V2.
    } else if (tail.includes(VOID_PATCHED_V1)) {
      tail = tail.replace(VOID_PATCHED_V1, VOID_PATCHED);
      changes.push("void-path-upgrade");
    } else {
      return { status: "unexpected", changes: [], reason: "void path V1 unrecognized" };
    }
  } else if (VOID_CATCH_RE.test(tail)) {
    tail = tail.replace(VOID_CATCH_RE, VOID_PATCHED);
    changes.push("void-path");
  } else {
    return { status: "unexpected", changes: [], reason: "void path content unrecognized" };
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

// Expo config plugin: Black Gym crash diagnostics.
//
// Build 4/9/11/12 all die ~250-300ms after launch inside RN's TurboModule
// void-method dispatch, and Apple crash reports show no "Last Exception
// Backtrace", which means the terminal exception is a C++ exception
// (jsi::JSError), not a plain NSException — so NSSetUncaughtExceptionHandler
// alone would never fire. This plugin therefore installs BOTH:
//
//   1. A std::terminate handler (ObjC++, __attribute__((constructor)), runs
//      before main) that unwraps the in-flight exception — ObjC or C++ — and
//      prints its name/reason. For jsi::JSError, what() contains
//      "<ModuleName>.<methodName> raised an exception: <reason>", which
//      finally names the culprit module.
//   2. NSSetUncaughtExceptionHandler in the AppDelegate for plain ObjC
//      exceptions.
//
// Reports go to NSLog, to Library/Caches/blackgym_last_crash.txt, and to the
// UIPasteboard (survives relaunch — paste into Notes to read it) so the data
// is recoverable from a TestFlight device even while the app keeps crashing.
//
// Everything here is first-party app-target code (AppDelegate + a new .mm in
// the Xcode project), not a node_modules patch, so it cannot be dropped by
// whatever was skipping the RN patches.

const fs = require("fs");
const path = require("path");
const {
  withAppDelegate,
  withDangerousMod,
  withXcodeProject,
} = require("@expo/config-plugins");

const BEGIN = "// BLACKGYM_CRASH_DIAGNOSTICS_BEGIN";
const END = "// BLACKGYM_CRASH_DIAGNOSTICS_END";

const swiftDiagnostics = String.raw`${BEGIN}
import UIKit

final class CrashDiagnostics: NSObject {
  static let reportPath: String = {
    let caches = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true).first ?? NSTemporaryDirectory()
    return (caches as NSString).appendingPathComponent("blackgym_last_crash.txt")
  }()

  static func install() {
    NSSetUncaughtExceptionHandler { exception in
      let stack = exception.callStackSymbols.joined(separator: "\n")
      let report = "[Black Gym] Uncaught NSException\nname: \(exception.name.rawValue)\nreason: \(exception.reason ?? "(none)")\nstack:\n\(stack)"
      CrashDiagnostics.handle(report)
    }
  }

  static func handle(_ report: String) {
    NSLog("%@", report)
    try? report.write(toFile: reportPath, atomically: true, encoding: .utf8)
    UIPasteboard.general.string = report
  }
}
${END}`;

const objcDiagnostics = String.raw`// BLACKGYM CRASH DIAGNOSTICS — std::terminate handler (installed before main).
// See plugins/withCrashDiagnostics.js for the rationale.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#include <exception>
#include <execinfo.h>

static std::terminate_handler g_previousTerminateHandler = nullptr;

static void BlackGymWriteReport(NSString *report) {
  NSLog(@"%@", report);

  NSArray<NSString *> *caches =
      NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *path = [caches.firstObject stringByAppendingPathComponent:@"blackgym_last_crash.txt"];
  [report writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:NULL];

  // Survives relaunch: the user can paste this into Notes even while the app
  // keeps crashing at launch.
  UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
  pasteboard.string = report;
}

// ObjC and C++ exceptions share the Itanium ABI on arm64, so the in-flight
// exception can be re-thrown and re-caught to identify its type.
static NSString *BlackGymDescribeObjCException(std::exception_ptr eptr) {
  @try {
    std::rethrow_exception(eptr);
  } @catch (NSException *exception) {
    NSString *stack = [exception.callStackSymbols componentsJoinedByString:@"\n"];
    return [NSString stringWithFormat:@"ObjC NSException\nname: %@\nreason: %@\nstack:\n%@",
                                      exception.name, exception.reason ?: @"(none)", stack];
  } @catch (...) {
    return nil;
  }
}

static NSString *BlackGymDescribeCppException(std::exception_ptr eptr) {
  try {
    std::rethrow_exception(eptr);
  } catch (const std::exception &e) {
    void *frames[64];
    int count = backtrace(frames, 64);
    char **symbols = backtrace_symbols(frames, count);
    NSMutableString *stack = [NSMutableString string];
    for (int i = 0; i < count; i++) {
      [stack appendFormat:@"%s\n", symbols[i]];
    }
    free(symbols);
    return [NSString stringWithFormat:@"C++ std::exception\nwhat(): %s\nbacktrace:\n%@", e.what(), stack];
  } catch (...) {
    return @"C++ exception of unknown type";
  }
}

static void BlackGymTerminateHandler(void) {
  NSMutableString *report =
      [NSMutableString stringWithString:@"[Black Gym] std::terminate — uncaught exception\n"];

  std::exception_ptr eptr = std::current_exception();
  if (eptr) {
    NSString *description = BlackGymDescribeObjCException(eptr);
    if (!description) {
      description = BlackGymDescribeCppException(eptr);
    }
    [report appendFormat:@"%@\n", description];
  } else {
    [report appendString:@"(no active exception)\n"];
  }

  BlackGymWriteReport(report);

  if (g_previousTerminateHandler) {
    g_previousTerminateHandler();
  } else {
    abort();
  }
}

__attribute__((constructor)) static void BlackGymInstallTerminateHandler(void) {
  g_previousTerminateHandler = std::set_terminate(&BlackGymTerminateHandler);
}
`;

/** Writes CrashDiagnostics.mm into the generated iOS project. */
const withTerminateHandlerFile = (config) =>
  withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const { projectRoot, platform, projectName } = modConfig.modRequest;
      const nativeDir = path.join(projectRoot, platform ?? "ios");
      const filePath = path.join(nativeDir, projectName ?? "BlackGym", "CrashDiagnostics.mm");
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, objcDiagnostics);
      return modConfig;
    },
  ]);

/** Injects CrashDiagnostics.install() + the NSSetUncaughtExceptionHandler into AppDelegate.swift. */
const withAppDelegateDiagnostics = (config) =>
  withAppDelegate(config, (modConfig) => {
    const results = modConfig.modResults;
    const isFileObject =
      typeof results === "object" && results !== null && typeof results.contents === "string";
    let contents = isFileObject ? results.contents : results;

    if (!contents.includes(BEGIN)) {
      contents = contents.replace("@UIApplicationMain", `${swiftDiagnostics}\n\n@UIApplicationMain`);
    }

    if (!contents.includes("CrashDiagnostics.install()")) {
      const launchBody = "  ) -> Bool {\n    let delegate = ReactNativeDelegate()";
      const patchedBody =
        "  ) -> Bool {\n    CrashDiagnostics.install()\n\n    let delegate = ReactNativeDelegate()";
      if (contents.includes(launchBody)) {
        contents = contents.replace(launchBody, patchedBody);
      } else {
        console.warn(
          "[withCrashDiagnostics] didFinishLaunchingWithOptions body not found — handler not installed",
        );
      }
    }

    if (isFileObject) {
      results.contents = contents;
    } else {
      modConfig.modResults = contents;
    }
    return modConfig;
  });

/** Registers CrashDiagnostics.mm in the app target (PBXBuildFile + Sources phase). */
const withPbxprojDiagnostics = (config) =>
  withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const projectName = modConfig.modRequest.projectName;
    const filePath = `${projectName}/CrashDiagnostics.mm`;

    if (!project.hasFile(filePath)) {
      const groupKey = project.findPBXGroupKey({ name: projectName });
      if (groupKey) {
        // The bundled xcode lib does not map ".mm" to a file type — without an
        // explicit lastKnownFileType the entry lands in the project as "unknown".
        project.addSourceFile(filePath, { lastKnownFileType: "sourcecode.cpp.objcpp" }, groupKey);
      } else {
        console.warn(
          `[withCrashDiagnostics] PBXGroup "${projectName}" not found — CrashDiagnostics.mm not registered`,
        );
      }
    }
    return modConfig;
  });

const withCrashDiagnostics = (config) => {
  config = withTerminateHandlerFile(config);
  config = withAppDelegateDiagnostics(config);
  config = withPbxprojDiagnostics(config);
  return config;
};

module.exports = withCrashDiagnostics;

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
// Reports go to NSLog and to Library/Caches/blackgym_last_crash.txt.
// UIPasteboard from the terminate handler is NOT reliable: it needs an XPC
// round-trip that never completes before abort(). Instead, on the NEXT launch
// — before React Native starts — the AppDelegate reads the file and shows it
// in a native alert with copy actions. The app is fully alive there, so the
// clipboard and exit(0) both work; launch is blocked until the user chooses.
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

  private static var pendingReportWindow: UIWindow?
  private static var shouldContinueLaunch = false

  static func install() {
    NSSetUncaughtExceptionHandler { exception in
      let stack = exception.callStackSymbols.joined(separator: "\n")
      let report = "[Black Gym] Uncaught NSException\nname: \(exception.name.rawValue)\nreason: \(exception.reason ?? "(none)")\nstack:\n\(stack)"
      CrashDiagnostics.handle(report)
    }
  }

  /// Muestra el reporte del último crash (si existe) en una alerta nativa
  /// ANTES de arrancar React Native. Aquí la app está viva, así que copiar
  /// funciona (a diferencia del pasteboard durante std::terminate, que
  /// necesita un XPC round-trip que nunca completa antes del abort).
  /// Bloquea el launch hasta que el usuario elija una acción.
  static func presentPendingReport() {
    shouldContinueLaunch = false
    guard let report = try? String(contentsOfFile: reportPath, encoding: .utf8),
          !report.isEmpty else {
      try? FileManager.default.removeItem(atPath: reportPath)
      return
    }

    let window = UIWindow(frame: UIScreen.main.bounds)
    let root = UIViewController()
    root.view.backgroundColor = .systemBackground
    window.rootViewController = root
    window.makeKeyAndVisible()
    pendingReportWindow = window

    let alert = UIAlertController(
      title: "Último fallo detectado",
      message: String(report.prefix(1600)),
      preferredStyle: .alert
    )

    alert.addAction(UIAlertAction(title: "Copiar y cerrar", style: .default) { _ in
      UIPasteboard.general.string = report
      try? FileManager.default.removeItem(atPath: reportPath)
      exit(0)
    })
    alert.addAction(UIAlertAction(title: "Copiar y continuar", style: .default) { _ in
      UIPasteboard.general.string = report
      try? FileManager.default.removeItem(atPath: reportPath)
      shouldContinueLaunch = true
    })
    alert.addAction(UIAlertAction(title: "Continuar sin copiar", style: .cancel) { _ in
      try? FileManager.default.removeItem(atPath: reportPath)
      shouldContinueLaunch = true
    })

    root.present(alert, animated: true)

    while !shouldContinueLaunch {
      RunLoop.main.run(mode: .default, before: Date.distantFuture)
    }
    pendingReportWindow = nil
  }

  static func handle(_ report: String) {
    NSLog("%@", report)
    try? report.write(toFile: reportPath, atomically: true, encoding: .utf8)
  }
}
${END}`;

const objcDiagnostics = String.raw`// BLACKGYM CRASH DIAGNOSTICS — std::terminate handler (installed before main).
// See plugins/withCrashDiagnostics.js for the rationale.

#import <Foundation/Foundation.h>

#include <cstdlib>
#include <exception>

static std::terminate_handler g_previousTerminateHandler = nullptr;

static void BlackGymWriteReport(NSString *report) {
  NSLog(@"%@", report);

  NSArray<NSString *> *caches =
      NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *path = [caches.firstObject stringByAppendingPathComponent:@"blackgym_last_crash.txt"];
  [report writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:NULL];

  // The file is the reliable channel: the pasteboard needs an XPC round-trip
  // that does not complete before abort(), so it is intentionally skipped
  // here. The report is surfaced by CrashDiagnostics.presentPendingReport()
  // on the next launch, while the app is fully alive.
}

static NSString *BlackGymDescribeActiveException(std::exception_ptr eptr) {
  try {
    std::rethrow_exception(eptr);
  } catch (const std::exception &e) {
    NSString *what = [NSString stringWithUTF8String:e.what()];
    if (!what) {
      what = @"(unreadable what())";
    }
    NSString *stack = [[NSThread callStackSymbols] componentsJoinedByString:@"\n"];
    return [NSString stringWithFormat:@"C++ std::exception\nwhat(): %@\nstack:\n%@", what, stack];
  } catch (...) {
    return @"C++ exception of unknown type";
  }
  return nil; // Unreachable — keeps -Werror=return-type quiet.
}

static void BlackGymTerminateHandler(void) {
  NSMutableString *report =
      [NSMutableString stringWithString:@"[Black Gym] std::terminate — uncaught exception\n"];

  std::exception_ptr eptr = std::current_exception();
  if (eptr) {
    [report appendFormat:@"%@\n", BlackGymDescribeActiveException(eptr)];
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

    const launchBody = "  ) -> Bool {\n    let delegate = ReactNativeDelegate()";
    const patchedBody =
      "  ) -> Bool {\n    CrashDiagnostics.install()\n    CrashDiagnostics.presentPendingReport()\n\n    let delegate = ReactNativeDelegate()";

    if (!contents.includes("CrashDiagnostics.install()")) {
      if (contents.includes(launchBody)) {
        contents = contents.replace(launchBody, patchedBody);
      } else {
        console.warn(
          "[withCrashDiagnostics] didFinishLaunchingWithOptions body not found — handler not installed",
        );
      }
    } else if (!contents.includes("CrashDiagnostics.presentPendingReport()")) {
      // Already injected for build 13 (install only) — add the report alert call.
      contents = contents.replace(
        "CrashDiagnostics.install()",
        "CrashDiagnostics.install()\n    CrashDiagnostics.presentPendingReport()",
      );
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

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

  /// Muestra el reporte del último crash (si existe) ANTES de arrancar React
  /// Native, en una pantalla nativa propia (NO un UIAlertController): la
  /// ventana se vuelve key con contenido REAL (texto + botones), lo que
  /// fuerza a iOS a descartar el snapshot del launch screen. Los builds
  /// 15/16 fallaron porque el splash tapaba la alerta modal (el snapshot del
  /// launch screen queda arriba de TODAS las ventanas hasta que la key
  /// window commitea su primer frame, sin importar el windowLevel) y/o la
  /// presentación modal nunca se completaba durante didFinishLaunching.
  ///
  /// El launch se bloquea hasta que el usuario elige una acción (aquí la app
  /// está viva, así que copiar funciona), con timeout de seguridad de 120s.
  static func presentPendingReport() {
    shouldContinueLaunch = false
    guard let report = try? String(contentsOfFile: reportPath, encoding: .utf8),
          !report.isEmpty else {
      try? FileManager.default.removeItem(atPath: reportPath)
      return
    }

    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    guard let windowScene = scene else {
      // Sin scene no hay ventana posible: NO bloquear el launch.
      NSLog("[Black Gym] reporte pendiente: sin UIWindowScene, se omite la pantalla")
      return
    }

    NSLog("[Black Gym] reporte pendiente: mostrando pantalla de diagnóstico")

    let window = UIWindow(windowScene: windowScene)
    window.frame = windowScene.coordinateSpace.bounds
    window.windowLevel = .alert + 1
    window.rootViewController = CrashDiagnostics.makeReportViewController(report: report) {
      shouldContinueLaunch = true
    }
    window.makeKeyAndVisible()
    window.isHidden = false
    pendingReportWindow = window

    // Forzar layout inmediato: el primer frame de esta ventana es el que
    // descarta el splash; así ese frame ya incluye todo el contenido.
    window.rootViewController?.view.setNeedsLayout()
    window.rootViewController?.view.layoutIfNeeded()

    // Red de seguridad: si a los 120s nadie tocó nada, dejamos seguir — el
    // archivo queda para el próximo launch y el app no queda congelada.
    let deadline = Date().addingTimeInterval(120)
    while !shouldContinueLaunch && Date() < deadline {
      RunLoop.main.run(mode: .default, before: Date().addingTimeInterval(0.1))
    }
    if !shouldContinueLaunch {
      NSLog("[Black Gym] reporte pendiente: timeout, se continúa el launch")
    }
    window.isHidden = true
    pendingReportWindow = nil
  }

  /// Pantalla de diagnóstico propia: título + reporte seleccionable (se puede
  /// leer y copiar a mano con long-press) + botones nativos. Sin
  /// presentaciones modales que puedan fallar durante el launch.
  private static func makeReportViewController(
    report: String,
    onFinish: @escaping () -> Void
  ) -> UIViewController {
    let accent = UIColor(red: 0.776, green: 0.945, blue: 0.208, alpha: 1) // #C6F135
    let background = UIColor(red: 0.016, green: 0.016, blue: 0.016, alpha: 1) // #040404

    let vc = UIViewController()
    vc.view.backgroundColor = background

    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 12
    stack.translatesAutoresizingMaskIntoConstraints = false
    vc.view.addSubview(stack)

    let title = UILabel()
    title.text = "Último fallo detectado"
    title.font = .systemFont(ofSize: 20, weight: .bold)
    title.textColor = accent
    title.textAlignment = .center

    let hint = UILabel()
    hint.text = "Tocá un botón para copiar el reporte o continuar."
    hint.font = .systemFont(ofSize: 13)
    hint.textColor = .secondaryLabel
    hint.textAlignment = .center
    hint.numberOfLines = 0

    let textView = UITextView()
    textView.text = report
    textView.font = UIFont(name: "Menlo", size: 10) ?? .systemFont(ofSize: 10)
    textView.textColor = .white
    textView.backgroundColor = UIColor(white: 0.08, alpha: 1)
    textView.layer.cornerRadius = 10
    textView.isEditable = false
    textView.isSelectable = true

    let copyClose = makeReportButton("Copiar y cerrar", accent: accent) {
      UIPasteboard.general.string = report
      try? FileManager.default.removeItem(atPath: reportPath)
      exit(0)
    }
    let copyContinue = makeReportButton("Copiar y continuar", accent: nil) {
      UIPasteboard.general.string = report
      try? FileManager.default.removeItem(atPath: reportPath)
      onFinish()
    }
    let skip = makeReportButton("Continuar sin copiar", accent: nil) {
      try? FileManager.default.removeItem(atPath: reportPath)
      onFinish()
    }

    for button in [copyClose, copyContinue, skip] {
      button.heightAnchor.constraint(equalToConstant: 48).isActive = true
    }

    stack.addArrangedSubview(title)
    stack.addArrangedSubview(hint)
    stack.addArrangedSubview(textView)
    stack.addArrangedSubview(copyClose)
    stack.addArrangedSubview(copyContinue)
    stack.addArrangedSubview(skip)

    NSLayoutConstraint.activate([
      stack.topAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.topAnchor, constant: 16),
      stack.bottomAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
      stack.leadingAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
      textView.heightAnchor.constraint(equalTo: stack.heightAnchor, multiplier: 0.5),
    ])

    return vc
  }

  private static func makeReportButton(
    _ title: String,
    accent: UIColor?,
    action: @escaping () -> Void
  ) -> UIButton {
    let button = UIButton(type: .system)
    var config = UIButton.Configuration.filled()
    config.title = title
    config.cornerStyle = .medium
    if let accent = accent {
      config.baseBackgroundColor = accent
      config.baseForegroundColor = .black
    } else {
      config.baseBackgroundColor = UIColor(white: 0.15, alpha: 1)
      config.baseForegroundColor = .white
    }
    button.configuration = config
    button.addAction(UIAction { _ in action() }, for: .touchUpInside)
    return button
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

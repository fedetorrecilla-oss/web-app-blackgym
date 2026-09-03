import Expo
import React
import ReactAppDependencyProvider

// BLACKGYM_CRASH_DIAGNOSTICS_BEGIN
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
  ///
  /// Bloquea el launch SOLO si la alerta realmente se presentó. La ventana se
  /// adjunta a la UIWindowScene activa (una UIWindow(frame:) sin scene no se
  /// muestra ni recibe toques en apps con ciclo de vida por scenes — eso
  /// congeló el launch en el build 15). Sin scene o tras un timeout de
  /// seguridad se continúa y el archivo queda para el próximo launch.
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
      NSLog("[Black Gym] reporte pendiente: sin UIWindowScene, se omite la alerta")
      return
    }

    NSLog("[Black Gym] reporte pendiente: mostrando alerta")

    let window = UIWindow(windowScene: windowScene)
    window.frame = windowScene.coordinateSpace.bounds
    let root = UIViewController()
    root.view.backgroundColor = .systemBackground
    window.rootViewController = root
    window.windowLevel = .alert + 1
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

    root.present(alert, animated: false)

    // Red de seguridad: si a los 120s nadie tocó nada (p. ej. la alerta no
    // llegó a presentarse), dejamos seguir — el archivo queda para el
    // próximo launch y el app no queda congelada para siempre.
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

  static func handle(_ report: String) {
    NSLog("%@", report)
    try? report.write(toFile: reportPath, atomically: true, encoding: .utf8)
  }
}
// BLACKGYM_CRASH_DIAGNOSTICS_END

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    CrashDiagnostics.install()
    CrashDiagnostics.presentPendingReport()

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

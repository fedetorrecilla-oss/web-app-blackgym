import Expo
import React
import ReactAppDependencyProvider

// BLACKGYM_CRASH_DIAGNOSTICS_BEGIN
import UIKit

final class CrashDiagnostics: NSObject {
  static let reportPath: String = {
    let docs = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true).first ?? NSTemporaryDirectory()
    return (docs as NSString).appendingPathComponent("blackgym_last_crash.txt")
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
    guard let report = CrashDiagnostics.readPendingReport() else {
      return
    }

    // 1) Canal automático: subir al backend SIN interacción del usuario.
    if CrashDiagnostics.tryUploadPendingReport(report: report) {
      return // el archivo ya se borró; el launch continúa en silencio
    }

    // 2) Fallback manual: pantalla de diagnóstico propia. En
    // didFinishLaunching puede no haber UIWindowScene conectada todavía —
    // devolver en silencio acá hacía que la pantalla NO aparezca nunca
    // (build 22). Esperamos hasta 10s a que haya una escena.
    NSLog("[Black Gym] reporte pendiente: esperando UIWindowScene…")
    let sceneDeadline = Date().addingTimeInterval(10)
    var reportWindow: UIWindow? = nil
    while reportWindow == nil && Date() < sceneDeadline {
      let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
      if let windowScene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first {
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
        reportWindow = window
        break
      }
      RunLoop.main.run(mode: .default, before: Date().addingTimeInterval(0.1))
    }

    guard reportWindow != nil else {
      NSLog("[Black Gym] reporte pendiente: sin UIWindowScene tras 10s, se continúa el launch")
      return
    }

    // Red de seguridad: si a los 120s nadie tocó nada, dejamos seguir — el
    // archivo queda para el próximo launch y el app no queda congelada.
    let deadline = Date().addingTimeInterval(120)
    while !shouldContinueLaunch && Date() < deadline {
      RunLoop.main.run(mode: .default, before: Date().addingTimeInterval(0.1))
    }
    if !shouldContinueLaunch {
      NSLog("[Black Gym] reporte pendiente: timeout, se continúa el launch")
    }
    reportWindow?.isHidden = true
    pendingReportWindow = nil
  }

  /// Lee el reporte pendiente. Ubicación actual: Documents (el sistema NO la
  /// purga, a diferencia de Caches). Como fallback lee la ubicación vieja en
  /// Caches para no perder reportes escritos por builds anteriores.
  private static func readPendingReport() -> String? {
    if let current = try? String(contentsOfFile: reportPath, encoding: .utf8), !current.isEmpty {
      return current
    }
    let caches = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true).first ?? NSTemporaryDirectory()
    let legacyPath = (caches as NSString).appendingPathComponent("blackgym_last_crash.txt")
    if let legacy = try? String(contentsOfFile: legacyPath, encoding: .utf8), !legacy.isEmpty {
      return legacy
    }
    return nil
  }

  /// Borra el reporte en AMBAS ubicaciones (actual y legacy).
  private static func deletePendingReport() {
    try? FileManager.default.removeItem(atPath: reportPath)
    let caches = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true).first ?? NSTemporaryDirectory()
    let legacyPath = (caches as NSString).appendingPathComponent("blackgym_last_crash.txt")
    try? FileManager.default.removeItem(atPath: legacyPath)
  }

  /// Sube el reporte al backend (tRPC superjson) sin interacción del usuario.
  /// Prueba la URL principal y la de fallback (Info.plist). Corre antes de
  /// arrancar RN, así que aunque RN crashee segundos después, el reporte ya
  /// viajó. Devuelve true si alguna URL aceptó el reporte (y borra el archivo).
  static func tryUploadPendingReport(report: String) -> Bool {
    let candidates: [String] = [
      (Bundle.main.object(forInfoDictionaryKey: "BlackGymDiagnosticsBaseURL") as? String) ?? "",
      (Bundle.main.object(forInfoDictionaryKey: "BlackGymDiagnosticsFallbackURL") as? String) ?? "",
    ].filter { !$0.isEmpty }

    guard !candidates.isEmpty else {
      NSLog("[Black Gym] upload: sin URLs en Info.plist, se omite")
      return false
    }

    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?"
    let device = UIDevice.current.model
    let payload: [String: Any] = [
      "json": [
        "report": report,
        "build": build,
        "device": device,
      ]
    ]
    guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
      return false
    }

    // La gateway del backend a veces limita por ráfaga (429/503); una segunda
    // ronda tras una pausa aumenta mucho la tasa de entrega del reporte.
    for attempt in 0..<2 {
      if attempt > 0 {
        Thread.sleep(forTimeInterval: 3)
      }
    for base in candidates {
      guard let url = URL(string: base + "/api/trpc/crash.submit") else { continue }
      var request = URLRequest(url: url)
      request.httpMethod = "POST"
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.timeoutInterval = 5
      request.httpBody = body

      var uploaded = false
      let semaphore = DispatchSemaphore(value: 0)
      let task = URLSession.shared.dataTask(with: request) { _, response, error in
        if let http = response as? HTTPURLResponse, error == nil, http.statusCode == 200 {
          uploaded = true
        } else {
          let status = (response as? HTTPURLResponse)?.statusCode ?? -1
          NSLog("[Black Gym] upload falló (status=\(status)): \(String(describing: error))")
        }
        semaphore.signal()
      }
      task.resume()
      _ = semaphore.wait(timeout: .now() + 7)
      if uploaded {
        deletePendingReport()
        NSLog("[Black Gym] reporte subido al backend OK")
        return true
      }
      }
    }
    return false
  }

  /// Pantalla de diagnóstico propia: título + reporte seleccionable (se puede
  /// leer y copiar a mano con long-press) + botones nativos (copiar,
  /// continuar y compartir por WhatsApp/mail — canal independiente del
  /// backend). Sin presentaciones modales durante el launch; el share sheet
  /// se presenta solo tras un toque del usuario.
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
      deletePendingReport()
      exit(0)
    }
    let copyContinue = makeReportButton("Copiar y continuar", accent: nil) {
      UIPasteboard.general.string = report
      deletePendingReport()
      onFinish()
    }
    let skip = makeReportButton("Continuar sin copiar", accent: nil) {
      deletePendingReport()
      onFinish()
    }
    let share = makeReportButton("Compartir reporte (WhatsApp / mail)", accent: nil) {
      // Presentado solo tras un toque explícito, cuando el launch ya corre
      // dentro del RunLoop propio de esta pantalla: la presentación modal es
      // segura ahí (las builds 15/16 fallaron solo al presentarla DURANTE
      // didFinishLaunching, sin interacción del usuario).
      let activityVC = UIActivityViewController(activityItems: [report], applicationActivities: nil)
      activityVC.popoverPresentationController?.sourceView = vc.view
      activityVC.popoverPresentationController?.sourceRect = CGRect(
        x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 80, width: 1, height: 1)
      vc.present(activityVC, animated: true)
    }

    for button in [copyClose, copyContinue, skip, share] {
      button.heightAnchor.constraint(equalToConstant: 48).isActive = true
    }

    stack.addArrangedSubview(title)
    stack.addArrangedSubview(hint)
    stack.addArrangedSubview(textView)
    stack.addArrangedSubview(copyClose)
    stack.addArrangedSubview(copyContinue)
    stack.addArrangedSubview(skip)
    stack.addArrangedSubview(share)

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

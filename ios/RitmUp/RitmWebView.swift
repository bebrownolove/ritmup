import SwiftUI
import UIKit
import WebKit

struct RitmWebView: UIViewRepresentable {
    private let appURL = URL(string: "https://ritmup.ru")!

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "ritmHealth")
        controller.addUserScript(WKUserScript(
            source: "window.ritmHealthKitAvailable=true;window.dispatchEvent(new Event('ritm-healthkit-ready'));",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.webView = webView
        webView.load(URLRequest(url: appURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "ritmHealth")
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var webView: WKWebView?
        private let health = HealthKitManager()

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "ritmHealth", message.frameInfo.isMainFrame,
                  message.frameInfo.request.url?.host == "ritmup.ru",
                  let payload = message.body as? [String: Any], payload["action"] as? String == "syncToday" else {
                return
            }

            Task { @MainActor in
                do {
                    let snapshot = try await health.todaySnapshot()
                    try send(event: "ritm-health-data", value: snapshot)
                } catch {
                    try? send(event: "ritm-health-data", value: ["error": error.localizedDescription])
                }
            }
        }

        private func send<T: Encodable>(event: String, value: T) throws {
            let data = try JSONEncoder().encode(value)
            guard let json = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(event)',{detail:\(json)}));")
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url else { return .cancel }
            if url.host == "ritmup.ru" || url.scheme == "about" { return .allow }
            if navigationAction.navigationType == .linkActivated {
                await UIApplication.shared.open(url)
            }
            return .cancel
        }
    }
}

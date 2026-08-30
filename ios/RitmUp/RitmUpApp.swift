import SwiftUI

@main
struct RitmUpApp: App {
    var body: some Scene {
        WindowGroup {
            RitmWebView()
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}

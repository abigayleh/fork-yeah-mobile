import ExpoModulesCore
import WidgetKit

private let appGroup = "group.com.hammyinc.whatsfordinner"

internal final class AppGroupUnavailableException: Exception {
  override var reason: String {
    "App Group \(appGroup) is not reachable — check the entitlement on both targets"
  }
}

private func containerDirectory() throws -> URL {
  guard let container = FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
    throw AppGroupUnavailableException()
  }
  return container
}

public final class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    AsyncFunction("write") { (name: String, json: String) in
      let target = try containerDirectory().appendingPathComponent("\(name).json")
      try json.write(to: target, atomically: true, encoding: .utf8)
    }

    // WidgetKit cannot load a remote image, so thumbnails have to be on disk before
    // the widget draws. Runs off the main thread, and every failure is survivable —
    // a missing file just renders the placeholder tile.
    AsyncFunction("cacheImages") { (entries: [[String: String]]) in
      let files = FileManager.default
      let directory = try containerDirectory().appendingPathComponent("images", isDirectory: true)
      try files.createDirectory(at: directory, withIntermediateDirectories: true)

      let wanted = Set(entries.compactMap { $0["file"] })
      for stale in (try? files.contentsOfDirectory(atPath: directory.path)) ?? []
      where !wanted.contains(stale) {
        try? files.removeItem(at: directory.appendingPathComponent(stale))
      }

      for entry in entries {
        guard
          let name = entry["file"],
          let source = entry["url"].flatMap(URL.init(string:))
        else { continue }
        let target = directory.appendingPathComponent(name)
        guard !files.fileExists(atPath: target.path) else { continue }
        guard let data = try? Data(contentsOf: source), !data.isEmpty else { continue }
        try? data.write(to: target, options: .atomic)
      }
    }

    AsyncFunction("reload") {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

import Foundation
import UIKit

let appGroup = "group.com.hammyinc.whatsfordinner"

// Mirrors lib/widgetSnapshot.ts. The widget can never re-fetch, so everything it
// can display has to already be in the file the app writes.
struct GroceryList: Codable, Identifiable {
  let id: String
  let name: String
  let count: Int
  let items: [String]
}

struct GrocerySnapshot: Codable {
  let lists: [GroceryList]
}

struct PlannedMeal: Codable, Identifiable {
  let recipeId: String
  let title: String
  let imageFile: String
  let servings: Int
  let isMyRecipe: Bool
  let type: String

  var id: String { type }
}

struct MealDay: Codable {
  let date: String
  let meals: [PlannedMeal]

  func meal(_ type: String) -> PlannedMeal? { meals.first { $0.type == type } }
}

struct MealSnapshot: Codable {
  let days: [MealDay]
}

struct Session: Codable {
  let signedIn: Bool
}

// The app downloads thumbnails into the shared container; the widget only reads them.
enum ImageCache {
  static func image(_ file: String) -> UIImage? {
    guard
      !file.isEmpty,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    else { return nil }
    return UIImage(contentsOfFile: container.appendingPathComponent("images/\(file)").path)
  }
}

enum MealType: String, CaseIterable {
  case breakfast, lunch, dinner

  var label: String { rawValue.capitalized }
}

enum SnapshotStore {
  // Absent file means a fresh install that has never opened the app; treat that as
  // signed in so the widget shows its own empty state rather than a login prompt.
  static var isSignedIn: Bool {
    (load("session") as Session?)?.signedIn ?? true
  }

  static func load<T: Decodable>(_ name: String) -> T? {
    guard
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
      let data = try? Data(contentsOf: container.appendingPathComponent("\(name).json"))
    else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
  }
}

// Which grocery list is open. Written by the toggle intent, read by the provider.
enum WidgetState {
  private static let key = "expandedListId"

  static var expandedListId: String? {
    get { UserDefaults(suiteName: appGroup)?.string(forKey: key) }
    set { UserDefaults(suiteName: appGroup)?.set(newValue, forKey: key) }
  }
}

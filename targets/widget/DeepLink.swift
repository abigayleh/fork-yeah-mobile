import Foundation

// Matches the `forkyeah` scheme in app.json. Adding is deep-link only by design —
// a widget can't show a keyboard.
enum DeepLink {
  private static func url(_ path: String, _ items: [URLQueryItem] = []) -> URL {
    var components = URLComponents()
    components.scheme = "forkyeah"
    components.host = ""
    components.path = path
    components.queryItems = items.isEmpty ? nil : items
    return components.url ?? URL(string: "forkyeah:///")!
  }

  static func groceryList(_ id: String) -> URL {
    url("/grocery-lists", [URLQueryItem(name: "list", value: id)])
  }

  static func addGroceryItem(_ id: String) -> URL {
    url("/grocery-lists", [URLQueryItem(name: "list", value: id), URLQueryItem(name: "add", value: "1")])
  }

  // The app keeps user-authored recipes on a separate route.
  static func recipe(_ id: String, isMine: Bool) -> URL {
    url(isMine ? "/my-recipe/\(id)" : "/recipe/\(id)")
  }

  static func addMeal(date: String, type: String) -> URL {
    url("/meal-planner", [URLQueryItem(name: "date", value: date), URLQueryItem(name: "type", value: type)])
  }

  static let mealPlanner = url("/meal-planner")
  static let groceryLists = url("/grocery-lists")
}

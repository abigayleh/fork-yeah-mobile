import AppIntents

// Expanding a list is the one thing the widget does without opening the app.
// perform() returning reloads the timeline, so no explicit WidgetCenter call.
struct ToggleListIntent: AppIntent {
  static var title: LocalizedStringResource = "Expand grocery list"
  static var isDiscoverable: Bool { false }

  @Parameter(title: "List") var listId: String

  init() {}

  init(listId: String) {
    self.listId = listId
  }

  func perform() async throws -> some IntentResult {
    WidgetState.expandedListId = WidgetState.expandedListId == listId ? nil : listId
    return .result()
  }
}

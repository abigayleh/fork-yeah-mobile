import SwiftUI
import WidgetKit

struct GroceryEntry: TimelineEntry {
  let date: Date
  let lists: [GroceryList]
  let expandedId: String?
  let signedIn: Bool
}

struct GroceryProvider: TimelineProvider {
  func placeholder(in context: Context) -> GroceryEntry { current() }

  func getSnapshot(in context: Context, completion: @escaping (GroceryEntry) -> Void) {
    completion(current())
  }

  // The app reloads us when it writes and the toggle intent reloads on tap, so
  // there is nothing worth scheduling.
  func getTimeline(in context: Context, completion: @escaping (Timeline<GroceryEntry>) -> Void) {
    completion(Timeline(entries: [current()], policy: .never))
  }

  private func current() -> GroceryEntry {
    let lists: [GroceryList] = (SnapshotStore.load("groceries") as GrocerySnapshot?)?.lists ?? []
    let stored = WidgetState.expandedListId
    let expanded = lists.contains { $0.id == stored } ? stored : lists.first?.id
    return GroceryEntry(
      date: Date(), lists: lists, expandedId: expanded, signedIn: SnapshotStore.isSignedIn
    )
  }
}

private struct ItemRow: View {
  let name: String

  var body: some View {
    HStack(spacing: 9) {
      Image(systemName: "square")
        .font(.system(size: 13, weight: .medium))
        .foregroundStyle(Color.accent)
      Text(name)
        .font(.system(size: 13))
        .foregroundStyle(Color.primaryText)
        .lineLimit(1)
      Spacer(minLength: 0)
    }
    .frame(height: 25)
  }
}

private struct NoLists: View {
  var body: some View {
    VStack(spacing: 10) {
      Text("No grocery lists yet.")
        .font(.system(size: 13))
        .foregroundStyle(Color.mutedText)
      Text("Create a list")
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(Color.surface)
        .padding(.horizontal, 16)
        .frame(height: 32)
        .background(Color.accent, in: RoundedRectangle(cornerRadius: 10))
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct GroceryMediumView: View {
  let entry: GroceryEntry

  private var openList: GroceryList? {
    entry.lists.first { $0.id == entry.expandedId } ?? entry.lists.first
  }

  var body: some View {
    if let list = openList {
      body(for: list).widgetURL(DeepLink.groceryList(list.id))
    } else {
      NoLists()
    }
  }

  private func footer(for list: GroceryList, shown: Int) -> String {
    let remaining = max(0, list.count - shown)
    let others = entry.lists.filter { $0.id != list.id }.map(\.name)
    return [
      remaining > 0 ? "\(remaining) more" : nil,
      others.isEmpty ? nil : others.joined(separator: ", "),
    ].compactMap { $0 }.joined(separator: " · ")
  }

  private func body(for list: GroceryList) -> some View {
    let shown = Array(list.items.prefix(3))

    return VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 8) {
        Image(systemName: "cart").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.accent)
        Text(list.name).font(.system(size: 14, weight: .bold)).foregroundStyle(Color.primaryText).lineLimit(1)
        Spacer(minLength: 4)
        Text("\(list.count) item\(list.count == 1 ? "" : "s")")
          .font(.system(size: 11)).foregroundStyle(Color.mutedText)
      }
      .frame(height: 26)

      Hairline()

      VStack(spacing: 0) {
        ForEach(shown, id: \.self) { ItemRow(name: $0) }
      }
      .padding(.top, 3)

      Spacer(minLength: 0)
      Hairline()

      HStack(spacing: 6) {
        Text(footer(for: list, shown: shown.count))
          .font(.system(size: 11)).foregroundStyle(Color.mutedText).lineLimit(1)
        Spacer(minLength: 4)
        Link(destination: DeepLink.addGroceryItem(list.id)) {
          Text("Add").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.accent)
        }
      }
      .frame(height: 22)
    }
  }
}

struct GroceryLargeView: View {
  let entry: GroceryEntry

  var body: some View {
    if entry.lists.isEmpty {
      NoLists()
    } else {
      VStack(alignment: .leading, spacing: 8) {
        HStack(spacing: 7) {
          Image(systemName: "cart").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.accent)
          Text("Groceries").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.heading)
          Spacer(minLength: 4)
          Text("\(entry.lists.count) list\(entry.lists.count == 1 ? "" : "s")")
            .font(.system(size: 11)).foregroundStyle(Color.mutedText)
        }
        .frame(height: 20)

        VStack(alignment: .leading, spacing: 0) {
          ForEach(entry.lists) { list in
            accordionHeader(list)
            if list.id == entry.expandedId {
              VStack(spacing: 0) {
                ForEach(list.items, id: \.self) { ItemRow(name: $0) }
              }
              .padding(.leading, 22)
              .padding(.bottom, 4)
            }
          }
        }

        Spacer(minLength: 0)
        addItemButton
      }
      .widgetURL(DeepLink.groceryLists)
    }
  }

  private func accordionHeader(_ list: GroceryList) -> some View {
    let expanded = list.id == entry.expandedId

    return Button(intent: ToggleListIntent(listId: list.id)) {
      HStack(spacing: 8) {
        Image(systemName: expanded ? "chevron.down" : "chevron.right")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(Color.accent)
        Text(list.name).font(.system(size: 14, weight: .bold)).foregroundStyle(Color.primaryText).lineLimit(1)
        Spacer(minLength: 4)
        Text("\(list.count)").font(.system(size: 11)).foregroundStyle(Color.mutedText)
      }
      .frame(height: 30)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .overlay(alignment: .top) { Hairline() }
  }

  private var addItemButton: some View {
    Link(destination: DeepLink.addGroceryItem(entry.expandedId ?? entry.lists[0].id)) {
      HStack(spacing: 6) {
        Image(systemName: "plus.circle").font(.system(size: 12, weight: .medium))
        Text("Add an item").font(.system(size: 12, weight: .bold))
      }
      .foregroundStyle(Color.accent)
      .frame(maxWidth: .infinity)
      .frame(height: 30)
      .overlay(
        RoundedRectangle(cornerRadius: 8)
          .strokeBorder(Color.hairline, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
      )
    }
  }
}

struct GroceryFamilyView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GroceryEntry

  var body: some View {
    if !entry.signedIn {
      SignedOutView()
    } else if family == .systemLarge {
      GroceryLargeView(entry: entry)
    } else {
      GroceryMediumView(entry: entry)
    }
  }
}

struct GroceryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ForkYeahGroceries", provider: GroceryProvider()) { entry in
      GroceryFamilyView(entry: entry)
        .padding(EdgeInsets(top: 13, leading: 14, bottom: 13, trailing: 14))
        .widgetSurface()
    }
    .configurationDisplayName("Groceries")
    .description("Your grocery lists, with one open at a time.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

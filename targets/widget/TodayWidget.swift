import SwiftUI
import WidgetKit

struct TodayEntry: TimelineEntry {
  let date: Date
  let today: MealDay?
  let tomorrow: MealDay?
  let signedIn: Bool
}

struct TodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry { entry(at: Date()) }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    completion(entry(at: Date()))
  }

  // The snapshot holds today and tomorrow, so a second entry at midnight rolls the
  // widget over on its own. The app rewrites the file whenever it is next opened.
  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let now = Date()
    var entries = [entry(at: now)]
    if let midnight = Calendar.current.nextDate(
      after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime
    ) {
      entries.append(entry(at: midnight))
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }

  private func entry(at date: Date) -> TodayEntry {
    let days = (SnapshotStore.load("meals") as MealSnapshot?)?.days ?? []
    let key = DayFormat.key(date)
    // Matching by key rather than index is what makes the midnight entry correct.
    let todayIndex = days.firstIndex { $0.date == key }
    return TodayEntry(
      date: date,
      today: todayIndex.map { days[$0] },
      tomorrow: todayIndex.flatMap { days.indices.contains($0 + 1) ? days[$0 + 1] : nil },
      signedIn: SnapshotStore.isSignedIn
    )
  }
}

enum DayFormat {
  // Local calendar day, matching utils/dateKey.ts on the JS side.
  static func key(_ date: Date) -> String {
    let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }

  static func label(_ key: String) -> String {
    let parser = DateFormatter()
    parser.dateFormat = "yyyy-MM-dd"
    guard let date = parser.date(from: key) else { return "" }
    let out = DateFormatter()
    out.dateFormat = "EEE, MMM d"
    return out.string(from: date)
  }
}

private struct Thumb: View {
  let file: String
  let size: CGSize

  // Falls back to the placeholder tile whenever the download hasn't landed yet.
  var body: some View {
    Group {
      if let cached = ImageCache.image(file) {
        Image(uiImage: cached).resizable().aspectRatio(contentMode: .fill)
      } else {
        Color.thumb
      }
    }
    .frame(width: size.width, height: size.height)
    .clipShape(RoundedRectangle(cornerRadius: 6))
  }
}

private struct AddSlot: View {
  let size: CGSize

  var body: some View {
    RoundedRectangle(cornerRadius: 6)
      .strokeBorder(Color.hairline, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
      .frame(width: size.width, height: size.height)
      .overlay(
        Image(systemName: "plus").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.accent)
      )
  }
}

private struct MealRow: View {
  let type: MealType
  let meal: PlannedMeal?
  let dateKey: String
  let compact: Bool

  private var thumbSize: CGSize { compact ? CGSize(width: 44, height: 30) : CGSize(width: 60, height: 44) }
  private var rowHeight: CGFloat { compact ? 38 : 56 }

  var body: some View {
    Link(destination: destination) {
      HStack(spacing: compact ? 9 : 10) {
        if let meal { Thumb(file: meal.imageFile, size: thumbSize) } else { AddSlot(size: thumbSize) }

        VStack(alignment: .leading, spacing: 0) {
          Text(type.label.uppercased())
            .font(.system(size: 10, weight: .bold))
            .kerning(0.3)
            .foregroundStyle(Color.mutedText)
          Text(meal?.title ?? "Add a meal")
            .font(.system(size: compact ? 13 : 14, weight: .semibold))
            .foregroundStyle(meal == nil ? Color.accent : Color.primaryText)
            .lineLimit(1)
          if let meal, !compact {
            Text("\(meal.servings) serving\(meal.servings == 1 ? "" : "s")")
              .font(.system(size: 11))
              .foregroundStyle(Color.mutedText)
          }
        }
        Spacer(minLength: 0)
      }
      .padding(.horizontal, compact ? 8 : 10)
      .frame(height: rowHeight)
      .background(background)
    }
  }

  @ViewBuilder
  private var background: some View {
    let radius: CGFloat = compact ? 8 : 10
    if meal == nil {
      RoundedRectangle(cornerRadius: radius)
        .strokeBorder(Color.hairline, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
    } else {
      RoundedRectangle(cornerRadius: radius).fill(Color.mealRow)
    }
  }

  private var destination: URL {
    guard let meal else { return DeepLink.addMeal(date: dateKey, type: type.rawValue) }
    return DeepLink.recipe(meal.recipeId, isMine: meal.isMyRecipe)
  }
}

private struct DayHeader: View {
  let title: String
  let dateKey: String

  var body: some View {
    HStack(spacing: 7) {
      Image(systemName: "calendar").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.accent)
      Text(title).font(.system(size: 13, weight: .bold)).foregroundStyle(Color.heading)
      Spacer(minLength: 4)
      Text(DayFormat.label(dateKey)).font(.system(size: 11)).foregroundStyle(Color.mutedText)
    }
    .frame(height: 20)
  }
}

struct TodayMediumView: View {
  let entry: TodayEntry

  var body: some View {
    let key = entry.today?.date ?? DayFormat.key(entry.date)
    VStack(alignment: .leading, spacing: 5) {
      DayHeader(title: "Today", dateKey: key)
      VStack(spacing: 4) {
        ForEach(MealType.allCases, id: \.self) { type in
          MealRow(type: type, meal: entry.today?.meal(type.rawValue), dateKey: key, compact: true)
        }
      }
    }
    .widgetURL(DeepLink.mealPlanner)
  }
}

struct TodayLargeView: View {
  let entry: TodayEntry

  var body: some View {
    let key = entry.today?.date ?? DayFormat.key(entry.date)
    VStack(alignment: .leading, spacing: 7) {
      DayHeader(title: "Today", dateKey: key)

      VStack(spacing: 6) {
        ForEach(MealType.allCases, id: \.self) { type in
          MealRow(type: type, meal: entry.today?.meal(type.rawValue), dateKey: key, compact: false)
        }
      }

      if let tomorrow = entry.tomorrow {
        Hairline().padding(.top, 2)
        HStack(spacing: 7) {
          Text("TOMORROW").font(.system(size: 11, weight: .bold)).kerning(0.3).foregroundStyle(Color.mutedText)
          Spacer(minLength: 4)
          Text(DayFormat.label(tomorrow.date)).font(.system(size: 11)).foregroundStyle(Color.mutedText)
        }
        .frame(height: 22)

        VStack(spacing: 0) {
          ForEach(MealType.allCases, id: \.self) { type in
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Text(type.label).font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.mutedText).frame(width: 62, alignment: .leading)
              Text(tomorrow.meal(type.rawValue)?.title ?? "Not planned")
                .font(.system(size: 13))
                .foregroundStyle(tomorrow.meal(type.rawValue) == nil ? Color.dimText : Color.primaryText)
                .lineLimit(1)
              Spacer(minLength: 0)
            }
            .frame(height: 30)
          }
        }
      }

      Spacer(minLength: 0)
    }
    .widgetURL(DeepLink.mealPlanner)
  }
}

struct TodayFamilyView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TodayEntry

  var body: some View {
    if !entry.signedIn {
      SignedOutView()
    } else if family == .systemLarge {
      TodayLargeView(entry: entry)
    } else {
      TodayMediumView(entry: entry)
    }
  }
}

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ForkYeahToday", provider: TodayProvider()) { entry in
      TodayFamilyView(entry: entry)
        .padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
        .widgetSurface()
    }
    .configurationDisplayName("Today's Meals")
    .description("Breakfast, lunch and dinner for today.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

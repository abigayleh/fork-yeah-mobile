import SwiftUI

// The app's palette, plus the warm-dark inversion from the widget design. Widgets
// follow system appearance even though the app pins itself to light.
private extension UIColor {
  convenience init(rgb: UInt32) {
    self.init(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    )
  }
}

extension Color {
  private static func themed(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(rgb: dark) : UIColor(rgb: light) })
  }

  static let surface = themed(0xFFFAF0, 0x1C1A17)
  static let heading = themed(0x115E59, 0x5EEAD4)
  static let accent = themed(0x0F766E, 0x2DD4BF)
  static let hairline = themed(0xE4D9C5, 0x3A352D)
  static let mealRow = themed(0xECFDF5, 0x122E29)
  static let thumb = themed(0xD1FAE5, 0x1D4A42)
  static let primaryText = themed(0x1F2421, 0xF2EDE3)
  static let mutedText = themed(0x5E6A63, 0x9CA79F)
  static let dimText = themed(0x9CA3AF, 0x6B7280)
}

extension View {
  func widgetSurface() -> some View {
    containerBackground(Color.surface, for: .widget)
  }
}

struct Hairline: View {
  var body: some View {
    Rectangle().fill(Color.hairline).frame(height: 1)
  }
}

import SwiftUI

// A widget can't present a login sheet, so this is a first-class state rather than
// an error. Tapping anywhere opens the app, which takes it from there.
struct SignedOutView: View {
  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "lock")
        .font(.system(size: 26, weight: .light))
        .foregroundStyle(Color.accent)
      Text("Sign in to Fork Yeah")
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(Color.heading)
      Text("Your lists and meal plan will show up here once you are signed in.")
        .font(.system(size: 12))
        .foregroundStyle(Color.mutedText)
        .multilineTextAlignment(.center)
        .frame(maxWidth: 250)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

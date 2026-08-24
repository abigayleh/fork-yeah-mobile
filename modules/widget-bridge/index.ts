import { requireOptionalNativeModule } from 'expo';

export type WidgetBridgeModule = {
  // Writes `<name>.json` into the App Group container the widget target reads from.
  write(name: string, json: string): Promise<void>;
  // Downloads anything missing into the container's images/ dir and prunes the rest.
  cacheImages(entries: { file: string; url: string }[]): Promise<void>;
  reload(): Promise<void>;
};

// Null off iOS and wherever the native target isn't linked, so callers can no-op.
export default requireOptionalNativeModule<WidgetBridgeModule>('WidgetBridge');

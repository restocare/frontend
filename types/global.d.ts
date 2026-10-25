/** Meta Pixel base code, loaded by components/analytics/MetaPixel.tsx. */
interface MetaPixelFunction {
  (command: "init", pixelId: string, advancedMatching?: Record<string, string>): void;
  (
    command: "track" | "trackCustom",
    eventName: string,
    params?: Record<string, unknown>,
    options?: { eventID?: string },
  ): void;
  (command: "consent", action: "grant" | "revoke"): void;
  (command: string, ...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: MetaPixelFunction;
  getState?: () => { pixels: { id: string }[] };
}

interface Window {
  fbq?: MetaPixelFunction;
  _fbq?: MetaPixelFunction;
}

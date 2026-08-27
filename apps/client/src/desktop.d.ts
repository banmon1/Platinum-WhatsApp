export {};

declare global {
  interface Window {
    platinumDesktop?: {
      isDesktop: true;
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      close: () => Promise<void>;
    };
  }
}

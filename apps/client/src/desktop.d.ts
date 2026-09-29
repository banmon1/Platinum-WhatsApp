export {};

declare global {
  interface Window {
    platinumDesktop?: {
      isDesktop: true;
      loadSession: () => Promise<string | null>;
      saveSession: (token: string) => Promise<void>;
      clearSession: () => Promise<void>;
      loadLanguage: () => Promise<'en' | 'ar'>;
      saveLanguage: (language: 'en' | 'ar') => Promise<void>;
      openContact: () => Promise<void>;
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      close: () => Promise<void>;
    };
  }
}

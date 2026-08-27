import type { WhatsAppState } from './api';

export type ConnectionNotice = { message: string; tone: 'success' | 'danger' };

export function connectionTransitionNotice(previous: WhatsAppState, current: WhatsAppState): ConnectionNotice | null {
  if (current === 'connected' && previous !== 'connected') {
    return { message: 'Connected successfully.', tone: 'success' };
  }
  return null;
}

export function connectionErrorNotice(error: unknown): ConnectionNotice {
  return { message: error instanceof Error ? error.message : String(error), tone: 'danger' };
}

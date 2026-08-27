export interface DisconnectPlan {
  state: 'connecting' | 'disconnected';
  lastError: string | null;
  reconnectAfterMs: number | null;
}

const LOGGED_OUT_CODE = 401;
const RESTART_REQUIRED_CODE = 515;

export function planDisconnect(code: number | undefined, message: string | undefined, intentionallyLoggedOut: boolean): DisconnectPlan {
  const pairingRestart = code === RESTART_REQUIRED_CODE;
  const reconnectAfterMs = !intentionallyLoggedOut && code !== LOGGED_OUT_CODE
    ? (pairingRestart ? 250 : 4_000)
    : null;
  return {
    state: pairingRestart ? 'connecting' : 'disconnected',
    lastError: pairingRestart ? null : message || (code ? `WhatsApp disconnected (${code})` : 'WhatsApp disconnected'),
    reconnectAfterMs,
  };
}

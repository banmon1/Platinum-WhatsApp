import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { loadWebApiUrl, resolveApiUrl, saveWebApiUrl } from './apiOrigin';

const API_KEY = 'platinum.apiUrl';
const AUTH_TOKEN_KEY = 'platinum.authToken';


function webRuntime() {
  return typeof window === 'undefined' ? undefined : window;
}

export const defaultApiUrl = resolveApiUrl(Platform.OS, null, webRuntime());

export async function loadApiUrl() {
  if (Platform.OS === 'web') return loadWebApiUrl(API_KEY, webRuntime());
  return resolveApiUrl(Platform.OS, await SecureStore.getItemAsync(API_KEY));
}

export async function saveApiUrl(value: string) {
  if (Platform.OS === 'web') return saveWebApiUrl(API_KEY, value, webRuntime());
  const clean = value.trim().replace(/\/$/, '');
  await SecureStore.setItemAsync(API_KEY, clean);
  return clean;
}

export async function loadAuthToken() {
  if (webRuntime()?.platinumDesktop) return webRuntime()!.platinumDesktop!.loadSession();
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(AUTH_TOKEN_KEY) || null;
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function saveAuthToken(token: string) {
  if (webRuntime()?.platinumDesktop) return webRuntime()!.platinumDesktop!.saveSession(token);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(AUTH_TOKEN_KEY, token);
  else await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken() {
  if (webRuntime()?.platinumDesktop) return webRuntime()!.platinumDesktop!.clearSession();
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(AUTH_TOKEN_KEY);
  else await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

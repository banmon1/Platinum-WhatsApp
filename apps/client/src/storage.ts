import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { loadWebApiUrl, resolveApiUrl, saveWebApiUrl } from './apiOrigin';

const API_KEY = 'platinum.apiUrl';
const AUTH_TOKEN_KEY = 'platinum.authToken';
let nativeAuthToken: string | null = null;

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
  if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(AUTH_TOKEN_KEY) || null;
  return nativeAuthToken;
}

export async function saveAuthToken(token: string) {
  if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(AUTH_TOKEN_KEY, token);
  else nativeAuthToken = token;
}

export async function clearAuthToken() {
  if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(AUTH_TOKEN_KEY);
  else nativeAuthToken = null;
}

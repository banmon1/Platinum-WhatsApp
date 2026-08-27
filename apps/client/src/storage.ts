import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_KEY = 'platinum.apiUrl';
const AUTH_TOKEN_KEY = 'platinum.authToken';
let nativeAuthToken: string | null = null;
export const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';

export async function loadApiUrl() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(API_KEY) || defaultApiUrl;
  return (await SecureStore.getItemAsync(API_KEY)) || defaultApiUrl;
}

export async function saveApiUrl(value: string) {
  const clean = value.trim().replace(/\/$/, '');
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(API_KEY, clean);
  else await SecureStore.setItemAsync(API_KEY, clean);
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

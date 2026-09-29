import { Linking, Platform } from 'react-native';
export const CONTACT_URL = 'https://wa.me/message/2JDP6KDMBVM6N1';
export async function openContact() {
  if (Platform.OS === 'web' && window.platinumDesktop) await window.platinumDesktop.openContact();
  else await Linking.openURL(CONTACT_URL);
}

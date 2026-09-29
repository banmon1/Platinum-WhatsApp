import { Tajawal_400Regular, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { LanguageProvider } from '@/i18n';
import { ActivityIndicator, Image, Platform, StyleSheet,  View } from 'react-native';
import { Text } from '@/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WindowControls } from '@/components/WindowControls';
import { AppProvider, useApp } from '@/context/AppContext';
import { colors } from '@/theme';
import './global.css';

const logo = require('../assets/platinum-icon.png');

function AppRoutes() {
  const {authState} = useApp();

  if (authState === 'loading') {
    const desktop = Platform.OS === 'web' && typeof window !== 'undefined' && Boolean(window.platinumDesktop?.isDesktop);
    return <SafeAreaView style={styles.loadingSafe}>
      <View testID={desktop?'window-drag-region':undefined} style={styles.loadingTopbar}><View/><WindowControls/></View>
      <View style={styles.loadingBody}>
        <Image source={logo} style={styles.loadingLogo}/>
        <Text style={styles.loadingTitle}>Platinum WhatsApp</Text>
        <ActivityIndicator color={colors.ink} style={styles.loadingIndicator}/>
      </View>
    </SafeAreaView>;
  }

  return <Stack screenOptions={{headerShown:false,animation:'fade'}}>
    <Stack.Protected guard={authState === 'signedOut'}>
      <Stack.Screen name="login"/>
    </Stack.Protected>
    <Stack.Protected guard={authState === 'signedIn'}>
      <Stack.Screen name="index"/>
      <Stack.Screen name="connect"/>
      <Stack.Screen name="campaign"/>
      <Stack.Screen name="ai"/>
      <Stack.Screen name="activity"/>
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  const [loaded]=useFonts({Tajawal_400Regular,Tajawal_700Bold,Manrope_400Regular,Manrope_500Medium,Manrope_600SemiBold,Manrope_700Bold});
  if(!loaded) return null;
  return <SafeAreaProvider><LanguageProvider><AppProvider><StatusBar style="light"/><AppRoutes/></AppProvider></LanguageProvider></SafeAreaProvider>;
}

const styles=StyleSheet.create({
  loadingSafe:{flex:1,backgroundColor:colors.acid},
  loadingTopbar:{minHeight:80,paddingTop:22,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  loadingBody:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:58},
  loadingLogo:{width:78,height:78,borderRadius:24},
  loadingTitle:{fontFamily:'Manrope_700Bold',fontSize:20,color:colors.ink,marginTop:16},
  loadingIndicator:{marginTop:20},
});

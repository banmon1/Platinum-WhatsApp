import { createContext, useContext, useEffect, useState, forwardRef, type ReactNode } from 'react';
import { Text as NativeText, TextInput as NativeInput, Pressable, Platform, StyleSheet, type TextProps, type TextInputProps } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import ar from './translations/ar.json';
type Language='en'|'ar';
const Context=createContext({language:'en' as Language,setLanguage:(_value:Language)=>{}});
export function LanguageProvider({children}:{children:ReactNode}) {
  const [language,setValue]=useState<Language>('en');
  useEffect(()=>{void(async()=>{try{const value=Platform.OS==='web'?(window.platinumDesktop?await window.platinumDesktop.loadLanguage():localStorage.getItem('platinum.language')):await SecureStore.getItemAsync('platinum.language');if(value==='ar')setValue('ar');}catch{}})();},[]);
  useEffect(()=>{if(Platform.OS==='web'){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';}},[language]);
  const setLanguage=(value:Language)=>{setValue(value);void(async()=>{if(Platform.OS==='web'){if(window.platinumDesktop)await window.platinumDesktop.saveLanguage(value);else localStorage.setItem('platinum.language',value);}else await SecureStore.setItemAsync('platinum.language',value);})().catch(()=>{});};
  return <Context.Provider value={{language,setLanguage}}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
export function translate(value:string,language:Language):string {
  if(language==='en')return value;
  const dictionary=ar as Record<string,string>;
  if(dictionary[value])return dictionary[value];
  const processed=/^(\d+) of (\d+) processed$/.exec(value);
  if(processed)return `تمت معالجة ${processed[1]} من ${processed[2]}`;
  const recipients=/^(\d+) recipients$/.exec(value);
  if(recipients)return `${recipients[1]} مستلم`;
  if(value.startsWith('Next action '))return 'الموعد التالي '+value.slice(12);
  const invalid=/^Started\. (\d+) invalid number\(s\) skipped\.$/.exec(value);
  if(invalid)return `بدأت الحملة. تم تجاوز ${invalid[1]} رقم غير صالح.`;
  return value;
}
export function Text({children,style,localize=true,...props}:TextProps & {localize?:boolean}) {
  const {language}=useLanguage();
  const convert=(value:ReactNode):ReactNode=>typeof value==='string'?translate(value,language):Array.isArray(value)?value.map(convert):value;
  return <NativeText {...props} style={[style,language==='ar'&&{fontFamily: /Bold/.test(StyleSheet.flatten(style)?.fontFamily||'')?'Tajawal_700Bold':'Tajawal_400Regular',letterSpacing:0,writingDirection:'rtl'}]}>{localize?convert(children):children}</NativeText>;
}
export const TextInput=forwardRef<NativeInput,TextInputProps>(function LocalizedInput(props,ref){
  const {language}=useLanguage();return <NativeInput {...props} ref={ref} placeholder={props.placeholder?translate(props.placeholder,language):undefined} accessibilityLabel={props.accessibilityLabel?translate(props.accessibilityLabel,language):undefined}/>;
});
export function LanguageSwitch(){const {language,setLanguage}=useLanguage();return <Pressable accessibilityRole="button" accessibilityLabel="Change language / تغيير اللغة" onPress={()=>setLanguage(language==='en'?'ar':'en')} style={{paddingHorizontal:15,paddingVertical:10,borderRadius:24,backgroundColor:'#F5FF32'}}><NativeText style={{fontSize:13,fontWeight:'700',color:'#202725'}}>{language==='en'?'العربية':'English'}</NativeText></Pressable>;}

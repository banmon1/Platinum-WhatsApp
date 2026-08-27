import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Activity, Bot, Link2, LogOut, Megaphone, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radii } from '../theme';
import { WindowControls } from './WindowControls';

const items = [
  {href:'/connect',label:'Connect',icon:Link2}, {href:'/campaign',label:'Campaign',icon:Megaphone},
  {href:'/ai',label:'AI Replies',icon:Bot}, {href:'/activity',label:'Activity',icon:Activity},
] as const;
export function AppShell({children}:{children:ReactNode}) {
  const router=useRouter(); const path=usePathname(); const {width}=useWindowDimensions(); const compact=width<780;
  const {online,whatsapp,logout}=useApp();
  const navigate=(href:string,replace=false)=>{
    if(Platform.OS==='web'&&globalThis.document?.activeElement instanceof HTMLElement) globalThis.document.activeElement.blur();
    if(replace) router.replace(href as Href); else router.push(href as Href);
  };
  return <SafeAreaView style={styles.safe}><View style={styles.acidBackdrop}/><View style={[styles.shell,compact&&styles.shellCompact]}>
    <View testID={Platform.OS==='web'&&window?.platinumDesktop?.isDesktop?'window-drag-region':undefined} style={[styles.topbar,compact&&styles.topbarCompact]}>
      <Pressable onPress={()=>navigate('/connect',true)} style={styles.brand}><View style={styles.brandMark}><Sparkles size={18} color={colors.ink}/></View><View><Text style={styles.brandName}>Platinum</Text><Text style={styles.brandSub}>WHATSAPP STUDIO</Text></View></Pressable>
      {!compact&&<View style={styles.nav}>{items.map(({href,label,icon:Icon})=>{const active=path===href;return <Pressable key={href} onPress={()=>navigate(href)} style={[styles.navItem,active&&styles.navActive]}><Icon size={16} color={colors.ink}/><Text style={styles.navText}>{label}</Text></Pressable>})}</View>}
      <View style={styles.live}><View style={[styles.liveDot,{backgroundColor:online&&whatsapp.state==='connected'?colors.acid:online?'#F0C55B':colors.danger}]}/><Text style={styles.liveText}>{!online?'API offline':whatsapp.state==='connected'?'Live':'Ready'}</Text></View>
      <Pressable accessibilityLabel="Sign out" accessibilityRole="button" onPress={()=>void logout()} style={({pressed})=>[styles.logout,pressed&&styles.logoutPressed]}><LogOut size={17} color={colors.ink}/></Pressable>
      <WindowControls/>
    </View>
    <ScrollView contentContainerStyle={[styles.content,compact&&styles.contentCompact]} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    {compact&&<View style={styles.bottomNav}>{items.map(({href,label,icon:Icon})=>{const active=path===href;return <Pressable accessibilityLabel={label} key={href} onPress={()=>navigate(href)} style={[styles.bottomItem,active&&styles.bottomActive]}><Icon size={20} color={active?colors.ink:colors.muted}/><Text numberOfLines={1} style={[styles.bottomLabel,active&&styles.bottomLabelActive]}>{label}</Text></Pressable>})}</View>}
  </View></SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.acid},acidBackdrop:{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:colors.acid},
  shell:{flex:1,margin:22,borderRadius:radii.xlarge,overflow:'hidden',backgroundColor:colors.canvas,borderWidth:10,borderColor:colors.inkSoft,boxShadow:'0 28px 65px rgba(31,38,36,.22)'},shellCompact:{margin:0,borderRadius:0,borderWidth:0},
  topbar:{minHeight:84,backgroundColor:colors.inkSoft,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:18},topbarCompact:{minHeight:72,paddingHorizontal:14},
  brand:{backgroundColor:colors.card,borderRadius:radii.pill,paddingVertical:10,paddingLeft:10,paddingRight:18,flexDirection:'row',alignItems:'center',gap:10},brandMark:{width:38,height:38,borderRadius:19,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center'},brandName:{fontFamily:'Manrope_700Bold',fontSize:17,color:colors.ink,lineHeight:19},brandSub:{fontFamily:'Manrope_700Bold',fontSize:7,letterSpacing:1.1,color:colors.muted},
  nav:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},navItem:{height:45,borderRadius:radii.pill,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#D2D3CD'},navActive:{backgroundColor:colors.white},navText:{fontFamily:'Manrope_600SemiBold',fontSize:12,color:colors.ink},
  live:{height:40,borderRadius:radii.pill,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:colors.ink},liveDot:{width:8,height:8,borderRadius:8},liveText:{fontFamily:'Manrope_700Bold',fontSize:11,color:colors.white},
  logout:{width:40,height:40,borderRadius:20,backgroundColor:'#D2D3CD',alignItems:'center',justifyContent:'center'},logoutPressed:{backgroundColor:colors.acid,transform:[{scale:.95}]},
  content:{padding:32,maxWidth:1440,width:'100%',alignSelf:'center',paddingBottom:56},contentCompact:{padding:18,paddingBottom:104},
  bottomNav:{position:'absolute',left:12,right:12,bottom:10,minHeight:72,borderRadius:28,backgroundColor:colors.ink,padding:8,flexDirection:'row',alignItems:'center',justifyContent:'space-around',boxShadow:'0 12px 30px rgba(31,38,36,.25)'},bottomItem:{flex:1,minHeight:54,borderRadius:21,alignItems:'center',justifyContent:'center',gap:3},bottomActive:{backgroundColor:colors.acid},bottomLabel:{fontFamily:'Manrope_600SemiBold',fontSize:8,color:'#AEB2AE'},bottomLabelActive:{color:colors.ink},
});

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radii } from '../theme';

export function SectionCard({children,style}:{children:ReactNode;style?:ViewStyle|ViewStyle[]}) {
  return <View style={[styles.card,style]}>{children}</View>;
}
export function Eyebrow({children}:{children:ReactNode}) { return <Text style={styles.eyebrow}>{children}</Text>; }
export function StatusBadge({label,tone='neutral'}:{label:string;tone?:'neutral'|'success'|'danger'|'acid'|'warning'}) {
  return <View style={[styles.badge,styles[`badge_${tone}`]]}><View style={[styles.dot,styles[`dot_${tone}`]]}/><Text style={styles.badgeText}>{label}</Text></View>;
}
export function ActionButton({label,onPress,variant='dark',disabled,loading,icon}:{label:string;onPress:()=>void;variant?:'dark'|'light'|'acid'|'danger';disabled?:boolean;loading?:boolean;icon?:ReactNode}) {
  return <Pressable accessibilityRole="button" disabled={disabled||loading} onPress={onPress} style={({pressed})=>[styles.button,styles[`button_${variant}`],(disabled||loading)&&styles.buttonDisabled,pressed&&styles.pressed]}>
    {loading?<ActivityIndicator color={variant==='dark'?colors.white:colors.ink}/>:icon}<Text style={[styles.buttonText,variant==='dark'&&styles.buttonTextDark,variant==='danger'&&styles.buttonTextDark]}>{label}</Text>
  </Pressable>;
}
export function PageHeader({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:ReactNode}) {
  return <View style={styles.pageHeader}><View style={styles.headerCopy}><Eyebrow>{eyebrow}</Eyebrow><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>{action}</View>;
}

const styles=StyleSheet.create({
  card:{backgroundColor:colors.card,borderRadius:radii.large,padding:24,borderWidth:1,borderColor:'rgba(32,39,37,0.08)'},
  eyebrow:{fontFamily:'Manrope_700Bold',fontSize:11,letterSpacing:1.4,textTransform:'uppercase',color:colors.muted,marginBottom:8},
  badge:{height:34,paddingHorizontal:14,borderRadius:radii.pill,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#DFE0DA'},
  badge_success:{backgroundColor:'#DDEFE4'},badge_danger:{backgroundColor:'#F3DEDB'},badge_acid:{backgroundColor:colors.acid},badge_warning:{backgroundColor:'#F6EBC8'},badge_neutral:{backgroundColor:'#DFE0DA'},
  dot:{width:7,height:7,borderRadius:9,backgroundColor:colors.muted},dot_success:{backgroundColor:colors.success},dot_danger:{backgroundColor:colors.danger},dot_acid:{backgroundColor:colors.ink},dot_warning:{backgroundColor:colors.warning},dot_neutral:{backgroundColor:colors.muted},
  badgeText:{fontFamily:'Manrope_700Bold',fontSize:12,color:colors.ink},
  button:{minHeight:52,paddingHorizontal:22,borderRadius:radii.pill,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  button_dark:{backgroundColor:colors.ink},button_light:{backgroundColor:colors.white},button_acid:{backgroundColor:colors.acid},button_danger:{backgroundColor:colors.danger},
  buttonText:{fontFamily:'Manrope_700Bold',fontSize:14,color:colors.ink},buttonTextDark:{color:colors.white},buttonDisabled:{opacity:.45},pressed:{transform:[{scale:.985}]},
  pageHeader:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:24,marginBottom:24},headerCopy:{flex:1,maxWidth:720},
  title:{fontFamily:'Manrope_500Medium',fontSize:36,lineHeight:42,letterSpacing:-1.5,color:colors.ink},description:{fontFamily:'Manrope_400Regular',fontSize:14,lineHeight:22,color:colors.muted,marginTop:8},
});

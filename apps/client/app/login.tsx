import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,


  useWindowDimensions,
  View,
} from 'react-native';
import { TextInput, Text } from '@/i18n';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WindowControls } from '@/components/WindowControls';
import { useApp } from '@/context/AppContext';
import { colors, radii } from '@/theme';

import { LanguageSwitch } from '@/i18n';
import { openContact } from '@/contact';
import type { TextInput as NativeTextInput } from 'react-native';

const logo = require('../assets/platinum-icon.png');

export default function LoginPage() {
  const {width}=useWindowDimensions();
  const compact=width<820;
  const {login}=useApp();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const submittingRef=useRef(false);
  const passwordInputRef=useRef<NativeTextInput>(null);
  const desktop=Platform.OS==='web'&&typeof window!=='undefined'&&Boolean(window.platinumDesktop?.isDesktop);

  const submit=async()=>{
    if(submittingRef.current)return;
    if(!email.trim()||!password){setError('Enter your email and password to continue.');return;}
    submittingRef.current=true;
    setBusy(true);setError(null);
    try{await login(email,password);}
    catch(value){setError(value instanceof Error?value.message:'Unable to sign in. Please try again.');}
    finally{submittingRef.current=false;setBusy(false);}
  };

  return <SafeAreaView style={styles.safe}>
    <View testID={desktop?'window-drag-region':undefined} style={styles.topbar}>
      <View style={styles.topBrand}><Image source={logo} style={styles.topLogo}/><View><Text style={styles.topName}>Platinum</Text><Text style={styles.topSub}>WHATSAPP STUDIO</Text></View></View>
      <View style={{flexDirection:'row',gap:12,alignItems:'center'}}><LanguageSwitch/><WindowControls/></View>
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.stage,compact&&styles.stageCompact]}>
          {!compact?<View style={styles.story}>
            <View style={styles.storyPill}><Sparkles size={15} color={colors.ink}/><Text style={styles.storyPillText}>PRIVATE DESKTOP ACCESS</Text></View>
            <Text style={styles.storyTitle}>Your WhatsApp workspace, protected at the door.</Text>
            <Text style={styles.storyText}>Only approved credentials can open campaigns, linked-device controls, activity, and AI settings.</Text>
            <View style={styles.storySecurity}><ShieldCheck size={22} color={colors.ink}/><View style={styles.flex}><Text style={styles.storySecurityTitle}>Server-verified access</Text><Text style={styles.storySecurityText}>Your password is sent only for verification and is never saved in this app.</Text></View></View>
          </View>:null}

          <View style={[styles.card,compact&&styles.cardCompact]}>
            <Image source={logo} style={styles.logo}/>
            <Text style={styles.eyebrow}>PLATINUM WHATSAPP</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in with your approved email and password.</Text>

            <Text style={styles.label}>Email address</Text>
            <View style={[styles.inputShell,error&&styles.inputShellError]}>
              <Mail size={18} color={colors.muted}/>
              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={()=>passwordInputRef.current?.focus()}
                placeholder="name@example.com"
                placeholderTextColor="#626864"
                returnKeyType="next"
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputShell,error&&styles.inputShellError]}>
              <LockKeyhole size={18} color={colors.muted}/>
              <TextInput
                ref={passwordInputRef}
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                onChangeText={setPassword}
                onSubmitEditing={()=>void submit()}
                placeholder="Enter your password"
                placeholderTextColor="#626864"
                returnKeyType="done"
                secureTextEntry={!showPassword}
                style={styles.input}
                textContentType="password"
                value={password}
              />
              <Pressable accessibilityLabel={showPassword?'Hide password':'Show password'} accessibilityRole="button" hitSlop={8} onPress={()=>setShowPassword(value=>!value)} style={({pressed})=>[styles.eyeButton,pressed&&styles.pressed]}>
                {showPassword?<EyeOff size={19} color={colors.ink}/>:<Eye size={19} color={colors.ink}/>}
              </Pressable>
            </View>

            {error?<View accessibilityLiveRegion="polite" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>:null}

            <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void submit()} style={({pressed})=>[styles.submit,busy&&styles.submitDisabled,pressed&&styles.submitPressed]}>
              <Text style={styles.submitText}>{busy?'Signing in…':'Sign in securely'}</Text><ArrowRight size={19} color={colors.white}/>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={()=>void openContact().catch(()=>setError('Unable to open WhatsApp. Please try again.'))} style={[styles.submit,{backgroundColor:colors.acid,marginTop:12}]}><Text style={{fontSize:13,fontWeight:'700',color:colors.ink}}>Contact on WhatsApp · Get access</Text></Pressable>
            <Text style={[styles.subtitle,{marginTop:10,marginBottom:0}]}>No login details? Contact us on WhatsApp to get your access code and sign-in details.</Text>
            <View style={styles.privacy}><ShieldCheck size={14} color={colors.success}/><Text style={styles.privacyText}>Your session is remembered securely. Sign out on shared computers.</Text></View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.acid},flex:{flex:1},
  topbar:{minHeight:82,paddingTop:22,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  topBrand:{flexDirection:'row',alignItems:'center',gap:9},topLogo:{width:36,height:36,borderRadius:11},
  topName:{fontFamily:'Manrope_700Bold',fontSize:15,lineHeight:17,color:colors.ink},topSub:{fontFamily:'Manrope_700Bold',fontSize:6.5,letterSpacing:1,color:colors.inkSoft},
  scroll:{flexGrow:1,justifyContent:'center',padding:22,paddingTop:8},
  stage:{width:'100%',maxWidth:1100,minHeight:610,alignSelf:'center',flexDirection:'row',borderRadius:radii.xlarge,overflow:'hidden',backgroundColor:colors.inkSoft,boxShadow:'0 30px 75px rgba(31,38,36,.26)'},
  stageCompact:{maxWidth:520,minHeight:0,flexDirection:'column'},
  story:{flex:1,padding:54,justifyContent:'center'},storyPill:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:8,backgroundColor:colors.acid,borderRadius:radii.pill,paddingVertical:9,paddingHorizontal:13},storyPillText:{fontFamily:'Manrope_700Bold',fontSize:8,letterSpacing:1.2,color:colors.ink},
  storyTitle:{fontFamily:'Manrope_500Medium',fontSize:42,lineHeight:49,letterSpacing:-1.8,color:colors.white,marginTop:28},storyText:{fontFamily:'Manrope_400Regular',fontSize:14,lineHeight:23,color:'#CCD0CC',marginTop:18,maxWidth:460},
  storySecurity:{marginTop:38,borderTopWidth:1,borderTopColor:'#59605D',paddingTop:22,flexDirection:'row',gap:13},storySecurityTitle:{fontFamily:'Manrope_700Bold',fontSize:13,color:colors.white},storySecurityText:{fontFamily:'Manrope_400Regular',fontSize:10,lineHeight:16,color:'#B9BDB9',marginTop:3},
  card:{width:450,margin:14,borderRadius:38,backgroundColor:colors.card,padding:45,justifyContent:'center'},cardCompact:{width:'auto',margin:10,padding:28,paddingVertical:38},
  logo:{width:76,height:76,borderRadius:24,marginBottom:20},eyebrow:{fontFamily:'Manrope_700Bold',fontSize:9,letterSpacing:1.8,color:colors.success},title:{fontFamily:'Manrope_500Medium',fontSize:34,letterSpacing:-1.2,color:colors.ink,marginTop:7},subtitle:{fontFamily:'Manrope_400Regular',fontSize:12,lineHeight:19,color:'#626864',marginTop:7,marginBottom:24},
  label:{fontFamily:'Manrope_700Bold',fontSize:10,letterSpacing:.3,color:colors.ink,marginTop:13,marginBottom:8},
  inputShell:{minHeight:56,borderRadius:radii.medium,backgroundColor:colors.canvas,borderWidth:1,borderColor:colors.line,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:10},inputShellError:{borderColor:'#D4A19B'},input:{flex:1,minWidth:0,fontFamily:'Manrope_500Medium',fontSize:13,color:colors.ink,paddingVertical:13},eyeButton:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:colors.card},pressed:{opacity:.65},
  errorBox:{marginTop:14,borderRadius:14,backgroundColor:'#F3DEDB',padding:11},errorText:{fontFamily:'Manrope_600SemiBold',fontSize:10,lineHeight:15,color:'#8F332C'},
  submit:{minHeight:56,borderRadius:radii.pill,backgroundColor:colors.ink,marginTop:22,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},submitDisabled:{opacity:.6},submitPressed:{transform:[{scale:.988}]},submitText:{fontFamily:'Manrope_700Bold',fontSize:13,color:colors.white},
  privacy:{marginTop:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},privacyText:{fontFamily:'Manrope_500Medium',fontSize:9,color:'#626864'},
});

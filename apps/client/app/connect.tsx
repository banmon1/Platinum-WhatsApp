import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet,  useWindowDimensions, View } from 'react-native';
import { Text } from '@/i18n';
import { AlertCircle, Check, CircleCheck, Link2, LogOut, QrCode, ShieldCheck, Smartphone } from 'lucide-react-native';
import { AppShell } from '@/components/AppShell';
import { ActionButton, Eyebrow, PageHeader, SectionCard, StatusBadge } from '@/components/UI';
import { connectionErrorNotice, connectionTransitionNotice, type ConnectionNotice } from '@/connectionNotice';
import { useApp } from '@/context/AppContext';
import { colors, radii } from '@/theme';

export default function ConnectPage(){
  const {width}=useWindowDimensions(); const narrow=width<900; const {online,whatsapp,connectWhatsApp,disconnectWhatsApp}=useApp();
  const [busy,setBusy]=useState(false); const [notice,setNotice]=useState<ConnectionNotice|null>(null);
  const previousState=useRef(whatsapp.state);
  const mountedRef=useRef(true);
  const connect=async()=>{setBusy(true);setNotice(null);try{await connectWhatsApp();}catch(e){if(mountedRef.current)setNotice(connectionErrorNotice(e));}finally{if(mountedRef.current)setBusy(false)}};
  const disconnect=async()=>{setBusy(true);try{const result=await disconnectWhatsApp();if(mountedRef.current&&result)setNotice({message:'The linked session was removed safely.',tone:'success'});}catch(e){if(mountedRef.current)setNotice(connectionErrorNotice(e));}finally{if(mountedRef.current)setBusy(false)}};

  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;};},[]);

  useEffect(()=>{
    const nextNotice=connectionTransitionNotice(previousState.current,whatsapp.state);
    previousState.current=whatsapp.state;
    if(!nextNotice)return;
    setNotice(nextNotice);
    const timer=setTimeout(()=>setNotice(current=>current?.tone==='success'?null:current),4500);
    return()=>clearTimeout(timer);
  },[whatsapp.state]);

  const tone=!online?'danger':whatsapp.state==='connected'?'success':whatsapp.state==='qr'?'acid':whatsapp.lastError?'danger':'neutral';
  const visibleNotice=whatsapp.lastError?{message:whatsapp.lastError,tone:'danger' as const}:notice;
  return <AppShell><PageHeader eyebrow="WhatsApp connection" title="Link once. Stay in control." description="Scan the live QR from Linked Devices. Your session stays on this server and reconnects automatically." action={<StatusBadge label={!online?'API offline':whatsapp.state} tone={tone}/>}/>
    <View style={[styles.grid,narrow&&styles.stack]}>
      <SectionCard style={styles.qrCard}>
        <View style={styles.cardHead}><View><Eyebrow>Secure pairing</Eyebrow><Text style={styles.cardTitle}>{whatsapp.state==='connected'?'Device connected':whatsapp.state==='qr'?'Scan this QR code':'Connect your device'}</Text></View><View style={styles.roundIcon}>{whatsapp.state==='connected'?<Check size={26} color={colors.ink}/>:<QrCode size={26} color={colors.ink}/>}</View></View>
        <View style={styles.qrStage}>
          {whatsapp.qrDataUrl?<Image source={{uri:whatsapp.qrDataUrl}} style={styles.qr}/>:whatsapp.state==='connected'?<View style={styles.connectedVisual}><View style={styles.phoneRing}><Smartphone size={50} color={colors.ink}/><View style={styles.check}><Check size={16} color={colors.ink}/></View></View><Text localize={!whatsapp.profileName} style={styles.connectedName}>{whatsapp.profileName||'WhatsApp account'}</Text><Text style={styles.phone}>{whatsapp.phone?`+${whatsapp.phone}`:'Linked device'}</Text></View>:<View style={styles.emptyVisual}><QrCode size={70} color={colors.line}/><Text style={styles.emptyTitle}>No active QR</Text><Text style={styles.emptyText}>Start pairing to generate a fresh code.</Text></View>}
        </View>
        {visibleNotice?<View accessibilityLiveRegion="polite" style={[styles.notice,visibleNotice.tone==='success'?styles.noticeSuccess:styles.noticeDanger]}>{visibleNotice.tone==='success'?<CircleCheck size={17} color={colors.success}/>:<AlertCircle size={17} color="#8F332C"/>}<Text style={[styles.noticeText,visibleNotice.tone==='success'?styles.noticeTextSuccess:styles.noticeTextDanger]}>{visibleNotice.message}</Text></View>:null}
        <View style={styles.actions}>{whatsapp.state==='connected'?<ActionButton label="Disconnect device" variant="light" onPress={disconnect} loading={busy} icon={<LogOut size={18} color={colors.ink}/>}/>:<ActionButton label={whatsapp.state==='qr'?'Refresh connection':'Generate QR code'} onPress={connect} loading={busy} disabled={!online} icon={<Link2 size={18} color={colors.white}/>}/>}</View>
      </SectionCard>
      <View style={styles.side}>
        <SectionCard><Eyebrow>On your phone</Eyebrow><Text style={styles.sideTitle}>Three simple steps</Text>{['Open WhatsApp Settings','Choose Linked Devices','Tap Link a Device and scan'].map((item,index)=><View style={styles.step} key={item}><View style={[styles.stepNumber,index===2&&styles.stepActive]}><Text style={styles.stepNumberText}>0{index+1}</Text></View><View style={styles.stepLine}/><Text style={styles.stepText}>{item}</Text></View>)}</SectionCard>
        <SectionCard style={styles.security}><ShieldCheck size={24} color={colors.ink}/><View style={{flex:1}}><Text style={styles.securityTitle}>Local session vault</Text><Text style={styles.securityText}>WhatsApp credentials and your AI key stay in the backend data folder. Secrets never appear in the app response.</Text></View></SectionCard>
      </View>
    </View>
  </AppShell>;
}
const styles=StyleSheet.create({
  grid:{flexDirection:'row',gap:20,alignItems:'stretch'},stack:{flexDirection:'column'},qrCard:{flex:1,minHeight:570},side:{flex:.72,gap:20},cardHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},cardTitle:{fontFamily:'Manrope_500Medium',fontSize:26,color:colors.ink,letterSpacing:-.8},roundIcon:{width:54,height:54,borderRadius:27,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center'},
  qrStage:{flex:1,minHeight:340,marginVertical:24,borderRadius:radii.large,backgroundColor:colors.canvas,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.line},qr:{width:300,height:300,borderRadius:18},emptyVisual:{alignItems:'center',gap:8},emptyTitle:{fontFamily:'Manrope_700Bold',fontSize:19,color:colors.ink,marginTop:8},emptyText:{fontFamily:'Manrope_400Regular',fontSize:13,color:'#626864'},
  connectedVisual:{alignItems:'center'},phoneRing:{width:130,height:130,borderRadius:65,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center'},check:{position:'absolute',right:3,bottom:8,width:32,height:32,borderRadius:16,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},connectedName:{fontFamily:'Manrope_700Bold',fontSize:22,color:colors.ink,marginTop:20},phone:{fontFamily:'Manrope_400Regular',fontSize:14,color:'#626864',marginTop:4},notice:{minHeight:42,borderRadius:14,paddingHorizontal:13,marginBottom:12,flexDirection:'row',alignItems:'center',gap:9},noticeSuccess:{backgroundColor:'#DDEFE4'},noticeDanger:{backgroundColor:'#F3DEDB'},noticeText:{flex:1,fontFamily:'Manrope_600SemiBold',fontSize:12},noticeTextSuccess:{color:colors.success},noticeTextDanger:{color:'#8F332C'},actions:{alignItems:'flex-start'},
  sideTitle:{fontFamily:'Manrope_500Medium',fontSize:25,color:colors.ink,marginBottom:20},step:{minHeight:72,flexDirection:'row',alignItems:'center'},stepNumber:{width:44,height:44,borderRadius:22,backgroundColor:'#D8D9D3',alignItems:'center',justifyContent:'center',zIndex:2},stepActive:{backgroundColor:colors.acid},stepNumberText:{fontFamily:'Manrope_700Bold',fontSize:11,color:colors.ink},stepLine:{height:1,width:34,backgroundColor:colors.line},stepText:{fontFamily:'Manrope_600SemiBold',fontSize:14,color:colors.ink,flex:1},security:{backgroundColor:colors.acid,flexDirection:'row',alignItems:'flex-start',gap:14},securityTitle:{fontFamily:'Manrope_700Bold',fontSize:15,color:colors.ink},securityText:{fontFamily:'Manrope_400Regular',fontSize:12,lineHeight:18,color:colors.inkSoft,marginTop:4},
});

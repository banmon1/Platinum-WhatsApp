import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiClient, type ActivityEvent, type AiSettings, type Campaign, type WhatsAppStatus } from '../api';
import {
  clearAuthToken,
  defaultApiUrl,
  loadApiUrl,
  loadAuthToken,
  saveApiUrl as persistApiUrl,
  saveAuthToken,
} from '../storage';

const emptyStatus: WhatsAppStatus = { state:'disconnected', qrDataUrl:null, phone:null, profileName:null, lastError:null, updatedAt:new Date().toISOString() };
const emptyAi: AiSettings = { enabled:false, configured:false, prompt:'', model:'gpt-5-mini' };

type AuthState = 'loading' | 'signedOut' | 'signedIn';

interface AppState {
  apiUrl:string; setApiUrl:(value:string)=>Promise<void>; api:ApiClient; online:boolean; loading:boolean;
  authState:AuthState; authenticated:boolean; login:(email:string,password:string)=>Promise<void>; logout:()=>Promise<void>;
  whatsapp:WhatsAppStatus; ai:AiSettings; campaigns:Campaign[]; activity:ActivityEvent[];
  refresh:()=>Promise<void>; connectWhatsApp:()=>Promise<WhatsAppStatus|null>; disconnectWhatsApp:()=>Promise<WhatsAppStatus|null>; setAi:(value:AiSettings)=>void;
}
const Context = createContext<AppState | null>(null);

async function loadSnapshot(client: ApiClient) {
  const [status,campaigns,activity] = await Promise.all([client.status(),client.campaigns(),client.activity()]);
  return {status,campaigns,activity};
}

export function AppProvider({children}:{children:ReactNode}) {
  const [apiUrl,setApiUrlState] = useState(defaultApiUrl);
  const [accessToken,setAccessToken] = useState<string|null>(null);
  const [authState,setAuthState] = useState<AuthState>('loading');
  const [online,setOnline] = useState(false);
  const [loading,setLoading] = useState(true);
  const [whatsapp,setWhatsApp] = useState(emptyStatus);
  const [ai,setAi] = useState(emptyAi);
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [activity,setActivity] = useState<ActivityEvent[]>([]);
  const activeTokenRef = useRef<string|null>(null);
  const sessionGenerationRef = useRef(0);
  const refreshSequenceRef = useRef(0);

  const resetProtectedState = useCallback(() => {
    setOnline(false);
    setWhatsApp(emptyStatus);
    setAi(emptyAi);
    setCampaigns([]);
    setActivity([]);
  },[]);

  const beginSession = useCallback((token:string) => {
    sessionGenerationRef.current += 1;
    activeTokenRef.current = token;
    setAccessToken(token);
  },[]);

  const clearSession = useCallback(async (expectedToken?:string|null) => {
    if (expectedToken && activeTokenRef.current !== expectedToken) return;
    sessionGenerationRef.current += 1;
    activeTokenRef.current = null;
    setAccessToken(null);
    setAuthState('signedOut');
    setLoading(false);
    resetProtectedState();
    await clearAuthToken();
  },[resetProtectedState]);

  const expireApiSession = useCallback(() => clearSession(accessToken), [accessToken,clearSession]);
  const api = useMemo(() => new ApiClient(apiUrl,accessToken,expireApiSession), [accessToken,apiUrl,expireApiSession]);

  const logout = useCallback(async () => {
    const tokenToRevoke=activeTokenRef.current;
    if (tokenToRevoke) {
      try { await new ApiClient(apiUrl,tokenToRevoke).logout(); }
      catch { /* Local sign-out still completes if the server is unavailable. */ }
    }
    await clearSession(tokenToRevoke);
  },[apiUrl,clearSession]);

  const applySnapshot = useCallback((snapshot:Awaited<ReturnType<typeof loadSnapshot>>) => {
    setWhatsApp(snapshot.status.whatsapp);
    setAi(snapshot.status.ai);
    setCampaigns(snapshot.campaigns);
    setActivity(snapshot.activity);
    setOnline(true);
  },[]);

  const refresh = useCallback(async () => {
    if (!accessToken) { setLoading(false); return; }
    const requestGeneration=sessionGenerationRef.current;
    const requestSequence=++refreshSequenceRef.current;
    try {
      const snapshot=await loadSnapshot(api);
      if (activeTokenRef.current===accessToken&&sessionGenerationRef.current===requestGeneration&&refreshSequenceRef.current===requestSequence) applySnapshot(snapshot);
    } catch {
      if (activeTokenRef.current===accessToken&&sessionGenerationRef.current===requestGeneration&&refreshSequenceRef.current===requestSequence) setOnline(false);
    } finally {
      if (activeTokenRef.current===accessToken&&sessionGenerationRef.current===requestGeneration&&refreshSequenceRef.current===requestSequence) setLoading(false);
    }
  },[accessToken,api,applySnapshot]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [storedApiUrl,storedToken] = await Promise.all([loadApiUrl(),loadAuthToken()]);
      if (!active) return;
      setApiUrlState(storedApiUrl);
      if (!storedToken) {
        setAuthState('signedOut');
        setLoading(false);
        return;
      }

      const storedClient = new ApiClient(storedApiUrl,storedToken);
      try {
        const snapshot = await loadSnapshot(storedClient);
        if (!active) return;
        beginSession(storedToken);
        applySnapshot(snapshot);
        setAuthState('signedIn');
      } catch {
        await clearAuthToken();
        if (!active) return;
        resetProtectedState();
        setAuthState('signedOut');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  },[applySnapshot,beginSession,resetProtectedState]);

  useEffect(() => {
    if (authState !== 'signedIn') return;
    let cancelled=false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const poll=async()=>{
      await refresh();
      if(!cancelled)timer=setTimeout(()=>void poll(),3000);
    };
    void poll();
    return () => {cancelled=true;if(timer)clearTimeout(timer);};
  },[authState,refresh]);

  const mutateWhatsApp = useCallback(async(action:'connect'|'disconnect') => {
    if(!accessToken)return null;
    const requestToken=accessToken;
    const requestGeneration=sessionGenerationRef.current;
    const result=action==='connect'?await api.connect():await api.disconnect();
    if(activeTokenRef.current!==requestToken||sessionGenerationRef.current!==requestGeneration)return null;
    setWhatsApp(result);
    return result;
  },[accessToken,api]);

  const connectWhatsApp = useCallback(() => mutateWhatsApp('connect'),[mutateWhatsApp]);
  const disconnectWhatsApp = useCallback(() => mutateWhatsApp('disconnect'),[mutateWhatsApp]);

  const login = useCallback(async(email:string,password:string) => {
    setLoading(true);
    try {
      const result = await new ApiClient(apiUrl).login(email.trim().toLowerCase(),password);
      if (!result.token) throw new Error('The server did not return a valid session.');
      await saveAuthToken(result.token);
      beginSession(result.token);
      setAuthState('signedIn');
      setOnline(true);
    } finally { setLoading(false); }
  },[apiUrl,beginSession]);

  const setApiUrl = useCallback(async(value:string) => {
    setApiUrlState(await persistApiUrl(value));
    setLoading(true);
  },[]);

  return <Context.Provider value={{
    apiUrl,setApiUrl,api,online,loading,authState,authenticated:authState==='signedIn',login,logout,
    whatsapp,ai,campaigns,activity,refresh,connectWhatsApp,disconnectWhatsApp,setAi,
  }}>{children}</Context.Provider>;
}

export function useApp() {
  const value=useContext(Context);
  if(!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

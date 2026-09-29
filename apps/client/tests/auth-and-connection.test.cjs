const assert = require('node:assert/strict');
const test = require('node:test');
const { ApiClient, ApiError } = require('../src/api.ts');
const { loadWebApiUrl, resolveApiUrl, saveWebApiUrl } = require('../src/apiOrigin.ts');
const { connectionErrorNotice, connectionTransitionNotice } = require('../src/connectionNotice.ts');
const { visibleActivityDetail, visibleActivityEvents } = require('../src/activityDetail.ts');

test('internal WhatsApp chat identifiers stay hidden from activity', () => {
  assert.equal(visibleActivityDetail({type:'inbound',status:'received',detail:'40566083567631'}), null);
  assert.equal(visibleActivityDetail({type:'ai',status:'sent',detail:'216522890936376'}), null);
  assert.equal(visibleActivityDetail({type:'ai',status:'failed',detail:'AI provider unavailable'}), 'AI provider unavailable');
  assert.equal(visibleActivityDetail({type:'message',status:'sent',detail:'+962791111111'}), '+962791111111');
});

test('incoming-message events are omitted from the activity timeline', () => {
  const events = [
    {type:'inbound',status:'received',detail:'40566083567631',id:'incoming'},
    {type:'message',status:'sent',detail:'+962791111111',id:'sent'},
    {type:'campaign',status:'running',detail:'2 recipients',id:'campaign'},
  ];
  assert.deepEqual(visibleActivityEvents(events).map((event) => event.id), ['sent', 'campaign']);
});

test('desktop uses its current private server origin without changing web or Android defaults', () => {
  const desktopRuntime=(origin,stored='http://localhost:8787')=>({
    location:{origin},
    localStorage:{getItem:()=>stored,setItem:()=>assert.fail('Desktop must not persist a server override.')},
    platinumDesktop:{isDesktop:true},
  });
  assert.equal(
    loadWebApiUrl('platinum.apiUrl',desktopRuntime('http://127.0.0.1:63703')),
    'http://127.0.0.1:63703',
  );
  assert.equal(resolveApiUrl('web', null, null), 'http://localhost:8787');
  assert.equal(resolveApiUrl('web', 'https://api.example.test/', null), 'https://api.example.test');
  assert.equal(resolveApiUrl('android', null, null), 'http://10.0.2.2:8787');
  assert.equal(loadWebApiUrl('platinum.apiUrl',desktopRuntime('https://example.test')), 'http://localhost:8787');
  assert.equal(loadWebApiUrl('platinum.apiUrl',desktopRuntime('file:///C:/Platinum/index.html',null)), 'http://localhost:8787');
  assert.equal(loadWebApiUrl('platinum.apiUrl',desktopRuntime('http://127.0.0.1:63704',null)), 'http://127.0.0.1:63704');
  assert.equal(saveWebApiUrl('platinum.apiUrl','https://api.example.test',desktopRuntime('http://127.0.0.1:63703')), 'http://127.0.0.1:63703');

  const writes=[];
  const webRuntime={localStorage:{getItem:()=>null,setItem:(key,value)=>writes.push([key,value])}};
  assert.equal(saveWebApiUrl('platinum.apiUrl','https://api.example.test/',webRuntime),'https://api.example.test');
  assert.deepEqual(writes,[['platinum.apiUrl','https://api.example.test']]);
});

test('desktop login posts to the active private origin', async (context) => {
  const originalFetch=globalThis.fetch;
  const requests=[];
  context.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async(input,init)=>{
    requests.push({url:String(input),init});
    return Response.json({token:'nabilo-desktop-session'});
  };

  const desktopUrl=loadWebApiUrl('platinum.apiUrl',{
    location:{origin:'http://127.0.0.1:63703'},
    localStorage:{getItem:()=> 'http://localhost:8787',setItem:()=>{}},
    platinumDesktop:{isDesktop:true},
  });
  await new ApiClient(desktopUrl).login('owner@example.com','nabilo-test-password');
  assert.equal(requests[0]?.url,'http://127.0.0.1:63703/api/auth/login');
});

test('login sends credentials only to the auth route and bearer token protects later requests', async (context) => {
  const originalFetch=globalThis.fetch;
  const requests=[];
  context.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async(input,init)=>{
    requests.push({url:String(input),init});
    if(String(input).endsWith('/api/auth/login')) return Response.json({token:'nabilo-test-session'});
    return Response.json({whatsapp:{},ai:{}});
  };

  const anonymous=new ApiClient('http://localhost:8787');
  assert.deepEqual(await anonymous.login('owner@example.com','nabilo-test-password'),{token:'nabilo-test-session'});
  assert.equal(requests[0]?.url,'http://localhost:8787/api/auth/login');
  assert.equal(new Headers(requests[0]?.init?.headers).has('Authorization'),false);
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)),{email:'owner@example.com',password:'nabilo-test-password'});

  const authenticated=new ApiClient('http://localhost:8787','nabilo-test-session');
  await authenticated.status();
  assert.equal(new Headers(requests[1]?.init?.headers).get('Authorization'),'Bearer nabilo-test-session');
  await authenticated.logout();
  assert.equal(requests[2]?.url,'http://localhost:8787/api/auth/logout');
  assert.equal(requests[2]?.init?.method,'POST');
  assert.equal(new Headers(requests[2]?.init?.headers).get('Authorization'),'Bearer nabilo-test-session');
});

test('401 responses expire the client session', async (context) => {
  const originalFetch=globalThis.fetch;
  let expired=0;
  context.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>Response.json({error:'Session expired.'},{status:401});

  const client=new ApiClient('http://localhost:8787','expired-token',()=>{expired+=1;});
  await assert.rejects(client.status(),error=>error instanceof ApiError&&error.status===401);
  assert.equal(expired,1);
});

test('QR completion produces a green success notice while failures remain danger notices', () => {
  assert.deepEqual(connectionTransitionNotice('qr','connected'),{message:'Connected successfully.',tone:'success'});
  assert.deepEqual(connectionTransitionNotice('connecting','connected'),{message:'Connected successfully.',tone:'success'});
  assert.deepEqual(connectionTransitionNotice('disconnected','connected'),{message:'Connected successfully.',tone:'success'});
  assert.equal(connectionTransitionNotice('connected','connected'),null);
  assert.deepEqual(connectionErrorNotice(new Error('Pairing failed.')),{message:'Pairing failed.',tone:'danger'});
});

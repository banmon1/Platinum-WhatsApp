const assert = require('node:assert/strict');
const test = require('node:test');
const { ApiClient, ApiError } = require('../src/api.ts');
const { connectionErrorNotice, connectionTransitionNotice } = require('../src/connectionNotice.ts');

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

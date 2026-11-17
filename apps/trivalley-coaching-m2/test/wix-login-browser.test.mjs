import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createWixMemberLogin} from '../src/wix-login-browser.mjs';
const CLIENT_ID='82db080c-df7a-4995-9e72-d9fe9babd503';
const CALLBACK='https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/index.html';
const MEMBER='11111111-1111-4111-8111-111111111111';
function harness({
  time=1000000,status='APPROVED',loginUrl='https://www.trivalley.fit/_api/oauth2/authorize?code=fake',
  failToken=false
}={}) {
  const stored=new Map(),calls=[];
  const storage={
    getItem:key=>stored.get(key)||null,
    setItem:(key,value)=>stored.set(key,value),
    removeItem:key=>stored.delete(key)
  };
  const fake=(obj,ok=true)=>({ok,text:async()=>JSON.stringify(obj)});
  const fetchImpl=async(url,options)=>{
    const body=options.body?JSON.parse(options.body):null;
    calls.push({url,body,headers:options.headers});
    if(url==='https://www.wixapis.com/oauth2/token') {
      if(failToken)return fake({message:'Authentication unavailable'},false);
      if(body.grantType==='anonymous')return fake({access_token:'synthetic-visitor-token-value'});
      if(body.grantType==='authorization_code') {
        assert.equal(body.clientId,CLIENT_ID);
        assert.equal(body.redirectUri,CALLBACK);
        assert.equal(body.code,'one-time-code');
        assert.ok(body.codeVerifier.length>=43);
        return fake({access_token:'synthetic-member-token-value',expires_in:14400,refresh_token:'not-stored'});
      }
    }
    if(url==='https://www.wixapis.com/_api/redirects-api/v1/redirect-session') {
      assert.equal(options.headers.authorization,'synthetic-visitor-token-value');
      assert.equal(body.auth.authRequest.clientId,CLIENT_ID);
      assert.equal(body.auth.authRequest.codeChallengeMethod,'S256');
      assert.equal(body.auth.authRequest.responseMode,'fragment');
      assert.equal(body.auth.authRequest.scope,'offline_access');
      return fake({redirectSession:{fullUrl:loginUrl}});
    }
    if(url==='https://www.wixapis.com/members/v1/members/my?fieldsets=EXTENDED') {
      assert.equal(options.headers.authorization,'synthetic-member-token-value');
      return fake({member:{id:MEMBER,status}});
    }
    throw new Error('Unexpected test endpoint: '+url);
  };
  const client=createWixMemberLogin({fetchImpl,cryptoImpl:webcrypto,storage,now:()=>time});
  return {client,calls,stored};
}
test('valid Wix PKCE login from the main business site with one-time callback',async()=>{
  const {client,calls,stored}=harness();
  const {loginUrl,expectedState}=await client.begin();
  assert.ok(loginUrl.startsWith('https://www.trivalley.fit/'));
  assert.ok(expectedState.length>=43);
  assert.equal(calls[0].body.grantType,'anonymous');
  const redirect=calls[1].body.auth.authRequest;
  assert.equal(redirect.state,expectedState);
  assert.equal(redirect.codeChallengeMethod,'S256');
  assert.ok(redirect.codeChallenge.length>=43);
  const data=await client.complete(CALLBACK+'#code=one-time-code&state='+expectedState);
  assert.equal(data.memberId,MEMBER);
  assert.equal(data.source,'wix-main-business-site');
  assert.equal(data.accessToken,'synthetic-member-token-value');
  assert.equal(JSON.stringify([...stored.values()]).includes('synthetic-member-token-value'),false);
  assert.equal(JSON.stringify([...stored.values()]).includes('not-stored'),false);
  await assert.rejects(client.complete(CALLBACK+'#code=one-time-code&state='+expectedState),/state missing/);
});
test('wrong OAuth state rejects without redeeming a member token',async()=>{
  const {client,calls}=harness();
  await client.begin();
  await assert.rejects(client.complete(CALLBACK+'#code=one-time-code&state=wrong'),/state missing/);
  assert.equal(calls.filter(x=>x.body?.grantType==='authorization_code').length,0);
});
test('callback path or origin cannot be replaced with hostile site',async()=>{
  const {client}=harness();
  const {expectedState}=await client.begin();
  await assert.rejects(client.complete('https://evil.invalid/index.html#code=one-time-code&state='+expectedState),/origin mismatch/);
});
test('expired PKCE transaction fails even with the correct auth code',async()=>{
  let time=1000000;
  const {client}=harness({
    // time pointer overridden below in a second fixture
  });
  const storage=new Map();
  const state=await client.begin();
  assert.ok(state.expectedState);
  // Independent stale-state fixture using controlled clock
  const h=harness({time:0});
  await h.client.begin();
  const key=[...h.stored.keys()][0];
  const pending=JSON.parse(h.stored.get(key));
  pending.createdAt=-1000000;
  h.stored.set(key,JSON.stringify(pending));
  await assert.rejects(h.client.complete(CALLBACK+'#code=one-time-code&state='+pending.state),/state missing/);
});
test('malformed browser callback and access cancellation fail safely',async()=>{
  const {client}=harness();
  await client.begin();
  await assert.rejects(client.complete(CALLBACK+'#error=access_denied'),/cancelled/);
  await assert.rejects(client.complete(CALLBACK+'#/home'),/Missing OAuth/);
});
test('a Wix blocked/pending/unknown member receives no coaching access token',async()=>{
  for(const status of ['BLOCKED','PENDING','UNKNOWN']){
    const {client}=harness({status});
    const p=await client.begin();
    await assert.rejects(client.complete(CALLBACK+'#code=one-time-code&state='+p.expectedState),/not approved/);
  }
});
test('untrusted login redirect and upstream error clear pending PKCE state',async()=>{
  const h=harness({loginUrl:'https://evil.invalid/steal'});
  await assert.rejects(h.client.begin(),/Untrusted Wix login/);
  assert.equal(h.stored.size,0);
  const err=harness({failToken:true});
  await assert.rejects(err.client.begin(),/authentication request failed/);
  assert.equal(err.stored.size,0);
});
test('missing WebCrypto or browser session storage refuses login',()=>{
  assert.throws(()=>createWixMemberLogin({cryptoImpl:{},storage:new Map()}),/prerequisites/);
});

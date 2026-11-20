import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWixTokenInfoBinding} from '../src/wix-token-info-binding.mjs';
import {makeWixMemberVerifier} from '../src/wix-verify.mjs';
const siteId='9e6343d9-5a1c-45e2-8596-f73408e38402';
const clientId='d61ad4ca-bfe1-4792-b1d6-099567dd79d0';
const memberId='856ae2b7-5fc4-42d5-9647-57ec7a4675f4';
const canonicalId='4d122d05-0633-461b-ab06-4c642199e75a';
const token='synthetic-member-token-for-test-only';
const clock=1795218792000;
const valid={active:true,subjectType:'MEMBER',subjectId:memberId,
  siteId,clientId,iat:'1795218792',exp:'1795233192'};
const make=(data=valid)=>{
  const calls=[];
  const verify=makeWixTokenInfoBinding({expectedSiteId:siteId,expectedClientId:clientId,
    now:()=>clock,fetchImpl:async(url,options)=>{
      calls.push({url,options});
      return {ok:true,text:async()=>JSON.stringify(data)};
    }});
  return {verify,calls};
};
test('valid active Wix member token is bound to exact OAuth client and main Wix site',async()=>{
  const f=make();
  assert.deepEqual(await f.verify({token,expectedSiteId:siteId}),
    {siteId,identityType:'member',memberId});
  assert.equal(f.calls[0].url,'https://www.wixapis.com/oauth2/token-info');
  assert.equal(f.calls[0].options.method,'POST');
  assert.equal(JSON.parse(f.calls[0].options.body).token,token);
});
test('visitor, cross-site, other OAuth app, inactive, expired and malformed tokens fail closed',async()=>{
  for(const change of [
    {subjectType:'VISITOR'},{subjectType:'APP'},{siteId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},
    {clientId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},{active:false},
    {exp:'1795218792'},{iat:'1795233193'}, {exp:'9999999999'},
    {subjectId:'not-a-member'},{iat:'invalid'},{exp:null}
  ])assert.equal(await make({...valid,...change}).verify({token,expectedSiteId:siteId}),null);
  const f=make();
  assert.equal(await f.verify({token,expectedSiteId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),null);
  assert.equal(await f.verify({token:'bad',expectedSiteId:siteId}),null);
  assert.equal(f.calls.length,0);
});
test('Wix provider error and invalid JSON deny without falling back to client claims',async()=>{
  const fail=makeWixTokenInfoBinding({expectedSiteId:siteId,expectedClientId:clientId,
    fetchImpl:async()=>({ok:false,status:403})});
  assert.equal(await fail({token,expectedSiteId:siteId}),null);
  const broken=makeWixTokenInfoBinding({expectedSiteId:siteId,expectedClientId:clientId,
    fetchImpl:async()=>({ok:true,text:async()=>'{not json'})});
  assert.equal(await broken({token,expectedSiteId:siteId}),null);
});
test('verified secondary Wix member is mapped to canonical primary coaching account',async()=>{
  const binder=make().verify;
  const verifier=makeWixMemberVerifier({siteId,verifyTokenSite:binder,
    lookupProvisionedMember:async({siteId:site,memberId:member})=>({
      siteId:site,memberId:member,canonicalMemberId:canonicalId,
      role:'coach',orgId:'org-private',status:'active'
    }),
    fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({
      member:{id:memberId,status:'APPROVED'}
    })})
  });
  assert.deepEqual(await verifier(token),{
    sub:canonicalId,orgId:'org-private',role:'coach'
  });
});

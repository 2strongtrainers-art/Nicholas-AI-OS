import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWixMemberVerifier} from '../src/wix-verify.mjs';

const siteId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const wrongSite='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const memberId='11111111-1111-4111-8111-111111111111';
const approved=(status='APPROVED',id=memberId)=>JSON.stringify({
  member:{id,status,loginEmail:'not-returned@example.invalid'}
});
const token='synthetic-wix-member-token-not-real';
const make=({
  siteResult={siteId,identityType:'member',memberId},
  response=approved(),
  membership={siteId,memberId,role:'client',orgId:'org-private',status:'active'},
  httpOk=true,
  transport,
  lookup,
  scope
}={})=>{
  const calls=[];
  const request=transport||async (url,options)=>{
    calls.push({url,method:options.method,authorization:options.headers.Authorization,redirect:options.redirect});
    return{ok:httpOk,status:httpOk?200:401,text:async()=>response};
  };
  const verifier=makeWixMemberVerifier({
    siteId,verifyTokenSite:scope||async()=>siteResult,
    lookupProvisionedMember:lookup||async()=>membership,
    fetchImpl:request
  });
  return {verifier,calls};
};

test('production adapter cannot start without trusted token site binding or role lookup',()=>{
  assert.throws(()=>makeWixMemberVerifier({siteId,lookupProvisionedMember:async()=>{}}),
    /Trusted token-site binding/);
  assert.throws(()=>makeWixMemberVerifier({siteId,verifyTokenSite:async()=>{}}),
    /Trusted token-site binding/);
  assert.throws(()=>makeWixMemberVerifier({siteId:'not-site',verifyTokenSite:async()=>{},
    lookupProvisionedMember:async()=>{}}),/Verified Wix project/);
});

test('approved member identity only from EXTENDED Wix endpoint with protected membership',async()=>{
  const {verifier,calls}=make();
  const identity=await verifier(token);
  assert.deepEqual(identity,{sub:memberId,orgId:'org-private',role:'client'});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://www.wixapis.com/members/v1/members/my?fieldsets=EXTENDED');
  assert.equal(calls[0].authorization,token);
  assert.equal(calls[0].redirect,'error');
  assert.equal(JSON.stringify(identity).includes('example.invalid'),false);
});

test('visitor and cross-site tokens fail before reading Wix profile or local data',async()=>{
  for(const siteResult of [null,{siteId:wrongSite,identityType:'member',memberId},
    {siteId,identityType:'visitor'},{siteId,identityType:'api-key'},
    {siteId,identityType:'member',memberId:'22222222-2222-4222-8222-222222222222'}]){
    const {verifier,calls}=make({siteResult});
    const result=await verifier(token);
    assert.equal(result,null);
    if(siteResult?.siteId!==siteId||siteResult?.identityType!=='member') assert.equal(calls.length,0);
  }
});

test('Wix member must be APPROVED, not PUBLIC unknown or blocked/offline/pending',async()=>{
  for(const status of ['UNKNOWN','PENDING','BLOCKED','OFFLINE','']){
    const {verifier}=make({response:approved(status)});
    assert.equal(await verifier(token),null);
  }
});

test('unprovisioned, wrong-site, disabled and unrecognized roles denied',async()=>{
  const roles=[
    null,
    {siteId:wrongSite,memberId,role:'client',orgId:'org-private',status:'active'},
    {siteId,memberId,role:'admin',orgId:'org-private',status:'active'},
    {siteId,memberId,role:'client',orgId:'org-private',status:'disabled'},
    {siteId,memberId,role:'client',orgId:'',status:'active'},
    {siteId,memberId:'22222222-2222-4222-8222-222222222222',role:'client',orgId:'org-private',status:'active'}
  ];
  for(const membership of roles){
    const {verifier}=make({membership});
    assert.equal(await verifier(token),null);
  }
});

test('invalid profile response, Wix denial, transport errors all fail closed',async()=>{
  for(const response of ['not-json','{}','{"member":{"id":"not-guid","status":"APPROVED"}}',
    '{"member":{"id":"11111111-1111-4111-8111-111111111111"}}']){
    assert.equal(await make({response}).verifier(token),null);
  }
  assert.equal(await make({httpOk:false}).verifier(token),null);
  assert.equal(await make({transport:async()=>{throw new Error('private provider failure')}}).verifier(token),null);
  assert.equal(await make({lookup:async()=>{throw new Error('database unavailable')}}).verifier(token),null);
});

test('malformed or missing bearer token never reaches Wix',async()=>{
  const {verifier,calls}=make();
  for(const t of [undefined,'', 'short','bad token with spaces','a'.repeat(4100)]){
    assert.equal(await verifier(t),null);
  }
  assert.equal(calls.length,0);
});

test('oversized Wix response fails closed rather than parsing arbitrary data',async()=>{
  const {verifier}=make({response:' '.repeat(66000)});
  assert.equal(await verifier(token),null);
});

test('token-site verifier must affirm member site even when Wix status says APPROVED',async()=>{
  const {verifier,calls}=make({scope:async()=>({siteId:wrongSite,identityType:'member',memberId})});
  assert.equal(await verifier(token),null);
  assert.equal(calls.length,0);
});

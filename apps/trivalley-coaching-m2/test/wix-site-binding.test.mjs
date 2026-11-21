import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWixSiteUrlBinding} from '../src/wix-site-binding.mjs';
import {makeWixMemberVerifier} from '../src/wix-verify.mjs';

const siteId='9e6343d9-5a1c-45e2-8596-f73408e38402';
const memberId='11111111-1111-4111-8111-111111111111';
const token='synthetic-main-wix-member-token-value';
function fixture({baseUrl='https://www.trivalley.fit',published=true,
  siteStatus=200,memberStatus='APPROVED',role='coach',memberSite=siteId}={}) {
  const calls=[];
  const http=async (url,options)=>{
    calls.push({url,headers:options.headers,method:options.method});
    if(url==='https://www.wixapis.com/ricos/v1/site-context/site-url')
      return {ok:siteStatus===200,text:async()=>JSON.stringify({baseUrl,published})};
    if(url==='https://www.wixapis.com/members/v1/members/my?fieldSet=FULL')
      return {ok:true,text:async()=>JSON.stringify({member:{id:memberId,status:memberStatus}})};
    throw new Error('Unexpected request');
  };
  const siteBinder=makeWixSiteUrlBinding({expectedSiteId:siteId,fetchImpl:http});
  const verify=makeWixMemberVerifier({
    siteId,verifyTokenSite:siteBinder,
    lookupProvisionedMember:async()=>({siteId:memberSite,memberId,role,orgId:'org-a',status:'active'}),
    fetchImpl:http
  });
  return {verify,siteBinder,calls};
}
test('token site proof plus APPROVED Wix member plus protected role allow only intended site',async()=>{
  const f=fixture();
  const actor=await f.verify(token);
  assert.equal(actor.sub,memberId);
  assert.equal(actor.role,'coach');
  assert.equal(actor.orgId,'org-a');
  assert.equal(f.calls.length,2);
  assert.equal(f.calls[0].url,'https://www.wixapis.com/ricos/v1/site-context/site-url');
  assert.equal(f.calls[1].url,'https://www.wixapis.com/members/v1/members/my?fieldSet=FULL');
  assert.equal(f.calls[0].headers.Authorization,token);
});
test('wrong site domain, unpublished site or OAuth site-context denial block member lookup',async()=>{
  for(const overrides of [
    {baseUrl:'https://www.other-fit.invalid'},
    {baseUrl:'https://www.trivalley.fit.evil.invalid'},
    {baseUrl:'http://www.trivalley.fit'},
    {baseUrl:'https://www.trivalley.fit/other'},
    {baseUrl:'https://www.trivalley.fit?site=spoof'},
    {published:false},
    {siteStatus:403}
  ]) {
    const f=fixture(overrides);
    assert.equal(await f.verify(token),null);
    assert.equal(f.calls.length,1);
  }
});
test('unknown/blocked member, wrong provisioned membership site, or missing role fail closed',async()=>{
  for(const overrides of [
    {memberStatus:'UNKNOWN'},{memberStatus:'BLOCKED'},
    {memberSite:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},
    {role:'visitor'},{role:'admin'}
  ]) {
    const f=fixture(overrides);
    assert.equal(await f.verify(token),null);
  }
});
test('site endpoint cannot be invoked with forged expected site IDs or invalid tokens',async()=>{
  const f=fixture();
  assert.equal(await f.siteBinder({token,expectedSiteId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),null);
  assert.equal(await f.siteBinder({token:'bad',expectedSiteId:siteId}),null);
  assert.equal(f.calls.length,0);
});
test('transport errors and invalid JSON fail closed',async()=>{
  const siteBinder=makeWixSiteUrlBinding({expectedSiteId:siteId,
    fetchImpl:async()=>{throw new Error('Simulated provider timeout')}});
  assert.equal(await siteBinder({token,expectedSiteId:siteId}),null);
  const siteBinder2=makeWixSiteUrlBinding({expectedSiteId:siteId,
    fetchImpl:async()=>({ok:true,text:async()=>'{broken'})});
  assert.equal(await siteBinder2({token,expectedSiteId:siteId}),null);
});

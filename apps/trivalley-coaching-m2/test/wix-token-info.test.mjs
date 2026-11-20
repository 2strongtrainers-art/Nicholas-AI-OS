import test from "node:test";
import assert from "node:assert/strict";
import {makeWixOAuthTokenBinding} from "../src/wix-token-info.mjs";
const site="9e6343d9-5a1c-45e2-8596-f73408e38402";
const client="d61ad4ca-bfe1-4792-b1d6-099567dd79d0";
const member="4d122d05-0633-461b-ab06-4c642199e75a";
const token="synthetic-wix-member-token-value";
const valid=()=>({active:true,subjectType:"MEMBER",subjectId:member,siteId:site,clientId:client,iat:'1795218792',exp:'1795233192'});
function create(data=valid()){
  const calls=[];
  const fn=makeWixOAuthTokenBinding({expectedSiteId:site,expectedClientId:client,now:()=>1795220000000,
    fetchImpl:async(url,options)=>{calls.push({url,method:options.method,body:JSON.parse(options.body)});return {ok:true,text:async()=>JSON.stringify(data)};}});
  return {fn,calls};
}
test("real Wix token-info camelCase fields must all match before authorizing member",async()=>{
  const {fn,calls}=create();
  assert.deepEqual(await fn({token,expectedSiteId:site}),{siteId:site,identityType:"member",memberId:member});
  assert.equal(calls[0].url,"https://www.wixapis.com/oauth2/token-info");
  assert.equal(calls[0].method,"POST");
  assert.equal(calls[0].body.token,token);
});
test("visitor, app, admin, wrong site, wrong client, expired and inactive are rejected",async()=>{
  for(const change of [
    {subjectType:"VISITOR"},{subjectType:"USER"},{subjectType:"APP"},
    {siteId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
    {clientId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"},
    {subjectId:"bad"},{active:false},{exp:1},{iat:null},{exp:'1795218000'},{iat:'1795234000'}
  ])assert.equal(await create({...valid(),...change}).fn({token,expectedSiteId:site}),null);
});
test("no token or forged expected site never calls the provider",async()=>{
  const {fn,calls}=create();
  assert.equal(await fn({token,expectedSiteId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}),null);
  assert.equal(await fn({token:"bad",expectedSiteId:site}),null);
  assert.equal(calls.length,0);
});
test("provider failure, invalid JSON and response with legacy snake_case fields deny",async()=>{
  const {fn}=create({active:true,subject_type:"MEMBER",subject_id:member,site_id:site,client_id:client});
  assert.equal(await fn({token,expectedSiteId:site}),null);
  const outage=makeWixOAuthTokenBinding({expectedSiteId:site,expectedClientId:client,
    fetchImpl:async()=>{throw Error("provider outage")}});
  assert.equal(await outage({token,expectedSiteId:site}),null);
});

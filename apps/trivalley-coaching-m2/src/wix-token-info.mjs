// Wix OAuth Token Info verifies issuer/client, Wix site, and member subject on Wix's server.
// https://dev.wix.com/docs/api-reference/app-management/oauth-2/token-info
// The live JSON uses camelCase keys (siteId, clientId, subjectType, subjectId).
const URI="https://www.wixapis.com/oauth2/token-info";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function makeWixOAuthTokenBinding({expectedSiteId,expectedClientId,
  fetchImpl=globalThis.fetch,timeoutMs=4000,now=()=>Date.now()}={}) {
  if(!UUID.test(expectedSiteId||"")||!UUID.test(expectedClientId||""))
    throw new Error("Expected verified Wix site and OAuth client IDs");
  if(typeof fetchImpl!=="function")throw new Error("Wix token introspection transport required");
  if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>10000)
    throw new Error("Invalid Wix verification timeout");
  return async function verifyTokenSite({token,expectedSiteId:requestedSiteId}) {
    if(requestedSiteId!==expectedSiteId||typeof token!=="string"||
       token.length<10||token.length>4096||/\s/.test(token))return null;
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),timeoutMs);
    try {
      const res=await fetchImpl(URI,{
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({token}),
        signal:abort.signal,redirect:"error"
      });
      if(!res?.ok)return null;
      const raw=await res.text();
      if(raw.length>16384)return null;
      let data;try{data=JSON.parse(raw)}catch{return null}
      if(!data||data.active!==true||data.subjectType!=="MEMBER"||
         data.siteId!==expectedSiteId||data.clientId!==expectedClientId||
         !UUID.test(data.subjectId||""))return null;
      // Do not accept a provider-reported expired member session even if a stale response says active.
      if(typeof data.exp==="number" && (!Number.isFinite(data.exp)||data.exp*1000<=now()))return null;
      return Object.freeze({siteId:expectedSiteId,identityType:"member",memberId:data.subjectId});
    }catch{return null}
    finally{clearTimeout(timeout)}
  };
}

// Wix site URL proof for a supplied OAuth member access token.
// Wix REST GET /ricos/v1/site-context/site-url resolves the site bound to
// the caller's access token, without any user-supplied site ID.
// Source: https://dev.wix.com/docs/api-reference/assets/rich-content/site-context-v1/get-site-url
//
// This adapter is NOT a standalone login or role grant. It is used together
// with Wix Get My Member APPROVED status and a protected membership lookup.
// Some Headless member grants may lack the Ricos site-context permission;
// in that case the request fails closed. Live member-token support must be
// tested before enabling production.
const SITE_URL='https://www.wixapis.com/ricos/v1/site-context/site-url';
const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function makeWixSiteUrlBinding({
  expectedSiteId,expectedBaseUrl='https://www.trivalley.fit',
  fetchImpl=globalThis.fetch,timeoutMs=4000
}={}) {
  if(!GUID.test(expectedSiteId||''))throw new Error('Expected Wix site UUID required');
  if(typeof fetchImpl!=='function')throw new Error('Wix HTTP fetch transport required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>10000)throw new Error('Invalid site verification timeout');
  const expected=new URL(expectedBaseUrl);
  if(expected.protocol!=='https:'||expected.username||expected.password||
    expected.search||expected.hash||expected.pathname!=='/')
    throw new Error('Expected exact published Wix HTTPS site origin');
  return async function verifyTokenSite({token,expectedSiteId:requestSiteId}) {
    if(typeof token!=='string'||token.length<10||token.length>4096||
       /\s/.test(token)||requestSiteId!==expectedSiteId)return null;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const res=await fetchImpl(SITE_URL,{
        method:'GET',
        headers:{Authorization:token,Accept:'application/json'},
        signal:controller.signal,redirect:'error'
      });
      if(!res?.ok)return null;
      const raw=await res.text();
      if(raw.length>16384)return null;
      let data;
      try{data=JSON.parse(raw)}catch{return null}
      if(!data||data.published!==true||typeof data.baseUrl!=='string')return null;
      let actual;
      try{actual=new URL(data.baseUrl)}catch{return null}
      if(actual.origin!==expected.origin || actual.pathname!=='/' ||
         actual.search||actual.hash||actual.username||actual.password)return null;
      // Member identity is independently confirmed in makeWixMemberVerifier
      // by Wix Get My Member. This result only confirms Wix site context.
      return {siteId:expectedSiteId,identityType:'member'};
    }catch{return null}
    finally{clearTimeout(timer)}
  };
}

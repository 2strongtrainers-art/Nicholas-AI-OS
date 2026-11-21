// Verify the actual Wix-issued OAuth token using Wix's own token-info API.
// Wix returns camelCase fields (siteId, clientId, subjectType, subjectId)
// and Unix-second timestamps as decimal strings in live provider responses.
// No client-supplied site/member/role is trusted; tokens are never logged.
const INFO_URL='https://www.wixapis.com/oauth2/token-info';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const seconds=x=>{
  if(typeof x!=='number'&&!(typeof x==='string'&&/^\d{10,12}$/.test(x)))return null;
  const n=Number(x);
  return Number.isSafeInteger(n)&&n>0?n:null;
};
export function makeWixTokenInfoBinding({
  expectedSiteId,expectedClientId,
  fetchImpl=globalThis.fetch,timeoutMs=4000,now=()=>Date.now()
}={}) {
  if(!UUID.test(expectedSiteId||'')||!UUID.test(expectedClientId||''))
    throw new Error('Exact Wix site and OAuth client IDs required');
  if(typeof fetchImpl!=='function'||typeof now!=='function')
    throw new Error('Trusted token-info transport required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>10000)
    throw new Error('Invalid token-info timeout');
  return async function verifyTokenSite({token,expectedSiteId:requested}) {
    if(requested!==expectedSiteId||typeof token!=='string'||token.length<10||
       token.length>4096||/\s/.test(token))return null;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const res=await fetchImpl(INFO_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({token}),
        signal:controller.signal,
        redirect:'error'
      });
      if(!res?.ok)return null;
      const raw=await res.text();
      if(raw.length>16384)return null;
      let d;
      try{d=JSON.parse(raw)}catch{return null}
      if(d?.active!==true||d.subjectType!=='MEMBER'||
         d.siteId!==expectedSiteId||d.clientId!==expectedClientId||
         typeof d.subjectId!=='string'||!UUID.test(d.subjectId))return null;
      const issued=seconds(d.iat),expires=seconds(d.exp);
      const current=Math.floor(now()/1000);
      if(issued===null||expires===null||issued>current+60||
         expires<=current||expires<=issued||expires-issued>604800)return null;
      return {siteId:expectedSiteId,identityType:'member',memberId:d.subjectId};
    }catch{return null}
    finally{clearTimeout(timer)}
  };
}

// Staging-only Wix Headless member identity adapter.
//
// Verified official member endpoint:
// GET https://www.wixapis.com/members/v1/members/my?fieldsets=EXTENDED
// Member status must be APPROVED (PUBLIC fieldset returns UNKNOWN).
// Documentation: https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/get-my-member
//
// This cannot be activated in production without a provider-verified OAuth
// token-to-site binding function, protected membership/roles storage, and
// a verified login + redirect configuration. No identities are guessed.
const MY_MEMBER_URL='https://www.wixapis.com/members/v1/members/my?fieldsets=EXTENDED';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const permitted=new Set(['client','coach']);
const validGuid=x=>typeof x==='string'&&UUID.test(x);
const isMemberApproved=data=>data && typeof data==='object' && data.member &&
  validGuid(data.member.id)&&data.member.status==='APPROVED';

// verifyTokenSite must independently prove the presented OAuth token belongs
// to this exact Wix project. GET /members/my alone does not return site ID.
// A protected role lookup must be keyed by *both* Wix site and member ID.
export function makeWixMemberVerifier({
  siteId, verifyTokenSite, lookupProvisionedMember,
  fetchImpl=globalThis.fetch, timeoutMs=4000
}) {
  if (!validGuid(siteId)) throw new Error('Verified Wix project site ID required');
  if(typeof verifyTokenSite!=='function'||typeof lookupProvisionedMember!=='function')
    throw new Error('Trusted token-site binding and protected role lookup are required');
  if(typeof fetchImpl!=='function')throw new Error('Wix member lookup transport required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>10000)
    throw new Error('Invalid Wix member timeout');

  return async function verifyWixMember(token) {
    if(typeof token!=='string'||token.length<10||token.length>4096||/\s/.test(token)) return null;
    try {
      const scoped=await verifyTokenSite({token,expectedSiteId:siteId});
      if(!scoped||scoped.siteId!==siteId||scoped.identityType!=='member')return null;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),timeoutMs);
      let response;
      try {
        response=await fetchImpl(MY_MEMBER_URL,{
          method:'GET',
          headers:{Authorization:token,Accept:'application/json'},
          signal:controller.signal,redirect:'error'
        });
        if(!response||!response.ok)return null;
        const raw=await response.text();
        if(raw.length>65536)return null;
        let payload;
        try{payload=JSON.parse(raw)}catch{return null}
        if(!isMemberApproved(payload))return null;
        if(scoped.memberId && scoped.memberId!==payload.member.id)return null;
        const member=await lookupProvisionedMember({siteId,memberId:payload.member.id});
        if(!member||member.siteId!==siteId||member.memberId!==payload.member.id||
          member.status!=='active'||!permitted.has(member.role)||
          typeof member.orgId!=='string'||!member.orgId.trim())return null;
        return Object.freeze({sub:payload.member.id,orgId:member.orgId,role:member.role});
      }finally {
        clearTimeout(timeout);
      }
    }catch{
      // Distinguish no member vs transport failure only in private metrics.
      // Never log the supplied token, Wix identity/profile, or error body.
      return null;
    }
  };
}

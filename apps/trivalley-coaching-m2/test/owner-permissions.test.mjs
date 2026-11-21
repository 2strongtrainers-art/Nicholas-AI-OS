import test from "node:test";
import assert from "node:assert/strict";
import {requireCoachingOwner,CANONICAL_OWNER_ID} from "../src/owner-permissions.mjs";
const owner={sub:CANONICAL_OWNER_ID,orgId:"org-a",role:"coach"};
test("canonical member can perform organization-wide administrative actions",()=>{
  assert.equal(requireCoachingOwner(owner),owner);
});
test("all other coaches, clients, missing or altered identities are denied",()=>{
  for(const actor of [
    {sub:"someone-else",orgId:"org-a",role:"coach"},
    {sub:CANONICAL_OWNER_ID,orgId:"org-a",role:"client"},
    {sub:CANONICAL_OWNER_ID,orgId:"org-a",role:"admin"},
    null,{}
  ])assert.throws(()=>requireCoachingOwner(actor),x=>x?.status===403&&x?.code==="OWNER_ONLY");
});

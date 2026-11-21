// Organization-wide administration is reserved for the canonical owner.
// A verified secondary Wix owner alias is resolved to this canonical member
// before this function is called; user-supplied roles are never accepted.
import {CoachingError} from "./domain.mjs";
export const CANONICAL_OWNER_ID="4d122d05-0633-461b-ab06-4c642199e75a";
export function requireCoachingOwner(actor){
  if(!actor||actor.role!=="coach"||actor.sub!==CANONICAL_OWNER_ID)
    throw new CoachingError(403,"OWNER_ONLY","Canonical coaching owner required");
  return actor;
}

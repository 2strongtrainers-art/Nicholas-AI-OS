import wixData from "wix-data";
import { Permissions, webMethod } from "wix-web-module";
import { currentMember } from "wix-members-backend";
import { orders } from "wix-pricing-plans-backend";
import { DATA_OPTIONS, FORGE_PLAN_IDS, FORGE } from "./forgeConfig";

const REFERRAL_CREDIT = "25 USD";

async function loggedInMember() {
  const member = await currentMember.getMember();
  if (!member?._id) throw new Error("FORGE requires a logged-in site member.");
  return member;
}

async function hasActiveForgeEntitlement() {
  const memberOrders = await orders.listCurrentMemberOrders();
  return (memberOrders || []).some(
    (order) => FORGE_PLAN_IDS.includes(order.planId) && order.status === "ACTIVE",
  );
}

async function profileFor(memberId) {
  const result = await wixData
    .query(FORGE.collections.PROFILES)
    .eq("memberId", memberId)
    .limit(1)
    .find(DATA_OPTIONS);
  return result.items[0] || null;
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

async function generateReferralCode(memberId) {
  const compact = String(memberId).replace(/-/g, "").toUpperCase();
  const candidates = [
    `FORGE-${compact.slice(0, 10)}`,
    `FORGE-${compact.slice(0, 16)}`,
    `FORGE-${compact}`,
  ];

  for (const candidate of candidates) {
    const existing = await wixData
      .query(FORGE.collections.PROFILES)
      .eq("referralCode", candidate)
      .limit(1)
      .find(DATA_OPTIONS);
    if (!existing.items.length || existing.items[0].memberId === memberId) return candidate;
  }

  throw new Error("Unable to generate a unique FORGE referral code.");
}

async function ensureReferralCode(profile) {
  if (profile.referralCode) return profile;
  profile.referralCode = await generateReferralCode(profile.memberId);
  return wixData.save(FORGE.collections.PROFILES, profile, DATA_OPTIONS);
}

async function rewardExists(memberId, milestone) {
  const result = await wixData
    .query(FORGE.collections.REWARDS)
    .eq("memberId", memberId)
    .eq("milestone", milestone)
    .limit(1)
    .find(DATA_OPTIONS);
  return result.items.length > 0;
}

async function createReferralCredit(memberId, milestone, note) {
  if (await rewardExists(memberId, milestone)) return false;
  await wixData.insert(FORGE.collections.REWARDS, {
    memberId,
    milestone,
    earned: true,
    earnedDate: new Date(),
    rewardType: "REFERRAL_CREDIT",
    rewardValue: REFERRAL_CREDIT,
    redeemed: false,
    notes: note,
  }, DATA_OPTIONS);
  return true;
}

export const loadForgeReferral = webMethod(Permissions.SiteMember, async () => {
  const member = await loggedInMember();
  if (!(await hasActiveForgeEntitlement())) return { entitled: false };

  const profile = await profileFor(member._id);
  if (!profile) return { entitled: true, profileReady: false };

  const updated = await ensureReferralCode(profile);
  return {
    entitled: true,
    profileReady: true,
    referralCode: updated.referralCode,
    referredByCode: updated.referredByCode || null,
    canRedeemReferral: !updated.referredByCode,
    creditValue: REFERRAL_CREDIT,
  };
});

export const redeemForgeReferral = webMethod(Permissions.SiteMember, async (rawCode) => {
  const member = await loggedInMember();
  if (!(await hasActiveForgeEntitlement())) throw new Error("No active FORGE entitlement.");

  let memberProfile = await profileFor(member._id);
  if (!memberProfile) throw new Error("FORGE member profile is not ready yet.");
  memberProfile = await ensureReferralCode(memberProfile);

  if (memberProfile.referredByCode) {
    return { success: false, reason: "ALREADY_REDEEMED", referredByCode: memberProfile.referredByCode };
  }

  const code = normalizeCode(rawCode);
  if (!code || !code.startsWith("FORGE-")) return { success: false, reason: "INVALID_CODE" };
  if (code === normalizeCode(memberProfile.referralCode)) return { success: false, reason: "SELF_REFERRAL" };

  const referrerResult = await wixData
    .query(FORGE.collections.PROFILES)
    .eq("referralCode", code)
    .limit(2)
    .find(DATA_OPTIONS);
  const referrer = referrerResult.items[0];
  if (!referrer || referrer.memberId === member._id) return { success: false, reason: "INVALID_CODE" };

  memberProfile.referredByCode = code;
  await wixData.save(FORGE.collections.PROFILES, memberProfile, DATA_OPTIONS);

  const referrerMilestone = `REFERRAL_FROM:${member._id}`;
  const newMemberMilestone = `REFERRED_BY:${referrer.memberId}`;

  const [referrerCredited, newMemberCredited] = await Promise.all([
    createReferralCredit(
      referrer.memberId,
      referrerMilestone,
      `Earned for referring paid FORGE member ${member._id}. Credit is for future FORGE purchases/services and is not cash redeemable.`,
    ),
    createReferralCredit(
      member._id,
      newMemberMilestone,
      `Earned for joining FORGE with referral code ${code}. Credit is for future FORGE purchases/services and is not cash redeemable.`,
    ),
  ]);

  return {
    success: true,
    referralCode: code,
    referrerCredited,
    newMemberCredited,
    creditValue: REFERRAL_CREDIT,
  };
});

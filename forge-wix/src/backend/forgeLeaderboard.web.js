import wixData from "wix-data";
import { Permissions, webMethod } from "wix-web-module";
import { currentMember } from "wix-members-backend";
import { orders } from "wix-pricing-plans-backend";
import { DATA_OPTIONS, FORGE, FORGE_PLAN_IDS } from "./forgeConfig";

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

async function currentProfile(memberId) {
  const result = await wixData
    .query(FORGE.collections.PROFILES)
    .eq("memberId", memberId)
    .limit(1)
    .find(DATA_OPTIONS);
  return result.items[0] || null;
}

function cleanDisplayName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 ._'-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
}

function rankEntries(items) {
  return items
    .filter((item) => item.leaderboardOptIn === true && item.leaderboardName)
    .sort((a, b) => {
      const adherenceDifference = Number(b.completionPercent || 0) - Number(a.completionPercent || 0);
      if (adherenceDifference !== 0) return adherenceDifference;
      const streakDifference = Number(b.streak || 0) - Number(a.streak || 0);
      if (streakDifference !== 0) return streakDifference;
      return Number(b.workoutsCompleted || 0) - Number(a.workoutsCompleted || 0);
    })
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      displayName: item.leaderboardName,
      adherence: Number(item.completionPercent || 0),
      streak: Number(item.streak || 0),
      workoutsCompleted: Number(item.workoutsCompleted || 0),
      currentDay: Number(item.currentDay || 0),
    }));
}

export const loadForgeLeaderboard = webMethod(Permissions.SiteMember, async () => {
  const member = await loggedInMember();
  if (!(await hasActiveForgeEntitlement())) return { entitled: false, entries: [] };

  const profile = await currentProfile(member._id);
  if (!profile) return { entitled: true, profileReady: false, entries: [] };

  const result = await wixData
    .query(FORGE.collections.PROFILES)
    .eq("leaderboardOptIn", true)
    .limit(1000)
    .find(DATA_OPTIONS);

  return {
    entitled: true,
    profileReady: true,
    optIn: profile.leaderboardOptIn === true,
    displayName: profile.leaderboardName || "",
    entries: rankEntries(result.items || []),
    metricLabel: "Consistency score: adherence first, then streak, then workouts completed.",
  };
});

export const updateForgeLeaderboardPreference = webMethod(Permissions.SiteMember, async (optIn, rawDisplayName) => {
  const member = await loggedInMember();
  if (!(await hasActiveForgeEntitlement())) throw new Error("No active FORGE entitlement.");

  const profile = await currentProfile(member._id);
  if (!profile) throw new Error("FORGE member profile is not ready yet.");

  const enabled = optIn === true;
  const displayName = cleanDisplayName(rawDisplayName);
  if (enabled && displayName.length < 2) {
    return { success: false, reason: "DISPLAY_NAME_REQUIRED" };
  }

  profile.leaderboardOptIn = enabled;
  profile.leaderboardName = enabled ? displayName : profile.leaderboardName || "";
  await wixData.save(FORGE.collections.PROFILES, profile, DATA_OPTIONS);

  return {
    success: true,
    optIn: profile.leaderboardOptIn,
    displayName: profile.leaderboardName,
  };
});

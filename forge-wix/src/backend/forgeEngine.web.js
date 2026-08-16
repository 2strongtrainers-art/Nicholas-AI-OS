import wixData from "wix-data";
import { Permissions, webMethod } from "wix-web-module";
import { currentMember, badges } from "wix-members-backend";
import { orders } from "wix-pricing-plans-backend";
import { submissions } from "wix-forms.v2";
import { elevate } from "wix-auth";
import { DATA_OPTIONS, FORGE, FORGE_PLAN_IDS, TIER_BY_PLAN } from "./forgeConfig";
import {
  asArray,
  challengeDay,
  clamp,
  getOrCreateTodayWorkout,
  normalizePreferredDays,
  parseNumber,
  phaseFor,
} from "./forgeGenerator";

async function loggedInMember() {
  const member = await currentMember.getMember();
  if (!member?._id) throw new Error("FORGE requires a logged-in site member.");
  return member;
}

function orderId(order) {
  return order?._id || order?.id;
}

function createdTime(order) {
  return new Date(order?._createdDate || order?.createdDate || 0).getTime();
}

async function activeForgeOrder() {
  const memberOrders = await orders.listCurrentMemberOrders();
  const eligible = (memberOrders || [])
    .filter((order) => FORGE_PLAN_IDS.includes(order.planId) && order.status === "ACTIVE")
    .sort((a, b) => createdTime(b) - createdTime(a));

  if (!eligible.length) return null;
  return orders.getOrder(orderId(eligible[0]), { suppressAuth: true });
}

function unwrapSubmissionValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object" || Array.isArray(value)) return value;
  if ("value" in value) return value.value;
  if ("string" in value) return value.string;
  if ("number" in value) return value.number;
  if ("boolean" in value) return value.boolean;
  if ("dateTime" in value) return value.dateTime;
  if ("values" in value) return value.values;
  return value;
}

function submissionValues(raw = {}) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, unwrapSubmissionValue(value)]),
  );
}

async function existingAssessment(memberId) {
  const result = await wixData
    .query(FORGE.collections.ASSESSMENTS)
    .eq("memberId", memberId)
    .descending("assessmentDate")
    .limit(1)
    .find(DATA_OPTIONS);
  return result.items[0] || null;
}

async function assessmentFor(member, order) {
  const stored = await existingAssessment(member._id);
  if (stored) return stored;

  const submissionId = order?.formData?.submissionId;
  if (!submissionId) return null;

  const getSubmission = elevate(submissions.getSubmission);
  const submission = await getSubmission(submissionId);
  if (!submission || submission.formId !== FORGE.onboardingFormId) return null;

  const values = submissionValues(submission.submissions || {});
  const trainingDays = clamp(parseNumber(values.training_days_forge, 3), 3, 6);
  const assessment = {
    memberId: member._id,
    assessmentDate: new Date(),
    age: clamp(parseNumber(values.age_forge, 18), 13, 100),
    primaryGoal: String(values.primary_goal_forge || "general fitness"),
    trainingExperience: String(values.experience_forge || "beginner"),
    strengthBaseline: String(values.strength_baseline_forge || ""),
    trainingDaysPerWeek: trainingDays,
    preferredDays: normalizePreferredDays(values.preferred_days_forge, trainingDays),
    sessionMinutes: clamp(parseNumber(values.session_length_forge, 45), 20, 120),
    equipment: asArray(values.equipment_forge),
    preferredTraining: asArray(values.training_preference_forge),
    limitations: String(values.limitations_forge || ""),
    painAreas: asArray(values.pain_areas_forge),
    baselineMetrics: { raw: String(values.baseline_metrics_forge || "") },
    notes: "Imported automatically from the FORGE Pricing Plans checkout assessment.",
  };

  return wixData.insert(FORGE.collections.ASSESSMENTS, assessment, DATA_OPTIONS);
}

async function profileFor(member, order) {
  const result = await wixData
    .query(FORGE.collections.PROFILES)
    .eq("memberId", member._id)
    .limit(1)
    .find(DATA_OPTIONS);

  const previous = result.items[0] || {};
  const tier = TIER_BY_PLAN[order.planId];
  const startDate = new Date(order.startDate || order._createdDate || order.createdDate);
  const currentDay = challengeDay(startDate);
  const currentPhase = phaseFor(currentDay, tier);
  const profile = {
    ...previous,
    memberId: member._id,
    email: member.loginEmail || previous.email || "",
    tier,
    planId: order.planId,
    status: order.status,
    startDate,
    endDate: order.endDate ? new Date(order.endDate) : previous.endDate,
    currentDay,
    currentPhase,
    streak: Number(previous.streak || 0),
    completionPercent: Number(previous.completionPercent || 0),
    workoutsCompleted: Number(previous.workoutsCompleted || 0),
  };

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

async function awardBadge(memberId, milestone, badgeId, rewardValue) {
  if (await rewardExists(memberId, milestone)) return false;
  const assignMembers = elevate(badges.assignMembers);
  await assignMembers(badgeId, [memberId]);
  await wixData.insert(FORGE.collections.REWARDS, {
    memberId,
    milestone,
    earned: true,
    earnedDate: new Date(),
    rewardType: "BADGE",
    rewardValue,
    redeemed: true,
    redeemedDate: new Date(),
    notes: "Awarded automatically by the FORGE member engine.",
  }, DATA_OPTIONS);
  return true;
}

async function awardCompletionCredit(memberId) {
  const milestone = "DAY_90_CREDIT";
  if (await rewardExists(memberId, milestone)) return false;
  await wixData.insert(FORGE.collections.REWARDS, {
    memberId,
    milestone,
    earned: true,
    earnedDate: new Date(),
    rewardType: "FORGE_CREDIT",
    rewardValue: "100 USD",
    redeemed: false,
    notes: "Earned at Day 90 with at least 85% adherence. Redemption must be recorded before reuse.",
  }, DATA_OPTIONS);
  return true;
}

async function adherenceFor(profile, assessment) {
  const completed = await wixData
    .query(FORGE.collections.LOGS)
    .eq("memberId", profile.memberId)
    .eq("completed", true)
    .limit(1000)
    .find(DATA_OPTIONS);

  const trainingDays = clamp(assessment.trainingDaysPerWeek || 3, 3, 6);
  const plannedToDate = Math.max(1, Math.ceil((Math.min(profile.currentDay, 90) / 7) * trainingDays));
  const workoutsCompleted = completed.items.length;
  const adherence = Math.min(100, Math.round((workoutsCompleted / plannedToDate) * 100));
  const latestDate = completed.items
    .map((item) => item.completedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  profile.workoutsCompleted = workoutsCompleted;
  profile.completionPercent = adherence;
  if (latestDate) profile.lastWorkoutDate = new Date(latestDate);
  await wixData.save(FORGE.collections.PROFILES, profile, DATA_OPTIONS);
  return adherence;
}

async function evaluateMilestones(profile, assessment) {
  const adherence = await adherenceFor(profile, assessment);
  const newlyEarned = [];

  if (profile.currentDay >= 30 && await awardBadge(profile.memberId, "DAY_30", FORGE.badges.DAY_30, "FORGE 30")) {
    newlyEarned.push("FORGE 30");
  }
  if (profile.currentDay >= 60 && await awardBadge(profile.memberId, "DAY_60", FORGE.badges.DAY_60, "FORGE 60")) {
    newlyEarned.push("FORGE 60");
  }
  if (profile.currentDay >= 90 && adherence >= 85) {
    if (await awardBadge(profile.memberId, "DAY_90", FORGE.badges.DAY_90, "FORGE 90")) newlyEarned.push("FORGE 90");
    if (await awardCompletionCredit(profile.memberId)) newlyEarned.push("$100 FORGE credit");
  }

  return { adherence, newlyEarned };
}

function sanitizeSet(set = {}) {
  return {
    reps: clamp(set.reps, 0, 100),
    load: clamp(set.load, 0, 2000),
    rpe: clamp(set.rpe, 0, 10),
    completed: set.completed !== false,
  };
}

function sanitizeExerciseResults(results) {
  if (!Array.isArray(results)) return { items: [] };
  return {
    items: results.slice(0, 30).map((result) => ({
      exerciseName: String(result.exerciseName || result.name || "").slice(0, 120),
      sets: Array.isArray(result.sets) ? result.sets.slice(0, 12).map(sanitizeSet) : [],
    })),
  };
}

export const loadForgeDashboard = webMethod(Permissions.SiteMember, async () => {
  const member = await loggedInMember();
  const order = await activeForgeOrder();
  if (!order) return { entitled: false, reason: "NO_ACTIVE_FORGE_PLAN" };

  const assessment = await assessmentFor(member, order);
  if (!assessment) {
    return { entitled: true, onboardingRequired: true, reason: "ONBOARDING_NOT_AVAILABLE" };
  }

  const profile = await profileFor(member, order);
  const workout = await getOrCreateTodayWorkout(member._id, profile, assessment);
  const milestoneState = await evaluateMilestones(profile, assessment);

  return {
    entitled: true,
    onboardingRequired: false,
    tier: profile.tier,
    currentDay: profile.currentDay,
    phase: profile.currentPhase,
    streak: profile.streak,
    adherence: milestoneState.adherence,
    newlyEarnedRewards: milestoneState.newlyEarned,
    workout,
  };
});

export const saveForgeWorkoutLog = webMethod(Permissions.SiteMember, async (workoutId, payload = {}) => {
  const member = await loggedInMember();
  const order = await activeForgeOrder();
  if (!order) throw new Error("No active FORGE entitlement.");

  const workout = await wixData.get(FORGE.collections.WORKOUTS, workoutId, DATA_OPTIONS);
  if (!workout || workout.memberId !== member._id) throw new Error("Workout not found for this member.");

  const existingResult = await wixData
    .query(FORGE.collections.LOGS)
    .eq("memberId", member._id)
    .eq("workoutId", workoutId)
    .limit(1)
    .find(DATA_OPTIONS);
  const previous = existingResult.items[0] || {};
  const completed = payload.completed === true;

  const log = {
    ...previous,
    memberId: member._id,
    workoutId,
    completed,
    completedAt: completed ? new Date() : previous.completedAt,
    durationMinutes: clamp(payload.durationMinutes, 0, 240),
    sessionRpe: clamp(payload.sessionRpe, 0, 10),
    energy: clamp(payload.energy, 0, 10),
    soreness: clamp(payload.soreness, 0, 10),
    sleepQuality: clamp(payload.sleepQuality, 0, 10),
    painFlag: payload.painFlag === true,
    painNotes: String(payload.painNotes || "").slice(0, 1000),
    exerciseResults: sanitizeExerciseResults(payload.exerciseResults),
    memberNotes: String(payload.memberNotes || "").slice(0, 2000),
  };

  const saved = await wixData.save(FORGE.collections.LOGS, log, DATA_OPTIONS);
  workout.status = completed ? "COMPLETED" : (payload.painFlag ? "COACH_REVIEW" : "IN_PROGRESS");
  await wixData.save(FORGE.collections.WORKOUTS, workout, DATA_OPTIONS);

  const assessment = await assessmentFor(member, order);
  const profile = await profileFor(member, order);
  if (completed && previous.completed !== true) profile.streak = Number(profile.streak || 0) + 1;
  await wixData.save(FORGE.collections.PROFILES, profile, DATA_OPTIONS);
  const milestoneState = await evaluateMilestones(profile, assessment);

  return {
    saved: true,
    logId: saved._id,
    adherence: milestoneState.adherence,
    newlyEarnedRewards: milestoneState.newlyEarned,
    coachReview: payload.painFlag === true,
  };
});

export const getForgeProgress = webMethod(Permissions.SiteMember, async () => {
  const member = await loggedInMember();
  const order = await activeForgeOrder();
  if (!order) return { entitled: false };

  const profileResult = await wixData
    .query(FORGE.collections.PROFILES)
    .eq("memberId", member._id)
    .limit(1)
    .find(DATA_OPTIONS);
  const rewardsResult = await wixData
    .query(FORGE.collections.REWARDS)
    .eq("memberId", member._id)
    .descending("earnedDate")
    .limit(100)
    .find(DATA_OPTIONS);

  return {
    entitled: true,
    profile: profileResult.items[0] || null,
    rewards: rewardsResult.items || [],
  };
});

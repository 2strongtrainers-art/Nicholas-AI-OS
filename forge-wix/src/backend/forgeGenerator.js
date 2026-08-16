import wixData from "wix-data";
import { DATA_OPTIONS, FORGE, TZ } from "./forgeConfig";

const WEEKDAY_INDEX = Object.freeze({
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return String(value)
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseNumber(value, fallback = 0) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function lowerText(...values) {
  return values.flatMap(asArray).join(" ").toLowerCase();
}

export function localDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday.toLowerCase(),
  };
}

export function dateOnlyValue(date = new Date()) {
  const p = localDateParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
}

export function challengeDay(startDate, now = new Date()) {
  const start = localDateParts(new Date(startDate));
  const today = localDateParts(now);
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  return Math.max(1, Math.floor((todayUtc - startUtc) / 86400000) + 1);
}

export function phaseFor(day, tier) {
  if (tier === "CONTINUATION" || day > 90) return "ALUMNI";
  if (day <= 30) return "FOUNDATION";
  if (day <= 60) return "BUILD";
  return "PERFORMANCE";
}

export function normalizePreferredDays(value, desiredCount) {
  const found = asArray(value)
    .map((v) => v.toLowerCase())
    .flatMap((v) => Object.keys(WEEKDAY_INDEX).filter((day) => v.includes(day)))
    .filter((v, i, all) => all.indexOf(v) === i)
    .sort((a, b) => WEEKDAY_INDEX[a] - WEEKDAY_INDEX[b]);

  if (found.length) return found.slice(0, desiredCount);

  const defaults = {
    3: ["monday", "wednesday", "friday"],
    4: ["monday", "tuesday", "thursday", "friday"],
    5: ["monday", "tuesday", "wednesday", "friday", "saturday"],
    6: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
  };
  return defaults[desiredCount] || defaults[3];
}

async function latestLog(memberId) {
  const result = await wixData
    .query(FORGE.collections.LOGS)
    .eq("memberId", memberId)
    .descending("completedAt")
    .limit(1)
    .find(DATA_OPTIONS);
  return result.items[0] || null;
}

function recoveryState(log) {
  if (!log) return { mode: "NORMAL", rpeCap: 8, setReduction: 0, coachReview: false };
  if (log.painFlag) return { mode: "PAIN_MODIFIED", rpeCap: 6, setReduction: 1, coachReview: true };
  if (
    Number(log.energy) <= 4 ||
    Number(log.sleepQuality) <= 4 ||
    Number(log.soreness) >= 7 ||
    Number(log.sessionRpe) >= 9
  ) {
    return { mode: "LOW_RECOVERY", rpeCap: 6, setReduction: 1, coachReview: false };
  }
  return { mode: "NORMAL", rpeCap: 8, setReduction: 0, coachReview: false };
}

async function templateFor(trainingDays, daySlot, phase, goal) {
  const result = await wixData
    .query(FORGE.collections.TEMPLATES)
    .eq("trainingDaysPerWeek", trainingDays)
    .eq("daySlot", daySlot)
    .eq("active", true)
    .limit(20)
    .find(DATA_OPTIONS);

  const items = result.items || [];
  const normalizedGoal = String(goal || "").toLowerCase();
  return (
    items.find((item) => item.phase === phase && String(item.goal || "").toLowerCase() === normalizedGoal) ||
    items.find((item) => item.phase === "ANY" && String(item.goal || "").toLowerCase() === normalizedGoal) ||
    items.find((item) => item.phase === phase && item.goal === "ANY") ||
    items.find((item) => item.phase === "ANY" && item.goal === "ANY") ||
    items[0] ||
    null
  );
}

async function exerciseLibrary() {
  const result = await wixData
    .query(FORGE.collections.EXERCISES)
    .eq("active", true)
    .limit(1000)
    .find(DATA_OPTIONS);
  return result.items || [];
}

function equipmentMatch(exercise, availableEquipment) {
  const required = (exercise.equipment || []).map((x) => String(x).toLowerCase());
  if (!required.length || required.includes("bodyweight") || required.includes("none")) return true;
  const have = lowerText(availableEquipment);
  if (have.includes("full gym") || have.includes("commercial gym") || have.includes("gym access")) return true;
  return required.some((item) => have.includes(item));
}

function difficultyMatch(exercise, assessment) {
  const experience = String(assessment.trainingExperience || "").toLowerCase();
  const difficulty = String(exercise.difficulty || "").toLowerCase();
  return !(experience.includes("beginner") && difficulty.includes("advanced"));
}

function safeForMember(exercise, assessment, recovery) {
  const concerns = lowerText(assessment.limitations, assessment.painAreas);
  const contraindications = (exercise.contraindications || []).map((x) => String(x).toLowerCase());
  if (contraindications.some((term) => term && concerns.includes(term))) return false;

  if (recovery.mode === "PAIN_MODIFIED" && concerns) {
    const pattern = String(exercise.movementPattern || "").toLowerCase();
    if (concerns.includes("shoulder") && ["vertical_push", "horizontal_push"].includes(pattern)) return false;
    if (concerns.includes("knee") && ["squat", "lunge", "knee_extension"].includes(pattern)) return false;
    if ((concerns.includes("back") || concerns.includes("low back")) && pattern === "hinge") return false;
  }
  return true;
}

function priorResult(log, exerciseName) {
  const list = log?.exerciseResults?.items || [];
  return list.find((item) => String(item.exerciseName || "").toLowerCase() === String(exerciseName).toLowerCase()) || null;
}

function bestSet(previous) {
  const sets = previous?.sets || [];
  if (!sets.length) return null;
  return sets
    .filter((set) => set.completed !== false)
    .sort((a, b) => Number(b.reps || 0) - Number(a.reps || 0))[0] || null;
}

function progressionGuidance(previous, repRange, recovery) {
  if (!previous) return "Start conservatively, stay inside the prescribed RPE, and record every working set.";
  if (recovery.mode !== "NORMAL") return "Hold or reduce the prior load today and use pain-free, technically clean reps.";

  const set = bestSet(previous);
  if (!set) return "Repeat a conservative working load and build clean reps before increasing weight.";
  const topRep = parseNumber(String(repRange).split("-").pop(), 0);
  if (topRep && Number(set.reps) >= topRep && Number(set.rpe) <= 8) {
    return "Previous performance cleared the top of the range at RPE 8 or below. Add about 2.5–5% load or 1–2 reps if technique stays clean.";
  }
  if (Number(set.rpe) >= 9) return "Previous effort was too close to failure. Hold or reduce load and remain inside today's target RPE.";
  return "Repeat the prior load and aim to add a clean rep before increasing weight.";
}

function schemeFor(index, setScheme, recovery) {
  const base = index === 0 ? setScheme?.main : index <= 2 ? setScheme?.secondary : setScheme?.accessory;
  const fallback = index === 0
    ? { sets: 3, reps: "6-10", rpe: "6-8" }
    : { sets: 2, reps: "8-12", rpe: "7-8" };
  const scheme = base || fallback;
  return {
    sets: Math.max(1, Number(scheme.sets || fallback.sets) - recovery.setReduction),
    reps: String(scheme.reps || fallback.reps),
    targetRpe: recovery.mode === "NORMAL" ? String(scheme.rpe || fallback.rpe) : `5-${recovery.rpeCap}`,
  };
}

function selectExercise(pattern, index, library, assessment, log, recovery, dayNumber) {
  const candidates = library.filter((exercise) =>
    String(exercise.movementPattern || "").toLowerCase() === String(pattern).toLowerCase() &&
    equipmentMatch(exercise, assessment.equipment) &&
    difficultyMatch(exercise, assessment) &&
    safeForMember(exercise, assessment, recovery)
  );
  if (!candidates.length) return null;
  const selected = candidates[(dayNumber + index - 1) % candidates.length];
  return { selected, previous: priorResult(log, selected.exerciseName) };
}

function recoveryWorkout(profile, reason) {
  return {
    dayNumber: profile.currentDay,
    phase: profile.currentPhase,
    workoutName: "FORGE Recovery + Mobility",
    focus: "Recovery / Mobility",
    warmup: { minutes: 5, instructions: "Easy walk or bike plus relaxed nasal breathing." },
    exercises: {
      items: [
        { exerciseName: "Mobility Flow", sets: 2, reps: "5–8 controlled reps per area", targetRpe: "3-4", loadGuidance: "Use pain-free ranges only." },
        { exerciseName: "Zone 2 Walk/Bike", sets: 1, reps: "15–25 minutes", targetRpe: "3-5", loadGuidance: "Conversational pace; recovery, not a test." },
        { exerciseName: "Breathing / Downshift", sets: 1, reps: "5 minutes", targetRpe: "1-2", loadGuidance: "Slow, controlled exhale-focused breathing." },
      ],
    },
    conditioning: { type: "recovery", minutes: 20, intensity: "easy" },
    cooldown: { minutes: 5, instructions: "Easy movement, breathing, and pain-free mobility." },
    estimatedMinutes: 30,
    status: "READY",
    generationReason: reason,
    generatedAt: new Date(),
  };
}

async function buildWorkout(profile, assessment, log) {
  const today = localDateParts();
  const trainingDays = clamp(assessment.trainingDaysPerWeek || 3, 3, 6);
  const preferredDays = normalizePreferredDays(assessment.preferredDays, trainingDays);
  const recovery = recoveryState(log);

  if (!preferredDays.includes(today.weekday)) {
    return recoveryWorkout(profile, "Planned non-lifting day based on the member's preferred weekly schedule.");
  }

  const daySlot = preferredDays.indexOf(today.weekday) + 1;
  const template = await templateFor(trainingDays, daySlot, profile.currentPhase, assessment.primaryGoal);
  if (!template) throw new Error("No active FORGE workout template matched this member's schedule.");

  const library = await exerciseLibrary();
  const patterns = (template.movementPatterns || []).filter((pattern) => pattern !== "conditioning");
  const items = patterns.map((pattern, index) => {
    const selection = selectExercise(pattern, index, library, assessment, log, recovery, profile.currentDay);
    if (!selection) return null;
    const scheme = schemeFor(index, template.setScheme, recovery);
    return {
      exerciseId: selection.selected._id,
      exerciseName: selection.selected.exerciseName,
      movementPattern: pattern,
      sets: scheme.sets,
      reps: scheme.reps,
      targetRpe: scheme.targetRpe,
      videoUrl: selection.selected.videoUrl || null,
      alternatives: selection.selected.alternatives || [],
      loadGuidance: progressionGuidance(selection.previous, scheme.reps, recovery),
    };
  }).filter(Boolean);

  const sessionMinutes = clamp(assessment.sessionMinutes || 45, 20, 120);
  const conditioning = recovery.mode === "PAIN_MODIFIED"
    ? { type: "low_impact", minutes: Math.min(10, template.conditioning?.minutes || 10), intensity: "easy" }
    : recovery.mode === "LOW_RECOVERY"
      ? { ...template.conditioning, minutes: Math.min(8, template.conditioning?.minutes || 8), intensity: "easy" }
      : template.conditioning;

  const reason = recovery.mode === "PAIN_MODIFIED"
    ? "Pain was flagged in the latest log. Intensity is capped, provocative patterns are avoided where possible, and coach review is recommended."
    : recovery.mode === "LOW_RECOVERY"
      ? "Recent RPE, energy, soreness or sleep indicates low recovery, so volume and intensity are reduced."
      : "Scheduled progression using the member's phase, goal, experience, equipment, availability and prior performance.";

  return {
    dayNumber: profile.currentDay,
    phase: profile.currentPhase,
    workoutName: `${template.templateName} — Day ${profile.currentDay}`,
    focus: template.focus,
    warmup: { minutes: 7, instructions: "Raise body temperature, then perform controlled preparation for today's movement patterns. Avoid painful ranges." },
    exercises: { items },
    conditioning: conditioning || null,
    cooldown: { minutes: 5, instructions: "Easy movement, breathing and pain-free mobility." },
    estimatedMinutes: recovery.mode === "NORMAL" ? sessionMinutes : Math.max(25, sessionMinutes - 10),
    status: recovery.coachReview ? "COACH_REVIEW" : "READY",
    generationReason: reason,
    generatedAt: new Date(),
  };
}

export async function getOrCreateTodayWorkout(memberId, profile, assessment) {
  const workoutDate = dateOnlyValue();
  const existing = await wixData
    .query(FORGE.collections.WORKOUTS)
    .eq("memberId", memberId)
    .eq("workoutDate", workoutDate)
    .limit(1)
    .find(DATA_OPTIONS);

  if (existing.items.length) return existing.items[0];

  const log = await latestLog(memberId);
  const built = await buildWorkout(profile, assessment, log);
  return wixData.insert(
    FORGE.collections.WORKOUTS,
    { memberId, workoutDate, ...built },
    DATA_OPTIONS,
  );
}

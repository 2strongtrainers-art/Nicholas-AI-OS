export const TZ = "America/Los_Angeles";

export const FORGE = Object.freeze({
  onboardingFormId: "074bfc09-c2f6-439d-abd7-fe584a01756d",
  dailyCheckInFormId: "ffb66361-d798-463b-94f9-c58ecf0825e6",
  plans: Object.freeze({
    DIGITAL: "29a65654-344b-4402-8d39-4da780952458",
    COACHING: "500d70cb-e3c8-487e-974c-4d84bce3c4d0",
    ELITE: "7d6e11bc-a7f9-45a4-81b9-482bcf4f089e",
    CONTINUATION: "28a0386f-a21e-43ba-a171-f4dd92c945d9",
  }),
  badges: Object.freeze({
    DAY_30: "f4afde34-d36a-4917-b105-4769c12b7796",
    DAY_60: "6b6fae59-779c-49ec-9500-9a32429011f1",
    DAY_90: "a16884cc-f1cf-4c26-afe0-36c165ef84eb",
  }),
  collections: Object.freeze({
    PROFILES: "ForgeMemberProfiles",
    ASSESSMENTS: "ForgeAssessments",
    WORKOUTS: "ForgeDailyWorkouts",
    LOGS: "ForgeWorkoutLogs",
    PROGRESS: "ForgeProgress",
    REWARDS: "ForgeRewards",
    RULES: "ForgeTrainingRules",
    EXERCISES: "ForgeExerciseLibrary",
    TEMPLATES: "ForgeWorkoutTemplates",
  }),
});

export const TIER_BY_PLAN = Object.freeze({
  [FORGE.plans.DIGITAL]: "DIGITAL",
  [FORGE.plans.COACHING]: "COACHING",
  [FORGE.plans.ELITE]: "ELITE",
  [FORGE.plans.CONTINUATION]: "CONTINUATION",
});

export const FORGE_PLAN_IDS = Object.freeze(Object.values(FORGE.plans));
export const DATA_OPTIONS = Object.freeze({ suppressAuth: true });

import { checkout } from "wix-pricing-plans-frontend";
import {
  loadForgeDashboard,
  saveForgeProgressCheckIn,
  saveForgeWorkoutLog,
} from "backend/forgeEngine.web";
import {
  loadForgeReferral,
  redeemForgeReferral,
} from "backend/forgeReferral.web";
import {
  loadForgeLeaderboard,
  updateForgeLeaderboardPreference,
} from "backend/forgeLeaderboard.web";

const CONTINUATION_PLAN_ID = "28a0386f-a21e-43ba-a171-f4dd92c945d9";
let state = null;

$w.onReady(async function () {
  configureRepeaters();
  wireActions();
  await loadDashboard();
});

function configureRepeaters() {
  $w("#exerciseRepeater").onItemReady(($item, itemData, index) => {
    $item("#exerciseName").text = itemData.exerciseName || `Exercise ${index + 1}`;
    $item("#exercisePrescription").text = `${itemData.sets || 1} sets × ${itemData.reps || "controlled reps"} • RPE ${itemData.targetRpe || "7"}`;
    $item("#exerciseGuidance").text = itemData.loadGuidance || "";
    $item("#exerciseAlternatives").text = itemData.alternatives?.length
      ? `Alternatives: ${itemData.alternatives.join(", ")}`
      : "";
    configureSetRow($item, 1, itemData.sets >= 1);
    configureSetRow($item, 2, itemData.sets >= 2);
    configureSetRow($item, 3, itemData.sets >= 3);
  });

  $w("#forgeProgressHistory").onItemReady(($item, itemData) => {
    $item("#progressHistoryDay").text = `Day ${itemData.dayNumber || "—"}`;
    $item("#progressHistoryWeight").text = itemData.weight ? `${itemData.weight} lb` : "Weight optional";
    $item("#progressHistoryWaist").text = itemData.measurements?.waist ? `Waist: ${itemData.measurements.waist}` : "";
    $item("#progressHistoryRecovery").text = itemData.recoveryScore ? `Recovery: ${itemData.recoveryScore}/10` : "";
  });

  $w("#forgeLeaderboardRepeater").onItemReady(($item, itemData) => {
    $item("#leaderboardRank").text = `#${itemData.rank}`;
    $item("#leaderboardName").text = itemData.displayName;
    $item("#leaderboardAdherence").text = `${itemData.adherence}% adherence`;
    $item("#leaderboardStreak").text = `${itemData.streak} streak • ${itemData.workoutsCompleted} completed`;
  });
}

function wireActions() {
  $w("#forgeCompleteButton").onClick(async () => {
    if (!state?.workout?._id) return;
    $w("#forgeCompleteButton").disable();
    $w("#forgeSaveStatus").text = "Saving your workout…";
    try {
      const result = await saveForgeWorkoutLog(state.workout._id, collectLogPayload(true));
      $w("#forgeSaveStatus").text = result.coachReview
        ? "Workout saved. Your pain flag was recorded for coach review."
        : `Workout saved. Current adherence: ${result.adherence}%.`;
      if (result.newlyEarnedRewards?.length) {
        $w("#forgeRewardBanner").text = `Milestone earned: ${result.newlyEarnedRewards.join(", ")}`;
        $w("#forgeRewardBanner").show();
      }
      await loadDashboard();
    } catch (error) {
      $w("#forgeSaveStatus").text = "Your workout could not be saved. Please try again.";
      console.error("FORGE save error", error);
    } finally {
      $w("#forgeCompleteButton").enable();
    }
  });

  $w("#forgeSaveButton").onClick(async () => {
    if (!state?.workout?._id) return;
    $w("#forgeSaveButton").disable();
    $w("#forgeSaveStatus").text = "Saving progress…";
    try {
      await saveForgeWorkoutLog(state.workout._id, collectLogPayload(false));
      $w("#forgeSaveStatus").text = "Workout progress saved.";
    } catch (error) {
      $w("#forgeSaveStatus").text = "Progress could not be saved. Please try again.";
      console.error("FORGE workout progress save error", error);
    } finally {
      $w("#forgeSaveButton").enable();
    }
  });

  $w("#forgeProgressButton").onClick(async () => {
    $w("#forgeProgressButton").disable();
    $w("#forgeProgressStatus").text = "Saving check-in…";
    try {
      const result = await saveForgeProgressCheckIn(collectProgressPayload());
      $w("#forgeProgressStatus").text = `Progress check-in saved for Day ${result.dayNumber}.`;
      clearProgressInputs();
      await loadDashboard();
    } catch (error) {
      $w("#forgeProgressStatus").text = "Progress check-in could not be saved. Please try again.";
      console.error("FORGE progress check-in error", error);
    } finally {
      $w("#forgeProgressButton").enable();
    }
  });

  $w("#forgeReferralButton").onClick(async () => {
    const code = String($w("#forgeReferralInput").value || "").trim();
    if (!code) {
      $w("#forgeReferralStatus").text = "Enter the FORGE referral code you received.";
      return;
    }

    $w("#forgeReferralButton").disable();
    $w("#forgeReferralStatus").text = "Checking referral code…";
    try {
      const result = await redeemForgeReferral(code);
      if (result.success) {
        $w("#forgeReferralStatus").text = `Referral confirmed. You and the member who referred you each earned a ${result.creditValue} FORGE credit.`;
        $w("#forgeReferralInput").value = "";
        await renderReferral();
        return;
      }

      const messages = {
        ALREADY_REDEEMED: "A referral code has already been applied to this membership.",
        SELF_REFERRAL: "Your own referral code cannot be applied to your membership.",
        INVALID_CODE: "That FORGE referral code was not found.",
      };
      $w("#forgeReferralStatus").text = messages[result.reason] || "That referral code could not be applied.";
    } catch (error) {
      $w("#forgeReferralStatus").text = "The referral code could not be applied. Please try again.";
      console.error("FORGE referral error", error);
    } finally {
      $w("#forgeReferralButton").enable();
    }
  });

  $w("#forgeLeaderboardSaveButton").onClick(async () => {
    $w("#forgeLeaderboardSaveButton").disable();
    $w("#forgeLeaderboardStatus").text = "Saving leaderboard preference…";
    try {
      const result = await updateForgeLeaderboardPreference(
        $w("#forgeLeaderboardOptIn").checked === true,
        $w("#forgeLeaderboardDisplayName").value || "",
      );
      if (!result.success && result.reason === "DISPLAY_NAME_REQUIRED") {
        $w("#forgeLeaderboardStatus").text = "Enter a display name before opting into the leaderboard.";
        return;
      }
      $w("#forgeLeaderboardStatus").text = result.optIn
        ? "You are now visible on the FORGE consistency leaderboard."
        : "You are private and not shown on the leaderboard.";
      await renderLeaderboard();
    } catch (error) {
      $w("#forgeLeaderboardStatus").text = "Leaderboard preference could not be saved. Please try again.";
      console.error("FORGE leaderboard save error", error);
    } finally {
      $w("#forgeLeaderboardSaveButton").enable();
    }
  });

  $w("#forgeContinuationButton").onClick(async () => {
    $w("#forgeContinuationButton").disable();
    $w("#forgeContinuationStatus").text = "Opening secure FORGE Continuation checkout…";
    try {
      const purchase = await checkout.startOnlinePurchase(CONTINUATION_PLAN_ID);
      if (purchase) {
        $w("#forgeContinuationStatus").text = "FORGE Continuation purchase completed.";
        await loadDashboard();
      }
    } catch (error) {
      $w("#forgeContinuationStatus").text = "Checkout was not completed. Your current FORGE access is unchanged.";
      console.error("FORGE continuation checkout error", error);
    } finally {
      $w("#forgeContinuationButton").enable();
    }
  });
}

async function loadDashboard() {
  setLoading(true);
  try {
    state = await loadForgeDashboard();
    if (!state.entitled) {
      $w("#forgeNoAccessBox").expand();
      $w("#forgeDashboardBox").collapse();
      return;
    }
    if (state.onboardingRequired) {
      $w("#forgeNoAccessTitle").text = "Finish your FORGE assessment";
      $w("#forgeNoAccessText").text = "Your membership is active, but your training assessment is not available yet. Complete the assessment attached to your FORGE enrollment to unlock your daily program.";
      $w("#forgeNoAccessBox").expand();
      $w("#forgeDashboardBox").collapse();
      return;
    }

    $w("#forgeNoAccessBox").collapse();
    $w("#forgeDashboardBox").expand();
    renderHeader(state);
    renderWorkout(state.workout);
    renderRewards(state.newlyEarnedRewards || []);
    renderProgressHistory(state.recentProgress || []);
    renderCompletion(state);
    renderContinuation(state);
    await Promise.all([renderReferral(), renderLeaderboard()]);
  } catch (error) {
    console.error("FORGE dashboard error", error);
    $w("#forgeNoAccessTitle").text = "FORGE is temporarily unavailable";
    $w("#forgeNoAccessText").text = "Your account has not been changed. Refresh the page and try again.";
    $w("#forgeNoAccessBox").expand();
    $w("#forgeDashboardBox").collapse();
  } finally {
    setLoading(false);
  }
}

function renderHeader(data) {
  $w("#forgeTier").text = `FORGE ${data.tier}`;
  $w("#forgeDay").text = data.phase === "ALUMNI" ? "FORGE ALUMNI" : `DAY ${data.currentDay} / 90`;
  $w("#forgePhase").text = data.phase;
  $w("#forgeAdherence").text = `${data.adherence}%`;
  $w("#forgeStreak").text = `${data.streak || 0}`;
}

async function renderReferral() {
  try {
    const referral = await loadForgeReferral();
    if (!referral.entitled || !referral.profileReady) {
      $w("#forgeReferralBox").collapse();
      return;
    }

    $w("#forgeReferralBox").expand();
    $w("#forgeReferralCode").text = referral.referralCode;
    $w("#forgeReferralOffer").text = `Refer a paid FORGE member. When they apply your code after enrolling, you both earn a ${referral.creditValue} FORGE credit.`;

    if (referral.canRedeemReferral) {
      $w("#forgeReferralRedeemBox").expand();
      if (!$w("#forgeReferralStatus").text) {
        $w("#forgeReferralStatus").text = "Have a referral code? Apply it once to this membership.";
      }
    } else {
      $w("#forgeReferralRedeemBox").collapse();
      $w("#forgeReferralStatus").text = `Referral applied: ${referral.referredByCode}.`;
    }
  } catch (error) {
    console.error("FORGE referral load error", error);
    $w("#forgeReferralBox").collapse();
  }
}

async function renderLeaderboard() {
  try {
    const leaderboard = await loadForgeLeaderboard();
    if (!leaderboard.entitled || !leaderboard.profileReady) {
      $w("#forgeLeaderboardBox").collapse();
      return;
    }

    $w("#forgeLeaderboardBox").expand();
    $w("#forgeLeaderboardMetric").text = leaderboard.metricLabel;
    $w("#forgeLeaderboardOptIn").checked = leaderboard.optIn === true;
    $w("#forgeLeaderboardDisplayName").value = leaderboard.displayName || "";
    $w("#forgeLeaderboardRepeater").data = (leaderboard.entries || []).map((entry) => ({
      _id: `leaderboard-${entry.rank}`,
      ...entry,
    }));
  } catch (error) {
    console.error("FORGE leaderboard load error", error);
    $w("#forgeLeaderboardBox").collapse();
  }
}

function renderCompletion(data) {
  const qualified = Number(data.currentDay) >= 90 && Number(data.adherence) >= 85;
  if (!qualified) {
    $w("#forgeCompletionBox").collapse();
    return;
  }

  $w("#forgeCompletionBox").expand();
  $w("#forgeCompletionTitle").text = "FORGE 90 COMPLETE";
  $w("#forgeCompletionBadge").text = "FORGE 90";
  $w("#forgeCompletionStats").text = `90 days • ${data.adherence}% adherence • ${data.tier}`;
  $w("#forgeCompletionShareText").text = `FORGE 90 COMPLETE — ${data.adherence}% adherence. Strength. Discipline. Brotherhood.`;
}

function renderContinuation(data) {
  if (data.tier === "CONTINUATION") {
    $w("#forgeContinuationBox").expand();
    $w("#forgeContinuationTitle").text = "FORGE CONTINUATION ACTIVE";
    $w("#forgeContinuationText").text = "Your $129/month alumni programming membership is active.";
    $w("#forgeContinuationButton").hide();
    return;
  }

  if (Number(data.currentDay) >= 90) {
    $w("#forgeContinuationBox").expand();
    $w("#forgeContinuationTitle").text = "KEEP FORGING";
    $w("#forgeContinuationText").text = "Continue your adaptive programming, progress tracking and FORGE accountability for $129/month. Cancel according to your plan terms.";
    $w("#forgeContinuationButton").label = "Continue FORGE — $129/month";
    $w("#forgeContinuationButton").show();
  } else {
    $w("#forgeContinuationBox").collapse();
  }
}

function renderWorkout(workout) {
  $w("#forgeWorkoutName").text = workout.workoutName || "Today's FORGE Session";
  $w("#forgeFocus").text = workout.focus || "";
  $w("#forgeTime").text = workout.estimatedMinutes ? `${workout.estimatedMinutes} min` : "";
  $w("#forgeReason").text = workout.generationReason || "";
  $w("#forgeWarmup").text = objectInstruction(workout.warmup);
  $w("#forgeConditioning").text = conditioningText(workout.conditioning);
  $w("#forgeCooldown").text = objectInstruction(workout.cooldown);

  const exercises = workout.exercises?.items || [];
  $w("#exerciseRepeater").data = exercises.map((exercise, index) => ({
    _id: exercise.exerciseId || `forge-exercise-${index}`,
    ...exercise,
  }));

  if (workout.status === "COMPLETED") {
    $w("#forgeSaveStatus").text = "Today's workout is complete.";
  } else if (workout.status === "COACH_REVIEW") {
    $w("#forgeSaveStatus").text = "Today's session has been modified and flagged for coach review.";
  } else {
    $w("#forgeSaveStatus").text = "";
  }
}

function configureSetRow($item, setNumber, show) {
  const box = $item(`#set${setNumber}Box`);
  if (show) box.expand();
  else box.collapse();
}

function collectLogPayload(completed) {
  const exerciseResults = [];
  $w("#exerciseRepeater").forEachItem(($item, itemData) => {
    const sets = [];
    for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
      if (setNumber > Number(itemData.sets || 1)) continue;
      sets.push({
        load: numberValue($item(`#set${setNumber}Load`).value),
        reps: numberValue($item(`#set${setNumber}Reps`).value),
        rpe: numberValue($item(`#set${setNumber}Rpe`).value),
        completed: true,
      });
    }
    exerciseResults.push({ exerciseName: itemData.exerciseName, sets });
  });

  return {
    completed,
    durationMinutes: numberValue($w("#forgeDuration").value),
    sessionRpe: numberValue($w("#forgeSessionRpe").value),
    energy: numberValue($w("#forgeEnergy").value),
    soreness: numberValue($w("#forgeSoreness").value),
    sleepQuality: numberValue($w("#forgeSleep").value),
    painFlag: $w("#forgePainFlag").checked === true,
    painNotes: $w("#forgePainNotes").value || "",
    memberNotes: $w("#forgeMemberNotes").value || "",
    exerciseResults,
  };
}

function collectProgressPayload() {
  return {
    weight: numberValue($w("#forgeProgressWeight").value),
    measurements: {
      waist: numberValue($w("#forgeProgressWaist").value),
      chest: numberValue($w("#forgeProgressChest").value),
      hips: numberValue($w("#forgeProgressHips").value),
      arm: numberValue($w("#forgeProgressArm").value),
      thigh: numberValue($w("#forgeProgressThigh").value),
      calf: numberValue($w("#forgeProgressCalf").value),
    },
    performanceMetrics: {
      pushups: numberValue($w("#forgeProgressPushups").value),
      plankSeconds: numberValue($w("#forgeProgressPlank").value),
      notes: $w("#forgeProgressPerformanceNotes").value || "",
    },
    recoveryScore: numberValue($w("#forgeProgressRecovery").value),
    sleepHours: numberValue($w("#forgeProgressSleepHours").value),
    notes: $w("#forgeProgressNotes").value || "",
    photoUrls: [],
  };
}

function renderProgressHistory(items) {
  $w("#forgeProgressHistory").data = items.map((item, index) => ({
    _id: item._id || `progress-${index}`,
    ...item,
  }));
}

function clearProgressInputs() {
  [
    "#forgeProgressWeight",
    "#forgeProgressWaist",
    "#forgeProgressChest",
    "#forgeProgressHips",
    "#forgeProgressArm",
    "#forgeProgressThigh",
    "#forgeProgressCalf",
    "#forgeProgressPushups",
    "#forgeProgressPlank",
    "#forgeProgressRecovery",
    "#forgeProgressSleepHours",
    "#forgeProgressPerformanceNotes",
    "#forgeProgressNotes",
  ].forEach((selector) => {
    $w(selector).value = "";
  });
}

function renderRewards(rewards) {
  if (!rewards.length) {
    $w("#forgeRewardBanner").hide();
    return;
  }
  $w("#forgeRewardBanner").text = `Milestone earned: ${rewards.join(", ")}`;
  $w("#forgeRewardBanner").show();
}

function setLoading(loading) {
  if (loading) {
    $w("#forgeLoading").show();
    $w("#forgeDashboardBox").collapse();
  } else {
    $w("#forgeLoading").hide();
  }
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function objectInstruction(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const minutes = value.minutes ? `${value.minutes} min — ` : "";
  return `${minutes}${value.instructions || ""}`.trim();
}

function conditioningText(value) {
  if (!value) return "Optional / as prescribed.";
  return [value.type, value.minutes ? `${value.minutes} min` : null, value.intensity]
    .filter(Boolean)
    .join(" • ");
}

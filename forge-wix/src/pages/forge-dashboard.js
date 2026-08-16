import { loadForgeDashboard, saveForgeWorkoutLog } from "backend/forgeEngine.web";

let state = null;

$w.onReady(async function () {
  wireActions();
  await loadDashboard();
});

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
      $w("#forgeSaveStatus").text = "Progress saved.";
    } catch (error) {
      $w("#forgeSaveStatus").text = "Progress could not be saved. Please try again.";
      console.error("FORGE progress save error", error);
    } finally {
      $w("#forgeSaveButton").enable();
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

/* TriValley.fit public-safe editorial starter pack; no client data, tokens, or publishing. */
(function (root) {
  "use strict";
  const booking = "https://www.trivalley.fit/booking-calendar/start-here-elite-assessment";
  const raw = [
    ["Strength","The first squat I assess","Before I count reps, I watch this.","Reel","Watch one bodyweight rep from the side and front before loading it."],
    ["Busy schedules","The 20-minute training decision","Only have twenty minutes? Start here.","Carousel","Pick one lower-body move, one upper-body move and a manageable finish."],
    ["Boxing","Three boxing stance checks","Your hands are up. What about your feet?","Reel","Show stance width, balance and an easy reset between punches."],
    ["50+ strength","Getting back to strength after 50","The starting weight is not the headline.","Reel","Choose a starting set using current ability, range and comfortable control."],
    ["Golf performance","Warm up before the first tee","Your first swing should not be your warm-up.","Carousel","Try a simple sequence for rotation, balance and rehearsal swings."],
    ["Training process","What happens in an assessment","One rep can tell me where to start coaching.","Reel","Walk through questions, a movement screen and a first practical plan."],
    ["Nutrition habits","Protein without food obsession","A perfect macro app is not your first move.","Story","Begin with a repeatable meal pattern that suits your schedule."],
    ["Strength","Hinge or squat: see the difference","Same weight, different movement pattern.","Reel","Compare a side-view hinge with a bodyweight squat without calling either universally superior."],
    ["Busy schedules","Train when your calendar is packed","Stop waiting for a perfect hour.","Carousel","Build two dependable sessions before promising yourself five."],
    ["Boxing","The jab you can actually repeat","Fast hands are not the full story.","Reel","Demonstrate the jab, your base and returning the hand safely."],
    ["50+ strength","The chair sit-to-stand check","Can you control this everyday movement?","Reel","Show a stable sit-to-stand and options for a higher seat or support."],
    ["Golf performance","Build a more stable golf stance","Your practice swing starts from the ground.","Photo","Demonstrate balanced foot placement and comfortable rotation."],
    ["Training process","One coaching cue, two reps","Watch what changes after one cue.","Reel","Film the before/after from the same camera angle and speed."],
    ["Nutrition habits","A realistic restaurant strategy","You can eat out and still have a plan.","Carousel","Check portions, protein and an overall weekly pattern without rigid rules."],
    ["Strength","Three dumbbell moves worth learning","These basics earn their place.","Reel","Show a row, squat variation and floor press with clear setup."],
    ["Busy schedules","The backup-session rule","Missed the gym? Your week is not over.","Story","Keep a shorter backup session ready instead of doubling up impulsively."],
    ["Boxing","The combination is not the workout","Why I coach the reset, not just the punches.","Reel","Use a simple one-two and show a controlled guard reset."],
    ["50+ strength","Strength for everyday carrying","Training shows up outside the gym.","Carousel","Demonstrate safe manageable carrying with balanced posture and suitable load."],
    ["Golf performance","A rotational warm-up without forcing it","More rotation is not always the answer.","Reel","Use comfortable thoracic rotation and balance drills without pain."],
    ["Training process","What online coaching really includes","A PDF isn't the whole coaching relationship.","Photo","Describe assessment, training choices and recurring check-ins without unsupported guarantees."],
    ["Nutrition habits","Plan breakfast for an early shift","If you train early, plan the first meal.","Reel","Offer two ordinary breakfast planning options and individual flexibility."],
    ["Strength","Row setup that changes the rep","Before you pull harder, set your position.","Reel","Show a stable row setup and a controlled return."],
    ["Busy schedules","Two sessions or none?","Two repeatable days beat an impossible calendar.","Carousel","Show a sample two-day template and how to adjust it."],
    ["Boxing","Footwork before fancy combinations","Your feet need a plan too.","Reel","Demonstrate a step-slide while keeping a stable stance."],
    ["50+ strength","Balance plus strength","A stable rep starts before the lift.","Story","Show a supported balance drill paired with a simple strength movement."],
    ["Golf performance","Carry strength for golfers","Your bag might be a training clue.","Carousel","Demonstrate comfortable carries and a sensible progression."],
    ["Training process","Why I ask about your schedule","The best program fits your real Tuesday.","Reel","Show how the same goal leads to different plans with different time windows."],
    ["Nutrition habits","The four-week food log reset","Look for patterns, not perfect days.","Story","Review meal consistency and preferences without judgment."],
    ["Strength","Slower reps: what can you see?","Watch the same rep at two speeds.","Reel","Compare technique at the same angle, then explain the observation."],
    ["Busy schedules","Your next 30 days of training","Don't copy a stranger's calendar.","Carousel","Write a realistic weekly plan, log sessions and adjust from evidence."],
    ["Boxing","A simple three-round boxing session","You can make a plan without complex combos.","Reel","Outline warm-up, basic technique rounds and recovery."],
    ["50+ strength","One safe way to start lifting again","You do not need to match your old best.","Carousel","Start with movements and effort you can repeat, then progress based on response."],
    ["Golf performance","Strength and golf practice are different","Swing practice is not a complete strength plan.","Photo","Separate skill practice from general conditioning."],
    ["Training process","Coaching remotely without guessing","What I ask before sending the first session.","Reel","Gather goals, schedule, equipment and movement context."],
    ["Nutrition habits","What a flexible nutrition plan looks like","A plan should survive weekends.","Carousel","Use regular meals and adjustments instead of all-or-nothing rules."],
    ["Strength","The push-up setup checklist","A push-up starts before you lower.","Reel","Show hand position, trunk alignment and a suitable incline option."],
    ["Busy schedules","How to use a 10-minute walk","Short walks still count as movement.","Story","Offer a practical walk between appointments without a calorie promise."],
    ["Boxing","The hook at an easy pace","Slow down so we can see it.","Reel","Show stance, rotation and recovery without maximal power."],
    ["50+ strength","Why a coach checks your range","A good range is personal.","Photo","Demonstrate how an exercise can be adapted for ability and comfort."],
    ["Golf performance","Training on a golf travel week","You can keep moving without a full gym.","Carousel","Create a travel-friendly strength and mobility routine."],
    ["Training process","A week of coaching in practice","What happens between workout sessions?","Reel","Explain training review, feedback and plan updates."],
    ["Nutrition habits","Build a simple grocery repeat","Your shopping list is part of the plan.","Story","Choose flexible staples for meals you actually enjoy."],
    ["Strength","The split squat stance experiment","A small setup change can change how it feels.","Reel","Demonstrate support and stance options with a matched camera angle."],
    ["Busy schedules","Your training minimum viable week","What can you repeat for a month?","Carousel","Pick realistic days, a simple full-body menu and a review date."],
    ["Boxing","What I coach between rounds","The rest minute matters.","Story","Show breathing, feedback and preparing for the next round."],
    ["50+ strength","Strength and independence","Train for the things you like doing.","Reel","Connect general movement examples to individual activities without making a medical promise."],
    ["Golf performance","Movement before a long driving range session","Check your body before the bucket.","Story","Use a comfortable brief warm-up and listen to symptoms."],
    ["Training process","Local training versus online coaching","Different delivery, same need for a plan.","Carousel","Explain the types of support and when each can fit."],
    ["Nutrition habits","The honest hydration check","Start with what your day actually looks like.","Story","Plan access to fluids according to activity, weather and individual needs."],
    ["Strength","How to film your own form check","Camera angle changes what you can see.","Reel","Choose side and three-quarter angles, consistent speed and good light."]
  ];
  const hashtags = {
    "Strength":["TriValleyFit","StrengthTraining","SanRamonFitness","PersonalTraining","LiftWithPurpose"],
    "Busy schedules":["TriValleyFit","BusyProfessionalFitness","PleasantonFitness","TrainConsistently","TimeEfficientTraining"],
    "Boxing":["TriValleyFit","BoxingTraining","DublinCAFitness","BoxingBasics","CoachNick"],
    "50+ strength":["TriValleyFit","StrengthAfter50","HealthyAgingFitness","WalnutCreekFitness","FunctionalStrength"],
    "Golf performance":["TriValleyFit","GolfFitness","TriValleyGolf","GolfStrength","TrainForLife"],
    "Training process":["TriValleyFit","PersonalTrainer","SanRamonCA","CoachingMatters","MovementAssessment"],
    "Nutrition habits":["TriValleyFit","NutritionHabits","FlexibleNutrition","FitnessLifestyle","CoachingSupport"]
  };
  const ideas = raw.map(function (row, i) {
    return {id:"TV"+String(i+1).padStart(2,"0"),pillar:row[0],title:row[1],hook:row[2],
      format:row[3],takeaway:row[4],tags:hashtags[row[0]],status:"DRAFT_CONCEPT"};
  });
  function iso(date) { return date.toISOString().slice(0,10); }
  const plan = ideas.slice(0,30).map(function (idea,i) {
    const d=new Date(Date.UTC(2026,10,17+i)),dow=d.getUTCDay(),week=Math.floor(i/7)+1;
    const cta = i%5===0 ? "Book a $297 Elite Assessment at the assessment link." :
      (i%5===1 ? "Save this for your next session." :
      (i%5===2 ? "Share this with someone planning their training week." :
      (i%5===3 ? "Tell me what move you want covered next." :
      "Find the coaching options at TriValley.fit."));
    const caption=idea.hook+" "+idea.takeaway+" "+cta+" "+
      idea.tags.slice(0,5).map(function(t){return "#"+t;}).join(" ");
    return {id:"DAY"+String(i+1).padStart(2,"0"),day:i+1,week:week,date:iso(d),
      timePT:(dow===0||dow===6)?"9:00 AM PT":"7:00 AM PT",idea_id:idea.id,
      pillar:idea.pillar,format:idea.format,title:idea.title,hook:idea.hook,
      takeaway:idea.takeaway,cta:cta,caption:caption,booking_url:booking,
      status:"DRAFT_AWAITING_REVIEW",scheduled_published:false};
  });
  const seedReels = [
    [1,"Wide and side-angle bodyweight squat; insert a freeze-frame before cue.","Watch foot position and the movement you can comfortably repeat.","One clear cue can matter more than an extra plate."],
    [3,"Coach-to-camera intro, medium stance shot, then two clean jab-cross resets.","Demonstrate where your weight settles after a simple combination.","Speed comes after control."],
    [4,"Show two approachable starting sets from the same camera angle.","Choose the first set for today's capacity, not an old personal best.","No comparison video required."],
    [6,"Show coach greeting, a squat, and a written first-week outline.","Explain the assessment, coaching discussion and practical next step.","No sales pitch before showing the process."],
    [8,"Place hinge and squat side-by-side, matching speed and view.","Point out hip travel and knee movement without declaring a universal winner.","Same weight does not mean same exercise."],
    [10,"Demonstrate a jab from feet to knuckles, followed by a guard reset.","Show a stable stance and relaxed return.","Your jab must come home."],
    [13,"Show an uncoached rep, one cue, then the next rep from same angle.","Explain what is observable and what is only a coaching hypothesis.","Don't call an angle change a transformation."],
    [15,"Film each dumbbell exercise with 2–3 technically clear repetitions.","Offer row, squat variation and floor press setup cues.","Three basics, not thirty hacks."],
    [19,"Comfortable rotation and balance sequence using an unloaded club.","Show warm-up options without claiming a distance gain.","Mobility is not a guaranteed longer drive."],
    [27,"Coach reviewing an example schedule and two different training templates.","Match a program to equipment, available days and prior experience.","The schedule is part of the program."]
  ];
  const reels = seedReels.map(function (seed,i) {
    const idea=ideas[seed[0]-1];
    return {id:"REEL"+String(i+1).padStart(2,"0"),idea_id:idea.id,title:idea.title,
      hook_0_3:idea.hook,body_3_10:seed[1],body_10_24:seed[2],
      interrupt_12:seed[3],close_24_35:"Want a plan based on your movement and schedule? Start with the Elite Assessment at TriValley.fit.",
      shots:seed[1],caption:idea.hook+" "+seed[2]+" Coaching varies by individual. Start with the Elite Assessment at TriValley.fit. "+
        idea.tags.map(function(t){return "#"+t;}).join(" "),
      audio:"Original voice or authorized August Nick; manual audio/footage review required.",
      status:"SCRIPT_ONLY_NOT_RENDERED"};
  });
  function slides(rows) { return rows.map(function(p,i){return {number:i+1,heading:p[0],body:p[1]};}); }
  const carousels = [
    {id:"CAR01",title:"Your first four weeks back",idea_id:"TV30",slides:slides([
      ["START HERE","Your comeback should fit who you are today."],
      ["WEEK ONE","Pick two realistic training days and keep them on your calendar."],
      ["CHOOSE MOVES","Start with a squat pattern, a hinge, a push, a pull and a carry variation."],
      ["START CONTROLLED","Choose ranges and loads you can manage with good technique."],
      ["WRITE IT DOWN","Record sets, reps, effort and any useful coaching notes."],
      ["BUILD A BACKUP","Prepare a short session for busy or unpredictable days."],
      ["WEEK TWO","Repeat what works before adding complexity."],
      ["WEEK THREE","Adjust load or volume only when performance and recovery support it."],
      ["WEEK FOUR","Review attendance, movement quality and goals."],
      ["THE TAKEAWAY","Save the checklist; a personal assessment can help you choose your starting point."]
    ])},
    {id:"CAR02",title:"Strength for golfers over 50",idea_id:"TV05",slides:slides([
      ["GOLF IS A SPORT","Practice the swing; train the person making it."],
      ["START WITH BALANCE","Find a stance you can hold comfortably."],
      ["WARM UP","Use easy rotation and rehearsal swings before full effort."],
      ["HINGE","Learn a manageable hip hinge before loading it."],
      ["PUSH","Choose a comfortable push variation that suits your shoulders."],
      ["PULL","Use rows to train controlled upper-body pulling."],
      ["CARRY","Start with a comfortable carry load and distance."],
      ["ROTATE WITH CONTROL","Train range and coordination without forcing pain."],
      ["TRACK THE RIGHT THING","Look at repeatability and training progress, not promised yardage."],
      ["NEXT STEP","Save this and ask a qualified coach to tailor the plan."]
    ])},
    {id:"CAR03",title:"20-minute dumbbell training",idea_id:"TV02",slides:slides([
      ["20 MINUTES COUNT","You do not need a perfect calendar to train."],
      ["CHOOSE THREE","Pick one lower-body, one push and one pull."],
      ["WARM UP","Rehearse your movements with easy repetitions."],
      ["MOVE ONE","Try a comfortable goblet squat or supported squat."],
      ["MOVE TWO","Choose a floor press or suitable push variation."],
      ["MOVE THREE","Perform a stable supported dumbbell row."],
      ["REST","Leave enough rest to keep the next set controlled."],
      ["KEEP A LOG","Write down weight, reps and how the sets felt."],
      ["REPEAT","Use the same simple structure again before making it harder."],
      ["SAVE THIS","Ask for an individualized plan when your goals and equipment differ."]
    ])}
  ];
  const repurpose = {
    source:"Illustrative source: a coach explains and demonstrates a hip hinge from two camera angles.",
    note:"This is a sample transformation, not a claim that private client footage exists or is cleared.",
    reels:[
      {title:"Before you deadlift",copy:"Hook: Before you pick up the weight, watch where the hips travel. Show the unloaded hinge from the side. Cue: hips back while keeping balance. CTA: Save the setup."},
      {title:"One cue, two reps",copy:"Hook: Watch the next rep after a simple cue. Film matched angles and speed. Explain exactly what changed; avoid miracle claims. CTA: Ask a movement question."},
      {title:"Squat versus hinge",copy:"Hook: Both bend the knees, so why are they different? Show matched side views. Explain hip travel and the coaching purpose. CTA: Save the comparison."},
      {title:"Fix the camera angle",copy:"Hook: Your form video might be hiding the important part. Show poor angle versus side angle, then the same hinge. CTA: Share with a training partner."},
      {title:"Build the next session",copy:"Hook: One rep is only the beginning. Show how you note range, comfort and equipment before choosing another set. CTA: Book an assessment."}
    ],
    carousels:[
      {title:"Five frames of a hinge",copy:"10 slides: hook; foot position; knee bend; hip travel; reach; stable back; unloaded demo; camera angle; individual adjustment; save cue."},
      {title:"Movement-screen myth check",copy:"10 slides: hook; what one rep shows; what it cannot prove; two views; useful questions; coached rep; limits; practice; next session; CTA."},
      {title:"From assessment to plan",copy:"10 slides: hook; goal; schedule; equipment; movement; starting choices; feedback; repeat; reassess; booking CTA."}
    ],
    short_posts:[
      "A movement video is a starting point, not a diagnosis. Capture the same angle twice and look for one observable change.",
      "Before loading a hinge: rehearse the pattern unloaded, find your balance, then choose a manageable start.",
      "A squat and a hinge both matter. Learn why you are doing each before copying someone else's routine.",
      "You do not need ten cues on one rep. Try one clear cue, repeat, and see what actually changed.",
      "Good coaching does not end at the form check. It turns what you saw into a sensible next session."
    ],
    linkedin:[
      "One movement assessment cannot tell a coach everything about a client. The useful part is asking a better question: What can the person do comfortably today, what is their goal, and what schedule will they realistically follow? At TriValley.fit, a movement screen is the start of a practical conversation, not a diagnosis.",
      "A repeatable training process matters more than a flashy exercise library. Film the movement clearly, choose an actionable cue, document the response, and build a plan around available time and equipment. This is how a one-rep observation becomes coaching someone can use."
    ]
  };
  const captionStyles = [
    {name:"Curiosity",intro:"Here is what I check first:",ending:"Save this for the next time you train."},
    {name:"Coach's note",intro:"One detail worth practicing:",ending:"Tell me which exercise you want me to explain next."},
    {name:"Local Tri-Valley",intro:"For busy people training around San Ramon, Dublin and Pleasanton:",ending:"Explore coaching at TriValley.fit."},
    {name:"Myth check",intro:"This is not a one-size-fits-all rule:",ending:"Share it with someone who likes practical training advice."},
    {name:"Inside the program",intro:"A useful plan starts with your goal, schedule and current ability:",ending:"Start with the $297 Elite Assessment at TriValley.fit."}
  ];
  root.TRI_CONTENT = Object.freeze({
    schema:"trivalley.content-studio.v1",
    issued_for:"TriValley.fit / Nick Kaplan",
    start_date:"2026-11-17",end_date:"2026-12-16",timezone:"America/Los_Angeles",
    owner_review_required:true,auto_publish:false,external_model_calls:0,
    offers:{assessment:"$297 Elite Assessment",booking_url:booking,site:"https://www.trivalley.fit/"},
    evidence:[
      {label:"ACSM 2026 fitness trends survey",url:"https://doi.org/10.1249/fit.0000000000001110",purpose:"Topic selection only; verify any health/performance claim separately."},
      {label:"ACSM 2027 fitness trends survey",url:"https://doi.org/10.1249/fit.0000000000001208",purpose:"Topic selection only; this is not an Instagram virality forecast."}
    ],
    pillars:["Strength","Busy schedules","Boxing","50+ strength","Golf performance","Training process","Nutrition habits"],
    ideas:ideas,plan:plan,reels:reels,carousels:carousels,repurpose:repurpose,caption_styles:captionStyles
  });
})(globalThis);

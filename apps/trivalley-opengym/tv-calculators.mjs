// Original deterministic implementations. Source descriptions/code are not imported.
const BB = 'https://shop.bodybuilding.com/blogs/tools-and-calculators/'
const energyFields = ['age', 'sex', 'height', 'weight']
const nutritionFields = [...energyFields, 'activity', 'goal']
export const ACTIVITY_FACTORS = [[1.2,'Mostly sedentary'],[1.375,'Light activity'],[1.55,'Moderate activity'],[1.725,'Very active'],[1.9,'Extra active']]
// Selected 2024 Adult Compendium codes; custom MET allows other activities.
export const MET_ACTIVITIES = [
 ['02054',3.5,'Weights: multiple exercises, 8–15 reps'], ['02050',6,'Weights: vigorous effort'],
 ['02022',3.8,'Calisthenics: moderate'], ['02020',7.5,'Calisthenics: vigorous'],
 ['02048',5,'Elliptical: moderate'], ['02049',9,'Elliptical: vigorous'],
 ['02032',6,'Body-weight circuit'], ['custom',null,'Enter another published MET']
]
const entry = (id,name,category,fields,slug,summary) => ({id,name,category,fields,source:BB+slug,summary})
export const CALCULATORS = [
 entry('calories','Daily calorie target','Nutrition',nutritionFields,'how-many-calories-should-you-eat-per-day','Estimate maintenance, loss or gain calories.'),
 entry('maintenance','Maintenance calories · TDEE','Nutrition',[...energyFields,'activity'],'tdee-calculator-calculate-your-maintenance-calories','Estimate a starting maintenance intake.'),
 entry('macros','Macros','Nutrition',[...nutritionFields,'ratio'],'macro-calculator-count-your-macros-like-a-pro','Turn calories into protein, carbohydrate and fat grams.'),
 entry('protein','Protein','Nutrition',nutritionFields,'protein-calculator-how-much-protein-do-i-need','See the protein share of a goal-based macro plan.'),
 entry('carbs','Carbohydrates','Nutrition',nutritionFields,'carbohydrate-calculator-how-many-grams-of-carbs-should-you-eat','See the carbohydrate share of your plan.'),
 entry('fats','Dietary fats','Nutrition',nutritionFields,'fats-calculator-how-many-grams-of-fat-per-day','See the fat share of your plan.'),
 entry('bmr','Basal metabolic rate · BMR','Nutrition',energyFields,'bmr-calculator-learn-your-basal-metabolic-rate-for-weight-loss','Estimate energy at rest; not a food-intake target.'),
 entry('rmr','Resting metabolic rate · RMR','Nutrition',energyFields,'rmr-calculator-learn-your-resting-metabolic-rate-for-weight-loss','The same published Harris–Benedict estimator, under its RMR label.'),
 entry('lean','Lean body mass','Body composition',['weight','bodyFat'],'lean-body-mass-calculator-track-your-body-composition','Split weight into fat and fat-free mass using your supplied body-fat estimate.'),
 entry('bmi','Body mass index · BMI','Body composition',['age','height','weight'],null,'Additional CDC-based tool for adults 20 and older.'),
 entry('one-rm','One-rep max','Training',['lift','reps'],'one-rep-max-calculator-target-max-strength-goals','Compare Epley and Brzycki estimates from one performed set.'),
 entry('burn','Exercise calorie burn','Training',['weight','minutes','metActivity'],'calorie-burn-calculator-for-exercise-and-sports','Estimate gross and above-rest activity energy using METs.'),
 entry('creatine','Creatine weight-band reference','References',['age','weight'],'creatine-dosage-calculator-for-men-and-women','Compare the retailer’s weight-band rule with research context; not a personal prescription.')
].map(tool => tool.id === 'bmi' ? {...tool,source:'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html'} : tool)
export const EXTERNAL_RESOURCES = [
 {id:'ideal',name:'Historical physique proportions',url:BB+'ideal-body-measurements-calculator-for-aesthetics',note:'External resource. The published wrist-ratio coefficients were not independently verified. Aesthetic proportions do not establish health or genetic potential.'},
 {id:'body-type',name:'Body-type questionnaire',url:BB+'body-types-how-to-exercise-and-eat-for-your-body',note:'External resource. Body-type labels are not used to prescribe your training or nutrition here.'},
 {id:'tirzepatide',name:'Prescription tirzepatide converter',url:BB+'tirzepatide-dosage-calculator',note:'External medical resource; use only with your prescriber or pharmacist. This app does not select a drug, dose or injection amount.'},
 {id:'peptides',name:'Prescription peptide converter',url:BB+'peptide-dosage-calculator',note:'External medical resource; use only with your prescriber or pharmacist. No medication inputs are collected here.'}
]
export function numeric(value,label,min,max,{integer=false}={}) {
 if (value == null || typeof value === 'boolean' || !['string','number'].includes(typeof value) || String(value).trim()==='') throw Error('Enter '+label+'.')
 const n=Number(value)
 if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n))) throw Error(label+' must be '+(integer?'a whole number ':'')+'between '+min+' and '+max+'.')
 return n
}
export const kgFrom = (n,unit) => unit === 'lb' ? n*0.45359237 : n
export const cmFrom = (n,unit) => unit === 'lb' ? n*2.54 : n
export function convertCalculatorInputs(values,from,to) {
 if(!['kg','lb'].includes(from)||!['kg','lb'].includes(to))throw Error('Choose kg/cm or lb/in.')
 const next={...values}; if(from===to)return next
 for(const key of ['weight','lift','height']){
  if(values[key] == null || String(values[key]).trim()==='') continue
  const n=Number(values[key]); if(!Number.isFinite(n))continue
  const factor=key==='height'?2.54:0.45359237
  next[key]=String(Number((from==='lb'?n*factor:n/factor).toPrecision(12)))
 }
 return next
}
export function calculateFitness(id,p,unit='kg') {
 const tool=CALCULATORS.find(tool=>tool.id===id)
 if(!tool)throw Error('Choose a supported calculator.')
 if(!['kg','lb'].includes(unit))throw Error('Choose kg/cm or lb/in.')
 const rows=[],notes=[], sources=[{label:'Method reference',url:tool.source}]
 const result=(method,explanation) => {
  if(rows.some(row=>typeof row.value==='number'&&!Number.isFinite(row.value)))throw Error('No valid result for these inputs.')
  return {id,rows,method,explanation,notes,sources,unit}
 }
 const row=(label,value,unit='')=>rows.push({label,value,unit})
 const weight=()=>kgFrom(numeric(p.weight,'body weight',unit==='lb'?66:30,unit==='lb'?662:300),unit)
 const height=()=>cmFrom(numeric(p.height,'height',unit==='lb'?47:120,unit==='lb'?91:230),unit)
 const adult=()=>numeric(p.age,'age',id==='bmi'?20:18,100,{integer:true})
 if(id==='one-rm'){
  const load=numeric(p.lift,'lifted weight',0.1,unit==='lb'?2204:1000),reps=numeric(p.reps,'performed reps',1,10,{integer:true})
  const epley=reps===1?load:load*(1+reps/30),brzycki=load*36/(37-reps)
  row('Epley estimate',epley,unit);row('Brzycki estimate',brzycki,unit)
  for(const percent of [60,70,80,90])row(percent+'% of Epley',epley*percent/100,unit)
  notes.push('Estimates depend on a hard, controlled set and the exercise. Do not attempt a maximal lift just because a formula suggests it. Dumbbell results use the same per-dumbbell basis as your input.')
  return result('Epley: load × (1 + reps / 30); Brzycki: load × 36 / (37 − reps). One rep uses the performed load.','Two original formula estimates show uncertainty; neither is a tested maximum. Exact parity with the retailer’s undisclosed algorithm is unverified.')
 }
 const w=weight()
 if(id==='lean'){
  const bf=numeric(p.bodyFat,'body-fat percentage',1,70)
  row('Fat-free mass',w*(1-bf/100),'kg');row('Fat mass',w*bf/100,'kg')
  if(unit==='lb'){row('Fat-free mass',w*(1-bf/100)/0.45359237,'lb');row('Fat mass',w*bf/100/0.45359237,'lb')}
  notes.push('The app does not measure body fat. Fat-free mass includes water, organs and bone as well as muscle. Changes in hydration can affect estimates.')
  return result('Fat-free mass = weight × (1 − body-fat percentage / 100).','Accuracy is limited by the body-fat percentage you supply.')
 }
 if(id==='burn'){
  const minutes=numeric(p.minutes,'activity duration in minutes',1,1440)
  const activity=MET_ACTIVITIES.find(activity=>activity[0]===p.metActivity)
  if(!activity)throw Error('Choose an activity or a published MET.')
  const met=activity[0]==='custom'?numeric(p.met,'MET value',1,25):activity[1]
  row('Gross activity energy',met*3.5*w/200*minutes,'kcal');row('Above-rest energy',(met-1)*3.5*w/200*minutes,'kcal');row('MET used',met)
  sources.push({label:'2024 Adult Compendium',url:'https://pacompendium.com/conditioning-exercise/'})
  notes.push('MET values describe groups, not your measured energy use. These presets differ from the retailer’s 2011 activity list. Gross energy includes resting energy; do not automatically add it to a TDEE target.')
  return result('Gross kcal = MET × 3.5 × kg / 200 × minutes. Above-rest uses (MET − 1).','Select a matching activity or enter a published MET from the source. Rest breaks and intensity affect the estimate.')
 }
 const age=adult()
 if(id==='creatine'){
  const lb=w/0.45359237
  // Explicit fractional boundary: <=120, >120 through 200, >200 pounds.
  row('Retailer weight-band reference',lb<=120?3:lb<=200?5:8,'g/day')
  notes.push('This reproduces the retailer’s 3/5/8 g reference, not a personal requirement. For fractional weights, this app uses ≤120, >120–200 and >200 lb. Research commonly describes 3–5 g/day maintenance; a larger body weight alone does not prove you need more. Discuss supplementation with a qualified clinician.')
  sources.push({label:'ISSN position stand',url:'https://link.springer.com/article/10.1186/s12970-017-0173-z'})
  return result('Retailer rule: ≤120 lb → 3 g; >120 to 200 lb → 5 g; >200 lb → 8 g per day.','A weight-band lookup cannot assess whether a supplement is suitable for you.')
 }
 const h=height()
 if(id==='bmi'){
  const bmi=w/(h/100)**2
  row('BMI',bmi,'kg/m²')
  row('CDC screening category',bmi<18.5?'Below 18.5':bmi<25?'18.5 to below 25':bmi<30?'25 to below 30':'30 or above')
  notes.push('BMI is a screening measure, not a diagnosis or body-fat measurement. It does not distinguish muscle from fat. These categories apply to adults 20 and older.')
  return result('BMI = kg / height in meters².','Interpret BMI with your health history and other measures, particularly if you are muscular.')
 }
 if(!['male','female'].includes(p.sex))throw Error('Choose the equation’s sex coefficient.')
 const male=p.sex==='male'
 const mifflin=10*w+6.25*h-5*age+(male?5:-161)
 const harris=male?66.5+13.75*w+5.003*h-6.755*age:655.1+9.563*w+1.850*h-4.676*age
 notes.push('These equations use male/female coefficients from their original study populations; they do not capture every individual’s physiology. Use qualified guidance when an equation is a poor fit, including pregnancy, breastfeeding or a medical condition.')
 if(id==='bmr'||id==='rmr'){
  row('Estimated resting energy',harris,'kcal/day')
  return result('Harris–Benedict as published on the retailer’s BMR/RMR pages: male 66.5 + 13.75kg + 5.003cm − 6.755age; female 655.1 + 9.563kg + 1.850cm − 4.676age.','Both labels use the same equation here. This is not a measured BMR/RMR or an eating target, and is not a second independent test.')
 }
 const factor=numeric(p.activity,'activity factor',1.2,1.9)
 if(!ACTIVITY_FACTORS.some(([value])=>value===factor))throw Error('Choose one of the listed activity levels.')
 const maintenance=mifflin*factor
 row('Estimated maintenance',maintenance,'kcal/day')
 sources.push({label:'Mifflin–St Jeor study',url:'https://pubmed.ncbi.nlm.nih.gov/2305711/'})
 if(id==='maintenance')return result('Mifflin–St Jeor × activity factor. Male: 10kg + 6.25cm − 5age + 5. Female: 10kg + 6.25cm − 5age − 161.','Activity is approximate. Compare this starting estimate with actual intake and weight trends over time; activity energy is already included.')
 if(!['maintain','lose','gain'].includes(p.goal))throw Error('Choose a calorie goal.')
 const calories=p.goal==='lose'?maintenance*0.85:p.goal==='gain'?maintenance+500:maintenance
 row('Goal-based starting estimate',calories,'kcal/day')
 let ratios=p.goal==='lose'?[40,40,20]:[40,30,30]
 if(id==='macros'&&p.ratio==='custom'){
  ratios=['carbPercent','proteinPercent','fatPercent'].map(key=>numeric(p[key],key.replace('Percent',' percentage'),0,100))
  if(Math.abs(ratios.reduce((sum,value)=>sum+value,0)-100)>0.000001)throw Error('Carbohydrate, protein and fat percentages must total 100.')
 }
 const [carb,protein,fat]=ratios
 if(['macros','carbs'].includes(id))row('Carbohydrates',calories*carb/100/4,'g/day')
 if(['macros','protein'].includes(id))row('Protein',calories*protein/100/4,'g/day')
 if(['macros','fats'].includes(id))row('Fats',calories*fat/100/9,'g/day')
 notes.push('Loss uses a disclosed 15% reduction within the retailer’s 10–20% range; gain adds 500 kcal. Macro splits are arithmetic examples, not an individualized diet. Do not add exercise calories again. Protein here is the macro-percentage method, not a separate g/kg recommendation.')
 return result('Mifflin–St Jeor × activity; maintain unchanged, lose ×0.85, gain +500 kcal. Carbohydrate/protein 4 kcal/g; fat 9 kcal/g. Split C/P/F: '+ratios.join('/')+'%.','I want you to treat this as a starting estimate and adjust with real progress and qualified nutrition guidance. The mathematics can be checked; your actual needs can differ.')
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { CALCULATORS, EXTERNAL_RESOURCES, calculateFitness, convertCalculatorInputs, numeric } from './tv-calculators.mjs'
const base={age:30,sex:'male',height:180,weight:80,activity:1.55,goal:'maintain',bodyFat:20,lift:100,reps:5,minutes:30,metActivity:'02054'}
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`)
const value=(id,label,p=base,unit='kg')=>calculateFitness(id,p,unit).rows.find(row=>row.label===label).value

test('independent known-answer energy and macro examples',()=>{
 near(value('maintenance','Estimated maintenance'),2759)
 near(value('bmr','Estimated resting energy'),1864.39)
 near(value('rmr','Estimated resting energy'),1864.39)
 near(value('bmr','Estimated resting energy',{...base,sex:'female'}),1612.86)
 near(value('calories','Goal-based starting estimate',{...base,goal:'lose'}),2345.15)
 near(value('calories','Goal-based starting estimate',{...base,goal:'gain'}),3259)
 near(value('protein','Protein'),206.925)
 near(value('carbs','Carbohydrates'),275.9)
 near(value('fats','Fats'),2759/30)
 const macro=calculateFitness('macros',base).rows
 near(macro.find(r=>r.label==='Carbohydrates').value*4+macro.find(r=>r.label==='Protein').value*4+macro.find(r=>r.label==='Fats').value*9,2759)
})
test('custom ratios conserve calories and reject incomplete or invalid ratios',()=>{
 const p={...base,ratio:'custom',carbPercent:50,proteinPercent:25,fatPercent:25}
 near(value('macros','Protein',p),172.4375)
 for(const ratio of [{carbPercent:50,proteinPercent:25,fatPercent:24},{carbPercent:'',proteinPercent:50,fatPercent:50},{carbPercent:-1,proteinPercent:51,fatPercent:50}])assert.throws(()=>calculateFitness('macros',{...p,...ratio}))
})
test('known-answer body composition, activity energy and one-rep estimators',()=>{
 near(value('lean','Fat-free mass'),64);near(value('lean','Fat mass'),16)
 near(value('bmi','BMI'),80/3.24)
 near(value('burn','Gross activity energy'),147);near(value('burn','Above-rest energy'),105)
 near(value('one-rm','Epley estimate'),100*7/6);near(value('one-rm','Brzycki estimate'),112.5)
 near(value('one-rm','Epley estimate',{...base,reps:1}),100)
 assert.throws(()=>calculateFitness('one-rm',{...base,reps:11}))
 assert.throws(()=>calculateFitness('burn',{...base,metActivity:'custom',met:0}))
})
test('unit conversion preserves physical quantities, blanks, and all estimator outputs',()=>{
 const lb=convertCalculatorInputs(base,'kg','lb')
 for(const id of ['maintenance','calories','macros','bmr','rmr','bmi','burn']){
  const a=calculateFitness(id,base,'kg'),b=calculateFitness(id,lb,'lb')
  a.rows.forEach((row,i)=>{if(typeof row.value==='number')assert(Math.abs(row.value-b.rows[i].value)<1e-6,id)})
 }
 const back=convertCalculatorInputs(lb,'lb','kg');assert(Math.abs(Number(back.height)-180)<1e-8);assert(Math.abs(Number(back.weight)-80)<1e-8)
 assert.equal(convertCalculatorInputs({weight:'',height:'',lift:''},'lb','kg').weight,'')
 assert.throws(()=>convertCalculatorInputs(base,'invalid','kg'))
})
test('retailer creatine boundaries are explicit, including fractional pounds',()=>{
 for(const [weight,expected]of [[119,3],[120,3],[120.5,5],[200,5],[200.01,8]])assert.equal(value('creatine','Retailer weight-band reference',{age:30,weight},'lb'),expected)
 assert.throws(()=>calculateFitness('creatine',{age:17,weight:80}))
})
test('blank, nonfinite, negative, malformed and unsupported values never produce a plausible result',()=>{
 for(const v of ['',null,undefined,NaN,Infinity,-1,{},[],true,'garbage'])assert.throws(()=>numeric(v,'test',1,100))
 for(const patch of [{age:''},{age:17},{age:30.5},{sex:''},{height:0},{weight:0},{activity:1.5},{goal:'unknown'}])assert.throws(()=>calculateFitness('calories',{...base,...patch}))
 assert.throws(()=>calculateFitness('bmi',{...base,age:19}))
 assert.throws(()=>calculateFitness('lean',{...base,bodyFat:0}))
 assert.throws(()=>calculateFitness('unknown',base));assert.throws(()=>calculateFitness('bmr',base,'stone'))
})
test('all 13 tools have finite results and four external resources are never executed as calculators',()=>{
 assert.equal(CALCULATORS.length,13);assert.equal(new Set(CALCULATORS.map(t=>t.id)).size,13)
 for(const tool of CALCULATORS){const result=calculateFitness(tool.id,base);assert(result.rows.length>0);assert(result.sources.every(source=>source.url.startsWith('https://')))}
 assert.equal(EXTERNAL_RESOURCES.length,4)
 for(const item of EXTERNAL_RESOURCES)assert.throws(()=>calculateFitness(item.id,base))
 const before=JSON.stringify(base);calculateFitness('macros',base);assert.equal(JSON.stringify(base),before)
})

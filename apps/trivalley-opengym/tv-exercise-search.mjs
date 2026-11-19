// Original, deterministic and offline-friendly discovery ranking.
// Search suggestions never imply that matching an exercise makes it appropriate for a user.
const expand = value => String(value ?? '').toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\bdbs?\b/g, 'dumbbell').replace(/\brdls?\b/g, 'romanian deadlift')
  .replace(/\bpress[\s-]?ups?\b/g, 'push up').replace(/\bpush[\s-]?ups?\b/g, 'push up')
  .replace(/\bkb\b/g, 'kettlebell').replace(/\bbw\b/g, 'bodyweight')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')

const aliases = ex => {
  const raw = expand(ex.n)
  const out = [raw]
  if (raw.includes('dumbbell')) out.push(raw.replace(/dumbbell/g, 'db'))
  if (raw.includes('romanian deadlift')) out.push(raw.replace(/romanian deadlift/g, 'rdl'))
  if (raw.includes('squat')) out.push(raw.replace(/squat/g, 'squats'))
  return out
}
export const normalizeQuery = expand
// Suggestions only, after zero exact results. One edit on words of 4+ letters,
// deterministic ordering, no fuzzy replacement of the actual matching results.
function oneEdit(a,b) {
  if (Math.abs(a.length-b.length)>1) return false
  let i=0,j=0,edits=0
  while(i<a.length && j<b.length) {
    if(a[i]===b[j]) {i++;j++;continue}
    if(++edits>1) return false
    if(a.length>=b.length)i++
    if(b.length>=a.length)j++
  }
  return edits+(i<a.length || j<b.length ? 1:0)===1
}
export function suggestExerciseQuery(exercises, query) {
  const q=expand(query), tokens=q.split(' ')
  if(q.length<4 || q.length>60 || tokens.length>6) return null
  const vocabulary=[...new Set(exercises.flatMap(e=>expand(e.n).split(' ')))].sort()
  const candidates=[]
  for(let i=0;i<tokens.length;i++) {
    if(tokens[i].length<4 || vocabulary.includes(tokens[i]))continue
    for(const word of vocabulary) {
      if(!oneEdit(tokens[i],word))continue
      const fixed=tokens.map((t,j)=>i===j?word:t).join(' ')
      const matches=exercises.filter(e=>scoreExercise(e,fixed)>=80)
      if(matches.length)candidates.push({fixed,score:Math.max(...matches.map(e=>scoreExercise(e,fixed)))})
    }
  }
  candidates.sort((a,b)=>b.score-a.score || a.fixed.localeCompare(b.fixed))
  return candidates[0]?.fixed || null
}
export function scoreExercise(ex, query) {
  const q = expand(query)
  if (!q) return 1
  const name = expand(ex.n)
  if (name === q) return 120
  if (name.startsWith(q)) return 105
  if (name.includes(q)) return 95
  const alt = aliases(ex)
  if (alt.some(a => a === q || a.startsWith(q))) return 90
  if (alt.some(a => a.includes(q))) return 85
  const nameTokens = q.split(' ')
  if (nameTokens.every(t => name.split(' ').includes(t))) return 80
  const muscle = expand([ex.tg, ex.bp, ...(ex.sm || [])].filter(Boolean).join(' '))
  if (muscle.includes(q)) return 60
  const equipment = expand(ex.eq)
  if (equipment.includes(q)) return 40
  const guidance = expand([ex.desc, ...(Array.isArray(ex.st) ? ex.st : [])].join(' '))
  if (guidance.includes(q)) return 20
  return 0
}
export function sortExerciseMatches(exercises, query, context = {}) {
  const {mode = 'all', recentIds = [], favoriteIds = [], planIds = []} = context
  const recent = new Map(recentIds.map((id, i) => [id, i]))
  const fav = new Set(favoriteIds), planned = new Set(planIds)
  const foundations = /\b(squat|push up|plank|row|lunge|deadlift|bench press)\b/
  return exercises
    .map((ex, index) => {
      const relevance = scoreExercise(ex, query)
      const personal = mode === 'recent' ? Math.max(0, 200 - (recent.get(ex.id) ?? 999)) :
        (!query ? (fav.has(ex.id) ? 30 : 0) + (planned.has(ex.id) ? 20 : 0) +
          (recent.has(ex.id) ? Math.max(5, 35 - recent.get(ex.id)) : 0) +
          (foundations.test(normalizeQuery(ex.n)) ? 8 : 0) : 0)
      return {ex, index, relevance, personal}
    })
    .filter(x => x.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.personal - a.personal || a.index - b.index)
    .map(x => x.ex)
}

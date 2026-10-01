import { COMPONENTS, CONDITIONS, type ComponentKey, type ConditionKey } from './content'

export type Tri = 0 | 0.5 | 1 // いいえ / どちらとも / はい

export interface Answer {
  points: Record<ComponentKey, number> // 合計10
  conds: Record<ConditionKey, Tri>
  comment: string
  at: number
}

export interface Entry {
  cid: string
  answer: Answer
  dummy: boolean
}

// ---- ネットワークのメッセージ ----
export type ToHost = { t: 'submit'; cid: string; answer: Answer }
export type ToClient = { t: 'ack'; cid: string } | { t: 'state'; reveal: boolean }

// ---- 集計 ----

/** 6条件から「遊び度」0〜100 を算出（はい=1, どちらとも=0.5, いいえ=0） */
export function playScore(a: Answer): number {
  const sum = CONDITIONS.reduce((s, c) => s + a.conds[c.key], 0)
  return Math.round((sum / CONDITIONS.length) * 100)
}

/** 最も多く配分した成分（同点は先に並ぶ方） */
export function dominant(a: Answer): ComponentKey {
  let best: ComponentKey = COMPONENTS[0].key
  for (const c of COMPONENTS) if (a.points[c.key] > a.points[best]) best = c.key
  return best
}

export const BIN_COUNT = 10 // 0-9, 10-19, ... 90-100
export function binOf(score: number): number {
  return Math.min(BIN_COUNT - 1, Math.floor(score / 10))
}

export interface Summary {
  n: number
  nReal: number
  hist: number[]
  mean: number
  min: number
  max: number
  avgPoints: Record<ComponentKey, number>
  typeCounts: Record<ComponentKey, number>
  cond: Record<ConditionKey, { yes: number; mid: number; no: number }>
}

export function summarize(entries: Entry[]): Summary {
  const hist = new Array(BIN_COUNT).fill(0)
  const avgPoints = Object.fromEntries(COMPONENTS.map((c) => [c.key, 0])) as Record<ComponentKey, number>
  const typeCounts = Object.fromEntries(COMPONENTS.map((c) => [c.key, 0])) as Record<ComponentKey, number>
  const cond = Object.fromEntries(CONDITIONS.map((c) => [c.key, { yes: 0, mid: 0, no: 0 }])) as Summary['cond']
  let sum = 0
  let min = 100
  let max = 0
  for (const e of entries) {
    const s = playScore(e.answer)
    hist[binOf(s)]++
    sum += s
    min = Math.min(min, s)
    max = Math.max(max, s)
    for (const c of COMPONENTS) avgPoints[c.key] += e.answer.points[c.key]
    typeCounts[dominant(e.answer)]++
    for (const c of CONDITIONS) {
      const v = e.answer.conds[c.key]
      cond[c.key][v === 1 ? 'yes' : v === 0.5 ? 'mid' : 'no']++
    }
  }
  const n = entries.length
  if (n) for (const c of COMPONENTS) avgPoints[c.key] /= n
  return {
    n,
    nReal: entries.filter((e) => !e.dummy).length,
    hist,
    mean: n ? Math.round(sum / n) : 0,
    min: n ? min : 0,
    max: n ? max : 0,
    avgPoints,
    typeCounts,
    cond,
  }
}

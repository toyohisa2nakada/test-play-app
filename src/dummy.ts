// 架空のクラスメイト（44人）。シード固定なので毎回同じ分布になる。
import { COMPONENTS, CONDITIONS, TOTAL_POINTS, type ComponentKey, type ConditionKey } from './content'
import type { Answer, Entry, Tri } from './model'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 楽しみ方のタイプ：どの成分に偏りやすいか（重み）と人数
const ARCHETYPES: { weights: Record<ComponentKey, number>; count: number }[] = [
  { weights: { agon: 1, alea: 1, mimicry: 1.5, ilinx: 5 }, count: 15 }, // 熱狂派
  { weights: { agon: 5, alea: 1.5, mimicry: 1, ilinx: 1.5 }, count: 10 }, // 競争派
  { weights: { agon: 1.5, alea: 5, mimicry: 1, ilinx: 1 }, count: 9 }, // ドキドキ派
  { weights: { agon: 1, alea: 1, mimicry: 5, ilinx: 1.5 }, count: 10 }, // なりきり派
]

// 推し活で「はい / どちらとも」になりやすい確率
const COND_PROB: Record<ConditionKey, [number, number]> = {
  free: [0.3, 0.4],
  separate: [0.55, 0.3],
  uncertain: [0.65, 0.25],
  unproductive: [0.2, 0.35],
  rules: [0.6, 0.3],
  fiction: [0.45, 0.35],
}

const COMMENTS = [
  'ライブで推しと目が合った（気がした）瞬間',
  '新曲が出た日にみんなで感想を言い合う時間',
  'ランダム缶バッジで推しが出たとき',
  '投票で順位が上がった瞬間',
  '推しカラーでコーデを考えている時',
  'チケットの当落発表を待つドキドキ',
  '同担の友達と語り合う時',
  '推しの誕生日を祝う企画を準備している時',
  '遠征先の街を推しの気分で歩く時',
  'グッズを全部そろえきった時',
  '配信のコメントを読んでもらえた時',
  'ペンライトで会場が一色になる瞬間',
  '正直、最近はちょっと義務になってる…',
  'お金のことを考えると複雑',
  '推しの出演作を初見で観る時',
]

function allocate(rng: () => number, w: Record<ComponentKey, number>): Record<ComponentKey, number> {
  const keys = COMPONENTS.map((c) => c.key)
  const pts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<ComponentKey, number>
  const total = keys.reduce((s, k) => s + w[k], 0)
  for (let i = 0; i < TOTAL_POINTS; i++) {
    let r = rng() * total
    for (const k of keys) {
      r -= w[k]
      if (r <= 0) {
        pts[k]++
        break
      }
    }
  }
  return pts
}

export function makeDummies(count = 44, seed = 20261004): Entry[] {
  const rng = mulberry32(seed)
  const out: Entry[] = []
  let i = 0
  for (const arch of ARCHETYPES) {
    for (let j = 0; j < arch.count && i < count; j++, i++) {
      // 競争派・ドキドキ派ほど「やめられる」「非生産的」が下がる傾向を少し入れる
      const hooked = arch.weights.agon >= 5 || arch.weights.alea >= 5
      // 人ごとの「のめり込み度」：ライト層ほど遊び寄り、ヘビー層ほど義務寄りになる
      const lean = 0.35 + rng() * 1.3
      const conds = Object.fromEntries(
        CONDITIONS.map((c) => {
          let [py, pm] = COND_PROB[c.key]
          if (hooked && (c.key === 'free' || c.key === 'unproductive')) py *= 0.5
          py = Math.min(0.95, py * lean)
          pm = Math.min(pm, 1 - py)
          const r = rng()
          const v: Tri = r < py ? 1 : r < py + pm ? 0.5 : 0
          return [c.key, v]
        }),
      ) as Record<ConditionKey, Tri>
      const answer: Answer = {
        points: allocate(rng, arch.weights),
        conds,
        comment: rng() < 0.6 ? COMMENTS[Math.floor(rng() * COMMENTS.length)] : '',
        at: 0,
      }
      out.push({ cid: `dummy-${i}`, answer, dummy: true })
    }
  }
  return out
}

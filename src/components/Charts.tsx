// スクリーン用の集計グラフ（素のSVG/HTML。ホバーで数値を表示）
import { useState } from 'react'
import { COMPONENTS, CONDITIONS, TOTAL_POINTS } from '../content'
import { BIN_COUNT, type Summary } from '../model'

function Tip({ text }: { text: string | null }) {
  if (!text) return null
  return <div className="absolute right-3 top-3 rounded-md bg-ink text-white text-sm px-2 py-1 pointer-events-none">{text}</div>
}

/** ① 遊び度の分布 */
export function Histogram({ s, highlightBin }: { s: Summary; highlightBin: number | null }) {
  const [tip, setTip] = useState<string | null>(null)
  const W = 560
  const H = 180
  const padL = 28
  const padR = 18
  const padB = 28
  const padT = 26
  const maxC = Math.max(4, ...s.hist)
  const bw = (W - padL - padR) / BIN_COUNT
  const y = (c: number) => padT + (H - padT - padB) * (1 - c / maxC)
  const ticks = [0, Math.round(maxC / 2), maxC]
  return (
    <div className="relative">
      <Tip text={tip} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="遊び度のヒストグラム">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#ecebe7" />
            <text x={padL - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#8a8984">
              {t}
            </text>
          </g>
        ))}
        {s.hist.map((c, i) => {
          const x = padL + i * bw + 1
          const top = y(c)
          const h = H - padB - top
          const hi = highlightBin === i
          return (
            <g key={i} onMouseEnter={() => setTip(`${i * 10}〜${i === 9 ? 100 : i * 10 + 9}%：${c}人`)} onMouseLeave={() => setTip(null)}>
              <rect x={x - 1} y={padT - 20} width={bw} height={H - padT - padB + 20} fill="transparent" />
              {c > 0 && <path d={roundTop(x, top, bw - 2, h, 4)} fill={hi ? '#184f95' : '#2a78d6'} />}
              {hi && (
                <text x={x + (bw - 2) / 2} y={top - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#184f95">
                  ▼ いま届いた回答
                </text>
              )}
            </g>
          )
        })}
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="#8a8984" />
        {Array.from({ length: BIN_COUNT + 1 }).map((_, i) =>
          i % 2 === 0 ? (
            <text key={i} x={padL + i * bw} y={H - padB + 16} textAnchor="middle" fontSize={11} fill="#52514e">
              {i * 10}%
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

function roundTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

/** 横棒（成分の平均 / タイプ別人数 で共用） */
export function CompBars({ values, max, unit, reveal, digits = 0 }: { values: Record<string, number>; max: number; unit: string; reveal: boolean; digits?: number }) {
  const [tip, setTip] = useState<string | null>(null)
  return (
    <div className="relative space-y-2.5">
      <Tip text={tip} />
      {COMPONENTS.map((c) => {
        const v = values[c.key]
        const label = reveal ? `${c.theory}（${c.theorySub}）` : c.plain
        return (
          <div key={c.key} onMouseEnter={() => setTip(`${label}：${v.toFixed(digits)}${unit}`)} onMouseLeave={() => setTip(null)}>
            <div className="flex items-baseline justify-between text-[15px]">
              <span className="font-bold flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                {label}
              </span>
              <span className="tabular-nums text-ink2">
                {v.toFixed(digits)}
                {unit}
              </span>
            </div>
            <div className="h-3.5 bg-stone-100 rounded-r-[4px] mt-1">
              <div className="h-full rounded-r-[4px] transition-all duration-500" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: c.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const AVG_MAX = TOTAL_POINTS / 2

/** ③ 6条件：はい / どちらとも / いいえ の100%積み上げ */
export function CondStack({ s, reveal }: { s: Summary; reveal: boolean }) {
  const [tip, setTip] = useState<string | null>(null)
  return (
    <div className="relative">
      <Tip text={tip} />
      <div className="flex gap-4 text-xs text-ink2 mb-2 justify-end">
        <Legend color="var(--color-yes)" label="はい" />
        <Legend color="var(--color-mid)" label="どちらとも" />
        <Legend color="var(--color-no)" label="いいえ" />
      </div>
      <div className="space-y-2">
        {CONDITIONS.map((c) => {
          const d = s.cond[c.key]
          const n = s.n || 1
          const label = reveal ? c.theory : c.plain
          const parts = [
            ['yes', d.yes, 'var(--color-yes)', 'はい'],
            ['mid', d.mid, 'var(--color-mid)', 'どちらとも'],
            ['no', d.no, 'var(--color-no)', 'いいえ'],
          ] as const
          return (
            <div key={c.key} className="grid grid-cols-[minmax(0,15rem)_1fr_3rem] items-center gap-3">
              <span className={`text-[14px] leading-tight ${reveal ? 'font-bold' : ''}`}>{label}</span>
              <div className="flex h-5 gap-[2px]">
                {parts.map(([k, v, color, name]) =>
                  v > 0 ? (
                    <div
                      key={k}
                      className="h-full first:rounded-l-[4px] last:rounded-r-[4px] transition-all duration-500"
                      style={{ width: `${(v / n) * 100}%`, background: color }}
                      onMouseEnter={() => setTip(`${label}：${name} ${v}人`)}
                      onMouseLeave={() => setTip(null)}
                    />
                  ) : null,
                )}
              </div>
              <span className="tabular-nums text-sm text-ink2 text-right">{Math.round((d.yes / n) * 100)}%</span>
            </div>
          )
        })}
      </div>
      <div className="text-xs text-ink3 text-right mt-1">右端の数字：「はい」の割合</div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}

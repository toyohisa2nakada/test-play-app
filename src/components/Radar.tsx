// 4軸レーダー（個人の結果表示用）
export function Radar({ values, max, size = 260 }: { values: { label: string; value: number; color: string }[]; max: number; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.32
  const n = values.length
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + Math.cos(a) * r * (v / max), cy + Math.sin(a) * r * (v / max)] as const
  }
  const poly = values.map((d, i) => pt(i, Math.max(d.value, 0.15)).join(',')).join(' ')
  return (
    <svg viewBox={`-50 0 ${size + 100} ${size}`} className="w-full max-w-[280px] mx-auto" role="img" aria-label={values.map((v) => `${v.label} ${v.value}`).join('、')}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={values.map((_, i) => pt(i, max * f).join(',')).join(' ')} fill="none" stroke="#e4e3df" strokeWidth={1} />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, max)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e4e3df" strokeWidth={1} />
      })}
      <polygon points={poly} fill="#2a78d6" fillOpacity={0.18} stroke="#2a78d6" strokeWidth={2} strokeLinejoin="round" />
      {values.map((d, i) => {
        const [x, y] = pt(i, Math.max(d.value, 0.15))
        // 左右のラベルは外側へ寄せる（長いラベルが点に重ならないように）
        const side = Math.abs(Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n)) > 0.5
        const [lx, ly] = pt(i, max * (side ? 1.12 : 1.3))
        const anchor = !side ? 'middle' : lx < cx ? 'end' : 'start'
        return (
          <g key={d.label}>
            <circle cx={x} cy={y} r={5} fill={d.color} stroke="#fcfcfb" strokeWidth={2} />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize={14} fill="#0b0b0b" fontWeight={700}>
              {d.label}
            </text>
            <text x={lx} y={ly + 15} textAnchor={anchor} dominantBaseline="middle" fontSize={12} fill="#52514e">
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

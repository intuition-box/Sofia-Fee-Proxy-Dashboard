import type { ChartPoint } from "../hooks/useFeeEvents"

interface Props {
  data: ChartPoint[]
}

export function FeeChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#111116] p-6 h-64 flex items-center justify-center">
        <p className="text-sm text-gray-500">Not enough data for chart</p>
      </div>
    )
  }

  const width = 800
  const height = 300
  const padX = 50
  const padY = 30
  const chartW = width - padX * 2
  const chartH = height - padY * 2

  const values = data.map((d) => d.cumulativeFees)
  const maxVal = Math.max(...values, 0.001)
  const minVal = Math.min(...values)

  const points = data
    .map((d, i) => {
      const x = padX + (i / (data.length - 1)) * chartW
      const y =
        padY +
        chartH -
        ((d.cumulativeFees - minVal) / (maxVal - minVal || 1)) * chartH
      return `${x},${y}`
    })
    .join(" ")

  // Area fill path
  const firstX = padX
  const lastX = padX + chartW
  const bottomY = padY + chartH
  const areaPath = `M ${firstX},${bottomY} L ${points
    .split(" ")
    .map((p) => `L ${p}`)
    .join(" ")} L ${lastX},${bottomY} Z`
    .replace("L L", "L")

  // Y-axis labels (3 ticks)
  const yTicks = [0, 0.5, 1].map((frac) => {
    const val = minVal + frac * (maxVal - minVal)
    const y = padY + chartH - frac * chartH
    return { val: val.toFixed(2), y }
  })

  // X-axis labels (show ~5 dates)
  const step = Math.max(1, Math.floor(data.length / 5))
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d, _, arr) => {
      const idx = data.indexOf(d)
      const x = padX + (idx / (data.length - 1)) * chartW
      const label = d.date.slice(5) // MM-DD
      return { x, label }
    })

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111116] p-4">
      <h2 className="text-sm font-medium text-gray-400 mb-2 px-2">
        Cumulative Fees Collected (TRUST)
      </h2>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((t) => (
          <line
            key={t.val}
            x1={padX}
            y1={t.y}
            x2={width - padX}
            y2={t.y}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Y-axis labels */}
        {yTicks.map((t) => (
          <text
            key={t.val}
            x={padX - 8}
            y={t.y + 4}
            textAnchor="end"
            fill="rgba(255,255,255,0.35)"
            fontSize="11"
            fontFamily="monospace"
          >
            {t.val}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l) => (
          <text
            key={l.label}
            x={l.x}
            y={height - 4}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize="11"
            fontFamily="monospace"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

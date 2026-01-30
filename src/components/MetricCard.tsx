interface MetricCardProps {
  label: string
  value: string
  subtitle?: string
  highlight?: boolean
}

export function MetricCard({ label, value, subtitle, highlight }: MetricCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-indigo-500/40 bg-indigo-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-indigo-300" : "text-white"}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

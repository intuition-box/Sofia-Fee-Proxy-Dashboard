import { MetricCard } from "./MetricCard"
import type { PeriodStats } from "../services/FeeAnalytics"

interface Props {
  stats7d: PeriodStats
  stats30d: PeriodStats
  statsTotal: PeriodStats
  selectedPeriod: "7d" | "30d" | "total"
  onSelectPeriod: (period: "7d" | "30d" | "total") => void
}

function PeriodRow({
  label,
  stats,
  selected,
  onClick,
}: {
  label: string
  stats: PeriodStats
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-3 gap-4 cursor-pointer rounded-xl p-1 transition-all ${
        selected ? "ring-2 ring-emerald-500/50" : "hover:ring-1 hover:ring-white/10"
      }`}
    >
      <MetricCard
        label={`NB TX (${label})`}
        value={stats.txCount.toString()}
        highlight={selected}
      />
      <MetricCard
        label={`TRUST Amount (${label})`}
        value={`${stats.totalFeesFormatted}`}
        subtitle="TRUST"
        highlight={selected}
      />
      <MetricCard
        label={`Wallets (${label})`}
        value={stats.uniqueWallets.toString()}
        subtitle="unique"
        highlight={selected}
      />
    </div>
  )
}

export function FeeRevenue({
  stats7d,
  stats30d,
  statsTotal,
  selectedPeriod,
  onSelectPeriod,
}: Props) {
  return (
    <div className="space-y-4">
      <PeriodRow
        label="7j"
        stats={stats7d}
        selected={selectedPeriod === "7d"}
        onClick={() => onSelectPeriod("7d")}
      />
      <PeriodRow
        label="30j"
        stats={stats30d}
        selected={selectedPeriod === "30d"}
        onClick={() => onSelectPeriod("30d")}
      />
      <PeriodRow
        label="Total"
        stats={statsTotal}
        selected={selectedPeriod === "total"}
        onClick={() => onSelectPeriod("total")}
      />
    </div>
  )
}

import { MetricCard } from "./MetricCard"
import type { AllTimeStats } from "../hooks/useFeeEvents"

interface Props {
  allTime: AllTimeStats
}

export function AllTimeSummary({ allTime }: Props) {
  const ops = allTime.operationBreakdown

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">All-Time Summary</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Fees Collected"
          value={`${allTime.totalFeesFormatted} TRUST`}
          highlight
        />
        <MetricCard
          label="Total Transactions"
          value={allTime.totalTransactions.toString()}
        />
        <MetricCard
          label="createTriples"
          value={(ops["createTriples"]?.count ?? 0).toString()}
          subtitle="total calls"
        />
        <MetricCard
          label="deposit"
          value={(ops["deposit"]?.count ?? 0).toString()}
          subtitle="total calls"
        />
        <MetricCard
          label="createAtoms"
          value={(ops["createAtoms"]?.count ?? 0).toString()}
          subtitle="no fee charged"
        />
        <MetricCard
          label="Total Volume"
          value={`${allTime.totalVolumeFormatted} TRUST`}
          subtitle="Total value received by proxy"
        />
        <MetricCard
          label="Forwarded to MultiVault"
          value={`${allTime.totalMultiVaultValueFormatted} TRUST`}
        />
      </div>
    </div>
  )
}

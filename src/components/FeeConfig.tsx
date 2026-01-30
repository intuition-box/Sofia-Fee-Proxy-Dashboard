import { MetricCard } from "./MetricCard"
import type { ContractState } from "../hooks/useContractState"

interface Props {
  state: ContractState
}

export function FeeConfig({ state }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Fee Configuration</h2>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="Deposit Fixed Fee"
          value={`${state.depositFixedFeeFormatted} TRUST`}
          subtitle="Per deposit operation"
        />
        <MetricCard
          label="Deposit % Fee"
          value={`${state.depositPercentageFormatted}%`}
          subtitle={`Raw: ${state.depositPercentageFee} / ${state.feeDenominator}`}
          highlight
        />
      </div>
    </div>
  )
}

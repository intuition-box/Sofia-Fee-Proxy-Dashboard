import { SOFIA_PROXY_ADDRESS, EXPLORER_URL } from "../config"
import type { ContractState } from "../hooks/useContractState"

interface Props {
  state: ContractState
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function AddressLink({ address, label }: { address: string; label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <a
        href={`${EXPLORER_URL}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        {shortenAddress(address)}
      </a>
    </div>
  )
}

export function ContractOverview({ state }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Contract Overview</h2>
      <AddressLink address={SOFIA_PROXY_ADDRESS} label="Proxy Contract" />
      <AddressLink address={state.feeRecipient} label="Fee Recipient" />
      <AddressLink address={state.ethMultiVault} label="MultiVault" />
      <div className="flex items-center justify-between py-2 mt-2">
        <span className="text-sm text-gray-400">Contract Balance</span>
        <span className="text-sm font-bold text-emerald-400">
          {state.contractBalanceFormatted} TRUST
        </span>
      </div>
    </div>
  )
}

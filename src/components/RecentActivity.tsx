import { EXPLORER_URL } from "../config"
import { formatTrust } from "../utils/format"
import type { RawEvent } from "../services/EventFetcher"

interface Props {
  transactions: RawEvent[]
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function shortenHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`
}

export function RecentActivity({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <p className="text-sm text-gray-500">No recent transactions found.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">
        Recent Activity
        <span className="text-sm font-normal text-gray-500 ml-2">
          (last {transactions.length})
        </span>
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-white/10">
              <th className="pb-3 pr-4">Operation</th>
              <th className="pb-3 pr-4">User</th>
              <th className="pb-3 pr-4 text-right">Sofia Fee</th>
              <th className="pb-3 pr-4 text-right">MultiVault Value</th>
              <th className="pb-3 pr-4 text-right">Total Received</th>
              <th className="pb-3 text-right">Block</th>
              <th className="pb-3 text-right">Tx</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr
                key={`${tx.txHash}-${i}`}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 pr-4">
                  <span className="inline-block rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                    {tx.operation}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-gray-300">
                  <a
                    href={`${EXPLORER_URL}/address/${tx.user}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-indigo-300 transition-colors"
                  >
                    {shortenAddress(tx.user)}
                  </a>
                </td>
                <td className="py-3 pr-4 text-right font-mono text-emerald-400">
                  {formatTrust(tx.sofiaFee)}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-gray-300">
                  {formatTrust(tx.multiVaultValue)}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-gray-300">
                  {formatTrust(tx.totalReceived)}
                </td>
                <td className="py-3 pr-4 text-right text-gray-500">
                  {tx.blockNumber.toString()}
                </td>
                <td className="py-3 text-right">
                  <a
                    href={`${EXPLORER_URL}/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {shortenHash(tx.txHash)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

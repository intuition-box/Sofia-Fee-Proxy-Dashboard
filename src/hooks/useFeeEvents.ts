import { useEffect, useState, useCallback } from "react"
import { createPublicClient, http, formatEther, parseAbiItem } from "viem"
import { formatTrust } from "../utils/format"
import {
  intuitionMainnet,
  SOFIA_PROXY_ADDRESS,
  REFRESH_INTERVAL,
  DEPLOY_BLOCK,
} from "../config"

const client = createPublicClient({
  chain: intuitionMainnet,
  transport: http(),
})

export interface TransactionForwardedEvent {
  operation: string
  user: string
  sofiaFee: bigint
  multiVaultValue: bigint
  totalReceived: bigint
  blockNumber: bigint
  txHash: string
  timestamp: number // estimated unix seconds
}

export interface PeriodStats {
  txCount: number
  totalFees: bigint
  totalFeesFormatted: string
  uniqueWallets: number
}

export interface ChartPoint {
  date: string // YYYY-MM-DD
  fees: number // float TRUST
  cumulativeFees: number
}

export interface AllTimeStats {
  totalFees: bigint
  totalFeesFormatted: string
  totalVolume: bigint
  totalVolumeFormatted: string
  totalMultiVaultValue: bigint
  totalMultiVaultValueFormatted: string
  totalTransactions: number
  operationBreakdown: Record<string, { count: number; totalFee: bigint }>
}

export interface FeeEventsSummary {
  stats7d: PeriodStats
  stats30d: PeriodStats
  statsTotal: PeriodStats
  allTime: AllTimeStats
  chartData7d: ChartPoint[]
  chartData30d: ChartPoint[]
  recentTransactions: TransactionForwardedEvent[]
}

const TX_FORWARDED_EVENT = parseAbiItem(
  "event TransactionForwarded(string operation, address indexed user, uint256 sofiaFee, uint256 multiVaultValue, uint256 totalReceived)"
)

const BLOCK_CHUNK = 50_000n

async function getLogsInChunks<T>(
  fetcher: (from: bigint, to: bigint) => Promise<T[]>,
  fromBlock: bigint,
  toBlock: bigint
): Promise<T[]> {
  const allLogs: T[] = []
  let cursor = fromBlock
  while (cursor <= toBlock) {
    const end =
      cursor + BLOCK_CHUNK - 1n > toBlock ? toBlock : cursor + BLOCK_CHUNK - 1n
    const logs = await fetcher(cursor, end)
    allLogs.push(...logs)
    cursor = end + 1n
  }
  return allLogs
}

function computePeriodStats(
  events: TransactionForwardedEvent[],
  afterTimestamp: number
): PeriodStats {
  const filtered = events.filter((e) => e.timestamp >= afterTimestamp)
  let totalFees = 0n
  const wallets = new Set<string>()
  for (const e of filtered) {
    totalFees += e.sofiaFee
    wallets.add(e.user.toLowerCase())
  }
  return {
    txCount: filtered.length,
    totalFees,
    totalFeesFormatted: formatTrust(totalFees),
    uniqueWallets: wallets.size,
  }
}

function computeChartData(
  events: TransactionForwardedEvent[],
  afterTimestamp: number
): ChartPoint[] {
  const filtered = events.filter((e) => e.timestamp >= afterTimestamp)
  // Group fees by date
  const byDate: Record<string, number> = {}
  for (const e of filtered) {
    const d = new Date(e.timestamp * 1000)
    const key = d.toISOString().slice(0, 10)
    byDate[key] = (byDate[key] ?? 0) + parseFloat(formatEther(e.sofiaFee))
  }

  // Fill in missing dates
  const now = new Date()
  const start = new Date(afterTimestamp * 1000)
  const points: ChartPoint[] = []
  let cumulative = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10)
    const dailyFees = byDate[key] ?? 0
    cumulative += dailyFees
    points.push({
      date: key,
      fees: dailyFees,
      cumulativeFees: cumulative,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return points
}

export function useFeeEvents() {
  const [summary, setSummary] = useState<FeeEventsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      // Get current block and its timestamp for block→time estimation
      const currentBlock = await client.getBlockNumber()
      const latestBlock = await client.getBlock({ blockNumber: currentBlock })
      const currentTimestamp = Number(latestBlock.timestamp)

      // Fetch all TransactionForwarded events
      const txLogs = await getLogsInChunks(
        (from, to) =>
          client.getLogs({
            address: SOFIA_PROXY_ADDRESS,
            event: TX_FORWARDED_EVENT,
            fromBlock: from,
            toBlock: to,
          }),
        DEPLOY_BLOCK,
        currentBlock
      )

      // Estimate timestamps from block numbers
      // Intuition mainnet ≈ 1 block/sec
      const allEvents: TransactionForwardedEvent[] = txLogs.map((log) => {
        const blockDiff = Number(currentBlock - log.blockNumber)
        const estimatedTimestamp = currentTimestamp - blockDiff
        return {
          operation: log.args.operation ?? "unknown",
          user: log.args.user ?? "0x",
          sofiaFee: log.args.sofiaFee ?? 0n,
          multiVaultValue: log.args.multiVaultValue ?? 0n,
          totalReceived: log.args.totalReceived ?? 0n,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          timestamp: estimatedTimestamp,
        }
      })

      // Sort by block ascending for chart computation
      allEvents.sort((a, b) => Number(a.blockNumber - b.blockNumber))

      const now = Math.floor(Date.now() / 1000)
      const sevenDaysAgo = now - 7 * 24 * 3600
      const thirtyDaysAgo = now - 30 * 24 * 3600

      const stats7d = computePeriodStats(allEvents, sevenDaysAgo)
      const stats30d = computePeriodStats(allEvents, thirtyDaysAgo)
      const chartData7d = computeChartData(allEvents, sevenDaysAgo)
      const chartData30d = computeChartData(allEvents, thirtyDaysAgo)

      // All-time stats
      let totalFees = 0n
      let totalVolume = 0n
      let totalMultiVaultValue = 0n
      const operationBreakdown: Record<string, { count: number; totalFee: bigint }> = {}
      for (const e of allEvents) {
        totalFees += e.sofiaFee
        totalVolume += e.totalReceived
        totalMultiVaultValue += e.multiVaultValue
        const op = e.operation
        if (!operationBreakdown[op]) {
          operationBreakdown[op] = { count: 0, totalFee: 0n }
        }
        operationBreakdown[op].count++
        operationBreakdown[op].totalFee += e.sofiaFee
      }

      const allTime: AllTimeStats = {
        totalFees,
        totalFeesFormatted: formatTrust(totalFees),
        totalVolume,
        totalVolumeFormatted: formatTrust(totalVolume),
        totalMultiVaultValue,
        totalMultiVaultValueFormatted: formatTrust(totalMultiVaultValue),
        totalTransactions: allEvents.length,
        operationBreakdown,
      }

      // Recent transactions (descending)
      const recent = [...allEvents]
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
        .slice(0, 50)

      const statsTotal = computePeriodStats(allEvents, 0)

      setSummary({
        stats7d,
        stats30d,
        statsTotal,
        allTime,
        chartData7d,
        chartData30d,
        recentTransactions: recent,
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch events")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchEvents])

  return { summary, loading, error, refetch: fetchEvents }
}

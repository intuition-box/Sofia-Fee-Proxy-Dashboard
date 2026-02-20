import { formatEther } from "viem"
import { formatTrust } from "../utils/format"
import type { RawEvent } from "./EventFetcher"

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

export interface DashboardData {
  stats7d: PeriodStats
  stats30d: PeriodStats
  statsTotal: PeriodStats
  allTime: AllTimeStats
  chartData7d: ChartPoint[]
  chartData30d: ChartPoint[]
  chartDataTotal: ChartPoint[]
  recentTransactions: RawEvent[]
}

/**
 * Pure computation class — no RPC calls.
 * Takes events as input, returns computed analytics.
 */
export class FeeAnalytics {
  computeAll(events: RawEvent[]): DashboardData {
    const now = Math.floor(Date.now() / 1000)
    const sevenDaysAgo = now - 7 * 24 * 3600
    const thirtyDaysAgo = now - 30 * 24 * 3600

    // For the "total" chart, start from the earliest event with a real timestamp.
    // Events may have timestamp=0 before background resolution completes.
    const firstResolved = events.find((e) => e.timestamp > 0)
    const earliestEventTs = firstResolved ? firstResolved.timestamp : now

    return {
      stats7d: this.computePeriodStats(events, sevenDaysAgo),
      stats30d: this.computePeriodStats(events, thirtyDaysAgo),
      statsTotal: this.computePeriodStats(events, 0),
      allTime: this.computeAllTime(events),
      chartData7d: this.computeChartData(events, sevenDaysAgo),
      chartData30d: this.computeChartData(events, thirtyDaysAgo),
      chartDataTotal: this.computeChartData(events, earliestEventTs),
      recentTransactions: [...events]
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
        .slice(0, 50),
    }
  }

  private computePeriodStats(
    events: RawEvent[],
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

  private computeAllTime(events: RawEvent[]): AllTimeStats {
    let totalFees = 0n
    let totalVolume = 0n
    let totalMultiVaultValue = 0n
    const operationBreakdown: Record<
      string,
      { count: number; totalFee: bigint }
    > = {}

    for (const e of events) {
      totalFees += e.sofiaFee
      totalVolume += e.totalReceived
      totalMultiVaultValue += e.multiVaultValue

      if (!operationBreakdown[e.operation]) {
        operationBreakdown[e.operation] = { count: 0, totalFee: 0n }
      }
      operationBreakdown[e.operation].count++
      operationBreakdown[e.operation].totalFee += e.sofiaFee
    }

    return {
      totalFees,
      totalFeesFormatted: formatTrust(totalFees),
      totalVolume,
      totalVolumeFormatted: formatTrust(totalVolume),
      totalMultiVaultValue,
      totalMultiVaultValueFormatted: formatTrust(totalMultiVaultValue),
      totalTransactions: events.length,
      operationBreakdown,
    }
  }

  private computeChartData(
    events: RawEvent[],
    afterTimestamp: number
  ): ChartPoint[] {
    const filtered = events.filter((e) => e.timestamp >= afterTimestamp)

    const byDate: Record<string, number> = {}
    for (const e of filtered) {
      const d = new Date(e.timestamp * 1000)
      const key = d.toISOString().slice(0, 10)
      byDate[key] = (byDate[key] ?? 0) + parseFloat(formatEther(e.sofiaFee))
    }

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
      points.push({ date: key, fees: dailyFees, cumulativeFees: cumulative })
      cursor.setDate(cursor.getDate() + 1)
    }

    return points
  }
}

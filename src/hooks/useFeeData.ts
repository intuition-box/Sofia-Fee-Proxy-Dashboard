import { useEffect, useState, useCallback, useRef } from "react"
import { BlockResolver } from "../services/BlockResolver"
import { EventFetcher } from "../services/EventFetcher"
import { FeeAnalytics, type DashboardData } from "../services/FeeAnalytics"
import { REFRESH_INTERVAL } from "../config"

// Singleton instances — persist across re-renders and refreshes
const blockResolver = new BlockResolver()
const eventFetcher = new EventFetcher(blockResolver)
const feeAnalytics = new FeeAnalytics()

export function useFeeData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timestampsResolved, setTimestampsResolved] = useState(false)
  const fetchingRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      // Phase 1: Fetch events without timestamps → show totals immediately
      const events = await eventFetcher.fetch()
      const partialResult = feeAnalytics.computeAll(events)
      setData(partialResult)
      setLoading(false)

      // Phase 2: Resolve timestamps in background → update period stats + chart
      const updatedEvents = await eventFetcher.resolveTimestamps()
      if (updatedEvents) {
        const fullResult = feeAnalytics.computeAll(updatedEvents)
        setData(fullResult)
        setTimestampsResolved(true)
      }

      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch fee data")
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  return { data, loading, error, timestampsResolved, refetch: fetchData }
}

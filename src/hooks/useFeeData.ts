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
  const fetchingRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const events = await eventFetcher.fetch()
      const result = feeAnalytics.computeAll(events)
      setData(result)
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

  return { data, loading, error, refetch: fetchData }
}

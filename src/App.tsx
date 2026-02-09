import { useState } from "react"
import { useContractState } from "./hooks/useContractState"
import { useFeeData } from "./hooks/useFeeData"
import { FeeChart } from "./components/FeeChart"
import { FeeRevenue } from "./components/FeeRevenue"
import { ContractOverview } from "./components/ContractOverview"
import { FeeConfig } from "./components/FeeConfig"
import { AllTimeSummary } from "./components/AllTimeSummary"
import { RecentActivity } from "./components/RecentActivity"
import { SOFIA_PROXY_ADDRESS } from "./config"

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
      <p className="text-sm text-red-400">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

function App() {
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "total">("7d")

  const {
    state,
    loading: stateLoading,
    error: stateError,
    refetch: refetchState,
  } = useContractState()

  const {
    data: summary,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useFeeData()

  const loading = stateLoading || eventsLoading

  const chartData = summary
    ? selectedPeriod === "7d"
      ? summary.chartData7d
      : selectedPeriod === "30d"
        ? summary.chartData30d
        : summary.chartDataTotal
    : []

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Sofia Fee Proxy Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 font-mono">
            {SOFIA_PROXY_ADDRESS}
          </p>
        </div>

        {/* Errors */}
        {stateError && (
          <div className="mb-4">
            <ErrorBanner message={stateError} onRetry={refetchState} />
          </div>
        )}
        {eventsError && (
          <div className="mb-4">
            <ErrorBanner message={eventsError} onRetry={refetchEvents} />
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSpinner />}

        {/* Dashboard */}
        {!loading && (
          <div className="space-y-6">
            {/* Contract Overview + Fee Config */}
            {state && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <ContractOverview state={state} />
                </div>
                <div className="lg:col-span-2">
                  <FeeConfig state={state} />
                </div>
              </div>
            )}

            {/* All-Time Revenue Summary */}
            {summary && <AllTimeSummary allTime={summary.allTime} />}

            {/* Chart + Period Metrics */}
            {summary && (
              <>
                <FeeChart data={chartData} />
                <FeeRevenue
                  stats7d={summary.stats7d}
                  stats30d={summary.stats30d}
                  statsTotal={summary.statsTotal}
                  selectedPeriod={selectedPeriod}
                  onSelectPeriod={setSelectedPeriod}
                />
              </>
            )}

            {/* Recent Activity Table */}
            {summary && (
              <RecentActivity transactions={summary.recentTransactions} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

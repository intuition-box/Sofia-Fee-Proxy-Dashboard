import { useEffect, useState, useCallback } from "react"
import { formatTrust } from "../utils/format"
import { rpcClient } from "../services/rpcClient"
import { SOFIA_PROXY_ADDRESS, REFRESH_INTERVAL } from "../config"
import { SofiaFeeProxyAbi } from "../abi"

export interface ContractState {
  depositFixedFee: bigint
  depositPercentageFee: bigint
  feeDenominator: bigint
  maxFeePercentage: bigint
  feeRecipient: string
  ethMultiVault: string
  contractBalance: bigint
  // Formatted
  depositFixedFeeFormatted: string
  depositPercentageFormatted: string
  contractBalanceFormatted: string
}

export function useContractState() {
  const [state, setState] = useState<ContractState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const [
        depositFixedFee,
        depositPercentageFee,
        feeDenominator,
        maxFeePercentage,
        feeRecipient,
        ethMultiVault,
        contractBalance,
      ] = await Promise.all([
        rpcClient.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "depositFixedFee",
        }),
        rpcClient.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "depositPercentageFee",
        }),
        rpcClient.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "FEE_DENOMINATOR",
        }),
        rpcClient.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "MAX_FEE_PERCENTAGE",
        }),
        rpcClient.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "feeRecipient",
        }),
        rpcClient.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "ethMultiVault",
        }),
        rpcClient.getBalance({ address: SOFIA_PROXY_ADDRESS }),
      ])

      const pctNum = Number(depositPercentageFee)
      const denomNum = Number(feeDenominator)

      setState({
        depositFixedFee,
        depositPercentageFee,
        feeDenominator,
        maxFeePercentage,
        feeRecipient,
        ethMultiVault,
        contractBalance,
        depositFixedFeeFormatted: formatTrust(depositFixedFee),
        depositPercentageFormatted:
          denomNum > 0 ? ((pctNum / denomNum) * 100).toFixed(2) : "0",
        contractBalanceFormatted: formatTrust(contractBalance),
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch contract state")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchState])

  return { state, loading, error, refetch: fetchState }
}

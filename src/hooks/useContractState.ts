import { useEffect, useState, useCallback } from "react"
import { createPublicClient, http } from "viem"
import { formatTrust } from "../utils/format"
import { intuitionMainnet, SOFIA_PROXY_ADDRESS, REFRESH_INTERVAL } from "../config"
import { SofiaFeeProxyAbi } from "../abi"

const client = createPublicClient({
  chain: intuitionMainnet,
  transport: http(),
})

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
        client.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "depositFixedFee",
        }),
        client.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "depositPercentageFee",
        }),
        client.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "FEE_DENOMINATOR",
        }),
        client.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "MAX_FEE_PERCENTAGE",
        }),
        client.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "feeRecipient",
        }),
        client.readContract({
          address: SOFIA_PROXY_ADDRESS,
          abi: SofiaFeeProxyAbi,
          functionName: "ethMultiVault",
        }),
        client.getBalance({ address: SOFIA_PROXY_ADDRESS }),
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

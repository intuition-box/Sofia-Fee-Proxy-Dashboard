import { formatEther } from "viem"

/**
 * Format a bigint wei value to a human-readable TRUST string with max 4 decimals.
 */
export function formatTrust(value: bigint | undefined | null): string {
  if (value == null) return "0"
  const raw = parseFloat(formatEther(value))
  return parseFloat(raw.toFixed(4)).toString()
}

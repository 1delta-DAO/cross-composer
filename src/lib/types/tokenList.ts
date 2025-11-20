import type { RawCurrency } from "../../types/currency"

export interface VersionedDeltaTokenList {
  name: string
  version: {
    major: number
    minor: number
    patch: number
  }
  timestamp: string
  tags: Record<string, { name: string; description: string }>
  logoURI: string
  keywords: string[]
  list: Record<string, RawCurrency>
}

import { type Address, zeroAddress } from 'viem'
import { erc20Abi } from 'viem'
import { getRpcSelectorEvmClient, SupportedChainId } from '@1delta/lib-utils'
import { MOONWELL_LENS, MOONWELL_UNDERLYING_TO_MTOKEN } from '../deposit/consts'
import type { RawCurrency } from '../../../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { VenusLensAbi } from '../../../../lib/abi/compV2'
import { setCachedBalances } from '../withdraw/balanceCache'
import { multicallRetryUniversal } from '@1delta/providers'

export type MoonwellMarket = {
  mTokenCurrency: RawCurrency
  underlyingCurrency: RawCurrency
  symbol?: string
  decimals?: number
  isListed: boolean
  mintPaused: boolean
  borrowPaused: boolean
}

let cachedMarkets: MoonwellMarket[] | undefined = undefined
let isLoading = false
let error: string | undefined = undefined
let isInitialized = false

type StateChangeListener = () => void
const listeners = new Set<StateChangeListener>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function subscribeToCacheChanges(listener: StateChangeListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCachedMarkets(): MoonwellMarket[] | undefined {
  return cachedMarkets
}

export function isMarketsLoading(): boolean {
  return isLoading
}

export function isMarketsReady(): boolean {
  return !isLoading && cachedMarkets !== undefined && error === undefined
}

export function hasMarketsError(): boolean {
  return error !== undefined
}

export function getMarketsError(): string | undefined {
  return error
}

export function getMarketByMToken(mToken: Address): MoonwellMarket | undefined {
  if (!cachedMarkets) return undefined
  return cachedMarkets.find((m) => m.mTokenCurrency.address.toLowerCase() === mToken.toLowerCase())
}

export function getMarketByUnderlying(underlying: Address): MoonwellMarket | undefined {
  if (!cachedMarkets) return undefined
  return cachedMarkets.find(
    (m) => m.underlyingCurrency.address.toLowerCase() === underlying.toLowerCase()
  )
}

export async function initializeMoonwellMarkets(
  chainId: string = SupportedChainId.MOONBEAM,
  userAddress?: Address
): Promise<{ markets: MoonwellMarket[]; balances?: Record<string, bigint> }> {
  if (isInitialized && cachedMarkets !== undefined) {
    return { markets: cachedMarkets }
  }

  if (isLoading) {
    return { markets: cachedMarkets || [] }
  }

  if (chainId !== SupportedChainId.MOONBEAM) {
    error = 'Only moonbeam supported'
    notifyListeners()
    return { markets: [] }
  }

  isLoading = true
  error = undefined
  notifyListeners()

  try {
    const client = await getRpcSelectorEvmClient(chainId)
    if (!client) {
      throw new Error('No client for chain')
    }

    const mTokenEntries = Object.entries(MOONWELL_UNDERLYING_TO_MTOKEN)
    const results: MoonwellMarket[] = []
    const balanceMap: Record<string, bigint> = {}

    const marketInfoCalls = mTokenEntries.map(([, mToken]) => ({
      address: MOONWELL_LENS as Address,
      name: 'getMarketInfo' as const,
      params: [mToken as Address],
    }))

    const marketInfosResults = await multicallRetryUniversal({
      chain: chainId,
      calls: marketInfoCalls,
      abi: VenusLensAbi,
      maxRetries: 3,
      providerId: 0,
    })

    const marketInfos = marketInfosResults.map((r) => (r.status === 'success' ? r.result : null))

    const underlyingAddresses: Address[] = []
    const underlyingSymbolCalls: any[] = []
    const underlyingDecimalsCalls: any[] = []
    const mTokenSymbolCalls: any[] = []
    const mTokenDecimalsCalls: any[] = []
    const balanceCalls: any[] = []

    for (let i = 0; i < mTokenEntries.length; i++) {
      const [underlyingRaw, mToken] = mTokenEntries[i]
      const underlying = underlyingRaw as Address
      const info = marketInfos[i] as any

      const underlyingFromLens = (info?.[18]?.token ||
        info?.underlying ||
        info?.underlyingAssetAddress ||
        undefined) as Address | undefined
      const resolvedUnderlying = (
        underlying && underlying !== ('' as Address) ? underlying : underlyingFromLens
      ) as Address

      underlyingAddresses.push(resolvedUnderlying)

      if (resolvedUnderlying && resolvedUnderlying.toLowerCase() !== zeroAddress.toLowerCase()) {
        underlyingSymbolCalls.push({
          address: resolvedUnderlying,
          abi: erc20Abi,
          functionName: 'symbol' as const,
        })
        underlyingDecimalsCalls.push({
          address: resolvedUnderlying,
          abi: erc20Abi,
          functionName: 'decimals' as const,
        })
      }

      mTokenSymbolCalls.push({
        address: mToken as Address,
        abi: erc20Abi,
        functionName: 'symbol' as const,
      })
      mTokenDecimalsCalls.push({
        address: mToken as Address,
        abi: erc20Abi,
        functionName: 'decimals' as const,
      })

      if (userAddress) {
        balanceCalls.push({
          address: mToken as Address,
          abi: erc20Abi,
          functionName: 'balanceOf' as const,
          args: [userAddress],
        })
      }
    }

    const allCalls = [
      ...underlyingSymbolCalls,
      ...underlyingDecimalsCalls,
      ...mTokenSymbolCalls,
      ...mTokenDecimalsCalls,
      ...balanceCalls,
    ]

    const allResultsRaw = await client.multicall({
      contracts: allCalls,
    })

    const allResults = allResultsRaw.map((r) => (r.status === 'success' ? r.result : null))

    let resultIndex = 0
    const underlyingSymbols: (string | undefined)[] = []
    const underlyingDecimals: (number | undefined)[] = []
    const mTokenSymbols: (string | undefined)[] = []
    const mTokenDecimals: (number | undefined)[] = []
    const balances: (bigint | undefined)[] = []

    for (let i = 0; i < mTokenEntries.length; i++) {
      const resolvedUnderlying = underlyingAddresses[i]

      if (resolvedUnderlying && resolvedUnderlying.toLowerCase() !== zeroAddress.toLowerCase()) {
        const symbolResult = allResults[resultIndex++]
        underlyingSymbols.push(symbolResult ? (symbolResult as string) : undefined)
        const decimalsResult = allResults[resultIndex++]
        underlyingDecimals.push(decimalsResult ? (decimalsResult as number) : undefined)
      } else {
        underlyingSymbols.push(undefined)
        underlyingDecimals.push(undefined)
      }

      const mTokenSymbolResult = allResults[resultIndex++]
      mTokenSymbols.push(mTokenSymbolResult ? (mTokenSymbolResult as string) : undefined)
      const mTokenDecimalsResult = allResults[resultIndex++]
      mTokenDecimals.push(mTokenDecimalsResult ? (mTokenDecimalsResult as number) : undefined)

      if (userAddress) {
        const balanceResult = allResults[resultIndex++]
        balances.push(balanceResult ? (balanceResult as bigint) : 0n)
      }
    }

    for (let i = 0; i < mTokenEntries.length; i++) {
      const [underlyingRaw, mToken] = mTokenEntries[i]
      const underlying = underlyingRaw as Address
      const info = marketInfos[i] as any
      const resolvedUnderlying = underlyingAddresses[i]

      const symbol = underlyingSymbols[i] || mTokenSymbols[i]
      const decimals = underlyingDecimals[i] ?? 18
      const mTokenSymbol = mTokenSymbols[i]
      const mTokenDecimalsValue = mTokenDecimals[i] ?? 18

      if (userAddress && balances[i] !== undefined) {
        const mTokenKey = (mToken as Address).toLowerCase()
        balanceMap[mTokenKey] = balances[i] || 0n
      }

      const mTokenCurrency = CurrencyHandler.Currency(
        chainId,
        mToken as Address,
        mTokenDecimalsValue,
        mTokenSymbol || 'mToken',
        mTokenSymbol || 'Moonwell Market Token'
      )

      const underlyingCurrency = CurrencyHandler.Currency(
        chainId,
        resolvedUnderlying || underlying,
        decimals,
        symbol || 'Token',
        symbol || 'Token'
      )

      results.push({
        mTokenCurrency,
        underlyingCurrency,
        symbol,
        decimals,
        isListed: Boolean(info?.isListed),
        mintPaused: Boolean(info?.mintPaused),
        borrowPaused: Boolean(info?.borrowPaused),
      })
    }

    cachedMarkets = results
    isInitialized = true
    error = undefined

    if (userAddress && Object.keys(balanceMap).length > 0) {
      setCachedBalances(chainId, userAddress, balanceMap)

      console.log(
        `[MarketCache] Fetched markets and balances for ${userAddress} on chain ${chainId}:`,
        {
          chainId,
          userAddress,
          marketsCount: results.length,
          balances: balanceMap,
          marketsWithBalance: Object.values(balanceMap).filter((b) => b > 0n).length,
        }
      )
    }

    return { markets: results, balances: userAddress ? balanceMap : undefined }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch Moonwell markets'
    cachedMarkets = undefined
    return { markets: [] }
  } finally {
    isLoading = false
    notifyListeners()
  }
}

export async function refreshMoonwellMarkets(
  chainId: string = SupportedChainId.MOONBEAM,
  userAddress?: Address
): Promise<void> {
  isInitialized = false
  cachedMarkets = undefined
  await initializeMoonwellMarkets(chainId, userAddress)
}

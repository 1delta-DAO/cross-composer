import { CurrencyHandler, SupportedChainId } from '@1delta/lib-utils'
import { getTokenFromCache, isTokenListsReady } from '../../../../lib/data/tokenListsCache'

export function formatListingPriceLabel(
  listing: any,
  tokenChainId: string | number | undefined
): string {
  const tokenMeta =
    !!tokenChainId && isTokenListsReady()
      ? getTokenFromCache(tokenChainId.toString(), listing.currency)
      : undefined

  const decimals =
    typeof tokenMeta?.decimals === 'number' ? tokenMeta.decimals : listing.priceDecimals
  const symbol = tokenMeta?.symbol || ''

  try {
    const base = BigInt(listing.pricePerToken)
    const d = BigInt(decimals >= 0 ? decimals : 0)
    const denom = 10n ** d
    const whole = base / denom
    const frac = base % denom

    let fracStr = decimals > 0 ? frac.toString().padStart(Number(d), '0') : ''
    if (fracStr) {
      fracStr = fracStr.replace(/0+$/, '')
    }

    const human = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
    return `${human} ${symbol}`
  } catch {
    return `${listing.pricePerToken} ${symbol}`
  }
}

export function buildCurrencyMetaForListing(listing: any, dstChainId?: string) {
  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM
  const tokenMeta =
    !!tokenChainId && isTokenListsReady()
      ? getTokenFromCache(tokenChainId.toString(), listing.currency)
      : undefined

  const currency: {
    chainId: string
    address: string
    symbol?: string
    decimals: number
  } = !!tokenMeta
    ? tokenMeta
    : {
        chainId: tokenChainId,
        address: listing.currency,
        decimals: listing.priceDecimals,
      }

  const minDstAmount = CurrencyHandler.fromRawAmount(currency, listing.pricePerToken)

  return { currency, minDstAmount }
}

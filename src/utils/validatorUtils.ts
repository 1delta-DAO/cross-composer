import { Address, isAddress } from 'viem'

export const isValidAddress = (address: string): address is Address => {
  if (!address || typeof address !== 'string') {
    return false
  }

  return isAddress(address)
}

export const isEmptyAddress = (address: string): boolean => {
  return !address || address.trim() === ''
}

export const validateNumericInput = (value: string): string => {
  if (!value) return ''

  let filtered = value.replace(/[^0-9.]/g, '')

  const parts = filtered.split('.')
  if (parts.length > 2) {
    filtered = parts[0] + '.' + parts.slice(1).join('')
  }

  return filtered
}

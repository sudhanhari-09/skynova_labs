const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  currencyDisplay: "symbol",
  maximumFractionDigits: 2,
})

const INR_FORMATTER_NO_DECIMALS = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
})

export function formatINR(value?: number | null, decimals = true): string {
  if (value == null || isNaN(Number(value))) return "\u2014"
  const formatter = decimals ? INR_FORMATTER : INR_FORMATTER_NO_DECIMALS
  return formatter.format(Number(value))
}

export function fmtMoney(v?: number | null): string {
  return `\u20B9${(Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

export const CURRENCY_CODE = "INR"
export const CURRENCY_SYMBOL = "\u20B9"
export const CURRENCY_NAME = "Indian Rupee"

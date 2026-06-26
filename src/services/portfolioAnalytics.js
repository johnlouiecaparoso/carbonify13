/**
 * Buyer portfolio analytics (backlog feature) — pure, side-effect-free.
 *
 * Computes a holder's live position: how many credits they own, what they paid
 * (cost basis), what the position is worth at the current market price, and the
 * resulting unrealized gain/loss. Retired holdings are excluded (they're spent,
 * not a tradable position). Holdings without a known purchase price still count
 * toward owned/market value but are left out of the cost-basis-based P&L so the
 * percentage stays honest.
 */

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/**
 * @param {Array<{quantity:number, purchase_price?:number, ownership_status?:string, ownership_type?:string}>} holdings
 * @param {number} marketPrice current market price per credit (e.g. market avg)
 * @returns {{
 *   ownedCredits:number, costBasis:number, marketValue:number,
 *   unrealizedPnl:number, unrealizedPnlPct:number,
 *   pricedCredits:number, unpricedCredits:number
 * }}
 */
export function computePortfolioPnl(holdings = [], marketPrice = 0) {
  const price = Math.max(Number(marketPrice) || 0, 0)
  let ownedCredits = 0
  let costBasis = 0
  let pricedCredits = 0

  for (const h of holdings || []) {
    if (h?.ownership_status === 'retired' || h?.ownership_type === 'retired') continue
    const qty = Number(h?.quantity) || 0
    if (qty <= 0) continue
    ownedCredits += qty
    const pp = Number(h?.purchase_price)
    if (pp > 0) {
      costBasis += qty * pp
      pricedCredits += qty
    }
  }

  const marketValue = ownedCredits * price
  // Fair P&L compares only the credits we have a cost basis for.
  const pricedMarketValue = pricedCredits * price
  const unrealizedPnl = round2(pricedMarketValue - costBasis)
  const unrealizedPnlPct = costBasis > 0 ? round2((unrealizedPnl / costBasis) * 100) : 0

  return {
    ownedCredits,
    costBasis: round2(costBasis),
    marketValue: round2(marketValue),
    unrealizedPnl,
    unrealizedPnlPct,
    pricedCredits,
    unpricedCredits: ownedCredits - pricedCredits,
  }
}

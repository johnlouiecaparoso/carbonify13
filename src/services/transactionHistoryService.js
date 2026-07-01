import { getSupabase } from '@/services/supabaseClient'

/**
 * Get user's complete transaction history (purchases and retirements)
 * This serves as proof of purchase and retirement history
 */
export async function getUserTransactionHistory(userId) {
  const supabase = getSupabase()

  if (!supabase) {
    console.warn('Supabase client not available')
    return { purchases: [], retirements: [] }
  }

  try {
    // Fetch purchase transactions (from credit_transactions where buyer_id = userId)
    // Also check credit_purchases as fallback if credit_transactions doesn't have data
    let purchases = []
    let purchaseError = null
    
    try {
      const { data: transactions, error: transError } = await supabase
        .from('credit_transactions')
        .select(
          `
          *,
          project_credits!inner(
            id,
            vintage_year,
            verification_standard,
            projects!inner(
              id,
              title,
              category,
              location,
              project_image
            )
          )
        `,
        )
        .eq('buyer_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (!transError && transactions) {
        purchases = transactions
        console.log('✅ Fetched purchase history from credit_transactions:', purchases.length)
      } else {
        console.warn('⚠️ Error fetching from credit_transactions:', transError)
        purchaseError = transError
      }
    } catch (err) {
      console.error('❌ Error in credit_transactions query:', err)
      purchaseError = err
    }
    
    // Fallback: If no transactions found, try credit_purchases table
    if ((!purchases || purchases.length === 0) && purchaseError) {
      console.log('🔄 Attempting fallback to credit_purchases table...')
      try {
        const { data: creditPurchases, error: purchaseTableError } = await supabase
          .from('credit_purchases')
          .select('*')
          .eq('buyer_id', userId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
        
        if (!purchaseTableError && creditPurchases && creditPurchases.length > 0) {
          console.log('✅ Found purchases in credit_purchases table:', creditPurchases.length)
          // Note: credit_purchases doesn't have project_credits relation, so we'll need to fetch separately
          // For now, we'll log this but continue with empty array
          // TODO: Implement proper fallback with project data fetching
        }
      } catch (fallbackErr) {
        console.error('❌ Error in fallback query:', fallbackErr)
      }
    }

    // Fetch certificates separately for purchases (linked via transaction_id)
    let purchaseCertificates = {}
    if (purchases && purchases.length > 0) {
      const transactionIds = purchases.map((p) => p.id)
      try {
        // Query certificates - start with minimal fields only (certificate_type column doesn't exist)
        // All certificates linked to purchase transactions are purchase certificates
        let { data: certs, error: certError } = await supabase
          .from('certificates')
          .select('id, transaction_id, certificate_number, issued_at, status')
          .in('transaction_id', transactionIds)

        // If query failed, log warning but don't show error (non-critical)
        if (certError) {
          console.warn('⚠️ Could not fetch certificates (non-critical):', certError.message)
          certs = []
          certError = null // Clear error to continue without certificates
        }

        if (!certError && certs && certs.length > 0) {
          // Create a map for quick lookup
          purchaseCertificates = certs.reduce((acc, cert) => {
            if (!acc[cert.transaction_id]) {
              acc[cert.transaction_id] = []
            }
            acc[cert.transaction_id].push(cert)
            return acc
          }, {})
          console.log('✅ Fetched certificates for purchases:', Object.keys(purchaseCertificates).length)
        } else if (certError) {
          console.warn('⚠️ Error fetching certificates:', certError)
          // Continue without certificates - purchases should still show
        } else {
          console.log('ℹ️ No certificates found for transactions:', transactionIds.length)
        }
      } catch (certErr) {
        console.error('❌ Error fetching certificates:', certErr)
        // Continue without certificates - purchases should still show
      }
    }

    // Fetch retirement records (certificates are not directly linked to retirements)
    const { data: retirements, error: retirementError } = await supabase
      .from('credit_retirements')
      .select(
        `
        *,
        projects(
          id,
          title,
          category,
          location,
          project_image
        )
      `,
      )
      .eq('user_id', userId)
      .order('retired_at', { ascending: false })

    if (retirementError) {
      console.error('Error fetching retirement history:', retirementError)
    }

    // Transform purchase data
    const purchaseHistory = (purchases || []).map((purchase) => {
      const cert = purchaseCertificates[purchase.id]?.[0] || null
      return {
        id: purchase.id,
        type: 'purchase',
        transaction_id: purchase.id,
        project_id: purchase.project_credits?.projects?.id,
        project_title: purchase.project_credits?.projects?.title || 'Unknown Project',
        project_category: purchase.project_credits?.projects?.category || 'Unknown',
        project_location: purchase.project_credits?.projects?.location || 'Unknown',
        project_image: purchase.project_credits?.projects?.project_image,
        credits_quantity: purchase.quantity,
        price_per_credit: purchase.price_per_credit,
        total_amount: purchase.total_amount,
        currency: purchase.currency || 'PHP',
        payment_method: purchase.payment_method || 'wallet',
        payment_reference: purchase.payment_reference,
        vintage_year: purchase.project_credits?.vintage_year,
        verification_standard: purchase.project_credits?.verification_standard,
        date: purchase.completed_at || purchase.created_at,
        certificate: cert,
        certificate_number: cert?.certificate_number || null,
        status: purchase.status,
      }
    })

    // Fetch retirement certificates separately (linked via retirement_id or user_id + project)
    let retirementCertificates = []
    if (retirements && retirements.length > 0) {
      const retirementIds = retirements.map((r) => r.id)
      const userId = retirements[0]?.user_id
      
      // Try to fetch certificates by retirement_id first, then by user_id and project
      const { data: certs } = await supabase
        .from('certificates')
        .select('id, retirement_id, certificate_number, issued_at, status, certificate_data')
        .or(`retirement_id.in.(${retirementIds.join(',')}),user_id.eq.${userId}`)
        .eq('certificate_type', 'retirement')

      if (certs) {
        // Create a map for quick lookup by retirement_id
        retirementCertificates = certs.reduce((acc, cert) => {
          if (cert.retirement_id) {
            if (!acc[cert.retirement_id]) {
              acc[cert.retirement_id] = []
            }
            acc[cert.retirement_id].push(cert)
          }
          return acc
        }, {})
      }
    }

    // Transform retirement data
    const retirementHistory = (retirements || []).map((retirement) => {
      const cert = retirementCertificates[retirement.id]?.[0] || null
      return {
        id: retirement.id,
        type: 'retirement',
        project_id: retirement.project_id,
        project_title: retirement.projects?.title || 'Unknown Project',
        project_category: retirement.projects?.category || 'Unknown',
        project_location: retirement.projects?.location || 'Unknown',
        project_image: retirement.projects?.project_image,
        credits_quantity: retirement.quantity,
        purpose: retirement.reason || 'Carbon Offset',
        date: retirement.retired_at || retirement.created_at,
        certificate: cert,
        certificate_number: cert?.certificate_number || null,
        status: retirement.status || 'completed',
      }
    })

    return {
      purchases: purchaseHistory,
      retirements: retirementHistory,
      all: [...purchaseHistory, ...retirementHistory].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      ),
    }
  } catch (error) {
    console.error('Error in getUserTransactionHistory:', error)
    return { purchases: [], retirements: [], all: [] }
  }
}

/**
 * Get purchase history only
 */
export async function getUserPurchaseHistory(userId) {
  const history = await getUserTransactionHistory(userId)
  return history.purchases
}

/**
 * Server-side paginated purchase history (Phase 3 — scale).
 *
 * Unlike getUserTransactionHistory (which loads everything and sorts in the
 * client), this pages at the database with `.range()` and returns the total row
 * count so callers can render pagination without fetching every row. Ordering
 * and filtering happen in SQL, served by the composite index
 * `credit_transactions (buyer_id, status, completed_at desc)`.
 *
 * @param {{ userId: string, limit?: number, offset?: number, status?: string }} args
 * @returns {Promise<{ rows: object[], total: number, limit: number, offset: number }>}
 */
export async function getUserPurchaseHistoryPage({ userId, limit = 20, offset = 0, status = 'completed' } = {}) {
  const supabase = getSupabase()
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const safeOffset = Math.max(Number(offset) || 0, 0)
  const empty = { rows: [], total: 0, limit: safeLimit, offset: safeOffset }

  if (!supabase || !userId) return empty

  let query = supabase
    .from('credit_transactions')
    .select(
      `
      id, quantity, price_per_credit, total_amount, currency, status,
      payment_method, payment_reference, created_at, completed_at,
      project_credits!inner(
        id, vintage_year, verification_standard,
        projects!inner(id, title, category, location, project_image)
      )
    `,
      { count: 'exact' },
    )
    .eq('buyer_id', userId)

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query
    .order('completed_at', { ascending: false, nullsFirst: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  if (error) {
    console.warn('getUserPurchaseHistoryPage failed:', error.message)
    return empty
  }

  // Attach purchase certificates for just this page of rows (linked via
  // transaction_id), mirroring getUserTransactionHistory so the paginated list
  // can show the same "View Certificate" affordance. Non-critical: on failure
  // rows still render, just without a certificate.
  let certsByTransaction = {}
  const pageIds = (data || []).map((p) => p.id)
  if (pageIds.length) {
    try {
      const { data: certs, error: certError } = await supabase
        .from('certificates')
        .select('id, transaction_id, certificate_number, issued_at, status')
        .in('transaction_id', pageIds)
      if (certError) {
        console.warn('getUserPurchaseHistoryPage certificates (non-critical):', certError.message)
      } else {
        certsByTransaction = (certs || []).reduce((acc, cert) => {
          if (!acc[cert.transaction_id]) acc[cert.transaction_id] = cert
          return acc
        }, {})
      }
    } catch (certErr) {
      console.warn('getUserPurchaseHistoryPage certificates (non-critical):', certErr?.message)
    }
  }

  const rows = (data || []).map((p) => {
    const cert = certsByTransaction[p.id] || null
    return {
      id: p.id,
      transaction_id: p.id,
      project_id: p.project_credits?.projects?.id,
      project_title: p.project_credits?.projects?.title || 'Unknown Project',
      project_category: p.project_credits?.projects?.category || 'Unknown',
      project_location: p.project_credits?.projects?.location || 'Unknown',
      project_image: p.project_credits?.projects?.project_image,
      credits_quantity: p.quantity,
      price_per_credit: p.price_per_credit,
      total_amount: p.total_amount,
      currency: p.currency || 'PHP',
      payment_method: p.payment_method || 'wallet',
      payment_reference: p.payment_reference,
      vintage_year: p.project_credits?.vintage_year,
      verification_standard: p.project_credits?.verification_standard,
      date: p.completed_at || p.created_at,
      certificate: cert,
      certificate_number: cert?.certificate_number || null,
      status: p.status,
    }
  })

  return { rows, total: Number(count) || 0, limit: safeLimit, offset: safeOffset }
}

/**
 * Get retirement history only
 */
export async function getUserRetirementHistory(userId) {
  const history = await getUserTransactionHistory(userId)
  return history.retirements
}


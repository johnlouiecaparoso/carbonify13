/**
 * Fulfillment saga (Phase 3) — purchase → placeOrder → retire, with
 * refund-on-failure compensation.
 *
 * Runs AFTER `process_marketplace_purchase` has committed (txn + ownership +
 * escrow). It is a pure, dependency-injected orchestration module so it can be
 * unit-tested against a fake supabase + MockCreditSupplier, and so the
 * paymongo-webhook Edge Function can mirror it line-for-line in TS.
 *
 * State machine (table public.supplier_orders, keyed transaction_id UNIQUE so
 * webhook retries resume instead of double-ordering):
 *   pending → ordered → retired
 *   failed / refunded are terminal compensation states.
 *
 * On any supplier failure the saga never throws — it marks the order failed,
 * calls the idempotent `refund_purchase` RPC (restores inventory, refunds
 * escrow, reverses the ledger, marks txn/ownership refunded) and returns
 * { status: 'refunded' }.
 */

const MAX_ATTEMPTS = 3

async function ensureOrderRow(supabase, { transactionId, certificateId, quantity, supplierId }) {
  await supabase.from('supplier_orders').upsert(
    {
      transaction_id: transactionId,
      certificate_id: certificateId ?? null,
      quantity,
      supplier_id: supplierId,
      status: 'pending',
    },
    { onConflict: 'transaction_id', ignoreDuplicates: true },
  )

  const { data, error } = await supabase
    .from('supplier_orders')
    .select('*')
    .eq('transaction_id', transactionId)
    .single()
  if (error) throw new Error(`supplier_orders lookup failed: ${error.message}`)
  return data
}

async function patchOrder(supabase, transactionId, patch) {
  const { data, error } = await supabase
    .from('supplier_orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('transaction_id', transactionId)
    .select('*')
    .single()
  if (error) throw new Error(`supplier_orders update failed: ${error.message}`)
  return data
}

async function defaultAttachRegistry(supabase, certificateId, info) {
  const { attachRegistryInfo } = await import('@/services/certificateService')
  return attachRegistryInfo(supabase, certificateId, info)
}

async function compensate(supabase, transactionId, reason) {
  await patchOrder(supabase, transactionId, { status: 'failed', last_error: reason })
  const { error } = await supabase.rpc('refund_purchase', {
    p_transaction_id: transactionId,
    p_reason: `Auto-refund (supplier fulfillment): ${reason}`,
  })
  if (error) {
    // The refund itself failed — leave the order 'failed' for manual review.
    return { status: 'failed', error: reason, refundError: error.message }
  }
  const updated = await patchOrder(supabase, transactionId, { status: 'refunded' })
  return { status: 'refunded', supplierOrderId: updated?.supplier_order_id ?? null, error: reason }
}

/**
 * @param {Object} args
 * @param {Object} args.supabase                 supabase-js client (service role server-side).
 * @param {import('./CreditSupplier').CreditSupplier} args.supplier
 * @param {string} args.transactionId            credit_transactions.id (idempotency key).
 * @param {number} args.quantity
 * @param {number} [args.vintageYear]
 * @param {Object} [args.projectMeta]
 * @param {string|null} [args.certificateId]
 * @param {Function} [args.attachRegistry]       (supabase, certificateId, {registrySerial, registryReceiptUrl}) => Promise. Injectable for tests.
 * @returns {Promise<{status:'retired'|'refunded'|'failed', supplierOrderId?:string|null, registrySerial?:string|null, retirementReceiptUrl?:string|null, error?:string}>}
 */
export async function runFulfillment({
  supabase,
  supplier,
  transactionId,
  quantity,
  vintageYear,
  projectMeta = {},
  certificateId = null,
  attachRegistry = defaultAttachRegistry,
}) {
  let order = await ensureOrderRow(supabase, {
    transactionId,
    certificateId,
    quantity,
    supplierId: supplier.id,
  })

  // Idempotent terminal states (webhook retry on an already-finished order).
  if (order.status === 'retired' || order.status === 'refunded') {
    return {
      status: order.status,
      supplierOrderId: order.supplier_order_id,
      registrySerial: order.registry_serial,
      retirementReceiptUrl: order.retirement_receipt_url,
    }
  }

  if ((order.attempts ?? 0) >= MAX_ATTEMPTS) {
    return { status: 'failed', error: 'max fulfillment attempts exceeded', supplierOrderId: order.supplier_order_id }
  }

  // Step 1 — place the order (skip if a prior run already reached 'ordered').
  if (order.status === 'pending' || order.status === 'failed') {
    try {
      const placed = await supplier.placeOrder({
        referenceId: transactionId,
        quantity,
        vintageYear,
        projectMeta,
      })
      order = await patchOrder(supabase, transactionId, {
        status: 'ordered',
        supplier_order_id: placed.orderId,
        supplier_id: supplier.id,
        registry_serial: placed.registrySerial ?? null,
        attempts: (order.attempts ?? 0) + 1,
      })
    } catch (err) {
      return compensate(supabase, transactionId, err?.message || 'placeOrder failed')
    }
  }

  // Step 2 — retire the order.
  try {
    const retired = await supplier.retire(order.supplier_order_id)
    order = await patchOrder(supabase, transactionId, {
      status: 'retired',
      registry_serial: retired.registrySerial ?? order.registry_serial,
      retirement_receipt_url: retired.retirementReceiptUrl ?? null,
    })
  } catch (err) {
    return compensate(supabase, transactionId, err?.message || 'retire failed')
  }

  // Step 3 — persist registry info onto the certificate. Non-critical: a cert
  // write hiccup must NOT refund a successfully-retired credit.
  if (certificateId) {
    try {
      await attachRegistry(supabase, certificateId, {
        registrySerial: order.registry_serial,
        registryReceiptUrl: order.retirement_receipt_url,
      })
    } catch (err) {
      console.error('[fulfillmentSaga] attachRegistryInfo failed (non-critical):', err?.message)
    }
  }

  return {
    status: 'retired',
    supplierOrderId: order.supplier_order_id,
    registrySerial: order.registry_serial,
    retirementReceiptUrl: order.retirement_receipt_url,
  }
}

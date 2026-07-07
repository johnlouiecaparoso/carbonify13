/**
 * localStorage keys coordinating the cart's sequential checkout across the
 * PayMongo redirect. CartView sets them before redirecting; PaymentCallbackView
 * reads them on a successful payment to remove the paid item and resume.
 */
export const CART_CHECKOUT_ACTIVE = 'ecolink_cart_checkout_active'
export const CART_PENDING_LISTING = 'ecolink_cart_pending_listing'

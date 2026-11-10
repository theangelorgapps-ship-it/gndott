// Shared checkout error type — safe to import from client-bundled modules
// (validators run on both sides), unlike the .server checkout module.
export class CheckoutError extends Error {}
export function checkoutError(error: unknown) {
  return error instanceof CheckoutError ? error.message : 'Checkout is temporarily unavailable. Please try again.'
}

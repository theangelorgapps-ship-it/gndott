import { createFileRoute } from '@tanstack/react-router'
import { handleSubscriptionWebhook } from '../lib/subscriptionCheckout.server'

export const Route = createFileRoute('/api/stripe-webhook')({
  server: { handlers: { POST: ({ request }) => handleSubscriptionWebhook(request) } },
})

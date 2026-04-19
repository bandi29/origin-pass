import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaddleWebhook } from '@/lib/paddle-webhook'

type PaddleSubscriptionEvent = {
    event_type: 'subscription.created' | 'subscription.updated'
    data: {
        customer_id: string
        status: string
        id: string
    }
}

const isPaddleSubscriptionEvent = (value: unknown): value is PaddleSubscriptionEvent => {
    if (!value || typeof value !== 'object') return false
    const event = value as PaddleSubscriptionEvent
    return (
        (event.event_type === 'subscription.created' ||
            event.event_type === 'subscription.updated') &&
        typeof event.data?.customer_id === 'string' &&
        typeof event.data?.status === 'string' &&
        typeof event.data?.id === 'string'
    )
}

export async function POST(req: Request) {
    const signature = (await headers()).get('Paddle-Signature') || ''
    const body = await req.text()

    if (!signature) {
        return new Response('Missing Signature', { status: 400 })
    }

    const secretKey = process.env.PADDLE_WEBHOOK_SECRET
    if (!secretKey) {
        console.error('[Paddle Webhook] PADDLE_WEBHOOK_SECRET not configured')
        return new Response('Server misconfigured', { status: 500 })
    }

    if (!verifyPaddleWebhook(body, signature, secretKey)) {
        return new Response('Invalid Signature', { status: 401 })
    }

    let event: unknown
    try {
        event = JSON.parse(body)
    } catch {
        return new Response('Invalid Webhook', { status: 400 })
    }

    const supabase = createAdminClient()

    if (isPaddleSubscriptionEvent(event)) {
        const subscription = event.data
        const customerId = subscription.customer_id
        const status = subscription.status
        const subscriptionId = subscription.id

        // Sync to profile. We need to find profile by paddle_customer_id or user metadata
        const { error } = await supabase
            .from('profiles')
            .update({
                subscription_status: status,
                paddle_subscription_id: subscriptionId
            })
            .eq('paddle_customer_id', customerId)

        if (error) console.error('Supabase update failed', error)
    }

    return new Response('OK', { status: 200 })
}

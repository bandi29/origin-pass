import { Environment, Paddle } from '@paddle/paddle-node-sdk'

export const paddle = new Paddle(process.env.PADDLE_API_KEY ?? 'api_test_placeholder', {
    environment: Environment.sandbox, // or production
})

export async function reportUsage(subscriptionId: string, quantity: number) {
    if (!subscriptionId) return
    try {
        // Currently Paddle Billing API V2 usage reporting is different from classic.
        // Assuming custom logic or just logging for now as metered billing setup varies.
        // In a real implementation, you might adjust a subscription modifier or post an event.
        console.log(`Reporting usage to Paddle: Sub ${subscriptionId}, +${quantity} items`)

        // Example: Update subscription or post to usage endpoint if available (Varies by Paddle implementation)
        // await paddle.adjustments.create({ ... }) 
    } catch (error) {
        console.error('Paddle usage report failed:', error, { subscriptionId, quantity })
    }
}

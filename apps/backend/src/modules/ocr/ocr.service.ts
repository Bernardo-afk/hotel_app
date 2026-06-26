import Anthropic from '@anthropic-ai/sdk';

export async function extractAmount(
  imageBase64: string,
  mediaType: string,
): Promise<{ amount: number; confidence: 'HIGH' | 'LOW' }> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Extract the total amount from this receipt. Respond with JSON only: {"amount": <number>, "confidence": "HIGH" or "LOW"}',
            },
          ],
        },
      ],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const parsed = JSON.parse(text) as { amount: number; confidence: 'HIGH' | 'LOW' };
    return { amount: parsed.amount, confidence: parsed.confidence };
  } catch {
    return { amount: 0, confidence: 'LOW' };
  }
}

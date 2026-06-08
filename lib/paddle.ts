import { Environment, Paddle } from '@paddle/paddle-node-sdk';

let _paddle: Paddle | null = null;

export function getPaddle(): Paddle {
  if (_paddle) return _paddle;
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error('PADDLE_API_KEY is not set');

  _paddle = new Paddle(apiKey, {
    environment:
      process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
        ? Environment.production
        : Environment.sandbox,
  });
  return _paddle;
}

export function priceId(): string {
  const id = process.env.PADDLE_PRICE_ID;
  if (!id) throw new Error('PADDLE_PRICE_ID is not set');
  return id;
}

import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import {
  cancelCheckout,
  CheckoutValidationError,
  createCheckout,
  findByReference,
  parseCheckoutInput,
  type CreateContext,
} from './checkouts';
import type { PspConfig } from './config';
import type { CheckoutStore } from './store';
import { CheckoutInput } from './types';

const sendError = (res: Response, status: number, code: string, message: string): void => {
  res.status(status).json({ error: { code, message } });
};

const requireApiKey =
  (apiKey: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const expected = Buffer.from(`Bearer ${apiKey}`);
    const actual = Buffer.from(req.get('authorization') ?? '');
    // Constant-time compare so the key cannot be guessed byte by byte from response times
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      sendError(res, 401, 'UNAUTHORIZED', 'Missing or invalid API key');
      return;
    }
    next();
  };

export const createApp = (
  config: PspConfig,
  store: CheckoutStore,
  now: () => Date = () => new Date(),
) => {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  const api = express.Router();
  api.use(requireApiKey(config.apiKey));

  api.get('/checkouts/:id', (req, res) => {
    const checkout = store.checkouts.get(req.params.id);
    if (!checkout) {
      sendError(res, 404, 'CHECKOUT_NOT_FOUND', 'Checkout not found');
      return;
    }
    res.json(checkout);
  });

  api.post('/checkouts', (req, res) => {
    const idempotencyKey = req.get('idempotency-key');
    if (!idempotencyKey) {
      sendError(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
      return;
    }

    let input: CheckoutInput;
    try {
      input = parseCheckoutInput(req.body);
    } catch (error) {
      if (error instanceof CheckoutValidationError) {
        sendError(res, 400, 'VALIDATION_FAILED', error.message);
        return;
      }
      throw error;
    }

    const ctx: CreateContext = {
      now: now(),
      publicUrl: config.publicUrl,
      ttlSeconds: config.checkoutTtlSeconds,
    };
    const result = createCheckout(store, String(idempotencyKey), input, ctx);
    switch (result.kind) {
      case 'created':
        res.status(201).json(result.checkout);
        return;
      case 'replayed':
        res.status(200).json(result.checkout);
        return;
      case 'conflict':
        sendError(
          res,
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'This idempotency key was already used for a different request',
        );
        return;
    }
  });

  api.get('/checkouts', (req, res) => {
    const { reference } = req.query;
    if (typeof reference !== 'string' || reference === '') {
      sendError(res, 400, 'VALIDATION_FAILED', 'reference is required');
      return;
    }

    res.status(200).json({ data: findByReference(store, reference) });
  });

  api.post('/checkouts/:id/cancel', (req, res) => {
    const result = cancelCheckout(store, req.params.id, now());
    switch (result.kind) {
      case 'cancelled':
        res.status(200).json(result.checkout);
        return;
      case 'not_open':
        sendError(res, 409, 'CHECKOUT_NOT_OPEN', 'Checkout not open');
        return;
      case 'not_found':
        sendError(res, 404, 'CHECKOUT_NOT_FOUND', 'Checkout not found');
        return;
    }
  });

  app.use('/v1', api);
  return app;
};

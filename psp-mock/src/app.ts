import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import {
  cancelCheckout,
  CheckoutValidationError,
  createCheckout,
  findByReference,
  isOpen,
  parseCheckoutInput,
  parsePayRequest,
  payCheckout,
  type PayRequest,
  type CreateContext,
} from './checkouts';
import { loadConfig, type PspConfig } from './config';
import type { CheckoutStore } from './store';
import type { CheckoutInput } from './types';
import { renderCheckoutPage } from './checkout-page';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    const result = createCheckout(store, idempotencyKey, input, ctx);
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

  app.get('/checkout/:id', (req, res) => {
    const checkout = store.checkouts.get(req.params.id);
    if (!checkout) {
      res.status(404).type('html').send('<p>Checkout not found</p>');
      return;
    }

    const open = isOpen(checkout, now());
    const embedded = req.query.embedded === '1';

    res.type('html').send(renderCheckoutPage(checkout, open, embedded));
  });

  app.post('/checkout/:id/pay', (req, res) => {
    let request: PayRequest;
    try {
      request = parsePayRequest(req.body);
    } catch (error) {
      if (error instanceof CheckoutValidationError) {
        sendError(res, 400, 'VALIDATION_FAILED', error.message);
        return;
      }
      throw error;
    }

    const result = payCheckout(store, req.params.id, request.outcome, now());
    switch (result.kind) {
      case 'processed':
        res.status(200).json(result.checkout);
        // TODO(week 6): send the webhook using request.duplicateWebhook / delaySeconds / suppressWebhook
        return;
      case 'not_open':
        sendError(res, 409, 'CHECKOUT_NOT_OPEN', 'Checkout not open');
        return;
      case 'not_found':
        sendError(res, 404, 'CHECKOUT_NOT_FOUND', 'Checkout not found');
        return;
    }
  });

  // Read once when the app is created, not on every request
  const widgetScript = readFileSync(join(__dirname, '..', 'public', 'widget.js'), 'utf8')
    // Fill in the value only the server knows
    .replace('__PSP_ORIGIN__', new URL(config.publicUrl).origin);

  app.get('/widget.js', (_req, res) => {
    res.type('application/javascript').send(widgetScript);
  });

  const demoPage = readFileSync(join(__dirname, '..', 'public', 'demo.html'), 'utf8');

  app.get('/demo', (_req, res) => {
    res.type('html').send(demoPage);
  });

  return app;
};

import express from 'express';
import type { PspConfig } from './config';
import type { CheckoutStore } from './store';

// TODO(step 4): API key middleware and /v1 routes
export const createApp = (_config: PspConfig, _store: CheckoutStore) => express();

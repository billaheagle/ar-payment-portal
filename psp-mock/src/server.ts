import { createApp } from './app';
import { loadConfig } from './config';
import { createStore } from './store';
import { expireCheckouts } from './checkouts';

const config = loadConfig();
const store = createStore();

createApp(config, store).listen(config.port, () => {
  console.log(`Mock PSP listening on ${config.publicUrl}`);
});

// Every 10 s, OPEN checkouts past expiresAt become EXPIRED (spec 11.3).
// unref() so the timer alone never keeps the process alive.
setInterval(() => {
  expireCheckouts(store, new Date());
  // TODO(week 6): send a checkout.expired webhook for each returned checkout
}, 10_000).unref();

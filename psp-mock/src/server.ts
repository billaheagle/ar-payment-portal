import { createApp } from './app';
import { loadConfig } from './config';
import { createStore } from './store';

const config = loadConfig();
const store = createStore();

createApp(config, store).listen(config.port, () => {
  console.log(`Mock PSP listening on ${config.publicUrl}`);
});

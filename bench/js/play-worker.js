import init, * as m from '../pkg-web/nona_bridge.js';
import { play } from './play-core.mjs';

self.onmessage = async ({ data: { puzzle } }) => {
  await init();
  self.postMessage(play(m, puzzle, () => performance.now()));
};

export {
  startStream,
  addSubscription,
  removeSubscription,
} from "./src/stream.js";

import start from "./start.js";

export default start;

if (import.meta.url?.endsWith("/farcaster/index.ts")) {
  await start();
}

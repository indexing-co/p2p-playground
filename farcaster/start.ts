import { CastAddData, GossipMessage, MessageType } from "@farcaster/hub-nodejs";

import { startStream, addSubscription } from "./src/stream.js";
import { hashToHexHash } from "./src/utils.js";
import { CastDataToStore } from "./src/types.js";
import { getDB, initDB } from "./src/db.js";

const BATCH_SIZE = 1000;
const SEEN_HASHES = new Set<string>();
const TO_STORE: CastDataToStore[] = [];

async function batchWriter() {
  const batch = TO_STORE.splice(0, BATCH_SIZE);

  if (batch.length > 0) {
    setTimeout(() => {
      batch.forEach((b) => {
        SEEN_HASHES.delete(b.hash);
      });
    }, 5000);

    await getDB().into("casts").insert(batch).onConflict().ignore();
    console.log(
      `[${new Date().toISOString()}] Wrote batch with`,
      batch.length,
      "records"
    );
  }

  setTimeout(batchWriter, 100);
}

export default async function start() {
  await initDB();

  await addSubscription(MessageType["CAST_ADD"], (msg) => {
    const {
      message: { data, hash },
    } = GossipMessage.toJSON(msg) as {
      message: { data: CastAddData; hash: string };
    };

    const upsertData: CastDataToStore = {
      hash: hashToHexHash(hash) as string,
      timestamp: new Date(1609459200000 + data.timestamp * 1000).toISOString(),
      fid: data.fid,
      text: data.castAddBody.text,
      parentCastFid: data.castAddBody.parentCastId?.fid,
      parentCastHash: hashToHexHash(
        data.castAddBody.parentCastId?.hash?.toString()
      ),
      rawCastAddBody: JSON.stringify(data.castAddBody),
    };

    if (!SEEN_HASHES.has(upsertData.hash)) {
      SEEN_HASHES.add(upsertData.hash);
      TO_STORE.push(upsertData);
    }
  });

  await batchWriter();
  await startStream();
  console.log("Stream is live 🔥");
}

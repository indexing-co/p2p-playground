import { GossipMessage, Message, MessageType } from "@farcaster/hub-nodejs";
import { bootstrap } from "@libp2p/bootstrap";
import { createLibp2p } from "libp2p";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { identify } from "@libp2p/identify";
import { mdns } from "@libp2p/mdns";
import { mplex } from "@libp2p/mplex";
import { multiaddr } from "@multiformats/multiaddr";
import { noise } from "@chainsafe/libp2p-noise";
import { tcp } from "@libp2p/tcp";

import { BOOTSTRAP_NODES, VALID_TOPICS, getUniqMsgId } from "./utils.js";

type FarcasterMessageHandler = (
  farcasterMsg: GossipMessage
) => void | Promise<void>;

const SUBSCRIPTIONS: {
  [key in MessageType]?: Record<string, FarcasterMessageHandler>;
} = {};

async function handleMessage(farcasterMsg: GossipMessage) {
  if (Array.isArray(farcasterMsg?.messageBundle?.messages)) {
    await Promise.all(
      farcasterMsg?.messageBundle?.messages.map((message) =>
        handleMessage({ message } as GossipMessage)
      )
    );
    return;
  }

  const msgType = farcasterMsg?.message?.data?.type as MessageType;
  if (SUBSCRIPTIONS[msgType]) {
    await Promise.all(
      Object.values(SUBSCRIPTIONS[msgType] || {}).map(async (handler) => {
        try {
          await handler(farcasterMsg);
        } catch (err) {
          console.error(err as Error);
        }
      })
    );
  }
}

export async function startStream() {
  const node = await createLibp2p({
    transports: [tcp()],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    peerDiscovery: [
      mdns({ interval: 1000 }),
      bootstrap({
        list: BOOTSTRAP_NODES,
        timeout: 1000,
        tagName: "bootstrap",
        tagValue: 50,
        tagTTL: 120000,
      }),
    ],
    services: {
      identify: identify(),
      pubsub: gossipsub({
        emitSelf: false,
        msgIdFn: (rawMsg) => getUniqMsgId(rawMsg.topic, rawMsg.data),
        directPeers: [],
        canRelayMessage: true,
      }),
    },
  });

  node.services.pubsub.addEventListener("gossipsub:message", (rawMsg) => {
    const farcasterMsg = GossipMessage.decode(rawMsg.detail.msg.data);
    handleMessage(farcasterMsg);
  });
  node.services.pubsub.addEventListener("message", (rawMsg) => {
    const farcasterMsg = GossipMessage.decode(rawMsg.detail.data);
    handleMessage(farcasterMsg);
  });

  await node.start();

  console.log("Started with peer ID", node.peerId);

  for (const addr of BOOTSTRAP_NODES) {
    void node
      .dial(multiaddr(addr))
      .then(() => console.log("Connected to peer", addr))
      .catch((e) =>
        console.error("Failed dialing", addr, "error:", (e as Error).message)
      );
  }

  for (const topic of VALID_TOPICS) {
    node.services.pubsub.subscribe(topic);
  }
}

export function addSubscription(
  msgType: MessageType,
  handler: FarcasterMessageHandler
): string {
  const id = `sub-${msgType}-${Math.random()}`;
  if (!SUBSCRIPTIONS[msgType]) {
    SUBSCRIPTIONS[msgType] = {};
  }
  (SUBSCRIPTIONS[msgType] as Record<string, FarcasterMessageHandler>)[id] =
    handler;
  return id;
}

export function removeSubscription(msgType: MessageType, id: string) {
  if (!SUBSCRIPTIONS[msgType]) {
    return;
  }
  delete (SUBSCRIPTIONS[msgType] as Record<string, FarcasterMessageHandler>)[
    id
  ];
}

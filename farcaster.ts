import { createLibp2p } from "libp2p";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { tcp } from "@libp2p/tcp";
import { mplex } from "@libp2p/mplex";
import { noise } from "@chainsafe/libp2p-noise";
import { multiaddr } from "@multiformats/multiaddr";
import { bootstrap } from "@libp2p/bootstrap";
import { mdns } from "@libp2p/mdns";
import { identify } from "@libp2p/identify";
import Web3 from "web3";
import {
  GossipMessage,
  GossipVersion,
  MessageType,
} from "@farcaster/hub-nodejs";

type FarcasterMessageHandler = (
  farcasterMsg: GossipMessage
) => void | Promise<void>;

const BOOTSTRAP_NODES = [
  "/dns/hoyt.farcaster.xyz/tcp/2282",
  "/dns/lamia.farcaster.xyz/tcp/2282",
  "/dns/nemes.farcaster.xyz/tcp/2282",
];
const VALID_TOPICS = ["f_network_1_primary", "f_network_1_contact_info"];

const SUBSCRIPTIONS: {
  [key in MessageType]?: Record<string, FarcasterMessageHandler>;
} = {};

function getUniqMsgId(topic: string, data: Uint8Array) {
  if (topic.includes(VALID_TOPICS[0])) {
    const farcasterMsg = GossipMessage.decode(data);
    if (farcasterMsg && farcasterMsg.version === GossipVersion.V1_1) {
      if (farcasterMsg.message !== undefined) {
        return farcasterMsg.message?.hash ?? new Uint8Array();
      }
    }
  }
  return Buffer.from(Web3.utils.sha3(data) as string);
}

async function handleMessage(farcasterMsg: GossipMessage) {
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

export async function start() {
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
      .catch((e) => console.error("Failed dialing", addr, "error:", e));
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

await start();
await addSubscription(MessageType["CAST_ADD"], (msg) =>
  console.log(JSON.stringify(GossipMessage.toJSON(msg), null, 2))
);

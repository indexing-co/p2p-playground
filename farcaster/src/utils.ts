import { GossipMessage, GossipVersion } from "@farcaster/hub-nodejs";
import Web3 from "web3";

// https://github.com/farcasterxyz/hub-monorepo/blob/a5ed0199bd3a0f78382b319117d3a7cf57bb6d81/apps/hubble/src/bootstrapPeers.mainnet.ts
export const BOOTSTRAP_NODES = [
  "/dns/hoyt.farcaster.xyz/tcp/2282",
  "/dns/lamia.farcaster.xyz/tcp/2282",
  "/dns/nemes.farcaster.xyz/tcp/2282",
  "/dns/bootstrap.neynar.com/tcp/2282",
  "/dns/192.168.50.238/tcp/2282",
];

export const VALID_TOPICS = ["f_network_1_primary", "f_network_1_contact_info"];

export function getUniqMsgId(topic: string, data: Uint8Array) {
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

export function hashToHexHash(hash?: string) {
  if (!hash) {
    return hash;
  }

  if (hash.startsWith("0x")) {
    return hash;
  }

  return "0x" + Buffer.from(hash, "base64").toString("hex");
}

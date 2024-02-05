import { GossipMessage } from "@farcaster/hub-nodejs";

export type FarcasterMessageHandler = (
  farcasterMsg: GossipMessage
) => void | Promise<void>;

export type CastDataToStore = {
  hash: string;
  timestamp: string;
  fid: number;
  text: string;
  parentCastFid?: number;
  parentCastHash?: string;
  rawCastAddBody: string;
};

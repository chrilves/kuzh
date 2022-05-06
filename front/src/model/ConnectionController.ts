import { MemberEvent } from "./events/MemberEvent";

export default interface ConnectionController {
  close(): void;
  sendEvent(event: MemberEvent): void;
}

export type ConnectionStatus = "handshake" | "established" | "terminated";

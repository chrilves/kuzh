import { MemberEvent } from "./MemberEvent";

export default interface ConnectionController {
  close(): void;
  sendEvent(event: MemberEvent): void;
}

export type ConnectionStatus = "handshake" | "established";

import { MemberEvent } from "./events/MemberEvent";

export default interface ConnectionController {
  id: string;
  close(error: string | null): void;
  sendEvent(event: MemberEvent): void;
}

export type ConnectionStatus = "handshake" | "established" | "terminated";

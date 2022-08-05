import { Membership, Fingerprint, IdentityProof } from "../model/Crypto";
import { AssemblyEvent } from "../model/events/AssemblyEvent";
import ConnectionController, {
  ConnectionStatus,
} from "../model/ConnectionController";
import { ConnectionEvent } from "../model/events/ConnectionEvent";
import { Handshake } from "../model/Handshake";
import { MemberEvent } from "../model/events/MemberEvent";
import {
  JSONNormalizedStringify,
  JSONNormalizedStringifyD,
} from "../lib/JSONNormalizedStringify";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";

export interface BackAPI {
  createAssembly(name: string): Promise<AssemblyInfo>;
  assemblyName(id: string, secret: string): Promise<string>;
  identityProof(
    assembly: AssemblyInfo,
    member: Fingerprint
  ): Promise<IdentityProof>;
  connect(
    membership: Membership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController>;
}

export class RealBackAPI implements BackAPI {
  readonly baseURL: string;
  readonly authHeader = "X-KUZH-ASSEMBLY-SECRET";

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.createAssembly = this.createAssembly.bind(this);
    this.assemblyName = this.assemblyName.bind(this);
    this.identityProof = this.identityProof.bind(this);
    this.connect = this.connect.bind(this);
  }

  async createAssembly(name: string): Promise<AssemblyInfo> {
    const myHeaders: Headers = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Content-Type", "application/json");

    const init: RequestInit = {
      method: "POST",
      headers: myHeaders,
      body: JSONNormalizedStringify(name),
      mode: "cors",
      cache: "no-cache",
    };

    const request: Request = new Request(`${this.baseURL}/assembly`);
    const response: Response = await fetch(request, init);
    return await response.json();
  }

  async assemblyName(id: string, secret: string): Promise<string> {
    const myHeaders: Headers = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append(this.authHeader, secret);

    const init: RequestInit = {
      method: "GET",
      headers: myHeaders,
      mode: "cors",
      cache: "no-cache",
    };

    const request: Request = new Request(`${this.baseURL}/assembly/${id}/name`);
    const response: Response = await fetch(request, init);
    return await response.json();
  }

  async identityProof(
    assembly: AssemblyInfo,
    member: Fingerprint
  ): Promise<IdentityProof> {
    const myHeaders: Headers = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append(this.authHeader, assembly.secret);

    const init: RequestInit = {
      method: "GET",
      headers: myHeaders,
      mode: "cors",
      cache: "no-cache",
    };

    const request: Request = new Request(
      `${this.baseURL}/assembly/${assembly.id}/identity_proof/${member}`
    );
    const response: Response = await fetch(request, init);
    const identitySerial = await response.json();
    const identity = await IdentityProof.fromJson(identitySerial);
    if (await identity.isValid()) {
      console.log(
        `Valid identity proof for member ${identity.nickname.value} of fingerprint ${identity.fingerprint}.`
      );
      return identity;
    } else {
      console.log(
        `Invalid identity proof for member ${identity.nickname.value} of fingerprint ${identity.fingerprint}.`
      );
      throw new Error(
        `Invalid identity proof for member ${identity.nickname.value} of fingerprint ${identity.fingerprint}.`
      );
    }
  }

  async connect(
    membership: Membership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController> {
    const assemblyUrl = `${this.baseURL.replace("http", "ws")}/connect`;
    let status: ConnectionStatus = "handshake";
    const socket = new WebSocket(assemblyUrl);

    const controller: ConnectionController = new (class
      implements ConnectionController
    {
      close(): void {
        updateConnection(ConnectionEvent.closed);
        socket.close();
      }
      sendEvent(event: MemberEvent): void {
        socket.send(JSONNormalizedStringifyD(event));
      }
    })();

    socket.onopen = (e: Event) => {
      updateConnection(ConnectionEvent.opened);
      socket.send(
        JSONNormalizedStringifyD(
          Handshake.credentials(membership.assembly, membership.me.fingerprint)
        )
      );
    };

    socket.onmessage = async (msg: MessageEvent) => {
      switch (status) {
        case "handshake":
          const message: Handshake = JSON.parse(msg.data);
          switch (message.tag) {
            case "challenge":
              const response = await Handshake.replyToChallenge(
                membership,
                message
              );
              socket.send(JSONNormalizedStringifyD(response));
              break;

            case "challenge_response":
              updateConnection(
                ConnectionEvent.error(
                  "Protocol Error: received challenge_response.",
                  true
                )
              );
              break;

            case "credentials":
              updateConnection(
                ConnectionEvent.error(
                  "Protocol Error: received credentials.",
                  true
                )
              );
              break;

            case "error":
              updateConnection(
                ConnectionEvent.error(message.error, message.fatal)
              );
              break;

            case "established":
              updateConnection(ConnectionEvent.established);
              status = "established";
              break;
          }
          break;

        case "established":
          const event: AssemblyEvent = JSON.parse(msg.data);
          updateAssembly(event);
          break;
      }
    };

    socket.onclose = (ce: CloseEvent) => {
      updateConnection(ConnectionEvent.closed);
    };

    socket.onerror = (e: Event) => {
      updateConnection(ConnectionEvent.error(`${e}`, true));
      controller.close();
    };

    return controller;
  }
}

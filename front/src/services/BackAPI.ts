import { Base64URL } from "../lib/Base64URL";
import {
  AssemblyInfo,
  CryptoMe,
  CryptoMembership,
  Fingerprint,
  IdentityProof,
} from "../model/Crypto";
import { AssemblyEvent } from "../model/PublicEvent";
import ConnectionController, {
  ConnectionStatus,
} from "../model/ConnectionController";
import { ConnectionEvent } from "../model/ConnectionEvent";
import { Handshake } from "../model/Handshake";

export interface BackAPI {
  createAssembly(name: string): Promise<AssemblyInfo>;
  assemblyName(id: string, secret: string): Promise<string>;
  identityProofs(
    assembly: AssemblyInfo,
    members: Set<Fingerprint>
  ): Promise<Array<IdentityProof>>;
  connect(
    cryptoMembership: CryptoMembership,
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
    this.identityProofs = this.identityProofs.bind(this);
    this.connect = this.connect.bind(this);
  }

  async createAssembly(name: string): Promise<AssemblyInfo> {
    const myHeaders: Headers = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Content-Type", "application/json");

    const init: RequestInit = {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify(name),
      mode: "cors",
      cache: "no-cache",
    };

    const request: Request = new Request(`${this.baseURL}/assembly`);
    console.log(`Sending assembly creation request to ${request}`);
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

  async identityProofs(
    assembly: AssemblyInfo,
    members: Set<Fingerprint>
  ): Promise<Array<IdentityProof>> {
    const myHeaders: Headers = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append(this.authHeader, assembly.secret);

    const body = JSON.stringify(members);
    console.log(`Sending members \n${body}`);

    const init: RequestInit = {
      method: "GET",
      headers: myHeaders,
      body: body,
      mode: "cors",
      cache: "no-cache",
    };

    const request: Request = new Request(
      `${this.baseURL}/assembly/${assembly.id}/identity_proofs`
    );
    const response: Response = await fetch(request, init);
    const identities = await response.json();
    let fingers = new Set(members);
    for (let id of identities) {
      if (await CryptoMe.verifyIdentityProof(id)) {
        fingers.delete(id.fingerprint);
      } else {
        throw new Error(
          `Invalid identity proof for member ${id.nickname.value} of fingerprint ${id.fingerprint}.`
        );
      }
    }
    if (fingers.size === 0) {
      return identities;
    } else {
      throw new Error(`Missing identity proofs for members ${fingers}.`);
    }
  }

  async connect(
    cryptoMembership: CryptoMembership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController> {
    const assemblyUrl = `${this.baseURL.replace("http", "ws")}/connect`;
    console.log(`Connecting to ${assemblyUrl}`);
    let status: ConnectionStatus = "handshake";
    const socket = new WebSocket(assemblyUrl);

    const controller: ConnectionController = new (class
      implements ConnectionController
    {
      close(): void {
        updateConnection(ConnectionEvent.closed);
        socket.close();
      }
      sendEvent(event: string): void {
        console.log("Sending event!");
      }
    })();

    socket.onopen = (e: Event) => {
      updateConnection(ConnectionEvent.opened);
      socket.send(
        JSON.stringify(
          Handshake.credentials(
            cryptoMembership.assembly.id,
            cryptoMembership.assembly.secret,
            cryptoMembership.me.fingerprint
          )
        )
      );
    };

    socket.onmessage = async (msg: MessageEvent) => {
      console.log(
        `Incoming message of type ${typeof msg.data} and content ${msg.data}`
      );

      switch (status) {
        case "handshake":
          const message: Handshake = JSON.parse(msg.data);
          switch (message.tag) {
            case "challenge":
              const response = await Handshake.replyToChallenge(
                cryptoMembership,
                message
              );
              socket.send(JSON.stringify(response));
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
                ConnectionEvent.error(message.reason, message.fatal)
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
      console.log(`Connection error ${e}`);
      updateConnection(ConnectionEvent.error(`${e}`, true));
      controller.close();
    };

    return controller;
  }
}

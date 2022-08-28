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
    return response.json();
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
    return response.json();
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
    let socket = new WebSocket(assemblyUrl);

    const controller: ConnectionController = new (class
      implements ConnectionController
    {
      close(error: string | null): void {
        if (status !== "terminated") {
          status = "terminated";
          updateConnection(
            error ? ConnectionEvent.error(error, true) : ConnectionEvent.closed
          );
          socket.close();
        }
      }
      sendEvent(event: MemberEvent): void {
        if (status === "established")
          socket.send(JSONNormalizedStringifyD(event));
        else
          console.log(
            `Trying to send message ${JSON.stringify(
              event
            )} from a ${status} connection.`
          );
      }
    })();

    socket.onopen = (e: Event) => {
      if (status !== "terminated") {
        updateConnection(ConnectionEvent.opened(controller));
        socket.send(
          JSONNormalizedStringifyD(
            Handshake.Out.credentials(
              membership.assembly,
              membership.me.fingerprint
            )
          )
        );
      } else
        console.log(
          `Opening with event ${JSON.stringify(e)} a terminated connection!`
        );
    };

    socket.onmessage = async (msg: MessageEvent) => {
      switch (status) {
        case "established":
          const event: AssemblyEvent = JSON.parse(msg.data);
          updateAssembly(event);
          break;

        case "handshake":
          const message: Handshake.In = JSON.parse(msg.data);
          switch (message.tag) {
            case "challenge":
              const response = await Handshake.replyToChallenge(
                membership,
                message
              );
              socket.send(JSONNormalizedStringifyD(response));
              break;

            case "error":
              if (message.fatal) controller.close(message.error);
              updateConnection(
                ConnectionEvent.error(message.error, message.fatal)
              );
              break;

            case "established":
              status = "established";
              updateConnection(ConnectionEvent.established(message.state));
              break;
          }
          break;

        case "terminated":
          console.log(
            `Received ${JSON.stringify(msg)} from a terminated connection.`
          );
          break;
      }
    };

    socket.onclose = (ce: CloseEvent) => {
      if (status !== "terminated") {
        status = "terminated";
        updateConnection(ConnectionEvent.closed);
      } else
        console.log(
          `Closing with event ${JSON.stringify(ce)} a terminated connection!`
        );
    };

    socket.onerror = (e: Event) => {
      if (status !== "terminated") {
        status = "terminated";
        updateConnection(
          ConnectionEvent.error(
            "Connection with the server closed on error.",
            true
          )
        );
      } else
        console.log(`Error ${JSON.stringify(e)} from a terminated connection!`);
    };

    return controller;
  }
}

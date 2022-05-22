import { SocketAddress } from "net";
import { Base64URL } from "../lib/Base64URL";
import {
  AssemblyInfo,
  CryptoMe,
  CryptoMembership,
  Fingerprint,
  IdentityProof,
} from "../model/Crypto";
import { AssemblyEvent } from "../model/Events";

export interface BackAPI {
  createAssembly(name: string): Promise<AssemblyInfo>;
  assemblyName(uuid: string, secret: string): Promise<string>;
  identityProofs(
    assembly: AssemblyInfo,
    members: Set<Fingerprint>
  ): Promise<Array<IdentityProof>>;
  connect(
    cryptoMembership: CryptoMembership,
    update: (event: AssemblyEvent) => void
  ): Promise<void>;
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

  async assemblyName(uuid: string, secret: string): Promise<string> {
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

    const request: Request = new Request(`${this.baseURL}/assembly/${uuid}`);
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
      `${this.baseURL}/assembly/${assembly.uuid}/identity_proofs`
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
    if (fingers.size == 0) {
      return identities;
    } else {
      throw new Error(`Missing identity proofs for members ${fingers}.`);
    }
  }

  async connect(
    cryptoMembership: CryptoMembership,
    update: (event: AssemblyEvent) => void
  ): Promise<void> {
    const assemblyUrl = `${this.baseURL.replace("http", "ws")}/connect`;
    console.log(`Connecting to ${assemblyUrl}`);
    const socket = new WebSocket(assemblyUrl);

    type Status = "WAITING_CHALLENGE" | "ESTABLISHED" | "TERMINATED";
    let status: Status = "WAITING_CHALLENGE";

    socket.onopen = (e: Event) => {
      console.log(`Connection opened.`);
      socket.send(
        JSON.stringify({
          id: cryptoMembership.assembly.uuid,
          secret: cryptoMembership.assembly.secret,
          member: cryptoMembership.me.fingerprint,
        })
      );
    };

    socket.onmessage = async (msg: MessageEvent) => {
      console.log(
        `Incoming message of type ${typeof msg.data} and content ${msg.data}`
      );
      switch (status) {
        case "WAITING_CHALLENGE":
          // Expecting Challenge!
          const challenge: {
            challenge: string;
            identity_proof_needed: boolean;
          } = JSON.parse(msg.data);
          const signature = await CryptoMe.signB64(
            cryptoMembership.me,
            Base64URL.getInstance().decode(challenge.challenge)
          );
          let identity_proof: IdentityProof | null;

          if (challenge.identity_proof_needed) {
            identity_proof = await CryptoMe.identityProof(cryptoMembership.me);
          } else {
            identity_proof = null;
          }

          status = "ESTABLISHED";

          socket.send(
            JSON.stringify({
              signature: signature,
              identity_proof: identity_proof,
            })
          );

          break;

        case "ESTABLISHED":
          const event: AssemblyEvent = JSON.parse(msg.data);
          update(event);
          break;

        case "TERMINATED":
          break;
      }
    };

    socket.onclose = (ce: CloseEvent) => {
      console.log(`The connection is closing now ${Date.now()}`);
      setTimeout(
        async () => await this.connect(cryptoMembership, update),
        10000
      );
    };

    socket.onerror = (e: Event) => {
      console.log(`Connection error ${e}`);
      socket.close();
    };

    return;
  }
}

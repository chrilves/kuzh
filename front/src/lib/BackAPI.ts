import { Me } from "./Model";

export interface BackAPI {
  createAssembly(name: string, me: Me): Promise<void>
  upsertMe(me: Me): Promise<void>
}

export class RealBackAPI implements BackAPI {
  readonly baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.createAssembly = this.createAssembly.bind(this);
    this.upsertMe = this.upsertMe.bind(this);
  }

  async createAssembly(name: string, me: Me): Promise<void> {
    const myHeaders: Headers = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Content-Type", "application/json");

    const creationInit: RequestInit = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({name: name}),
      mode: 'cors',
      cache: 'no-cache'
    };

    const creationRequest: Request = new Request(`${this.baseURL}/assembly`);
    const creationResponse: Response = await fetch(creationRequest, creationInit);
    const assembly_info = await creationResponse.json();
    
  }

  async upsertMe(me: Me): Promise<void> {
    
  }
}
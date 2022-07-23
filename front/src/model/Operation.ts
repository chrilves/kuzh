import { CryptoMembership } from "./Crypto";

export namespace Operation {
  export type Create = {
    tag: "create";
    assemblyName: string;
    nickname: string;
  };

  export function create(assemblyName: string, nickname: string): Create {
    return {
      tag: "create",
      assemblyName: assemblyName,
      nickname: nickname,
    };
  }

  export type Join = {
    tag: "join";
    uuid: string;
    secret: string;
    nickname: string;
  };

  export function join(uuid: string, secret: string, nickname: string): Join {
    return {
      tag: "join",
      uuid: uuid,
      secret: secret,
      nickname: nickname,
    };
  }

  export function fold<R>(
    create: (assemblyName: string, nickname: string) => R,
    join: (uuid: string, secret: string, nickname: string) => R
  ): (op: Operation) => R {
    return function (op: Operation): R {
      switch (op.tag) {
        case "create":
          return create(op.assemblyName, op.nickname);
        case "join":
          return join(op.uuid, op.secret, op.nickname);
      }
    };
  }
}

export type Operation = Operation.Create | Operation.Join;

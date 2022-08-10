export namespace Operation {
  export type Create = {
    readonly tag: "create";
    readonly assemblyName: string;
    readonly nickname: string;
  };

  export function create(assemblyName: string, nickname: string): Create {
    return {
      tag: "create",
      assemblyName: assemblyName,
      nickname: nickname,
    };
  }

  export type Join = {
    readonly tag: "join";
    readonly id: string;
    readonly name: string | null;
    readonly secret: string;
    readonly nickname: string;
  };

  export function join(
    id: string,
    name: string | null,
    secret: string,
    nickname: string
  ): Join {
    return {
      tag: "join",
      id: id,
      name: name,
      secret: secret,
      nickname: nickname,
    };
  }

  export function fold<R>(
    create: (assemblyName: string, nickname: string) => R,
    join: (
      id: string,
      name: string | null,
      secret: string,
      nickname: string
    ) => R
  ): (op: Operation) => R {
    return function (op: Operation): R {
      switch (op.tag) {
        case "create":
          return create(op.assemblyName, op.nickname);
        case "join":
          return join(op.id, op.name, op.secret, op.nickname);
      }
    };
  }
}

export type Operation = Operation.Create | Operation.Join;

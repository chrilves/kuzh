export class Pair<A> {
  constructor(prv: A, pub: A) {
    this.private = prv;
    this.public = pub;
  }

  readonly private: A;
  readonly public: A;

  readonly map = <B>(f: (a: A) => B): Pair<B> =>
    new Pair<B>(f(this.private), f(this.public));

  readonly map_async = async <B>(f: (a: A) => Promise<B>): Promise<Pair<B>> => {
    const prv = await f(this.private);
    const pub = await f(this.public);
    return new Pair<B>(prv, pub);
  };

  readonly toJson = (): PairNS.Json<A> => ({
    private: this.private,
    public: this.public,
  });

  static readonly fromJson = <A>(p: PairNS.Json<A>): Pair<A> =>
    new Pair<A>(p.private, p.public);
}

export namespace PairNS {
  export type Json<A> = { private: A; public: A };
}

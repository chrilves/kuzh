export class Iso<A, B> {
  readonly to: (a: A) => B;
  readonly from: (b: B) => A;

  constructor(to: (a: A) => B, from: (b: B) => A) {
    this.to = to;
    this.from = from;
  }

  readonly swap: () => Iso<B, A> = () => new Iso<B, A>(this.from, this.to);

  readonly compose = <C>(other: Iso<B, C>): Iso<A, C> =>
    new Iso<A, C>(
      (a: A) => other.to(this.to(a)),
      (c: C) => this.from(other.from(c))
    );
}

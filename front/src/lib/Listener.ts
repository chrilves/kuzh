interface CommonListener<A> {
  readonly removeListener: (f: (a: A) => void) => void;
  readonly clearListeners: () => void;
  readonly waitFor: <B>(f: (a: A) => B | undefined) => Promise<B>;
}

export interface Listener<A> extends CommonListener<A> {
  readonly addListener: <B>(f: (a: A) => B) => B;
}

export interface MListener<A> extends CommonListener<A> {
  readonly addListener: <B>(f: (a: A) => B) => Promise<B>;
}

export class PropagateListener<A> implements Listener<A> {
  private _listeners: Set<(a: A) => void> = new Set();
  private readonly _get: () => A;

  constructor(get: () => A) {
    this._get = get;
  }

  readonly addListener = <B>(f: (a: A) => B): B => {
    this._listeners.add(f);
    return f(this._get());
  };

  readonly removeListener = (f: (a: A) => void) => {
    this._listeners.delete(f);
  };

  readonly clearListeners = () => {
    this._listeners = new Set();
  };

  readonly propagate = (a: A) => {
    this._listeners.forEach((f) => {
      try {
        f(a);
      } catch (e) {
        console.log(`Propagate error ${e} on value ${JSON.stringify(a)}`);
      }
    });
  };

  readonly waitFor = <B>(f: (a: A) => B | undefined): Promise<B> =>
    new Promise((resolve, reject) => {
      const g = (a: A) => {
        try {
          const b = f(a);
          if (b !== undefined) {
            this._listeners.delete(g);
            resolve(b);
          }
        } catch (e) {
          reject(e);
        }
      };
      this._listeners.add(g);
    });
}

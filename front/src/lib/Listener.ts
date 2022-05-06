export class Listener<A> {
  private _listeners: Set<(a: A) => void> = new Set();
  private readonly _get: () => A;

  constructor(get: () => A) {
    this._get = get;
  }

  readonly addListener = async (f: (a: A) => void) => {
    this._listeners.add(f);
    f(this._get());
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
}

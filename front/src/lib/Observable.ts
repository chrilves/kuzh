export type Cont<A> = (f: (a: A) => void) => void;

export interface Observable<A> {
  addListener: Cont<A>;
  removeListener: Cont<A>;
  clearListeners(): void;
  waitFor<B>(f: (a: A) => B | undefined): Promise<B>;
  map<B>(f: (a: A) => B): Observable<B>;
}

export class ObservableImpl<A> implements Observable<A> {
  private listeners: Set<(a: A) => void>;
  private sendValue: Cont<A>;

  constructor(listeners: Set<(a: A) => void>, sendValue: Cont<A>) {
    this.listeners = listeners;
    this.sendValue = sendValue;
  }

  readonly addListener = (f: (a: A) => void): void => {
    this.listeners.add(f);
    this.sendValue(f);
  };

  readonly removeListener = (f: (a: A) => void): void => {
    this.listeners.delete(f);
  };

  readonly clearListeners = (): void => {
    this.listeners.clear();
  };

  readonly waitFor = <B>(f: (a: A) => B | undefined): Promise<B> =>
    new Promise((resolve, reject) => {
      const g = (a: A) => {
        try {
          const b = f(a);
          if (b !== undefined) {
            this.listeners.delete(g);
            resolve(b);
          }
        } catch (e) {
          reject(e);
        }
      };
      this.listeners.add(g);
    });

  readonly map = <B>(f: (a: A) => B): Observable<B> =>
    new ObservableMap<A, B>(this, f);
}

export class ObservableMap<A, B> implements Observable<B> {
  private observable: Observable<A>;
  private mapFun: (a: A) => B;
  private matching: Map<(b: B) => void, (a: A) => void> = new Map();

  constructor(observable: Observable<A>, mapFun: (a: A) => B) {
    this.observable = observable;
    this.mapFun = mapFun;
  }

  readonly addListener = (f: (b: B) => void): void => {
    const g = (a: A) => f(this.mapFun(a));
    this.matching.set(f, g);
    this.observable.addListener(g);
  };

  readonly removeListener = (f: (b: B) => void): void => {
    const g = this.matching.get(f);
    if (g) {
      this.observable.removeListener(g);
      this.matching.delete(f);
    }
  };

  readonly clearListeners = (): void => {
    this.observable.clearListeners();
  };

  readonly waitFor = <C>(f: (b: B) => C | undefined): Promise<C> =>
    this.observable.waitFor((a: A) => f(this.mapFun(a)));

  readonly map = <C>(f: (b: B) => C): Observable<C> =>
    new ObservableMap<A, C>(this.observable, (a: A) => f(this.mapFun(a)));
}

export namespace Observable {
  export function create<A>(
    sendValue: Cont<A>
  ): [Observable<A>, (a: A) => void] {
    const listeners = new Set<(a: A) => void>();
    return [
      new ObservableImpl(listeners, sendValue),
      (a: A): void => {
        listeners.forEach((f) => {
          try {
            f(a);
          } catch (e) {
            console.log(
              `Error ${JSON.stringify(e)} propating value ${JSON.stringify(a)}.`
            );
          }
        });
      },
    ];
  }

  export function refresh<A>(sendValue: Cont<A>): [Observable<A>, () => void] {
    const listeners = new Set<(a: A) => void>();
    return [
      new ObservableImpl(listeners, sendValue),
      (): void => {
        listeners.forEach((f) => {
          try {
            sendValue(f);
          } catch (e) {
            console.log(`Error ${JSON.stringify(e)} propating value.`);
          }
        });
      },
    ];
  }
}

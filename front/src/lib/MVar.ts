import { Mutex } from "async-mutex";
import { Iso } from "./Iso";
import { Observable } from "./Observable";

export interface MGetSet<A> {
  get(): Promise<A>;
  set(a: A): Promise<void>;
}

export namespace MGetSet {
  export function variable<A>(initial: A): MGetSet<A> {
    return new (class implements MGetSet<A> {
      private value: A = initial;

      readonly get = () => Promise.resolve(this.value);
      readonly set = (a: A): Promise<void> => {
        this.value = a;
        return Promise.resolve();
      };
    })();
  }

  export function getterSetter<A>(
    _get: () => Promise<A>,
    _set: (a: A) => Promise<void>
  ): MGetSet<A> {
    return {
      get: _get,
      set: _set,
    };
  }

  export function cache<A>(gs: MGetSet<A>): MGetSet<A> {
    return new (class implements MGetSet<A> {
      private value: A | null = null;

      readonly get = async () => {
        if (this.value === null) {
          this.value = await gs.get();
          return Promise.resolve(this.value);
        } else return Promise.resolve(this.value);
      };

      readonly set = (a: A): Promise<void> => {
        this.value = a;
        return gs.set(a);
      };
    })();
  }
}

export abstract class MVar<A> {
  private readonly mutex = new Mutex();

  abstract unsafeGet(): Promise<A>;
  abstract unsafeSet(newValue: A): Promise<void>;

  readonly get = (): Promise<A> =>
    this.mutex.runExclusive(() => this.unsafeGet());
  readonly set = (newValue: A): Promise<void> =>
    this.mutex.runExclusive(() => this.unsafeSet(newValue));

  readonly with = async <B>(f: (a: A) => Promise<B>): Promise<B> =>
    f(await this.get());

  readonly setWith = async (f: () => Promise<A>): Promise<void> =>
    this.set(await f());

  readonly setIfEq = (oldValue: A, newValue: A): Promise<boolean> =>
    this.mutex.runExclusive(async () => {
      if ((await this.unsafeGet()) === oldValue) {
        await this.unsafeSet(newValue);
        return Promise.resolve(true);
      } else return Promise.resolve(false);
    });

  readonly modify = (f: (a: A) => Promise<A>): Promise<void> =>
    this.mutex.runExclusive(async () => {
      const newValue = await f(await this.unsafeGet());
      await this.unsafeSet(newValue);
    });

  readonly modifyWith = <B>(f: (a: A) => Promise<[A, B]>): Promise<B> =>
    this.mutex.runExclusive(async () => {
      const [newValue, ret] = await f(await this.unsafeGet());
      await this.unsafeSet(newValue);
      return Promise.resolve(ret);
    });

  readonly iso = <B>(isoab: Iso<A, B>): MVar<B> => {
    const base = this;
    return new (class extends MVar<B> {
      readonly unsafeGet = async (): Promise<B> => isoab.to(await base.get());
      readonly unsafeSet = async (b: B): Promise<void> =>
        base.set(isoab.from(b));
    })();
  };

  static readonly fromMGetSet = <A>(gs: MGetSet<A>): MVar<A> =>
    new (class extends MVar<A> {
      readonly unsafeGet = gs.get;
      readonly unsafeSet = gs.set;
    })();
}

export abstract class ObservableMVar<A>
  extends MVar<A>
  implements Observable<A>
{
  private _observable: Observable<A>;
  private propagate: (a: A) => void;

  readonly addListener;
  readonly removeListener;
  readonly clearListeners;
  readonly waitFor;
  readonly map;

  constructor() {
    super();
    const [_observable, propagate] = Observable.create(
      async (f: (a: A) => void) => f(await this.get())
    );
    this._observable = _observable;
    this.propagate = propagate;

    this.addListener = this._observable.addListener;
    this.removeListener = this._observable.removeListener;
    this.clearListeners = this._observable.clearListeners;
    this.waitFor = this._observable.waitFor;
    this.map = this._observable.map;
  }

  protected abstract unobservedUnsafeSet(a: A): Promise<void>;

  readonly unsafeSet = async (a: A): Promise<void> => {
    await this.unobservedUnsafeSet(a);
    this.propagate(a);
  };

  readonly variable = (): MVar<A> => this;
  readonly observable = (): Observable<A> => this;

  static readonly fromMGetSet = <A>(gs: MGetSet<A>): ObservableMVar<A> =>
    new (class extends ObservableMVar<A> {
      readonly unsafeGet = gs.get;
      readonly unobservedUnsafeSet = gs.set;
    })();
}

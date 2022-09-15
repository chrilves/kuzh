import { Iso } from "./Iso";
import { Observable } from "./Observable";

export interface GetSet<A> {
  get(): A;
  set(a: A): void;
}

export namespace GetSet {
  export function variable<A>(initial: A): GetSet<A> {
    return new (class implements GetSet<A> {
      private value: A = initial;

      readonly get = () => this.value;
      readonly set = (a: A): void => {
        this.value = a;
      };
    })();
  }

  export function getterSetter<A>(
    _get: () => A,
    _set: (a: A) => void
  ): GetSet<A> {
    return {
      get: _get,
      set: _set,
    };
  }

  export function cache<A>(gs: GetSet<A>): GetSet<A> {
    return new (class implements GetSet<A> {
      private value: A | null = null;

      readonly get = () => {
        if (this.value === null) {
          this.value = gs.get();
          return this.value;
        } else return this.value;
      };
      readonly set = (a: A): void => {
        this.value = a;
        gs.set(a);
      };
    })();
  }
}

export abstract class Var<A> {
  abstract get(): A;
  abstract set(newValue: A): void;

  readonly with = <B>(f: (a: A) => B): B => f(this.get());

  readonly setWith = (f: () => A): void => this.set(f());

  readonly setIfEq = (oldValue: A, newValue: A): boolean => {
    if (this.get() === oldValue) {
      this.set(newValue);
      return true;
    } else return false;
  };

  readonly modify = (f: (a: A) => A): void => {
    const newValue = f(this.get());
    this.set(newValue);
  };

  readonly modifyWith = <B>(f: (a: A) => [A, B]): B => {
    const [newValue, ret] = f(this.get());
    this.set(newValue);
    return ret;
  };

  readonly iso = <B>(isoab: Iso<A, B>): Var<B> => {
    const base = this;
    return new (class extends Var<B> {
      readonly get = (): B => isoab.to(base.get());
      readonly set = (b: B): void => base.set(isoab.from(b));
    })();
  };

  static readonly fromGetSet = <A>(gs: GetSet<A>): Var<A> =>
    new (class extends Var<A> {
      readonly get = gs.get;
      readonly set = gs.set;
    })();
}

export abstract class ObservableVar<A> extends Var<A> implements Observable<A> {
  private _observable: Observable<A>;
  private propagate: (a: A) => void;

  readonly addListener;
  readonly removeListener;
  readonly clearListeners;
  readonly waitFor;
  readonly map;

  constructor() {
    super();
    const [_observable, propagate] = Observable.create((f: (a: A) => void) =>
      f(this.get())
    );
    this._observable = _observable;
    this.propagate = propagate;

    this.addListener = this._observable.addListener;
    this.removeListener = this._observable.removeListener;
    this.clearListeners = this._observable.clearListeners;
    this.waitFor = this._observable.waitFor;
    this.map = this._observable.map;
  }

  protected abstract unobservedSet(a: A): void;

  readonly set = (a: A): void => {
    this.unobservedSet(a);
    this.propagate(a);
  };

  readonly variable = (): Var<A> => this;
  readonly observable = (): Observable<A> => this;

  static readonly fromGetSet = <A>(gs: GetSet<A>): ObservableVar<A> =>
    new (class extends ObservableVar<A> {
      readonly get = gs.get;
      readonly unobservedSet = gs.set;
    })();
}

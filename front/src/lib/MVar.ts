import { Mutex } from "async-mutex";
import { MListener } from "./Listener";

export interface Var<A> {
  get(): A;
  set(newValue: A): A;
}

export default class MVar<A> implements MListener<A> {
  private readonly mutex = new Mutex();
  private _listeners: Set<(a: A) => void> = new Set();
  private value: A;

  constructor(value: A) {
    this.value = value;
  }

  ////////////////////////
  // UNSAFE

  readonly unsafeGet = (): A => this.value;

  readonly unsafeSet = (newValue: A): Promise<A> => {
    const oldValue = this.value;
    this.value = newValue;
    this.propagate();
    return Promise.resolve(oldValue);
  };

  ////////////////////////7
  // SAFE

  readonly get = async (): Promise<A> =>
    this.mutex.runExclusive(() => this.value);

  readonly with = async <B>(f: (a: A) => Promise<B>): Promise<B> =>
    this.mutex.runExclusive(() => f(this.value));

  readonly set = async (newValue: A): Promise<A> =>
    this.mutex.runExclusive(() => this.unsafeSet(newValue));

  readonly setWith = async (f: () => Promise<A>): Promise<A> =>
    this.mutex.runExclusive(async () => this.unsafeSet(await f()));

  readonly setIfEq = async (oldValue: A, newValue: A): Promise<boolean> =>
    this.mutex.runExclusive(() => {
      if (this.value === oldValue) {
        this.unsafeSet(newValue);
        return true;
      } else return false;
    });

  readonly modify = async <B>(f: (a: A) => Promise<[A, B]>): Promise<B> =>
    this.mutex.runExclusive(async () => {
      const [newValue, ret] = await f(this.value);
      this.unsafeSet(newValue);
      return Promise.resolve(ret);
    });

  ////////////////////////
  // Listener

  readonly addListener = async <B>(f: (a: A) => B): Promise<B> => {
    this._listeners.add(f);
    return Promise.resolve(f(await this.get()));
  };

  readonly removeListener = (f: (a: A) => void) => {
    this._listeners.delete(f);
  };

  readonly clearListeners = () => {
    this._listeners = new Set();
  };

  private readonly propagate = () =>
    this._listeners.forEach((f) => {
      try {
        f(this.value);
      } catch (e) {
        console.log(
          `Propagate error ${e} on value ${JSON.stringify(this.value)}`
        );
      }
    });

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

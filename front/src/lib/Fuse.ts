import { Mutex } from "async-mutex";

export default class Fuse {
  ok = true;
  readonly mutex = new Mutex();
  readonly break = () =>
    this.mutex.runExclusive(() => {
      const old = this.ok;
      this.ok = false;
      return old;
    });
  readonly isOk = () =>
    this.mutex.runExclusive(() => {
      return this.ok;
    });
}

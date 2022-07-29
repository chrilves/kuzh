import { Mutex } from "async-mutex";

export default class Fuse {
  ok = true;
  mutex = new Mutex();
  break = () =>
    this.mutex.runExclusive(() => {
      const old = this.ok;
      this.ok = false;
      return old;
    });
  isOk = () =>
    this.mutex.runExclusive(() => {
      return this.ok;
    });
}

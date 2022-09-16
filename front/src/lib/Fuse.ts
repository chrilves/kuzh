import { Mutex } from "async-mutex";

export default class Fuse {
  ok = true;
  readonly mutex = new Mutex();
  readonly break = async (): Promise<boolean> =>
    await this.mutex.runExclusive((): boolean => {
      const old = this.ok;
      this.ok = false;
      return old;
    });
  readonly isOk = async (): Promise<boolean> =>
    await this.mutex.runExclusive((): boolean => this.ok);
}

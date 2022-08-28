import { Mutex } from "async-mutex";
import { Listener, PropagateListener } from "../lib/Listener";

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

declare global {
  var deferredPrompt: {
    state: BeforeInstallPromptEvent | null | undefined;
    propagate: () => void;
  };
}

export default class Install {
  private mutex = new Mutex();

  readonly installable = (): boolean =>
    globalThis.deferredPrompt.state !== null &&
    globalThis.deferredPrompt.state !== undefined;

  private readonly _listeners: PropagateListener<boolean> =
    new PropagateListener<boolean>(this.installable);

  readonly listeners: Listener<boolean> = this._listeners;

  private readonly set = (v: BeforeInstallPromptEvent | null): void => {
    globalThis.deferredPrompt.state = v;
    this._listeners.propagate(this.installable());
  };

  constructor() {
    globalThis.deferredPrompt.propagate = () =>
      this._listeners.propagate(this.installable());
  }

  readonly install: () => Promise<void> = () =>
    this.mutex.runExclusive(async () => {
      if (
        globalThis.deferredPrompt.state !== null &&
        globalThis.deferredPrompt.state !== undefined
      ) {
        try {
          await globalThis.deferredPrompt.state.prompt();

          const choiceResult = await globalThis.deferredPrompt.state.userChoice;
          if (choiceResult.outcome === "accepted") {
            console.log("User installed kuzh");
          } else {
            console.log("User refused to install kuzh");
          }
        } catch (e) {
          console.log(`Kuzh installation error: ${JSON.stringify(e)}`);
        }
        this.set(null);
      }
      Promise.resolve();
    });
}

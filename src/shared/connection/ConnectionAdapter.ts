// Prevent accidental use of the abstract base. This keeps the app decoupled from any specific connectivity provider.
export class ConnectionAdapter {
  constructor() {
    if (new.target === ConnectionAdapter) {
      throw new Error("ConnectionAdapter is abstract; implement a concrete adapter");
    }
  }
  // Lifecycle
  createInitiator(_mediaStream?: MediaStream): unknown { throw new Error("Not implemented"); }
  createResponder(_mediaStream?: MediaStream): unknown { throw new Error("Not implemented"); }
  destroy(): void {}
  // Signaling
  onSignal(_cb?: (data: unknown) => void): unknown { throw new Error("Not implemented"); }
  signal(_data?: unknown): void { throw new Error("Not implemented"); }
  // Media
  onStream(_cb?: (stream: MediaStream) => void): unknown { throw new Error("Not implemented"); }
  // Events
  onError(_cb?: (error: Error) => void): unknown { throw new Error("Not implemented"); }
  onClose(_cb?: () => void): unknown { throw new Error("Not implemented"); }
  onConnect(_cb?: () => void): unknown { throw new Error("Not implemented"); }
  getPeerConnection(): RTCPeerConnection | null { return null; }
}

export function assertAdapterShape(adapter: Readonly<Record<string, unknown>>) {
  const required = [
    "createInitiator",
    "createResponder",
    "destroy",
    "onSignal",
    "signal",
    "onStream",
  ];
  for (const k of required) {
    if (typeof adapter[k] !== "function") {
      throw new TypeError(`Adapter missing required method: ${k}`);
    }
  }
  return true;
}

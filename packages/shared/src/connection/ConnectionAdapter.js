// Prevent accidental use of the abstract base. This keeps the app decoupled from any specific connectivity provider.
export class ConnectionAdapter {
  constructor() {
    if (new.target === ConnectionAdapter) {
      throw new Error("ConnectionAdapter is abstract; implement a concrete adapter");
    }
  }
  // Lifecycle
  createInitiator(_mediaStream) { throw new Error("Not implemented"); }
  createResponder(_mediaStream) { throw new Error("Not implemented"); }
  destroy() {}
  // Signaling
  onSignal(_cb) { throw new Error("Not implemented"); }
  signal(_data) { throw new Error("Not implemented"); }
  // Media
  onStream(_cb) { throw new Error("Not implemented"); }
}

export function assertAdapterShape(adapter) {
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
      throw new Error(`Adapter missing required method: ${k}`);
    }
  }
  return true;
}

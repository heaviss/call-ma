export class SimplePeerAdapter {
  constructor({ PeerCtor, config } = {}) {
    this.PeerCtor = PeerCtor;
    this.config = config || null;
    this.peer = null;
    this._onSignal = null;
    this._onStream = null;
    this._onError = null;
    this._onClose = null;
    this._onConnect = null;
  }

  onSignal(cb) { this._onSignal = cb; return this; }
  onStream(cb) { this._onStream = cb; return this; }
  onError(cb) { this._onError = cb; return this; }
  onClose(cb) { this._onClose = cb; return this; }
  onConnect(cb) { this._onConnect = cb; return this; }

  createInitiator(stream) {
    this._createPeer(true, stream);
    return this;
  }

  createResponder(stream) {
    this._createPeer(false, stream);
    return this;
  }

  _createPeer(initiator, stream) {
    const Peer = this.PeerCtor;
    if (!Peer) throw new Error('Peer constructor not provided');

    const opts = { initiator, trickle: false, stream };
    if (this.config) opts.config = this.config;

    // Support both constructor-style and factory-style invocations to play nicely with tests
    let instance = null;
    try {
      // Some tests pass a vi.fn mock which can be called without `new`
      instance = Peer(opts);
      if (!instance || typeof instance.on !== 'function') {
        instance = null;
      }
    } catch {
      // Ignore and fallback to constructor
    }

    if (!instance) {
      instance = new Peer(opts);
    }

    this.peer = instance;
    this.peer.on('signal', (data) => { if (this._onSignal) this._onSignal(data); });
    this.peer.on('stream', (remote) => { if (this._onStream) this._onStream(remote); });
    this.peer.on('error', (err) => { if (this._onError) this._onError(err); });
    this.peer.on('close', () => { if (this._onClose) this._onClose(); });
    this.peer.on('connect', () => { if (this._onConnect) this._onConnect(); });
  }

  signal(data) {
    if (!this.peer) throw new Error('Peer not initialized');
    this.peer.signal(data);
  }

  getPeerConnection() {
    return (this.peer && this.peer._pc) || null;
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

import { describe, it, expect, vi } from 'vitest';
import { SimplePeerAdapter } from '../connection/simplePeerAdapter.js';

class FakePeer {
  constructor(opts) {
    this.opts = opts;
    this._handlers = {};
    this.signalCalls = [];
    this.destroyed = false;
  }
  on(evt, cb) {
    this._handlers[evt] = this._handlers[evt] || [];
    this._handlers[evt].push(cb);
    return this;
  }
  emit(evt, ...args) {
    (this._handlers[evt] || []).forEach((cb) => cb(...args));
  }
  signal(data) {
    this.signalCalls.push(data);
  }
  destroy() {
    this.destroyed = true;
  }
}

function makePeerCtor() {
  const instances = [];
  const PeerCtor = vi.fn().mockImplementation((opts) => {
    const p = new FakePeer(opts);
    instances.push(p);
    return p;
  });
  PeerCtor.instances = instances;
  return PeerCtor;
}

describe('SimplePeerAdapter', () => {
  it('passes config option to peer constructor when provided', () => {
    // Arrange
    const PeerCtor = makePeerCtor();
    const config = { iceServers: [{ urls: 'stun:example.com' }] };
    const adapter = new SimplePeerAdapter({ PeerCtor, config });

    // Act
    adapter.createInitiator({ id: 's' });

    // Assert
    expect(PeerCtor.mock.calls[0][0].config).toEqual(config);
  });

  it('creates initiator with trickle:false and wires signal/stream', () => {
    // Arrange
    const PeerCtor = makePeerCtor();
    const adapter = new SimplePeerAdapter({ PeerCtor });
    const onSignal = vi.fn();
    const onStream = vi.fn();
    adapter.onSignal(onSignal);
    adapter.onStream(onStream);

    const fakeStream = { id: 'local' };

    // Act
    adapter.createInitiator(fakeStream);

    // Assert
    expect(PeerCtor).toHaveBeenCalledTimes(1);
    const opts = PeerCtor.mock.calls[0][0];
    expect(opts.initiator).toBe(true);
    expect(opts.trickle).toBe(false);
    expect(opts.stream).toBe(fakeStream);

    // When the underlying peer emits events, callbacks are invoked
    const peer = PeerCtor.instances[0];
    const sig = { type: 'offer' };
    peer.emit('signal', sig);
    expect(onSignal).toHaveBeenCalledWith(sig);

    const remote = { id: 'remote' };
    peer.emit('stream', remote);
    expect(onStream).toHaveBeenCalledWith(remote);
  });

  it('calls onError callback when peer emits error', () => {
    // Arrange
    const PeerCtor = makePeerCtor();
    const adapter = new SimplePeerAdapter({ PeerCtor });
    const onError = vi.fn();
    adapter.onError(onError);
    adapter.createInitiator({ id: 's' });

    // Act
    const err = new Error('ICE failed');
    PeerCtor.instances[0].emit('error', err);

    // Assert
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('calls onClose callback when peer emits close', () => {
    // Arrange
    const PeerCtor = makePeerCtor();
    const adapter = new SimplePeerAdapter({ PeerCtor });
    const onClose = vi.fn();
    adapter.onClose(onClose);
    adapter.createInitiator({ id: 's' });

    // Act
    PeerCtor.instances[0].emit('close');

    // Assert
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onConnect callback when peer emits connect', () => {
    // Arrange
    const PeerCtor = makePeerCtor();
    const adapter = new SimplePeerAdapter({ PeerCtor });
    const onConnect = vi.fn();
    adapter.onConnect(onConnect);
    adapter.createInitiator({ id: 's' });

    // Act
    PeerCtor.instances[0].emit('connect');

    // Assert
    expect(onConnect).toHaveBeenCalled();
  });

  it('getPeerConnection returns the underlying _pc of the peer', () => {
    // Arrange
    const PeerCtor = makePeerCtor();
    const adapter = new SimplePeerAdapter({ PeerCtor });
    adapter.createInitiator({ id: 's' });
    const fakePc = { getStats: vi.fn() };
    PeerCtor.instances[0]._pc = fakePc;

    // Assert
    expect(adapter.getPeerConnection()).toBe(fakePc);
  });

  it('getPeerConnection returns null when peer is not initialized', () => {
    const adapter = new SimplePeerAdapter({});

    expect(adapter.getPeerConnection()).toBeNull();
  });

  it('creates responder and supports signal/destroy', () => {
    // Arrange
    const PeerCtor = makePeerCtor();
    const adapter = new SimplePeerAdapter({ PeerCtor });
    const fakeStream = { id: 'local' };
    adapter.createResponder(fakeStream);
    const peer = PeerCtor.instances[0];

    // Act
    const offer = { type: 'offer' };
    adapter.signal(offer);
    adapter.destroy();

    // Assert
    expect(PeerCtor).toHaveBeenCalledTimes(1);
    const opts = PeerCtor.mock.calls[0][0];
    expect(opts.initiator).toBe(false);
    expect(opts.trickle).toBe(false);
    expect(peer.signalCalls[0]).toBe(offer);
    expect(peer.destroyed).toBe(true);
  });
});

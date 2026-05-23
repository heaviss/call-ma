import { describe, it, expect } from 'vitest';
import { ConnectionAdapter, assertAdapterShape } from '../shared/connection/ConnectionAdapter.js';

class MinimalAdapter extends ConnectionAdapter {}

class ConcreteAdapter extends ConnectionAdapter {
  createInitiator() { return 'initiator'; }
  createResponder() { return 'responder'; }
  onSignal() { return this; }
  signal() {}
  onStream() { return this; }
  onError() { return this; }
  onClose() { return this; }
  onConnect() { return this; }
}

describe('ConnectionAdapter', () => {
  it('throws when instantiated directly', () => {
    expect(() => new ConnectionAdapter()).toThrow('abstract');
  });

  it('allows instantiation of a concrete subclass', () => {
    expect(() => new ConcreteAdapter()).not.toThrow();
  });

  it('destroy() returns undefined (no-op)', () => {
    expect(new ConcreteAdapter().destroy()).toBeUndefined();
  });

  it('getPeerConnection() returns null', () => {
    expect(new ConcreteAdapter().getPeerConnection()).toBeNull();
  });

  const abstractMethods = [
    'createInitiator',
    'createResponder',
    'onSignal',
    'signal',
    'onStream',
    'onError',
    'onClose',
    'onConnect',
  ];

  for (const method of abstractMethods) {
    it(`${method}() throws "Not implemented" when not overridden`, () => {
      expect(() => new MinimalAdapter()[method]()).toThrow('Not implemented');
    });
  }
});

describe('assertAdapterShape', () => {
  const required = ['createInitiator', 'createResponder', 'destroy', 'onSignal', 'signal', 'onStream'];
  const fullAdapter = Object.fromEntries(required.map((m) => [m, () => {}]));

  it('returns true for a fully implemented adapter', () => {
    expect(assertAdapterShape({ ...fullAdapter })).toBe(true);
  });

  for (const method of required) {
    it(`throws TypeError when "${method}" is missing`, () => {
      const partial = { ...fullAdapter };
      delete partial[method];

      expect(() => assertAdapterShape(partial)).toThrow(TypeError);
      expect(() => assertAdapterShape(partial)).toThrow(method);
    });
  }
});

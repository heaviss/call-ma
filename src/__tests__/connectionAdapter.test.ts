import { describe, expect, it } from 'vitest';

import { assertAdapterShape, ConnectionAdapter } from '../shared/connection/ConnectionAdapter.ts';

class MinimalAdapter extends ConnectionAdapter {}

class ConcreteAdapter extends ConnectionAdapter {
  override createInitiator() { return 'initiator'; }
  override createResponder() { return 'responder'; }
  override onSignal() { return this; }
  override signal() {}
  override onStream() { return this; }
  override onError() { return this; }
  override onClose() { return this; }
  override onConnect() { return this; }
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
  ] as const;

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

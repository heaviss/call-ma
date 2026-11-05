// Arrange / Act / Assert: example unit test proving runner

import { describe, expect, it } from 'vitest';

describe('example math', () => {
  it('adds numbers correctly', () => {
    // Arrange
    const a = 1;
    const b = 2;

    // Act
    const sum = a + b;

    // Assert
    expect(sum).toBe(3);
  });
});

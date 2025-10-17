import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getHeaderOverrides,
  setHeaderOverride,
  getCSharpApiHeaders,
  HeaderOverrides,
} from '../environment';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Header Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHeaderOverrides', () => {
    it('should return empty object when no overrides are set', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = getHeaderOverrides();

      expect(result).toEqual({});
    });

    it('should return overrides when they are set in localStorage', () => {
      localStorageMock.getItem
        .mockReturnValueOnce('true') // useLocalAuth
        .mockReturnValueOnce('false') // useLocalPostgres
        .mockReturnValueOnce('true'); // dualPath

      const result = getHeaderOverrides();

      expect(result).toEqual({
        useLocalAuth: true,
        useLocalPostgres: false,
        dualPath: true,
      });
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const result = getHeaderOverrides();

      expect(result).toEqual({});
    });
  });

  describe('setHeaderOverride', () => {
    it('should set header override in localStorage', () => {
      setHeaderOverride('useLocalAuth', true);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('debug.header.useLocalAuth', 'true');
    });

    it('should remove header override when value is null', () => {
      setHeaderOverride('useLocalAuth', null);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('debug.header.useLocalAuth');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => setHeaderOverride('useLocalAuth', true)).not.toThrow();
    });
  });

  describe('getCSharpApiHeaders', () => {
    it('should return empty headers when no overrides are set', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = getCSharpApiHeaders();

      expect(result).toEqual({});
    });

    it('should return headers when overrides are set', () => {
      localStorageMock.getItem
        .mockReturnValueOnce('true') // useLocalAuth
        .mockReturnValueOnce('false') // useLocalPostgres
        .mockReturnValueOnce('true'); // dualPath

      const result = getCSharpApiHeaders();

      expect(result).toEqual({
        'X-UseLocalAuth': 'true',
        'X-UseLocalPostgres': 'false',
        'X-DualPath': 'true',
      });
    });

    it('should only include headers that are explicitly set', () => {
      localStorageMock.getItem
        .mockReturnValueOnce('true') // useLocalAuth
        .mockReturnValueOnce(null) // useLocalPostgres
        .mockReturnValueOnce('false'); // dualPath

      const result = getCSharpApiHeaders();

      expect(result).toEqual({
        'X-UseLocalAuth': 'true',
        'X-DualPath': 'false',
      });
    });
  });
});

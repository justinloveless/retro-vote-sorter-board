import { describe, expect, it } from 'vitest';
import {
  AVATAR_CIRCLE_DIAMETER,
  AVATAR_VIEWPORT_SIZE,
  getCoverTransform,
  withAvatarCacheBust,
} from '@/components/account/avatarCrop';

describe('getCoverTransform', () => {
  it('scales a small square image up to cover the crop circle', () => {
    const { scale, offset } = getCoverTransform(48, 48);
    expect(scale).toBeCloseTo(AVATAR_CIRCLE_DIAMETER / 48);
    const scaled = 48 * scale;
    expect(offset.x).toBeCloseTo(AVATAR_VIEWPORT_SIZE / 2 - scaled / 2);
    expect(offset.y).toBeCloseTo(AVATAR_VIEWPORT_SIZE / 2 - scaled / 2);
    // Image must fully cover the circle bounding box
    expect(scaled).toBeGreaterThanOrEqual(AVATAR_CIRCLE_DIAMETER);
  });

  it('covers the circle for a wide landscape image', () => {
    const { scale, offset } = getCoverTransform(1000, 500);
    expect(scale).toBeCloseTo(AVATAR_CIRCLE_DIAMETER / 500);
    expect(1000 * scale).toBeGreaterThanOrEqual(AVATAR_CIRCLE_DIAMETER);
    expect(500 * scale).toBeGreaterThanOrEqual(AVATAR_CIRCLE_DIAMETER);
    expect(offset.y).toBeCloseTo((AVATAR_VIEWPORT_SIZE - 500 * scale) / 2);
  });

  it('covers the circle for a tall portrait image', () => {
    const { scale, offset } = getCoverTransform(500, 1000);
    expect(scale).toBeCloseTo(AVATAR_CIRCLE_DIAMETER / 500);
    expect(offset.x).toBeCloseTo((AVATAR_VIEWPORT_SIZE - 500 * scale) / 2);
  });

  it('returns a safe default for invalid dimensions', () => {
    expect(getCoverTransform(0, 100)).toEqual({ scale: 1, offset: { x: 0, y: 0 } });
    expect(getCoverTransform(-1, -1)).toEqual({ scale: 1, offset: { x: 0, y: 0 } });
  });
});

describe('withAvatarCacheBust', () => {
  it('appends a v query param without dropping existing params', () => {
    const url = withAvatarCacheBust(
      'https://example.com/storage/v1/object/public/avatars/u.png?token=abc',
      12345
    );
    expect(url).toContain('v=12345');
    expect(url).toContain('token=abc');
  });
});

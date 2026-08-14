/** Viewport and crop circle geometry shared by AvatarUploader preview + export. */
export const AVATAR_VIEWPORT_SIZE = 320;
export const AVATAR_CIRCLE_DIAMETER = 256;
export const AVATAR_CIRCLE_MARGIN =
  (AVATAR_VIEWPORT_SIZE - AVATAR_CIRCLE_DIAMETER) / 2;
export const AVATAR_OUTPUT_SIZE = 256;

export type AvatarCropTransform = {
  scale: number;
  offset: { x: number; y: number };
};

/**
 * Scale + center the image so it fully covers the circular crop region
 * (CSS object-fit: cover against the circle's bounding box).
 */
export function getCoverTransform(
  naturalWidth: number,
  naturalHeight: number,
  circleDiameter: number = AVATAR_CIRCLE_DIAMETER,
  viewportSize: number = AVATAR_VIEWPORT_SIZE
): AvatarCropTransform {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { scale: 1, offset: { x: 0, y: 0 } };
  }

  const scale = Math.max(circleDiameter / naturalWidth, circleDiameter / naturalHeight);
  const scaledW = naturalWidth * scale;
  const scaledH = naturalHeight * scale;
  const center = viewportSize / 2;

  return {
    scale,
    offset: {
      x: center - scaledW / 2,
      y: center - scaledH / 2,
    },
  };
}

/**
 * Draw the image into an output canvas the same way the preview positions it,
 * then copy the circular crop region. Avoids blank exports when the source
 * rectangle would fall outside a small image (the old sx/sy path).
 */
export function renderAvatarCropToCanvas(
  image: CanvasImageSource & { naturalWidth: number; naturalHeight: number },
  transform: AvatarCropTransform,
  options?: {
    viewportSize?: number;
    circleMargin?: number;
    circleDiameter?: number;
    outputSize?: number;
  }
): HTMLCanvasElement {
  const viewportSize = options?.viewportSize ?? AVATAR_VIEWPORT_SIZE;
  const circleMargin = options?.circleMargin ?? AVATAR_CIRCLE_MARGIN;
  const circleDiameter = options?.circleDiameter ?? AVATAR_CIRCLE_DIAMETER;
  const outputSize = options?.outputSize ?? AVATAR_OUTPUT_SIZE;
  const { scale, offset } = transform;

  const viewport = document.createElement('canvas');
  viewport.width = viewportSize;
  viewport.height = viewportSize;
  const vctx = viewport.getContext('2d');
  if (!vctx) {
    throw new Error('Could not create canvas context for avatar crop');
  }

  // Opaque backdrop so transparent source pixels don't yield an "empty" avatar.
  vctx.fillStyle = '#ffffff';
  vctx.fillRect(0, 0, viewportSize, viewportSize);
  vctx.drawImage(
    image,
    offset.x,
    offset.y,
    image.naturalWidth * scale,
    image.naturalHeight * scale
  );

  const output = document.createElement('canvas');
  output.width = outputSize;
  output.height = outputSize;
  const octx = output.getContext('2d');
  if (!octx) {
    throw new Error('Could not create canvas context for avatar export');
  }

  octx.drawImage(
    viewport,
    circleMargin,
    circleMargin,
    circleDiameter,
    circleDiameter,
    0,
    0,
    outputSize,
    outputSize
  );

  return output;
}

/** Append a cache-buster so re-uploads to the same storage path refresh in browsers. */
export function withAvatarCacheBust(publicUrl: string, version: number = Date.now()): string {
  const url = new URL(publicUrl);
  url.searchParams.set('v', String(version));
  return url.toString();
}

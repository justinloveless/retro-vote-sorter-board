import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import {
  AVATAR_CIRCLE_DIAMETER,
  AVATAR_CIRCLE_MARGIN,
  AVATAR_VIEWPORT_SIZE,
  getCoverTransform,
  renderAvatarCropToCanvas,
} from '@/components/account/avatarCrop';

interface AvatarUploaderProps {
  initialUrl?: string | null;
  onCropped: (blob: Blob) => Promise<void> | void;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ onCropped }) => {
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoadError(null);
    setFileName(f.name);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        setLoadError('Could not read that image. Try a different PNG or JPEG.');
        setImage(null);
        return;
      }
      const cover = getCoverTransform(img.naturalWidth, img.naturalHeight);
      setImage(img);
      setScale(cover.scale);
      setOffset(cover.offset);
      setOpen(true);
    };
    img.onerror = () => {
      setLoadError('Failed to load that image. Try a different file.');
      setImage(null);
    };
    img.src = url;
    // Allow re-selecting the same file
    e.target.value = '';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...offset };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({ x: offsetStartRef.current.x + dx, y: offsetStartRef.current.y + dy });
  };
  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const exportCropped = async () => {
    if (!image || !containerRef.current || saving) return;
    setSaving(true);
    try {
      const canvas = renderAvatarCropToCanvas(image, { scale, offset });
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
      if (!blob || blob.size < 32) {
        throw new Error('Cropped image was empty. Adjust zoom/position and try again.');
      }
      await onCropped(blob);
      setOpen(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const minScale = image
    ? Math.max(
        AVATAR_CIRCLE_DIAMETER / image.naturalWidth,
        AVATAR_CIRCLE_DIAMETER / image.naturalHeight
      ) * 0.5
    : 0.5;
  const maxScale = Math.max(minScale * 6, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {fileName ? 'Change Image' : 'Choose Image'}
        </Button>
        {fileName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={fileName}>
            {fileName}
          </span>
        )}
      </div>
      {loadError && !open && (
        <p className="text-sm text-destructive">{loadError}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop your avatar</DialogTitle>
          </DialogHeader>
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative mx-auto overflow-hidden bg-white"
            style={{ width: AVATAR_VIEWPORT_SIZE, height: AVATAR_VIEWPORT_SIZE, cursor: 'grab' }}
          >
            {image && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: AVATAR_VIEWPORT_SIZE,
                  height: AVATAR_VIEWPORT_SIZE,
                  backgroundImage: `url(${image.src})`,
                  backgroundSize: `${image.naturalWidth * scale}px ${image.naturalHeight * scale}px`,
                  backgroundPosition: `${offset.x}px ${offset.y}px`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
            )}
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                left: AVATAR_CIRCLE_MARGIN,
                top: AVATAR_CIRCLE_MARGIN,
                width: AVATAR_CIRCLE_DIAMETER,
                height: AVATAR_CIRCLE_DIAMETER,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                borderRadius: '9999px',
              }}
            />
          </div>
          <div className="flex items-center gap-3 pt-3">
            <label className="text-sm text-gray-600 dark:text-gray-300">Zoom</label>
            <input
              type="range"
              min={minScale}
              max={maxScale}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          {loadError && (
            <p className="text-sm text-destructive">{loadError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={exportCropped} disabled={!image || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

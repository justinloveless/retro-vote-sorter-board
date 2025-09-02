import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx';
import { Upload } from 'lucide-react';

interface AvatarUploaderProps {
  initialUrl?: string | null;
  onCropped: (blob: Blob) => Promise<void> | void;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ initialUrl, onCropped }) => {
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); };
  }, [fileUrl]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setOpen(true);
    };
    img.src = url;
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
  const handleMouseUp = () => { isDraggingRef.current = false; };

  const exportCropped = async () => {
    if (!image || !containerRef.current) return;
    const viewportSize = 320; // full preview area
    const circleDiameter = 256; // visible circle
    const circleMargin = (viewportSize - circleDiameter) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Compute source crop rect in image coordinates
    // Image is rendered with top-left at offset (x,y) and scaled by `scale` inside a square viewport of size viewportSize
    // The visible circle is inset by circleMargin on each side, so crop from that region
    const sx = (-offset.x + circleMargin) / scale;
    const sy = (-offset.y + circleMargin) / scale;
    const sSize = circleDiameter / scale;

    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(image, sx, sy, sSize, sSize, 0, 0, 256, 256);
    // Export PNG
    canvas.toBlob(async (blob) => {
      if (blob) {
        await onCropped(blob);
        setOpen(false);
      }
    }, 'image/png');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {fileName ? 'Change Image' : 'Choose Image'}
        </Button>
        {fileName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={fileName}>{fileName}</span>
        )}
      </div>

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
            className="relative mx-auto" 
            style={{ width: 320, height: 320, cursor: 'grab' }}
          >
            {/* Image layer */}
            {image && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 320,
                  height: 320,
                  backgroundImage: `url(${image.src})`,
                  backgroundSize: `${image.naturalWidth * scale}px ${image.naturalHeight * scale}px`,
                  backgroundPosition: `${offset.x}px ${offset.y}px`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
            )}
            {/* Circular overlay */}
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                left: 32,
                top: 32,
                width: 256,
                height: 256,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                borderRadius: '9999px'
              }}
            />
          </div>
          <div className="flex items-center gap-3 pt-3">
            <label className="text-sm text-gray-600 dark:text-gray-300">Zoom</label>
            <input type="range" min={0.5} max={3} step={0.01} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={exportCropped}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};



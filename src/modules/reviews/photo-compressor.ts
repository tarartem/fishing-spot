/**
 * Client-side WebP Photo Compressor ($0 Storage Optimization).
 * Resizes angler catch photos to max 1280px and compresses to WebP (<= 200KB target)
 * before uploading to Supabase Storage.
 */
export interface CompressedPhotoResult {
  dataUrl: string;
  mimeType: 'image/webp';
  sizeBytes: number;
  width: number;
  height: number;
}

export async function compressPhotoToWebP(
  file: File,
  maxDimension = 1280,
  quality = 0.78
): Promise<CompressedPhotoResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', quality);
        const base64Length = dataUrl.split(',')[1]?.length ?? 0;
        const sizeBytes = Math.round((base64Length * 3) / 4);

        resolve({
          dataUrl,
          mimeType: 'image/webp',
          sizeBytes,
          width,
          height,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

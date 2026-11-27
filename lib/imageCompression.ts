/**
 * Utility to compress an image (File or Blob) to strictly under 60 KB (61,440 bytes).
 * Iteratively resizes dimensions and reduces JPEG quality on an off-screen HTML canvas.
 */
export async function compressImageToMax60KB(
  fileOrBlob: File | Blob,
  maxBytes: number = 60 * 1024
): Promise<{ blob: Blob; sizeKB: number }> {
  // If already under maxBytes and is jpeg/png, still ensure it is processed
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image element"));
      img.onload = async () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Clamp initial maximum dimensions to 1024px while keeping aspect ratio
          const MAX_INITIAL_DIM = 1024;
          if (width > MAX_INITIAL_DIM || height > MAX_INITIAL_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_INITIAL_DIM) / width);
              width = MAX_INITIAL_DIM;
            } else {
              width = Math.round((width * MAX_INITIAL_DIM) / height);
              height = Math.round(MAX_INITIAL_DIM);
            }
          }

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Canvas 2D context not available");
          }

          let quality = 0.82;
          let iteration = 0;
          const maxIterations = 14;

          const compressAttempt = (): Promise<Blob> => {
            return new Promise((resBlob) => {
              canvas.width = width;
              canvas.height = height;
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";
              ctx.clearRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    return resBlob(new Blob());
                  }

                  // If size <= maxBytes OR reached bottom constraints
                  if (
                    blob.size <= maxBytes ||
                    (quality <= 0.22 && width <= 280) ||
                    iteration >= maxIterations
                  ) {
                    return resBlob(blob);
                  }

                  iteration++;
                  if (quality > 0.42) {
                    quality -= 0.12;
                  } else {
                    // Downscale dimensions by 20% and bump quality slightly
                    width = Math.max(200, Math.round(width * 0.8));
                    height = Math.max(200, Math.round(height * 0.8));
                    quality = 0.65;
                  }

                  compressAttempt().then(resBlob);
                },
                "image/jpeg",
                quality
              );
            });
          };

          const finalBlob = await compressAttempt();
          const sizeKB = Number((finalBlob.size / 1024).toFixed(1));
          resolve({ blob: finalBlob, sizeKB });
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Uploads a compressed image blob to ImageKit via `/api/upload`
 */
export async function uploadToImageKit(
  blob: Blob,
  fileNamePrefix: string = "warehouse"
): Promise<string> {
  const fileName = `${fileNamePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`;
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("folder", "/warehouse");
  formData.append("fileName", fileName);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to upload to ImageKit");
  }

  return data.url;
}

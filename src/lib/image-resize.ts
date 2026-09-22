// Client-side only (uses browser APIs). Shrinks an uploaded image to a
// sane max dimension before it goes over the wire -- a logo only ever
// displays at a few dozen pixels tall, so there's no reason to upload a
// multi-megabyte photo/scan straight off a phone. Falls back to the
// original file if resizing fails for any reason (unsupported browser
// API, corrupt image, etc.) rather than blocking the upload.
export async function resizeImageFile(file: File, maxDimension = 600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^./\\]+$/, "");
    return new File([blob], `${baseName}.png`, { type: "image/png" });
  } catch {
    return file;
  }
}

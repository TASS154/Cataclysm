/**
 * Redimensiona e exporta como JPEG para caber melhor no Firestore (ficha inteira ~1 MiB).
 */
export function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = dataUrl;
  });
}

export async function blobToCompressedDataUrl(blob, { maxSide = 960, quality = 0.78 } = {}) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return compressDataUrl(dataUrl, { maxSide, quality });
}

export async function compressDataUrl(dataUrl, { maxSide = 960, quality = 0.78 } = {}) {
  const img = await loadImageFromDataUrl(dataUrl);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) return dataUrl;

  if (w > maxSide || h > maxSide) {
    if (w >= h) {
      h = Math.round((h * maxSide) / w);
      w = maxSide;
    } else {
      w = Math.round((w * maxSide) / h);
      h = maxSide;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

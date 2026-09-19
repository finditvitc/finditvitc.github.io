export const DEFAULT_CATEGORY_IMAGES = {
  'Electronics': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
  'Keys': 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80',
  'Bags & Backpacks': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
  'IDs & Cards': 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=600&auto=format&fit=crop&q=80',
  'Clothing': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
  'Books': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
  'Eyewear': 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80',
  'Jewelry': 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80',
  'Other': 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=600&auto=format&fit=crop&q=80'
};

export const extractCanvasDominantColor = (canvas) => {
  try {
    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return null;

    // Sample down to a 40x40 grid for high performance and noise reduction
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 40;
    sampleCanvas.height = 40;
    const sCtx = sampleCanvas.getContext('2d');
    sCtx.drawImage(canvas, 0, 0, 40, 40);

    const imgData = sCtx.getImageData(0, 0, 40, 40).data;
    const colorScores = {};

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];
      if (a < 128) continue;
      // Skip pure white/bright background
      if (r > 240 && g > 240 && b > 240) continue;

      const rf = r / 255, gf = g / 255, bf = b / 255;
      const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
      const d = max - min;
      const v = max;
      const s = max === 0 ? 0 : d / max;

      let h = 0;
      if (max !== min) {
        if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
        else if (max === gf) h = (bf - rf) / d + 2;
        else h = (rf - gf) / d + 4;
        h /= 6;
      }

      let cName = '';
      let score = 0;

      if (s < 0.18) {
        if (v < 0.25) { cName = 'Black'; score = 0.4; }
        else if (v > 0.85) { cName = 'White'; score = 0.2; }
        else { cName = 'Gray'; score = 0.3; }
      } else {
        const deg = h * 360;
        score = s * (1.2 + v) * 2.0;
        if (deg < 15 || deg >= 345) cName = 'Red';
        else if (deg < 42) cName = 'Orange';
        else if (deg < 68) cName = 'Yellow';
        else if (deg < 165) cName = 'Green';
        else if (deg < 195) cName = s > 0.25 ? 'Teal' : 'Cyan';
        else if (deg < 260) cName = v < 0.4 ? 'Navy Blue' : 'Blue';
        else if (deg < 295) cName = 'Purple';
        else if (deg < 345) cName = 'Pink';
        else cName = 'Red';
      }

      colorScores[cName] = (colorScores[cName] || 0) + score;
    }

    const sorted = Object.entries(colorScores).sort((a, b) => b[1] - a[1]);
    return (sorted.length > 0 && sorted[0][1] > 5) ? sorted[0][0] : null;
  } catch {
    return null;
  }
};

export const compressImageFile = (file, maxDimension = 640, quality = 0.72) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ dataUrl: '', dominantColor: null, file: null });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result || '';
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dominantColor = extractCanvasDominantColor(canvas);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: compressedDataUrl, dominantColor, width, height });
      };
      img.onerror = () => {
        resolve({ dataUrl: rawDataUrl, dominantColor: null, width: 0, height: 0 });
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      resolve({ dataUrl: '', dominantColor: null, file });
    };
    reader.readAsDataURL(file);
  });
};


export const getCategoryFallbackImage = (category) => {
  if (!category) return DEFAULT_CATEGORY_IMAGES['Other'];
  return DEFAULT_CATEGORY_IMAGES[category] || DEFAULT_CATEGORY_IMAGES['Other'];
};

export const getImageUrl = (photoUrl, category) => {
  if (!photoUrl) {
    return getCategoryFallbackImage(category);
  }
  if (typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return `${baseUrl}${photoUrl}`;
  }
  return photoUrl;
};



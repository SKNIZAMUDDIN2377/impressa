// ==========================================
// IMPRESSA IMAGE EDITING
// Shared by the editor preview and the final export, so what you
// see in the editor is exactly what gets uploaded.
// ==========================================

export const MAX_OUTPUT_SIDE = 2048;
export const OUTPUT_QUALITY = 0.92;
export const ZOOM_MAX = 4;

// The feed shows posts between 4:5 (portrait) and 1.91:1 (wide)
export const MIN_RATIO = 4 / 5;
export const MAX_RATIO = 1.91;

export const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

// ------------------------------------------
// OPTIONS
// ------------------------------------------

export const ASPECTS = [
  { id: "original", label: "Original", ratio: null },
  { id: "square", label: "1:1", ratio: 1 },
  { id: "portrait", label: "4:5", ratio: 4 / 5 },
  { id: "wide", label: "16:9", ratio: 16 / 9 },
];

export const ADJUST_TOOLS = [
  { id: "brightness", label: "Brightness", min: -100, max: 100 },
  { id: "contrast", label: "Contrast", min: -100, max: 100 },
  { id: "saturation", label: "Saturation", min: -100, max: 100 },
  { id: "warmth", label: "Warmth", min: -100, max: 100 },
  { id: "fade", label: "Fade", min: 0, max: 100 },
  { id: "sharpness", label: "Sharpness", min: 0, max: 100 },
];

const TOOL_MAP = Object.fromEntries(
  ADJUST_TOOLS.map((tool) => [tool.id, tool])
);

export const LOOK_KEYS = ADJUST_TOOLS.map((tool) => tool.id);

export const FILTERS = [
  { id: "none", name: "Original", look: {} },
  { id: "warm", name: "Warm", look: { warmth: 30, saturation: 12, contrast: 4 } },
  { id: "cool", name: "Cool", look: { warmth: -28, saturation: 6, brightness: 3 } },
  { id: "bright", name: "Bright", look: { brightness: 16, contrast: 6, saturation: 6 } },
  { id: "vivid", name: "Vivid", look: { saturation: 42, contrast: 10 } },
  { id: "classic", name: "Classic", look: { saturation: -65, contrast: 14 } },
  { id: "soft", name: "Soft", look: { brightness: 8, saturation: -18, contrast: -8, fade: 14 } },
  { id: "fade", name: "Fade", look: { fade: 38, saturation: -12, contrast: -6 } },
  { id: "mono", name: "Mono", look: { saturation: -100, contrast: 12 } },
];

const FILTER_MAP = Object.fromEntries(
  FILTERS.map((filter) => [filter.id, filter])
);

export const DEFAULT_EDIT = {
  aspect: "original",
  zoom: 1,
  nx: 0, // horizontal offset, as a fraction of the frame width
  ny: 0, // vertical offset, as a fraction of the frame height
  rotation: 0,
  filter: "none",
  intensity: 100,
  adjust: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    fade: 0,
    sharpness: 0,
  },
};

export const cloneEdit = (edit) => ({
  ...edit,
  adjust: { ...edit.adjust },
});

export const isSameEdit = (a, b) =>
  JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------
// LOOK (filter preset + manual adjustments)
// ------------------------------------------

export function lookForPreset(filterId) {
  const preset = FILTER_MAP[filterId]?.look || {};

  const look = {};

  LOOK_KEYS.forEach((key) => {
    look[key] = clamp(
      preset[key] || 0,
      TOOL_MAP[key].min,
      TOOL_MAP[key].max
    );
  });

  return look;
}

// Stable objects, so filter thumbnails only redraw when needed
export const PRESET_LOOKS = FILTERS.map((filter) => ({
  id: filter.id,
  name: filter.name,
  look: lookForPreset(filter.id),
}));

export function mergeLook(edit) {
  const preset = FILTER_MAP[edit.filter]?.look || {};

  const strength = (edit.intensity ?? 100) / 100;

  const look = {};

  LOOK_KEYS.forEach((key) => {
    const value =
      (preset[key] || 0) * strength + (edit.adjust?.[key] || 0);

    look[key] = clamp(value, TOOL_MAP[key].min, TOOL_MAP[key].max);
  });

  return look;
}

export const hasLook = (look) =>
  LOOK_KEYS.some((key) => Math.abs(look[key]) > 0.01);

// ------------------------------------------
// GEOMETRY
// The image always covers the frame; zoom is relative to that.
// ------------------------------------------

export function getRotated(natW, natH, rotation) {
  const rot = (((rotation || 0) % 360) + 360) % 360;

  const swap = rot === 90 || rot === 270;

  return {
    rot,
    rw: swap ? natH : natW,
    rh: swap ? natW : natH,
  };
}

export function resolveAspect(aspectId, rw, rh) {
  const option = ASPECTS.find((aspect) => aspect.id === aspectId);

  if (option && option.ratio) return option.ratio;

  return clamp(rw / rh, MIN_RATIO, MAX_RATIO);
}

// Display scale of the image (frame pixels per source pixel)
export function frameScale(rw, rh, ar, frameW, zoom) {
  return frameW * Math.max(1 / rw, 1 / (ar * rh)) * zoom;
}

// How far the image may be moved, as a fraction of the frame size
export function offsetBounds(rw, rh, ar, zoom) {
  return {
    maxNx: Math.max(0, (Math.max(1, rw / (ar * rh)) * zoom - 1) / 2),
    maxNy: Math.max(0, (Math.max(1, (ar * rh) / rw) * zoom - 1) / 2),
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.decoding = "async";

    image.onload = () => resolve(image);

    image.onerror = () =>
      reject(new Error("Could not load this image"));

    image.src = src;
  });
}

// Draws the cropped / rotated / zoomed image into a canvas context.
export function drawFramed(ctx, image, edit, ar, outW, outH) {
  const natW = image.naturalWidth;
  const natH = image.naturalHeight;

  const { rot, rw, rh } = getRotated(natW, natH, edit.rotation);

  const scale = frameScale(rw, rh, ar, outW, edit.zoom);

  const { maxNx, maxNy } = offsetBounds(rw, rh, ar, edit.zoom);

  const nx = clamp(edit.nx || 0, -maxNx, maxNx);
  const ny = clamp(edit.ny || 0, -maxNy, maxNy);

  ctx.save();

  // white behind transparent PNGs (the export is a JPEG)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.translate(outW / 2 + nx * outW, outH / 2 + ny * outH);
  ctx.rotate((rot * Math.PI) / 180);

  ctx.drawImage(
    image,
    (-natW * scale) / 2,
    (-natH * scale) / 2,
    natW * scale,
    natH * scale
  );

  ctx.restore();
}

// ------------------------------------------
// PIXEL PIPELINE
// Plain JS (no ctx.filter) so Safari / iPhone match everyone else.
// ------------------------------------------

function sharpen(imageData, amount) {
  const { width, height, data } = imageData;

  const source = new Uint8ClampedArray(data);

  const strength = amount * 0.9;

  const center = 1 + 4 * strength;

  const row = width * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * row + x * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const i = index + channel;

        data[i] =
          source[i] * center -
          strength *
            (source[i - 4] +
              source[i + 4] +
              source[i - row] +
              source[i + row]);
      }
    }
  }
}

export function applyLook(imageData, look) {
  const { brightness, contrast, saturation, warmth, fade, sharpness } =
    look;

  const data = imageData.data;

  if (brightness || contrast || saturation || warmth || fade) {
    const gain = 1 + (brightness / 100) * 0.5;
    const contrastFactor = 1 + (contrast / 100) * 0.8;
    const saturationFactor = 1 + saturation / 100;
    const warm = warmth * 0.35;
    const t = fade / 100;
    const keep = 1 - 0.3 * t;
    const lift = 255 * 0.3 * 0.85 * t;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] * gain;
      let g = data[i + 1] * gain;
      let b = data[i + 2] * gain;

      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      r = luma + (r - luma) * saturationFactor;
      g = luma + (g - luma) * saturationFactor;
      b = luma + (b - luma) * saturationFactor;

      r += warm;
      b -= warm;

      // Uint8ClampedArray clamps to 0-255 on assignment
      data[i] = r * keep + lift;
      data[i + 1] = g * keep + lift;
      data[i + 2] = b * keep + lift;
    }
  }

  if (sharpness > 0) {
    sharpen(imageData, sharpness / 100);
  }
}

// ------------------------------------------
// EXPORT
// ------------------------------------------

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

// Renders the final image at upload resolution:
// crop + rotation + look baked in, long side capped, never upscaled.
export async function renderEditedBlob(image, edit, options = {}) {
  const maxSide = options.maxSide || MAX_OUTPUT_SIDE;
  const quality = options.quality || OUTPUT_QUALITY;

  const natW = image.naturalWidth;
  const natH = image.naturalHeight;

  const { rw, rh } = getRotated(natW, natH, edit.rotation);

  const ar = resolveAspect(edit.aspect, rw, rh);

  // size of the visible area, in source pixels
  const regionW = Math.min(rw, ar * rh) / Math.max(1, edit.zoom);
  const regionH = regionW / ar;

  const ratio = Math.min(1, maxSide / Math.max(regionW, regionH));

  const outW = Math.max(1, Math.round(regionW * ratio));
  const outH = Math.max(1, Math.round(outW / ar));

  const look = mergeLook(edit);

  const needsLook = hasLook(look);

  const canvas = document.createElement("canvas");

  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: needsLook,
  });

  drawFramed(ctx, image, edit, ar, outW, outH);

  if (needsLook) {
    const imageData = ctx.getImageData(0, 0, outW, outH);

    applyLook(imageData, look);

    ctx.putImageData(imageData, 0, 0);
  }

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);

  // release the pixel memory right away (matters on iOS)
  canvas.width = 0;
  canvas.height = 0;

  if (!blob) {
    throw new Error("Could not export the image");
  }

  return { blob, width: outW, height: outH };
}
// ==========================================
// IMPRESSA VIDEO EDITING
//
// Videos are never re-encoded in the browser (unreliable on phones).
// The ORIGINAL file is uploaded once; trim / crop / filter / mute are
// stored as a small "edit" object and applied by Cloudinary when the
// video is delivered (a transformation inside the URL).
// ==========================================

import { ASPECTS, clamp, offsetBounds } from "./imageEditing";

export const MIN_CLIP_SECONDS = 1;

const round2 = (value) => Math.round(value * 100) / 100;
const round4 = (value) => Math.round(value * 10000) / 10000;

const abortError = () =>
  Object.assign(new Error("Cancelled"), { name: "AbortError" });

// ------------------------------------------
// OPTIONS
// ------------------------------------------

export const VIDEO_LOOK_KEYS = [
  "brightness",
  "contrast",
  "saturation",
  "sepia",
];

export const VIDEO_ADJUST_TOOLS = [
  { id: "brightness", label: "Brightness", min: -100, max: 100 },
  { id: "contrast", label: "Contrast", min: -100, max: 100 },
  { id: "saturation", label: "Saturation", min: -100, max: 100 },
];

export const VIDEO_FILTERS = [
  { id: "none", name: "Original", look: {} },
  { id: "warm", name: "Warm", look: { sepia: 22, saturation: 12, contrast: 4 } },
  { id: "bright", name: "Bright", look: { brightness: 16, contrast: 6, saturation: 6 } },
  { id: "vivid", name: "Vivid", look: { saturation: 42, contrast: 10 } },
  { id: "classic", name: "Classic", look: { saturation: -65, contrast: 14 } },
  { id: "soft", name: "Soft", look: { brightness: 8, saturation: -18, contrast: -8 } },
  { id: "fade", name: "Fade", look: { brightness: 6, saturation: -14, contrast: -12 } },
  { id: "mono", name: "Mono", look: { saturation: -100, contrast: 12 } },
];

const VIDEO_FILTER_MAP = Object.fromEntries(
  VIDEO_FILTERS.map((filter) => [filter.id, filter])
);

const limitLook = (key, value) =>
  key === "sepia" ? clamp(value, 0, 100) : clamp(value, -100, 100);

// Stable objects, so filter thumbnails only redraw when needed
export const PRESET_VIDEO_LOOKS = VIDEO_FILTERS.map((filter) => {
  const look = {};

  VIDEO_LOOK_KEYS.forEach((key) => {
    look[key] = limitLook(key, filter.look[key] || 0);
  });

  return { id: filter.id, name: filter.name, look };
});

export const DEFAULT_VIDEO_EDIT = {
  trimStart: 0, // seconds
  trimEnd: null, // seconds, null = until the end
  muted: false,
  aspect: "original",
  zoom: 1,
  nx: 0,
  ny: 0,
  filter: "none",
  intensity: 100,
  adjust: { brightness: 0, contrast: 0, saturation: 0 },
  crop: null, // { x, y, w, h } as fractions of the video (set on Done)
  srcRatio: null, // width / height of the video the crop was made on
};

export const cloneVideoEdit = (edit) => ({
  ...DEFAULT_VIDEO_EDIT,
  ...(edit || {}),
  adjust: {
    ...DEFAULT_VIDEO_EDIT.adjust,
    ...((edit && edit.adjust) || {}),
  },
  crop: edit && edit.crop ? { ...edit.crop } : null,
});

export const isSameVideoEdit = (a, b) =>
  JSON.stringify(cloneVideoEdit(a)) === JSON.stringify(cloneVideoEdit(b));

// ------------------------------------------
// LOOK (filter preset + manual adjustments)
// ------------------------------------------

export function mergeVideoLook(edit) {
  const preset = VIDEO_FILTER_MAP[edit?.filter]?.look || {};

  const strength = (edit?.intensity ?? 100) / 100;

  const look = {};

  VIDEO_LOOK_KEYS.forEach((key) => {
    const value =
      (preset[key] || 0) * strength + (edit?.adjust?.[key] || 0);

    look[key] = limitLook(key, value);
  });

  return look;
}

export const hasVideoLook = (look) =>
  VIDEO_LOOK_KEYS.some((key) => Math.abs(look[key] || 0) > 0.01);

// CSS version, used for the live preview (close to what Cloudinary renders)
export function videoCssFilter(look) {
  const parts = [];

  if (look.brightness) {
    parts.push(`brightness(${(1 + look.brightness / 100).toFixed(3)})`);
  }

  if (look.contrast) {
    parts.push(`contrast(${(1 + look.contrast / 100).toFixed(3)})`);
  }

  if (look.saturation) {
    parts.push(
      `saturate(${Math.max(0, 1 + look.saturation / 100).toFixed(3)})`
    );
  }

  if (look.sepia) {
    parts.push(`sepia(${(look.sepia / 100).toFixed(3)})`);
  }

  return parts.length > 0 ? parts.join(" ") : "none";
}

// Inline style for <video> elements outside the editor
export function videoPreviewStyle(edit) {
  if (!edit) return undefined;

  const filter = videoCssFilter(mergeVideoLook(edit));

  return filter === "none" ? undefined : { filter };
}

export function hasVideoEdit(edit) {
  if (!edit) return false;

  return (
    Number(edit.trimStart) > 0.01 ||
    edit.trimEnd != null ||
    edit.muted === true ||
    Boolean(edit.crop) ||
    hasVideoLook(mergeVideoLook(edit))
  );
}

// ------------------------------------------
// CROP
// Same geometry as the photo editor, so the preview matches the result.
// Returns the visible area as fractions of the video, or null when the
// whole video is kept.
// ------------------------------------------

export function computeCropRect(edit, vw, vh) {
  const option = ASPECTS.find((aspect) => aspect.id === edit.aspect);

  const ar = option?.ratio || vw / vh;

  if (!option?.ratio && edit.zoom <= 1.001) return null;

  const { maxNx, maxNy } = offsetBounds(vw, vh, ar, edit.zoom);

  const nx = clamp(edit.nx || 0, -maxNx, maxNx);
  const ny = clamp(edit.ny || 0, -maxNy, maxNy);

  const regionW = Math.min(vw, ar * vh) / Math.max(1, edit.zoom);
  const regionH = regionW / ar;

  const centerX = vw / 2 - nx * regionW;
  const centerY = vh / 2 - ny * regionH;

  const x = clamp(centerX - regionW / 2, 0, Math.max(0, vw - regionW));
  const y = clamp(centerY - regionH / 2, 0, Math.max(0, vh - regionH));

  return {
    x: x / vw,
    y: y / vh,
    w: regionW / vw,
    h: regionH / vh,
  };
}

// Cleans an edit before it is saved on the media item
export function finalizeVideoEdit(edit, meta) {
  const next = cloneVideoEdit(edit);

  const duration = Number(meta?.duration) || 0;

  if (duration > 0) {
    const start = clamp(Number(next.trimStart) || 0, 0, duration);

    const end = clamp(
      next.trimEnd == null ? duration : Number(next.trimEnd),
      start,
      duration
    );

    next.trimStart = start <= 0.05 ? 0 : round2(start);
    next.trimEnd = end >= duration - 0.05 ? null : round2(end);
  }

  const vw = Number(meta?.w) || 0;
  const vh = Number(meta?.h) || 0;

  if (vw > 0 && vh > 0) {
    const crop = computeCropRect(next, vw, vh);

    next.crop = crop
      ? {
          x: round4(crop.x),
          y: round4(crop.y),
          w: round4(crop.w),
          h: round4(crop.h),
        }
      : null;

    next.srcRatio = crop ? round4(vw / vh) : null;
  }

  return next;
}

// ------------------------------------------
// CLOUDINARY DELIVERY URL
// ------------------------------------------

const evenNumber = (value) => Math.max(2, Math.round(value / 2) * 2);

// originalUrl: the uploaded video. dims: { width, height } from Cloudinary.
// Returns { url, width, height } of the edited video.
export function buildVideoDelivery(originalUrl, edit, dims) {
  let originalW = Number(dims?.width) || 0;
  let originalH = Number(dims?.height) || 0;

  const unchanged = {
    url: originalUrl,
    width: originalW || undefined,
    height: originalH || undefined,
  };

  if (!edit || !hasVideoEdit(edit)) return unchanged;

  const marker = "/upload/";

  const at = originalUrl.indexOf(marker);

  if (at === -1) return unchanged;

  // Cloudinary may report a rotated phone video with swapped sides
  if (edit.srcRatio && originalW > 0 && originalH > 0) {
    const direct = Math.abs(
      Math.log(originalW / originalH / edit.srcRatio)
    );

    const swapped = Math.abs(
      Math.log(originalH / originalW / edit.srcRatio)
    );

    if (swapped < direct) {
      [originalW, originalH] = [originalH, originalW];
    }
  }

  const parts = [];

  // 1) trim
  const trim = [];

  if (Number(edit.trimStart) > 0.01) {
    trim.push(`so_${round2(edit.trimStart)}`);
  }

  if (edit.trimEnd != null) {
    trim.push(`eo_${round2(edit.trimEnd)}`);
  }

  if (trim.length > 0) parts.push(trim.join(","));

  // 2) crop
  let outW = originalW;
  let outH = originalH;

  if (edit.crop && originalW > 0 && originalH > 0) {
    const w = Math.min(originalW, evenNumber(edit.crop.w * originalW));
    const h = Math.min(originalH, evenNumber(edit.crop.h * originalH));

    const x = clamp(
      Math.round(edit.crop.x * originalW),
      0,
      Math.max(0, originalW - w)
    );

    const y = clamp(
      Math.round(edit.crop.y * originalH),
      0,
      Math.max(0, originalH - h)
    );

    parts.push(`c_crop,w_${w},h_${h},x_${x},y_${y}`);

    outW = w;
    outH = h;
  }

  // 3) look (one effect per component)
  const look = mergeVideoLook(edit);

  const brightness = Math.round(clamp(look.brightness, -99, 100));
  const contrast = Math.round(clamp(look.contrast, -100, 100));
  const saturation = Math.round(clamp(look.saturation, -100, 100));
  const sepia = Math.round(clamp(look.sepia, 0, 100));

  if (brightness) parts.push(`e_brightness:${brightness}`);
  if (contrast) parts.push(`e_contrast:${contrast}`);
  if (saturation) parts.push(`e_saturation:${saturation}`);
  if (sepia) parts.push(`e_sepia:${sepia}`);

  // 4) sound
  if (edit.muted) parts.push("ac_none");

  if (parts.length === 0) return unchanged;

  const head = originalUrl.slice(0, at + marker.length);
  const tail = originalUrl.slice(at + marker.length);

  // .mp4 makes Cloudinary deliver H.264 / AAC that every phone plays
  const url = `${head}${parts.join("/")}/${tail}`.replace(
    /\.[a-zA-Z0-9]{2,5}(\?.*)?$/,
    ".mp4"
  );

  return {
    url,
    width: outW || undefined,
    height: outH || undefined,
  };
}

// ------------------------------------------
// WAIT UNTIL THE EDITED VIDEO IS READY
// Cloudinary builds the edited version the first time it is requested
// (answers 423 while working). Posting only after it is ready means the
// first viewer never sees a broken video.
// ------------------------------------------

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });

export async function waitForVideoReady(
  url,
  signal,
  { timeoutMs = 120000 } = {}
) {
  const started = Date.now();

  let delay = 1200;
  let failures = 0;

  for (;;) {
    if (signal?.aborted) throw abortError();

    let status = 0;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-1" },
        cache: "no-store",
        signal,
      });

      status = response.status;

      try {
        response.body?.cancel?.();
      } catch (cancelError) {
        // ignore
      }
    } catch (error) {
      if (error.name === "AbortError" || signal?.aborted) {
        throw abortError();
      }

      status = 0;
    }

    if (status === 200 || status === 206) return;

    if (status === 0) {
      failures += 1;

      // The browser cannot check (network / CORS): trust the server
      if (failures >= 3) return;
    }

    if (status === 0 || status === 202 || status === 423 || status >= 500) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(
          "Your video is still being processed. Please try again in a moment."
        );
      }

      await sleep(delay, signal);

      delay = Math.min(Math.round(delay * 1.4), 5000);

      continue;
    }

    throw new Error(
      `Your video edits could not be applied (error ${status}). Remove the edits and try again.`
    );
  }
}

// ------------------------------------------
// TIME LABEL  (0:05.3)
// ------------------------------------------

export function formatTime(seconds) {
  const tenths = Math.round(Math.max(0, Number(seconds) || 0) * 10);

  const minutes = Math.floor(tenths / 600);

  const rest = (tenths - minutes * 600) / 10;

  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}
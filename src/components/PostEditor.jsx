import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./PostEditor.css";

import {
  ADJUST_TOOLS,
  ASPECTS,
  DEFAULT_EDIT,
  PRESET_LOOKS,
  ZOOM_MAX,
  applyLook,
  clamp,
  cloneEdit,
  drawFramed,
  frameScale,
  getRotated,
  hasLook,
  isSameEdit,
  loadImage,
  mergeLook,
  offsetBounds,
  renderEditedBlob,
  resolveAspect,
} from "../utils/imageEditing";

import {
  DEFAULT_VIDEO_EDIT,
  MIN_CLIP_SECONDS,
  PRESET_VIDEO_LOOKS,
  VIDEO_ADJUST_TOOLS,
  cloneVideoEdit,
  finalizeVideoEdit,
  formatTime,
  isSameVideoEdit,
  mergeVideoLook,
  videoCssFilter,
} from "../utils/videoEditing";

const PHOTO_TABS = [
  { id: "crop", label: "Crop", icon: "crop" },
  { id: "filters", label: "Filters", icon: "filters" },
  { id: "adjust", label: "Adjust", icon: "adjust" },
];

const VIDEO_TABS = [
  { id: "trim", label: "Trim", icon: "trim" },
  { id: "crop", label: "Crop", icon: "crop" },
  { id: "filters", label: "Filters", icon: "filters" },
  { id: "adjust", label: "Adjust", icon: "adjust" },
  { id: "sound", label: "Sound", icon: "sound" },
];

const PREVIEW_MAX = 900;
const THUMB_LONG_SIDE = 104;
const STAGE_PADDING = 14;
const STRIP_FRAMES = 8;

/* ---------------------------------------------------------
   ICONS
--------------------------------------------------------- */

const ICONS = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  crop: (
    <>
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
    </>
  ),
  filters: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </>
  ),
  adjust: (
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  ),
  trim: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </>
  ),
  sound: (
    <>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </>
  ),
  mute: (
    <>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M23 9l-6 6M17 9l6 6" />
    </>
  ),
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: (
    <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none" />
  ),
  rotate: (
    <>
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </>
  ),
};

function Icon({ name, size = 22 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ---------------------------------------------------------
   SMALL SHARED PIECES
--------------------------------------------------------- */

function Slider({ min, max, step = 1, value, onChange, disabled, label }) {
  const span = max - min || 1;

  const fill = clamp(((value - min) / span) * 100, 0, 100);

  return (
    <input
      type="range"
      className="pe-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
      style={{ "--fill": `${fill}%` }}
    />
  );
}

function EditorHeader({ title, onClose, onDone, doneDisabled, saving }) {
  return (
    <header className="pe-header">
      <button
        type="button"
        className="pe-icon-btn"
        onClick={onClose}
        aria-label="Cancel editing"
      >
        <Icon name="close" size={20} />
      </button>

      <div className="pe-title">
        <span>IMPRESSA EDITOR</span>
        <h2>{title}</h2>
      </div>

      <button
        type="button"
        className="pe-done"
        onClick={onDone}
        disabled={doneDisabled}
      >
        {saving ? "Saving…" : "Done"}
      </button>
    </header>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <nav
      className="pe-tabs"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      aria-label="Editor tools"
    >
      {tabs.map((entry) => (
        <button
          type="button"
          key={entry.id}
          className={active === entry.id ? "active" : ""}
          onClick={() => onChange(entry.id)}
        >
          <Icon name={entry.icon} size={20} />
          <span>{entry.label}</span>
        </button>
      ))}
    </nav>
  );
}

// Measures the preview area
function useStageSize() {
  const ref = useRef(null);

  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const element = ref.current;

    if (!element) return undefined;

    const update = () =>
      setSize({
        w: element.clientWidth,
        h: element.clientHeight,
      });

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);

      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

// Crop gestures: drag = move, pinch = zoom (photos and videos)
function useFrameGestures(viewRef, setEdit) {
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  const [dragging, setDragging] = useState(false);

  const begin = () => {
    const points = Array.from(pointersRef.current.values());

    if (points.length === 0) return;

    const view = viewRef.current;

    gestureRef.current = {
      nx: view.nx,
      ny: view.ny,
      zoom: view.edit.zoom,
      p0: points[0],
      dist:
        points.length >= 2
          ? Math.hypot(
              points[1].x - points[0].x,
              points[1].y - points[0].y
            )
          : 0,
    };
  };

  const onPointerDown = (event) => {
    event.preventDefault();

    event.currentTarget.setPointerCapture?.(event.pointerId);

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    begin();

    setDragging(true);
  };

  const onPointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = Array.from(pointersRef.current.values());

    const base = gestureRef.current;

    const view = viewRef.current;

    if (!base) return;

    let zoom = base.zoom;
    let moveX = base.nx;
    let moveY = base.ny;

    if (points.length >= 2 && base.dist > 0) {
      const distance = Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y
      );

      zoom = clamp((base.zoom * distance) / base.dist, 1, ZOOM_MAX);
    } else if (points.length === 1) {
      moveX = base.nx + (points[0].x - base.p0.x) / view.frameW;
      moveY = base.ny + (points[0].y - base.p0.y) / view.frameH;
    } else {
      return;
    }

    const limit = offsetBounds(view.rw, view.rh, view.ar, zoom);

    setEdit((previous) => ({
      ...previous,
      zoom,
      nx: clamp(moveX, -limit.maxNx, limit.maxNx),
      ny: clamp(moveY, -limit.maxNy, limit.maxNy),
    }));
  };

  const onPointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      setDragging(false);
    } else {
      begin();
    }
  };

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

// Aspect chips + zoom (photos and videos)
function CropPanel({
  edit,
  setEdit,
  viewRef,
  originalRatio,
  onRotate,
  onReset,
}) {
  const chooseAspect = (id) =>
    setEdit((previous) => ({
      ...previous,
      aspect: id,
      zoom: 1,
      nx: 0,
      ny: 0,
    }));

  const changeZoom = (event) => {
    const zoom = clamp(Number(event.target.value), 1, ZOOM_MAX);

    const view = viewRef.current;

    const limit = offsetBounds(view.rw, view.rh, view.ar, zoom);

    setEdit((previous) => ({
      ...previous,
      zoom,
      nx: clamp(previous.nx, -limit.maxNx, limit.maxNx),
      ny: clamp(previous.ny, -limit.maxNy, limit.maxNy),
    }));
  };

  return (
    <>
      <div className="pe-aspects">
        {ASPECTS.map((aspect) => (
          <button
            type="button"
            key={aspect.id}
            className={`pe-aspect ${
              edit.aspect === aspect.id ? "active" : ""
            }`}
            onClick={() => chooseAspect(aspect.id)}
          >
            <i
              className="pe-shape"
              style={{
                aspectRatio: String(aspect.ratio || originalRatio),
              }}
            />

            <span>{aspect.label}</span>
          </button>
        ))}
      </div>

      <div className="pe-row">
        <span className="pe-label">Zoom</span>

        <Slider
          min={1}
          max={ZOOM_MAX}
          step={0.01}
          value={edit.zoom}
          onChange={changeZoom}
          label="Zoom"
        />

        {onRotate && (
          <button
            type="button"
            className="pe-round"
            onClick={onRotate}
            aria-label="Rotate 90 degrees"
          >
            <Icon name="rotate" size={18} />
          </button>
        )}

        <button type="button" className="pe-reset" onClick={onReset}>
          Reset
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   PHOTO FILTER THUMBNAIL
--------------------------------------------------------- */

function FilterThumb({ base, look, name, active, onSelect }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !base) return;

    canvas.width = base.width;
    canvas.height = base.height;

    const copy = new ImageData(
      new Uint8ClampedArray(base.data),
      base.width,
      base.height
    );

    if (hasLook(look)) applyLook(copy, look);

    canvas.getContext("2d").putImageData(copy, 0, 0);
  }, [base, look]);

  return (
    <button
      type="button"
      className={`pe-filter ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <span className="pe-filter-thumb">
        <canvas ref={canvasRef} />
      </span>

      <span className="pe-filter-name">{name}</span>
    </button>
  );
}

/* ---------------------------------------------------------
   PHOTO EDITOR
--------------------------------------------------------- */

function PhotoEditor({ item, onClose, onSave }) {
  const initialEdit = useRef(
    cloneEdit(item.edit || DEFAULT_EDIT)
  ).current;

  const [edit, setEdit] = useState(initialEdit);
  const [tab, setTab] = useState("crop");
  const [tool, setTool] = useState("brightness");

  const [image, setImage] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [stageRef, stageSize] = useStageSize();

  const canvasRef = useRef(null);
  const baseRef = useRef({ key: "", imageData: null });
  const rafRef = useRef(0);
  const viewRef = useRef(null);

  const { dragging, handlers } = useFrameGestures(viewRef, setEdit);

  /* ---------- load the original photo ---------- */

  useEffect(() => {
    let cancelled = false;

    loadImage(item.url)
      .then((loaded) => {
        if (!cancelled) setImage(loaded);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [item.url]);

  /* ---------- geometry ---------- */

  const natW = image?.naturalWidth || 1;
  const natH = image?.naturalHeight || 1;

  const { rw, rh } = getRotated(natW, natH, edit.rotation);

  const ar = resolveAspect(edit.aspect, rw, rh);

  const availW = Math.max(40, stageSize.w - STAGE_PADDING * 2);
  const availH = Math.max(40, stageSize.h - STAGE_PADDING * 2);

  const frameW = Math.floor(Math.min(availW, availH * ar));
  const frameH = frameW / ar;

  const bounds = offsetBounds(rw, rh, ar, edit.zoom);

  const nx = clamp(edit.nx, -bounds.maxNx, bounds.maxNx);
  const ny = clamp(edit.ny, -bounds.maxNy, bounds.maxNy);

  const scale = frameScale(rw, rh, ar, frameW, edit.zoom);

  const ready = Boolean(image) && stageSize.w > 0;

  viewRef.current = { edit, frameW, frameH, rw, rh, ar, nx, ny };

  /* ---------- controls ---------- */

  const rotate = () =>
    setEdit((previous) => ({
      ...previous,
      rotation: (previous.rotation + 90) % 360,
      nx: 0,
      ny: 0,
    }));

  const chooseFilter = (id) =>
    setEdit((previous) => ({
      ...previous,
      filter: id,
      intensity: 100,
    }));

  const changeIntensity = (event) =>
    setEdit((previous) => ({
      ...previous,
      intensity: Number(event.target.value),
    }));

  const changeAdjust = (event) => {
    const value = Number(event.target.value);

    setEdit((previous) => ({
      ...previous,
      adjust: { ...previous.adjust, [tool]: value },
    }));
  };

  const resetTab = () => {
    setEdit((previous) => {
      if (tab === "crop") {
        return {
          ...previous,
          aspect: DEFAULT_EDIT.aspect,
          zoom: 1,
          nx: 0,
          ny: 0,
          rotation: 0,
        };
      }

      if (tab === "filters") {
        return { ...previous, filter: "none", intensity: 100 };
      }

      return { ...previous, adjust: { ...DEFAULT_EDIT.adjust } };
    });
  };

  /* ---------- live preview for Filters / Adjust ---------- */

  const previewDims = useMemo(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = Math.max(1, Math.round(frameW * dpr));
    let h = Math.max(1, Math.round(frameH * dpr));

    const longSide = Math.max(w, h);

    if (longSide > PREVIEW_MAX) {
      const factor = PREVIEW_MAX / longSide;

      w = Math.max(1, Math.round(w * factor));
      h = Math.max(1, Math.round(h * factor));
    }

    return { w, h };
  }, [frameW, frameH]);

  useEffect(() => {
    if (tab === "crop" || !ready) return undefined;

    cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const { w, h } = previewDims;

      const key = `${w}x${h}|${edit.aspect}|${edit.zoom}|${edit.nx}|${edit.ny}|${edit.rotation}`;

      // framing only changes in the Crop tab, so this is rebuilt rarely
      if (baseRef.current.key !== key) {
        const base = document.createElement("canvas");

        base.width = w;
        base.height = h;

        const baseCtx = base.getContext("2d", {
          willReadFrequently: true,
        });

        drawFramed(baseCtx, image, edit, ar, w, h);

        baseRef.current = {
          key,
          imageData: baseCtx.getImageData(0, 0, w, h),
        };
      }

      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const source = baseRef.current.imageData;

      const copy = new ImageData(
        new Uint8ClampedArray(source.data),
        w,
        h
      );

      applyLook(copy, mergeLook(edit));

      canvas.getContext("2d").putImageData(copy, 0, 0);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [tab, ready, image, edit, ar, previewDims]);

  /* ---------- filter thumbnails ---------- */

  const thumbBase = useMemo(() => {
    if (tab !== "filters" || !image) return null;

    const width =
      ar >= 1 ? THUMB_LONG_SIDE : Math.round(THUMB_LONG_SIDE * ar);

    const height =
      ar >= 1 ? Math.round(THUMB_LONG_SIDE / ar) : THUMB_LONG_SIDE;

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    drawFramed(ctx, image, edit, ar, width, height);

    return ctx.getImageData(0, 0, width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, image, edit.aspect, edit.zoom, edit.nx, edit.ny, edit.rotation, ar]);

  /* ---------- save ---------- */

  const handleDone = async () => {
    if (!image || saving) return;

    if (isSameEdit(edit, initialEdit)) {
      onClose();
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const result = await renderEditedBlob(image, edit);

      onSave({ edit: cloneEdit(edit), result });
    } catch (error) {
      console.error("Editor export error:", error);

      setSaveError("Could not save your edits. Please try again.");

      setSaving(false);
    }
  };

  /* ---------- render ---------- */

  const activeTool = ADJUST_TOOLS.find((entry) => entry.id === tool);

  const toolValue = edit.adjust[tool] || 0;

  const originalRatio = resolveAspect("original", rw, rh);

  const cropHandlers = tab === "crop" ? handlers : {};

  return (
    <>
      <EditorHeader
        title="Edit photo"
        onClose={onClose}
        onDone={handleDone}
        doneDisabled={!ready || saving}
        saving={saving}
      />

      <div className="pe-stage" ref={stageRef}>
        {loadError && (
          <div className="pe-message">
            <p>This photo can't be opened for editing.</p>

            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {!loadError && !image && <div className="pe-spinner" />}

        {ready && (
          <div
            className={`pe-frame ${dragging ? "is-dragging" : ""} ${
              tab === "crop" ? "is-crop" : ""
            }`}
            style={{ width: frameW, height: frameH }}
            {...cropHandlers}
          >
            {tab === "crop" ? (
              <>
                <img
                  className="pe-media"
                  src={item.url}
                  alt="Crop preview"
                  draggable="false"
                  style={{
                    width: natW * scale,
                    height: natH * scale,
                    transform: `translate(${nx * frameW}px, ${
                      ny * frameH
                    }px) rotate(${edit.rotation}deg) translate(-50%, -50%)`,
                  }}
                />

                <div className="pe-grid" />

                <i className="pe-corner tl" />
                <i className="pe-corner tr" />
                <i className="pe-corner bl" />
                <i className="pe-corner br" />
              </>
            ) : (
              <canvas ref={canvasRef} className="pe-canvas" />
            )}
          </div>
        )}
      </div>

      {saveError && <p className="pe-error">{saveError}</p>}

      <div className="pe-dock">
        <div className="pe-panel">
          {tab === "crop" && (
            <CropPanel
              edit={edit}
              setEdit={setEdit}
              viewRef={viewRef}
              originalRatio={originalRatio}
              onRotate={rotate}
              onReset={resetTab}
            />
          )}

          {tab === "filters" && (
            <>
              <div className="pe-filters">
                {PRESET_LOOKS.map((preset) => (
                  <FilterThumb
                    key={preset.id}
                    base={thumbBase}
                    look={preset.look}
                    name={preset.name}
                    active={edit.filter === preset.id}
                    onSelect={() => chooseFilter(preset.id)}
                  />
                ))}
              </div>

              <div
                className={`pe-row ${
                  edit.filter === "none" ? "is-disabled" : ""
                }`}
              >
                <span className="pe-label">Intensity</span>

                <Slider
                  min={0}
                  max={100}
                  value={edit.intensity}
                  onChange={changeIntensity}
                  disabled={edit.filter === "none"}
                  label="Filter intensity"
                />

                <output className="pe-value">
                  {Math.round(edit.intensity)}
                </output>
              </div>
            </>
          )}

          {tab === "adjust" && (
            <>
              <div className="pe-tools">
                {ADJUST_TOOLS.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    className={`pe-tool ${
                      tool === entry.id ? "active" : ""
                    }`}
                    onClick={() => setTool(entry.id)}
                  >
                    {entry.label}

                    {Math.round(edit.adjust[entry.id]) !== 0 && (
                      <b>{Math.round(edit.adjust[entry.id])}</b>
                    )}
                  </button>
                ))}
              </div>

              <div className="pe-row">
                <span className="pe-label">{activeTool.label}</span>

                <Slider
                  min={activeTool.min}
                  max={activeTool.max}
                  value={toolValue}
                  onChange={changeAdjust}
                  label={activeTool.label}
                />

                <output className="pe-value">
                  {toolValue > 0 && activeTool.min < 0 ? "+" : ""}
                  {Math.round(toolValue)}
                </output>

                <button
                  type="button"
                  className="pe-reset"
                  onClick={resetTab}
                >
                  Reset
                </button>
              </div>
            </>
          )}
        </div>

        <TabBar tabs={PHOTO_TABS} active={tab} onChange={setTab} />
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   VIDEO FRAMES (timeline strip + filter previews)
   Frames are captured from a hidden copy of the video. If the
   browser cannot do it, the editor still works without them.
--------------------------------------------------------- */

function useVideoFrames(url, duration, ratio) {
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    if (!url || !duration) return undefined;

    let cancelled = false;

    const probe = document.createElement("video");

    probe.muted = true;
    probe.playsInline = true;
    probe.preload = "auto";

    probe.setAttribute("playsinline", "");
    probe.setAttribute("webkit-playsinline", "");

    probe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";

    document.body.appendChild(probe);

    const waitForData = () =>
      new Promise((resolve) => {
        if (probe.readyState >= 2) {
          resolve();
          return;
        }

        probe.addEventListener("loadeddata", resolve, { once: true });
        probe.addEventListener("error", resolve, { once: true });

        setTimeout(resolve, 4000);
      });

    const seekTo = (time) =>
      new Promise((resolve) => {
        let finished = false;

        const finish = () => {
          if (finished) return;

          finished = true;

          probe.removeEventListener("seeked", finish);

          clearTimeout(timer);

          resolve();
        };

        const timer = setTimeout(finish, 2500);

        probe.addEventListener("seeked", finish);

        probe.currentTime = time;
      });

    const run = async () => {
      try {
        await waitForData();

        const height = 72;

        const width = clamp(Math.round(height * ratio), 40, 160);

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        const captured = [];

        for (let index = 0; index < STRIP_FRAMES; index += 1) {
          if (cancelled) return;

          const time = Math.min(
            Math.max(0, duration - 0.1),
            ((index + 0.5) * duration) / STRIP_FRAMES
          );

          await seekTo(time);

          if (cancelled) return;

          ctx.drawImage(probe, 0, 0, width, height);

          captured.push(canvas.toDataURL("image/jpeg", 0.6));

          setFrames([...captured]);
        }
      } catch (error) {
        // no frames: the editor still works
      }
    };

    probe.src = url;

    run();

    return () => {
      cancelled = true;

      probe.removeAttribute("src");

      try {
        probe.load();
      } catch (error) {
        // ignore
      }

      probe.remove();
    };
  }, [url, duration, ratio]);

  return frames;
}

function VideoFilterThumb({ poster, look, name, active, onSelect }) {
  const filter = videoCssFilter(look);

  return (
    <button
      type="button"
      className={`pe-filter ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <span className="pe-filter-thumb">
        {poster ? (
          <img src={poster} alt="" style={{ filter }} />
        ) : (
          <i className="pe-swatch" style={{ filter }} />
        )}
      </span>

      <span className="pe-filter-name">{name}</span>
    </button>
  );
}

/* ---------------------------------------------------------
   VIDEO EDITOR
--------------------------------------------------------- */

function VideoEditor({ item, onClose, onSave }) {
  const initialEdit = useRef(
    cloneVideoEdit(item.edit || DEFAULT_VIDEO_EDIT)
  ).current;

  const [edit, setEdit] = useState(initialEdit);
  const [tab, setTab] = useState("trim");
  const [tool, setTool] = useState("brightness");

  const [meta, setMeta] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [stageRef, stageSize] = useStageSize();

  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const playheadRef = useRef(null);
  const dragHandleRef = useRef(null);
  const viewRef = useRef(null);
  const trimRef = useRef({ start: 0, end: 0, duration: 0 });

  const { dragging, handlers } = useFrameGestures(viewRef, setEdit);

  /* ---------- geometry ---------- */

  const vw = meta?.w || 16;
  const vh = meta?.h || 9;

  const duration = meta?.duration || 0;

  const option = ASPECTS.find((aspect) => aspect.id === edit.aspect);

  // "Original" keeps the real shape of the video (no cropping at all)
  const ar = option?.ratio || vw / vh;

  const availW = Math.max(40, stageSize.w - STAGE_PADDING * 2);
  const availH = Math.max(40, stageSize.h - STAGE_PADDING * 2);

  const frameW = Math.floor(Math.min(availW, availH * ar));
  const frameH = frameW / ar;

  const bounds = offsetBounds(vw, vh, ar, edit.zoom);

  const nx = clamp(edit.nx, -bounds.maxNx, bounds.maxNx);
  const ny = clamp(edit.ny, -bounds.maxNy, bounds.maxNy);

  const scale = frameScale(vw, vh, ar, frameW, edit.zoom);

  const ready = Boolean(meta) && stageSize.w > 0;

  viewRef.current = {
    edit,
    frameW,
    frameH,
    rw: vw,
    rh: vh,
    ar,
    nx,
    ny,
  };

  const trimStart = duration
    ? clamp(Number(edit.trimStart) || 0, 0, duration)
    : 0;

  const trimEnd = duration
    ? clamp(
        edit.trimEnd == null ? duration : Number(edit.trimEnd),
        trimStart,
        duration
      )
    : 0;

  trimRef.current = { start: trimStart, end: trimEnd, duration };

  const minClip = Math.min(MIN_CLIP_SECONDS, duration || MIN_CLIP_SECONDS);

  const look = mergeVideoLook(edit);

  const frames = useVideoFrames(item.url, duration, vw / vh);

  const poster =
    frames.length >= 3 ? frames[2] : frames[frames.length - 1] || null;

  /* ---------- playhead ---------- */

  const updatePlayhead = useCallback(
    (time) => {
      const element = playheadRef.current;

      if (!element || !duration) return;

      element.style.left = `${clamp(time / duration, 0, 1) * 100}%`;
    },
    [duration]
  );

  useEffect(() => {
    if (tab === "trim") {
      updatePlayhead(videoRef.current?.currentTime || 0);
    }
  }, [tab, updatePlayhead]);

  /* ---------- play only the trimmed part, in a loop ---------- */

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !playing) return undefined;

    let raf = 0;

    const tick = () => {
      const { start, end } = trimRef.current;

      if (
        end > 0 &&
        (video.currentTime >= end - 0.03 ||
          video.ended ||
          video.currentTime < start - 0.1)
      ) {
        video.currentTime = start;

        if (video.paused) {
          video.play().catch(() => {});
        }
      }

      updatePlayhead(video.currentTime);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [playing, updatePlayhead]);

  const handleMetadata = (event) => {
    const video = event.currentTarget;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setLoadError(true);
      return;
    }

    setMeta({
      w: width,
      h: height,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    });

    // shows the first frame of the chosen part
    try {
      video.currentTime =
        initialEdit.trimStart > 0 ? initialEdit.trimStart : 0.001;
    } catch (error) {
      // ignore
    }
  };

  const handleEnded = () => {
    const video = videoRef.current;

    if (!video) return;

    video.currentTime = trimRef.current.start;

    video.play().catch(() => {});
  };

  const togglePlay = () => {
    const video = videoRef.current;

    if (!video || !meta) return;

    if (video.paused) {
      const { start, end } = trimRef.current;

      if (
        video.currentTime < start ||
        (end > 0 && video.currentTime >= end - 0.05)
      ) {
        video.currentTime = start;
      }

      const attempt = video.play();

      if (attempt && attempt.catch) {
        attempt.catch(() => setPlaying(false));
      }
    } else {
      video.pause();
    }
  };

  const seekVideo = (time) => {
    const video = videoRef.current;

    if (!video) return;

    try {
      video.currentTime = time;
    } catch (error) {
      // ignore
    }

    updatePlayhead(time);
  };

  /* ---------- trim handles ---------- */

  const timeFromPointer = (event) => {
    const track = trackRef.current;

    if (!track || !duration) return 0;

    const rect = track.getBoundingClientRect();

    return (
      clamp((event.clientX - rect.left) / (rect.width || 1), 0, 1) *
      duration
    );
  };

  const onHandleDown = (which) => (event) => {
    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture?.(event.pointerId);

    dragHandleRef.current = which;

    videoRef.current?.pause();
  };

  const onHandleMove = (event) => {
    const which = dragHandleRef.current;

    if (!which || !duration) return;

    const time = timeFromPointer(event);

    const { start, end } = trimRef.current;

    if (which === "start") {
      const next = clamp(time, 0, end - minClip);

      setEdit((previous) => ({ ...previous, trimStart: next }));

      seekVideo(next);
    } else {
      const next = clamp(time, start + minClip, duration);

      setEdit((previous) => ({ ...previous, trimEnd: next }));

      seekVideo(Math.max(0, next - 0.05));
    }
  };

  const onHandleUp = (event) => {
    dragHandleRef.current = null;

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch (error) {
      // ignore
    }
  };

  const onTrackDown = (event) => {
    if (!duration) return;

    const { start, end } = trimRef.current;

    seekVideo(
      clamp(timeFromPointer(event), start, Math.max(start, end - 0.05))
    );
  };

  /* ---------- controls ---------- */

  const chooseFilter = (id) =>
    setEdit((previous) => ({
      ...previous,
      filter: id,
      intensity: 100,
    }));

  const changeIntensity = (event) =>
    setEdit((previous) => ({
      ...previous,
      intensity: Number(event.target.value),
    }));

  const changeAdjust = (event) => {
    const value = Number(event.target.value);

    setEdit((previous) => ({
      ...previous,
      adjust: { ...previous.adjust, [tool]: value },
    }));
  };

  const toggleMute = () =>
    setEdit((previous) => ({ ...previous, muted: !previous.muted }));

  const resetTab = () => {
    setEdit((previous) => {
      if (tab === "trim") {
        return { ...previous, trimStart: 0, trimEnd: null };
      }

      if (tab === "crop") {
        return {
          ...previous,
          aspect: DEFAULT_VIDEO_EDIT.aspect,
          zoom: 1,
          nx: 0,
          ny: 0,
        };
      }

      if (tab === "filters") {
        return { ...previous, filter: "none", intensity: 100 };
      }

      if (tab === "adjust") {
        return {
          ...previous,
          adjust: { ...DEFAULT_VIDEO_EDIT.adjust },
        };
      }

      return { ...previous, muted: false };
    });
  };

  /* ---------- save ---------- */

  const handleDone = () => {
    if (!meta) return;

    const finalized = finalizeVideoEdit(edit, meta);

    if (isSameVideoEdit(finalized, initialEdit)) {
      onClose();
      return;
    }

    onSave({ edit: finalized });
  };

  /* ---------- render ---------- */

  const activeTool = VIDEO_ADJUST_TOOLS.find(
    (entry) => entry.id === tool
  );

  const toolValue = edit.adjust[tool] || 0;

  const startPct = duration ? (trimStart / duration) * 100 : 0;
  const endPct = duration ? (trimEnd / duration) * 100 : 100;

  const clipLength = Math.max(0, trimEnd - trimStart);

  const cropHandlers = tab === "crop" ? handlers : {};

  return (
    <>
      <EditorHeader
        title="Edit video"
        onClose={onClose}
        onDone={handleDone}
        doneDisabled={!ready}
        saving={false}
      />

      <div className="pe-stage" ref={stageRef}>
        <div
          className={`pe-frame ${dragging ? "is-dragging" : ""} ${
            tab === "crop" ? "is-crop" : ""
          } ${ready ? "" : "is-hidden"}`}
          style={{ width: frameW, height: frameH }}
          {...cropHandlers}
        >
          <video
            ref={videoRef}
            className="pe-media"
            src={item.url}
            playsInline
            muted={edit.muted}
            preload="auto"
            onLoadedMetadata={handleMetadata}
            onError={() => setLoadError(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={handleEnded}
            onTimeUpdate={(event) =>
              updatePlayhead(event.currentTarget.currentTime)
            }
            style={{
              width: vw * scale,
              height: vh * scale,
              transform: `translate(${nx * frameW}px, ${
                ny * frameH
              }px) translate(-50%, -50%)`,
              filter: videoCssFilter(look),
            }}
          />

          {tab === "crop" && (
            <>
              <div className="pe-grid" />

              <i className="pe-corner tl" />
              <i className="pe-corner tr" />
              <i className="pe-corner bl" />
              <i className="pe-corner br" />
            </>
          )}
        </div>

        {!meta && !loadError && <div className="pe-spinner" />}

        {loadError && (
          <div className="pe-message">
            <p>This video can't be opened for editing on this device.</p>

            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {ready && (
          <button
            type="button"
            className="pe-play"
            onClick={togglePlay}
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            <Icon name={playing ? "pause" : "play"} size={20} />
          </button>
        )}
      </div>

      <div className="pe-dock">
        <div className="pe-panel">
          {tab === "trim" && (
            <>
              <div className="pe-trim-head">
                <button
                  type="button"
                  className="pe-play-sm"
                  onClick={togglePlay}
                  disabled={!ready}
                  aria-label={playing ? "Pause preview" : "Play preview"}
                >
                  <Icon name={playing ? "pause" : "play"} size={16} />
                </button>

                <span className="pe-trim-time">
                  {formatTime(trimStart)} – {formatTime(trimEnd)}
                  <b>{clipLength.toFixed(1)}s</b>
                </span>

                <button
                  type="button"
                  className="pe-reset"
                  onClick={resetTab}
                >
                  Reset
                </button>
              </div>

              {duration > 0 ? (
                <div
                  className="pe-timeline"
                  ref={trackRef}
                  onPointerDown={onTrackDown}
                >
                  <div className="pe-strip">
                    {Array.from({ length: STRIP_FRAMES }, (_, index) => (
                      <span className="pe-cell" key={index}>
                        {frames[index] && (
                          <img src={frames[index]} alt="" draggable="false" />
                        )}
                      </span>
                    ))}

                    <span
                      className="pe-dim left"
                      style={{ width: `${startPct}%` }}
                    />

                    <span
                      className="pe-dim right"
                      style={{ width: `${100 - endPct}%` }}
                    />
                  </div>

                  <span
                    className="pe-window"
                    style={{
                      left: `${startPct}%`,
                      width: `${Math.max(0, endPct - startPct)}%`,
                    }}
                  />

                  <button
                    type="button"
                    className="pe-handle start"
                    style={{ left: `${startPct}%` }}
                    onPointerDown={onHandleDown("start")}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                    aria-label="Trim start"
                  />

                  <button
                    type="button"
                    className="pe-handle end"
                    style={{ left: `${endPct}%` }}
                    onPointerDown={onHandleDown("end")}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                    aria-label="Trim end"
                  />

                  <span className="pe-playhead" ref={playheadRef} />
                </div>
              ) : (
                <p className="pe-hint">
                  Trimming isn't available for this video.
                </p>
              )}
            </>
          )}

          {tab === "crop" && (
            <CropPanel
              edit={edit}
              setEdit={setEdit}
              viewRef={viewRef}
              originalRatio={vw / vh}
              onRotate={null}
              onReset={resetTab}
            />
          )}

          {tab === "filters" && (
            <>
              <div className="pe-filters">
                {PRESET_VIDEO_LOOKS.map((preset) => (
                  <VideoFilterThumb
                    key={preset.id}
                    poster={poster}
                    look={preset.look}
                    name={preset.name}
                    active={edit.filter === preset.id}
                    onSelect={() => chooseFilter(preset.id)}
                  />
                ))}
              </div>

              <div
                className={`pe-row ${
                  edit.filter === "none" ? "is-disabled" : ""
                }`}
              >
                <span className="pe-label">Intensity</span>

                <Slider
                  min={0}
                  max={100}
                  value={edit.intensity}
                  onChange={changeIntensity}
                  disabled={edit.filter === "none"}
                  label="Filter intensity"
                />

                <output className="pe-value">
                  {Math.round(edit.intensity)}
                </output>
              </div>
            </>
          )}

          {tab === "adjust" && (
            <>
              <div className="pe-tools">
                {VIDEO_ADJUST_TOOLS.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    className={`pe-tool ${
                      tool === entry.id ? "active" : ""
                    }`}
                    onClick={() => setTool(entry.id)}
                  >
                    {entry.label}

                    {Math.round(edit.adjust[entry.id]) !== 0 && (
                      <b>{Math.round(edit.adjust[entry.id])}</b>
                    )}
                  </button>
                ))}
              </div>

              <div className="pe-row">
                <span className="pe-label">{activeTool.label}</span>

                <Slider
                  min={activeTool.min}
                  max={activeTool.max}
                  value={toolValue}
                  onChange={changeAdjust}
                  label={activeTool.label}
                />

                <output className="pe-value">
                  {toolValue > 0 ? "+" : ""}
                  {Math.round(toolValue)}
                </output>

                <button
                  type="button"
                  className="pe-reset"
                  onClick={resetTab}
                >
                  Reset
                </button>
              </div>
            </>
          )}

          {tab === "sound" && (
            <button
              type="button"
              className={`pe-sound ${edit.muted ? "is-muted" : ""}`}
              onClick={toggleMute}
              aria-pressed={edit.muted}
            >
              <span className="pe-sound-icon">
                <Icon name={edit.muted ? "mute" : "sound"} size={24} />
              </span>

              <span className="pe-sound-text">
                <strong>Mute video</strong>

                <small>
                  {edit.muted
                    ? "This video will be posted without sound."
                    : "Tap to remove the sound from this video."}
                </small>
              </span>

              <span
                className={`pe-switch ${edit.muted ? "on" : ""}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        <TabBar tabs={VIDEO_TABS} active={tab} onChange={setTab} />
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   EDITOR (full screen, rendered on document.body so no parent
   style or animation can move or clip it)
--------------------------------------------------------- */

function PostEditor(props) {
  const { item, onClose } = props;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const isVideo = item.type === "video";

  return createPortal(
    <div
      className="pe-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? "Edit video" : "Edit photo"}
    >
      {isVideo ? <VideoEditor {...props} /> : <PhotoEditor {...props} />}
    </div>,
    document.body
  );
}

export default PostEditor;
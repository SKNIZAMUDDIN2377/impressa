import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const TABS = [
  { id: "crop", label: "Crop", glyph: "□" },
  { id: "filters", label: "Filters", glyph: "✦" },
  { id: "adjust", label: "Adjust", glyph: "≡" },
];

const PREVIEW_MAX = 900;
const THUMB_LONG_SIDE = 104;
const STAGE_PADDING = 14;

/* ---------------------------------------------------------
   FILTER THUMBNAIL
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
   EDITOR
--------------------------------------------------------- */

function PostEditor({ item, onClose, onSave }) {
  const initialEdit = useRef(
    cloneEdit(item.edit || DEFAULT_EDIT)
  ).current;

  const [edit, setEdit] = useState(initialEdit);
  const [tab, setTab] = useState("crop");
  const [tool, setTool] = useState("brightness");

  const [image, setImage] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const baseRef = useRef({ key: "", imageData: null });
  const rafRef = useRef(0);

  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const viewRef = useRef(null);

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

  /* ---------- lock page scroll + Escape closes ---------- */

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

  /* ---------- measure the stage ---------- */

  useEffect(() => {
    const element = stageRef.current;

    if (!element) return undefined;

    const update = () =>
      setStageSize({
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

  /* ---------- crop gestures: drag = move, pinch = zoom ---------- */

  const beginGesture = () => {
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

  const handlePointerDown = (event) => {
    event.preventDefault();

    event.currentTarget.setPointerCapture?.(event.pointerId);

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    beginGesture();

    setDragging(true);
  };

  const handlePointerMove = (event) => {
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

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      setDragging(false);
    } else {
      beginGesture();
    }
  };

  /* ---------- crop controls ---------- */

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

  const rotate = () =>
    setEdit((previous) => ({
      ...previous,
      rotation: (previous.rotation + 90) % 360,
      nx: 0,
      ny: 0,
    }));

  /* ---------- filter / adjust controls ---------- */

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

  const cropHandlers =
    tab === "crop"
      ? {
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerUp,
        }
      : {};

  return (
    <div
      className="pe-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Edit photo"
    >
      <header className="pe-header">
        <button
          type="button"
          className="pe-close"
          onClick={onClose}
          aria-label="Cancel editing"
        >
          ×
        </button>

        <div className="pe-title">
          <span>IMPRESSA EDITOR</span>
          <h2>Edit photo</h2>
        </div>

        <button
          type="button"
          className="pe-done"
          onClick={handleDone}
          disabled={!ready || saving}
        >
          {saving ? "Saving…" : "Done"}
        </button>
      </header>

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
                  className="pe-crop-img"
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

      <div className="pe-panel">
        {tab === "crop" && (
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

            <div className="pe-slider-row">
              <span>Zoom</span>

              <input
                type="range"
                min="1"
                max={ZOOM_MAX}
                step="0.01"
                value={edit.zoom}
                onChange={changeZoom}
                aria-label="Zoom"
              />

              <button
                type="button"
                className="pe-round"
                onClick={rotate}
                aria-label="Rotate 90 degrees"
              >
                ↻
              </button>

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
              className={`pe-slider-row ${
                edit.filter === "none" ? "is-disabled" : ""
              }`}
            >
              <span>Intensity</span>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={edit.intensity}
                onChange={changeIntensity}
                disabled={edit.filter === "none"}
                aria-label="Filter intensity"
              />

              <output>{Math.round(edit.intensity)}</output>
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

            <div className="pe-slider-row">
              <span>{activeTool.label}</span>

              <input
                type="range"
                min={activeTool.min}
                max={activeTool.max}
                step="1"
                value={toolValue}
                onChange={changeAdjust}
                aria-label={activeTool.label}
              />

              <output>
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

      <nav className="pe-tabs" aria-label="Editor tools">
        {TABS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={tab === entry.id ? "active" : ""}
            onClick={() => setTab(entry.id)}
          >
            <span>{entry.glyph}</span>
            {entry.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default PostEditor;
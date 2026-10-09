import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PostEditor from "../components/PostEditor";
import {
  DEFAULT_EDIT,
  loadImage,
  renderEditedBlob,
} from "../utils/imageEditing";
import {
  buildVideoDelivery,
  hasVideoEdit,
  videoPreviewStyle,
  waitForVideoReady,
} from "../utils/videoEditing";
import {
  createPostRequest,
  fetchUploadSignature,
  runPool,
  uploadWithRetry,
  warmUpServer,
} from "../utils/cloudinaryUpload";

import "./CreatePost.css";
import "./CreatePostUpload.css";

const MAX_MEDIA = 10;
const MAX_VIDEO_MB = 100;
const UPLOAD_CONCURRENCY = 3;

// Audio the user adds from their own phone
const MAX_AUDIO_MB = 10;
const MAX_AUDIO_SECONDS = 60;
const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg"];

const moods = [
  { id: "energetic", emoji: "🔥", name: "Energetic" },
  { id: "calm", emoji: "🌙", name: "Calm" },
  { id: "inspired", emoji: "✨", name: "Inspired" },
  { id: "happy", emoji: "❤️", name: "Happy" },
  { id: "deep", emoji: "🖤", name: "Deep" },
  { id: "peaceful", emoji: "🌿", name: "Peaceful" },
];

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "avif",
  "bmp",
];

const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v", "avi"];

const getMediaType = (file) => {
  const mimeType = (file.type || "").toLowerCase();
  const extension = file.name.split(".").pop().toLowerCase();

  if (mimeType.startsWith("video/") || VIDEO_EXTENSIONS.includes(extension)) {
    return "video";
  }

  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }

  return null;
};

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const abortError = () =>
  Object.assign(new Error("Cancelled"), { name: "AbortError" });

// Photos and videos can both be edited (animated GIFs cannot)
const canEdit = (item) =>
  Boolean(item) &&
  (item.type === "video" ||
    (item.type === "image" && !item.skipProcessing));

const isEdited = (item) =>
  item.type === "video" ? hasVideoEdit(item.edit) : Boolean(item.edit);

function CreatePost() {
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioRef = useRef(null);

  const [media, setMedia] = useState([]);

  const mediaRef = useRef(media);

  mediaRef.current = media;

  // processed (cropped / compressed) images, keyed by media id
  const preparedRef = useRef(new Map());

  // finished Cloudinary uploads (survives retries).
  // photos: "id:version"   videos: "id" (the original is uploaded once,
  // edits are applied afterwards)   audio: "audio:id"
  const uploadedRef = useRef(new Map());

  const queueRef = useRef(Promise.resolve());
  const abortRef = useRef(null);
  const isPostingRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");

  const [editingIndex, setEditingIndex] = useState(null);

  // the user's own audio (chosen from their phone)
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioRights, setAudioRights] = useState(false);
  const [audioNotice, setAudioNotice] = useState("");

  const musicRef = useRef(null);

  musicRef.current = selectedMusic;

  const [selectedMood, setSelectedMood] = useState(null);

  const [isPosting, setIsPosting] = useState(false);
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [postError, setPostError] = useState("");

  /* ---------- wake the Render server while the user is composing ---------- */

  useEffect(() => {
    warmUpServer();
  }, []);

  /* ---------- background image preparation ---------- */

  const applyPreview = useCallback((item, result) => {
    const current = mediaRef.current.find(
      (entry) => entry.id === item.id
    );

    if (!current || current.version !== item.version) return;

    const previewUrl = URL.createObjectURL(result.blob);

    setMedia((previous) =>
      previous.map((entry) => {
        if (entry.id !== item.id || entry.version !== item.version) {
          return entry;
        }

        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);

        return { ...entry, previewUrl };
      })
    );
  }, []);

  // Photos are processed one at a time so phones never freeze
  const enqueue = (task) => {
    const run = queueRef.current.then(() => task());

    queueRef.current = run.catch(() => {});

    return run;
  };

  const renderItem = async (item) => {
    try {
      const image = await loadImage(item.url);

      return await renderEditedBlob(image, item.edit || DEFAULT_EDIT);
    } catch (error) {
      console.error(
        "Image processing failed, the original will be uploaded:",
        error
      );

      return null;
    }
  };

  const prepare = useCallback(
    (item) => {
      // videos are uploaded as they are; their edits are applied by
      // Cloudinary after the upload
      if (item.type !== "image" || item.skipProcessing) {
        return Promise.resolve(null);
      }

      const cached = preparedRef.current.get(item.id);

      if (cached && cached.version === item.version) {
        return cached.promise;
      }

      const promise = enqueue(() => renderItem(item));

      preparedRef.current.set(item.id, {
        version: item.version,
        promise,
      });

      promise.then((result) => {
        if (result) applyPreview(item, result);
      });

      return promise;
    },
    [applyPreview]
  );

  /* ---------- picking files ---------- */

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);

    event.target.value = "";

    const room = MAX_MEDIA - mediaRef.current.length;

    const accepted = [];
    const messages = [];

    for (const file of files) {
      const mediaType = getMediaType(file);

      if (!mediaType) {
        messages.push(`${file.name} isn't a supported photo or video.`);
        continue;
      }

      if (
        mediaType === "video" &&
        file.size > MAX_VIDEO_MB * 1024 * 1024
      ) {
        messages.push(
          `${file.name} is larger than ${MAX_VIDEO_MB} MB.`
        );
        continue;
      }

      if (accepted.length >= room) {
        messages.push(`A post can have up to ${MAX_MEDIA} photos or videos.`);
        break;
      }

      accepted.push({ file, mediaType });
    }

    setNotice(messages.join(" "));

    if (accepted.length === 0) return;

    const newMedia = accepted.map(({ file, mediaType }) => ({
      id: makeId(),
      file,
      type: mediaType,
      url: URL.createObjectURL(file),
      previewUrl: null,
      edit: null,
      version: 0,
      // animated GIFs are uploaded untouched
      skipProcessing: file.type === "image/gif",
    }));

    if (mediaRef.current.length === 0) {
      setActiveIndex(0);
    }

    setMedia((previous) => [...previous, ...newMedia]);

    // start optimizing right away, while the user writes the caption
    newMedia.forEach(prepare);
  };

  const revokeItem = (item) => {
    URL.revokeObjectURL(item.url);

    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  };

  const removeMedia = (id) => {
    const item = mediaRef.current.find((entry) => entry.id === id);

    if (item) {
      revokeItem(item);
      preparedRef.current.delete(id);
    }

    const nextLength = mediaRef.current.length - 1;

    setMedia((previous) => previous.filter((entry) => entry.id !== id));

    setActiveIndex((current) =>
      Math.min(current, Math.max(0, nextLength - 1))
    );

    setEditingIndex(null);
  };

  const moveMedia = (index, direction) => {
    setMedia((previous) => {
      const updated = [...previous];
      const target = index + direction;

      if (target < 0 || target >= updated.length) {
        return previous;
      }

      [updated[index], updated[target]] = [updated[target], updated[index]];

      return updated;
    });

    setActiveIndex((current) => {
      if (current === index) return index + direction;

      if (current === index + direction) return index;

      return current;
    });
  };

  const nextMedia = () => {
    if (activeIndex < media.length - 1) {
      setActiveIndex((previous) => previous + 1);
    }
  };

  const previousMedia = () => {
    if (activeIndex > 0) {
      setActiveIndex((previous) => previous - 1);
    }
  };

  /* ---------- editor ---------- */

  const openEditor = (index) => {
    if (canEdit(media[index])) setEditingIndex(index);
  };

  const closeEditor = useCallback(() => setEditingIndex(null), []);

  const handleEditorSave = ({ edit, result }) => {
    const item = media[editingIndex];

    if (!item) {
      setEditingIndex(null);
      return;
    }

    const version = item.version + 1;

    if (item.type === "image" && result) {
      const previewUrl = URL.createObjectURL(result.blob);

      // the edited image is already rendered: reuse it for the upload
      preparedRef.current.set(item.id, {
        version,
        promise: Promise.resolve(result),
      });

      setMedia((previous) =>
        previous.map((entry) => {
          if (entry.id !== item.id) return entry;

          if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);

          return { ...entry, edit, version, previewUrl };
        })
      );
    } else {
      // video: only the edit is stored; the file is uploaded untouched
      setMedia((previous) =>
        previous.map((entry) =>
          entry.id === item.id ? { ...entry, edit, version } : entry
        )
      );
    }

    setEditingIndex(null);
  };

  /* ---------- the user's own audio ---------- */

  const openAudioPicker = () => {
    audioInputRef.current?.click();
  };

  const handleAudioFile = (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setAudioNotice("");

    const extension = file.name.split(".").pop().toLowerCase();

    const looksLikeAudio =
      (file.type || "").startsWith("audio/") ||
      AUDIO_EXTENSIONS.includes(extension);

    if (!looksLikeAudio) {
      setAudioNotice(
        "Please choose an audio file (mp3, m4a, aac, wav or ogg)."
      );
      return;
    }

    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setAudioNotice(`Audio must be smaller than ${MAX_AUDIO_MB} MB.`);
      return;
    }

    const url = URL.createObjectURL(file);

    const probe = new Audio();

    probe.preload = "metadata";

    probe.onloadedmetadata = () => {
      if (!(probe.duration <= MAX_AUDIO_SECONDS + 0.5)) {
        URL.revokeObjectURL(url);

        setAudioNotice(
          `Audio can be up to ${MAX_AUDIO_SECONDS} seconds long.`
        );

        return;
      }

      audioRef.current?.pause();

      setMusicPlaying(false);
      setAudioRights(false);

      if (musicRef.current?.url) {
        URL.revokeObjectURL(musicRef.current.url);
      }

      setSelectedMusic({
        id: makeId(),
        file,
        url,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
        duration: Math.round(probe.duration),
      });
    };

    probe.onerror = () => {
      URL.revokeObjectURL(url);

      setAudioNotice("This audio file can't be played. Try another one.");
    };

    probe.src = url;
  };

  const updateMusicTitle = (value) => {
    setSelectedMusic((previous) =>
      previous ? { ...previous, title: value.slice(0, 60) } : previous
    );
  };

  const toggleMusicPreview = () => {
    const audio = audioRef.current;

    if (!audio || !selectedMusic) return;

    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
      return;
    }

    audio.src = selectedMusic.url;
    audio.currentTime = 0;

    audio
      .play()
      .then(() => setMusicPlaying(true))
      .catch(() => setMusicPlaying(false));
  };

  const removeMusic = () => {
    audioRef.current?.pause();

    if (musicRef.current?.url) {
      URL.revokeObjectURL(musicRef.current.url);
    }

    setSelectedMusic(null);
    setMusicPlaying(false);
    setAudioRights(false);
    setAudioNotice("");
  };

  /* ---------- clear ---------- */

  const clearAll = () => {
    mediaRef.current.forEach(revokeItem);

    preparedRef.current.clear();
    uploadedRef.current.clear();

    setMedia([]);
    setCaption("");
    setNotice("");
    setActiveIndex(0);
    setEditingIndex(null);
    removeMusic();
    setSelectedMood(null);
  };

  /* ---------- post ---------- */

  const handlePost = async () => {
    if (
      mediaRef.current.length === 0 ||
      isPostingRef.current ||
      (musicRef.current && !audioRights)
    ) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin", { replace: true });
      return;
    }

    const snapshot = mediaRef.current;

    const musicSnapshot = musicRef.current;

    const controller = new AbortController();

    abortRef.current = controller;

    isPostingRef.current = true;

    setPostError("");
    setIsPosting(true);
    setStage("preparing");
    setProgress(0);

    try {
      // ask for the upload signature while the photos finish processing
      const signaturePromise = fetchUploadSignature(
        token,
        controller.signal
      );

      signaturePromise.catch(() => {});

      const prepared = await Promise.all(
        snapshot.map((item) => prepare(item))
      );

      const signature = await signaturePromise;

      if (controller.signal.aborted) throw abortError();

      const plans = snapshot.map((item, index) => {
        // a video is uploaded once; changing its edit never re-uploads it
        const key =
          item.type === "video"
            ? item.id
            : `${item.id}:${item.version}`;

        const result = prepared[index];

        const body = result ? result.blob : item.file;

        return {
          key,
          item,
          body,
          size: body.size || 1,
          filename: result
            ? `impressa-${index + 1}.jpg`
            : item.file.name,
          resourceType: item.type === "video" ? "video" : "image",
          done: uploadedRef.current.get(key) || null,
        };
      });

      // ----- upload (3 at a time, with real progress) -----

      setStage("uploading");

      const total = plans.reduce((sum, plan) => sum + plan.size, 0) || 1;

      const loaded = new Map(
        plans.map((plan) => [plan.key, plan.done ? plan.size : 0])
      );

      let lastPercent = -1;

      const report = () => {
        let sum = 0;

        loaded.forEach((value) => {
          sum += value;
        });

        const percent = Math.min(100, Math.floor((sum / total) * 100));

        if (percent !== lastPercent) {
          lastPercent = percent;
          setProgress(percent / 100);
        }
      };

      report();

      const tasks = plans
        .filter((plan) => !plan.done)
        .map((plan) => async () => {
          const uploaded = await uploadWithRetry({
            file: plan.body,
            filename: plan.filename,
            resourceType: plan.resourceType,
            signature,
            signal: controller.signal,
            onProgress: (bytes) => {
              loaded.set(plan.key, Math.min(bytes, plan.size));
              report();
            },
          });

          uploadedRef.current.set(plan.key, {
            url: uploaded.url,
            type: plan.item.type === "video" ? "video" : "image",
            width: uploaded.width,
            height: uploaded.height,
          });

          loaded.set(plan.key, plan.size);
          report();
        });

      await runPool(tasks, UPLOAD_CONCURRENCY);

      // ----- the user's own audio -----
      // (Cloudinary stores audio files under the "video" resource type)

      let musicPayload;

      if (musicSnapshot) {
        const audioKey = `audio:${musicSnapshot.id}`;

        let audioDone = uploadedRef.current.get(audioKey);

        if (!audioDone) {
          const uploadedAudio = await uploadWithRetry({
            file: musicSnapshot.file,
            filename: musicSnapshot.file.name,
            resourceType: "video",
            signature,
            signal: controller.signal,
          });

          audioDone = { url: uploadedAudio.url };

          uploadedRef.current.set(audioKey, audioDone);
        }

        musicPayload = {
          title: musicSnapshot.title.trim() || "Original audio",
          artist: "Original audio",
          audioUrl: audioDone.url,
        };
      }

      // ----- apply video edits (Cloudinary builds the edited video) -----

      const needsVideoWork = plans.some(
        (plan) =>
          plan.item.type === "video" && hasVideoEdit(plan.item.edit)
      );

      if (needsVideoWork) {
        setStage("processing");
      }

      const mediaPayload = [];

      for (const plan of plans) {
        const uploaded = uploadedRef.current.get(plan.key);

        if (!uploaded) {
          throw new Error(
            "Some media did not upload. Please try again."
          );
        }

        if (
          plan.item.type === "video" &&
          hasVideoEdit(plan.item.edit)
        ) {
          const delivery = buildVideoDelivery(
            uploaded.url,
            plan.item.edit,
            uploaded
          );

          await waitForVideoReady(delivery.url, controller.signal);

          mediaPayload.push({
            url: delivery.url,
            type: "video",
            width: delivery.width,
            height: delivery.height,
          });
        } else {
          mediaPayload.push(uploaded);
        }
      }

      // ----- publish -----

      setStage("publishing");

      await createPostRequest({
        token,
        media: mediaPayload,
        caption: caption.trim(),
        music: musicPayload,
        signal: controller.signal,
      });

      // ----- done: tidy up and go to Home -----

      snapshot.forEach(revokeItem);

      preparedRef.current.clear();
      uploadedRef.current.clear();

      setMedia([]);
      setCaption("");
      setNotice("");
      setActiveIndex(0);
      removeMusic();
      setSelectedMood(null);
      setEditingIndex(null);
      setIsPosting(false);
      setStage("idle");

      navigate("/");
    } catch (error) {
      if (error.name === "AbortError") {
        setIsPosting(false);
        setStage("idle");
        setProgress(0);
        return;
      }

      console.error("Create post error:", error);

      setPostError(
        error.status === 401
          ? "Your session has expired. Please sign in again."
          : error.message || "Something went wrong. Please try again."
      );

      setStage("error");
    } finally {
      isPostingRef.current = false;
    }
  };

  const cancelPosting = () => {
    abortRef.current?.abort();
  };

  const dismissError = () => {
    setIsPosting(false);
    setStage("idle");
    setPostError("");
  };

  /* ---------- cleanup on leaving the page ---------- */

  useEffect(() => {
    return () => {
      abortRef.current?.abort();

      mediaRef.current.forEach(revokeItem);

      if (musicRef.current?.url) {
        URL.revokeObjectURL(musicRef.current.url);
      }
    };
  }, []);

  const current = media[activeIndex];

  const stageText =
    stage === "preparing"
      ? "Getting your media ready…"
      : stage === "uploading"
      ? `Uploading… ${Math.round(progress * 100)}%`
      : stage === "processing"
      ? "Applying your video edits…"
      : "Publishing your post…";

  return (
    <main className="create-post-page">
      <section className="create-post-container">
        <header className="create-post-header">
          <div>
            <p className="create-post-small-title">IMPRESSA</p>
            <h1>Create Post</h1>
          </div>

          <div className="media-count">
            {media.length === 0 ? "New post" : `${media.length} media`}
          </div>
        </header>

        {media.length === 0 ? (
          <div className="empty-upload">
            <div className="upload-orbit">
              <div className="upload-icon">
                <span>i</span>
              </div>
            </div>

            <h2>Share your moment</h2>

            <p>
              Add photos, videos, or mix both together
              <br />
              in one Impressa carousel.
            </p>

            <button
              type="button"
              className="choose-media-btn"
              onClick={openFilePicker}
            >
              Choose Media
            </button>

            <div className="upload-info">
              <span>PHOTO</span>
              <span>VIDEO</span>
              <span>MIXED</span>
            </div>
          </div>
        ) : (
          <>
            <div className="carousel-section">
              <div className="carousel">
                {current?.type === "image" ? (
                  <img
                    src={current.previewUrl || current.url}
                    alt={`Post media ${activeIndex + 1}`}
                    className="carousel-media"
                  />
                ) : (
                  current && (
                    <video
                      src={current.url}
                      className="carousel-media"
                      controls
                      playsInline
                      muted={Boolean(current.edit?.muted)}
                      style={videoPreviewStyle(current.edit)}
                    />
                  )
                )}

                <div className="carousel-counter">
                  {activeIndex + 1} / {media.length}
                </div>

                {current && isEdited(current) && (
                  <span className="cp-edited-tag">✦ Edited</span>
                )}

                {activeIndex > 0 && (
                  <button
                    type="button"
                    className="carousel-arrow previous"
                    onClick={previousMedia}
                    aria-label="Previous media"
                  >
                    ‹
                  </button>
                )}

                {activeIndex < media.length - 1 && (
                  <button
                    type="button"
                    className="carousel-arrow next"
                    onClick={nextMedia}
                    aria-label="Next media"
                  >
                    ›
                  </button>
                )}

                {canEdit(current) && (
                  <button
                    type="button"
                    className={`edit-main-button ${
                      current.type === "video" ? "on-video" : ""
                    }`}
                    onClick={() => openEditor(activeIndex)}
                  >
                    ✦ Edit
                  </button>
                )}
              </div>

              <div className="carousel-dots">
                {media.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`carousel-dot ${
                      activeIndex === index ? "active" : ""
                    }`}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show media ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="add-more-media"
              onClick={openFilePicker}
              disabled={media.length >= MAX_MEDIA}
            >
              <span>＋</span>
              Add more media
            </button>

            {notice && <div className="cp-notice">{notice}</div>}

            <div className="media-manager">
              <div className="section-heading">
                <div>
                  <h3>Your media</h3>
                  <p>Arrange your carousel</p>
                </div>

                <span>{media.length}</span>
              </div>

              <div className="media-list">
                {media.map((item, index) => (
                  <div
                    className={`media-item ${
                      activeIndex === index ? "selected" : ""
                    }`}
                    key={item.id}
                    onClick={() => setActiveIndex(index)}
                  >
                    <div className="thumbnail-wrapper">
                      {item.type === "image" ? (
                        <img
                          src={item.previewUrl || item.url}
                          alt={`Thumbnail ${index + 1}`}
                        />
                      ) : (
                        <>
                          <video
                            src={item.url}
                            muted
                            playsInline
                            preload="metadata"
                            style={videoPreviewStyle(item.edit)}
                          />

                          <span className="video-badge">▶</span>
                        </>
                      )}

                      <span className="media-number">{index + 1}</span>
                    </div>

                    <div className="media-actions">
                      {canEdit(item) && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditor(index);
                          }}
                          aria-label="Edit media"
                        >
                          ✦
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveMedia(index, -1);
                        }}
                        aria-label="Move media left"
                      >
                        ←
                      </button>

                      <button
                        type="button"
                        disabled={index === media.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveMedia(index, 1);
                        }}
                        aria-label="Move media right"
                      >
                        →
                      </button>

                      <button
                        type="button"
                        className="delete-media"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeMedia(item.id);
                        }}
                        aria-label="Delete media"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="caption-section">
          <div className="caption-heading">
            <h3>Caption</h3>
            <span>{caption.length}/500</span>
          </div>

          <textarea
            value={caption}
            onChange={(event) => {
              if (event.target.value.length <= 500) {
                setCaption(event.target.value);
              }
            }}
            placeholder="Write something about this moment..."
            maxLength={500}
          />
        </div>

        <section className="music-section">
          <div className="music-heading">
            <div>
              <div className="music-title-row">
                <span className="music-symbol">♪</span>
                <h3>Add Audio</h3>
              </div>

              <p>
                Add your own audio to this post (up to {MAX_AUDIO_SECONDS}{" "}
                seconds)
              </p>
            </div>

            {selectedMusic && (
              <button
                type="button"
                className="change-music-btn"
                onClick={openAudioPicker}
              >
                Change
              </button>
            )}
          </div>

          {selectedMusic ? (
            <>
              <div className="selected-music-card">
                <div className="music-cover">♪</div>

                <div className="selected-music-info">
                  <input
                    className="audio-title-input"
                    value={selectedMusic.title}
                    onChange={(event) =>
                      updateMusicTitle(event.target.value)
                    }
                    maxLength={60}
                    aria-label="Audio title"
                  />

                  <span>{selectedMusic.duration}s · your audio</span>
                </div>

                <button
                  type="button"
                  className="music-play-btn"
                  onClick={toggleMusicPreview}
                  aria-label={musicPlaying ? "Pause audio" : "Play audio"}
                >
                  {musicPlaying ? "Ⅱ" : "▶"}
                </button>

                <button
                  type="button"
                  className="remove-music-btn"
                  onClick={removeMusic}
                  aria-label="Remove audio"
                >
                  ×
                </button>
              </div>

              <label className="audio-rights">
                <input
                  type="checkbox"
                  checked={audioRights}
                  onChange={(event) => setAudioRights(event.target.checked)}
                />

                <span>
                  I created this audio or have the right to use it.
                </span>
              </label>
            </>
          ) : (
            <button
              type="button"
              className="add-music-card"
              onClick={openAudioPicker}
            >
              <div className="music-add-icon">♪</div>

              <div>
                <strong>Choose audio from your phone</strong>
                <span>MP3, M4A or AAC · up to {MAX_AUDIO_MB} MB</span>
              </div>

              <span className="music-arrow">›</span>
            </button>
          )}

          {audioNotice && <div className="cp-notice">{audioNotice}</div>}
        </section>

        <section className="mood-section">
          <div className="mood-heading">
            <div>
              <div className="mood-title-row">
                <span className="mood-symbol">✦</span>
                <h3>Set the mood</h3>
              </div>

              <p>Tell people how this moment feels</p>
            </div>

            {selectedMood && (
              <button
                type="button"
                className="clear-mood-btn"
                onClick={() => setSelectedMood(null)}
              >
                Clear
              </button>
            )}
          </div>

          <div className="mood-list">
            {moods.map((mood) => (
              <button
                type="button"
                key={mood.id}
                className={`mood-item ${
                  selectedMood?.id === mood.id ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedMood(
                    selectedMood?.id === mood.id ? null : mood
                  );
                }}
              >
                <span className="mood-emoji">{mood.emoji}</span>
                <span className="mood-name">{mood.name}</span>

                {selectedMood?.id === mood.id && (
                  <span className="mood-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </section>

        <div className="create-post-actions">
          <button
            type="button"
            className="clear-btn"
            disabled={
              isPosting ||
              (media.length === 0 &&
                !caption &&
                !selectedMusic &&
                !selectedMood)
            }
            onClick={clearAll}
          >
            Clear
          </button>

          <button
            type="button"
            className="post-btn"
            disabled={
              media.length === 0 ||
              isPosting ||
              Boolean(selectedMusic && !audioRights)
            }
            onClick={handlePost}
          >
            {isPosting ? "Posting..." : "Post on Impressa"}
          </button>
        </div>
      </section>

      {editingIndex !== null && media[editingIndex] && (
        <PostEditor
          key={`${media[editingIndex].id}-${media[editingIndex].version}`}
          item={media[editingIndex]}
          onClose={closeEditor}
          onSave={handleEditorSave}
        />
      )}

      {isPosting && (
        <div
          className="cp-upload-overlay"
          role="alertdialog"
          aria-live="polite"
          aria-label="Posting"
        >
          <div className="cp-upload-card">
            {stage === "error" ? (
              <>
                <div className="cp-upload-badge error">!</div>

                <h3>Couldn't post</h3>

                <p>{postError}</p>

                <div className="cp-upload-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={dismissError}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="primary"
                    onClick={handlePost}
                  >
                    Try again
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="cp-upload-badge">i</div>

                <h3>Posting to Impressa</h3>

                <p>{stageText}</p>

                <div
                  className={`cp-progress ${
                    stage === "uploading" ? "" : "indeterminate"
                  }`}
                >
                  <div
                    className="cp-progress-bar"
                    style={
                      stage === "uploading"
                        ? { width: `${Math.round(progress * 100)}%` }
                        : undefined
                    }
                  />
                </div>

                {stage !== "publishing" && (
                  <div className="cp-upload-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={cancelPosting}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFiles}
        aria-label="Choose photos or videos"
        style={{ display: "none" }}
      />

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioFile}
        aria-label="Choose an audio file"
        style={{ display: "none" }}
      />

      <audio ref={audioRef} onEnded={() => setMusicPlaying(false)} />
    </main>
  );
}

export default CreatePost;
import { useEffect, useRef, useState } from "react";
import "./CreatePost.css";

const filters = [
  { name: "Original", value: "none" },
  { name: "Warm", value: "sepia(0.18) saturate(1.2)" },
  { name: "Bright", value: "brightness(1.15) contrast(1.05)" },
  { name: "Classic", value: "grayscale(0.7) contrast(1.12)" },
  { name: "Vivid", value: "saturate(1.55) contrast(1.08)" },
  { name: "Soft", value: "brightness(1.08) saturate(0.8)" },
];

const musicLibrary = [
  {
    id: 1,
    title: "Golden Hour",
    artist: "Impressa Sounds",
    duration: "0:24",
    audioUrl: "https://res.cloudinary.com/xlf4ww86/video/upload/v1788812409/sound1.mp3",
  },
  {
    id: 2,
    title: "New Beginning",
    artist: "Impressa Sounds",
    duration: "0:21",
    audioUrl: "https://res.cloudinary.com/xlf4ww86/video/upload/v1788812410/sound2.mp3",
  },
  {
    id: 3,
    title: "Dream Motion",
    artist: "Impressa Sounds",
    duration: "0:27",
    audioUrl: "",
  },
  {
    id: 4,
    title: "City Lights",
    artist: "Impressa Sounds",
    duration: "0:25",
    audioUrl: "",
  },
  {
    id: 5,
    title: "Free Spirit",
    artist: "Impressa Sounds",
    duration: "0:23",
    audioUrl: "",
  },
];

const moods = [
  {
    id: "energetic",
    emoji: "🔥",
    name: "Energetic",
  },
  {
    id: "calm",
    emoji: "🌙",
    name: "Calm",
  },
  {
    id: "inspired",
    emoji: "✨",
    name: "Inspired",
  },
  {
    id: "happy",
    emoji: "❤️",
    name: "Happy",
  },
  {
    id: "deep",
    emoji: "🖤",
    name: "Deep",
  },
  {
    id: "peaceful",
    emoji: "🌿",
    name: "Peaceful",
  },
];

function CreatePost() {
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

const [media, setMedia] = useState([]);

  const [activeIndex, setActiveIndex] = useState(0);

  const [caption, setCaption] = useState("");

  const [editingIndex, setEditingIndex] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [rotation, setRotation] = useState(0);
  const [cropMode, setCropMode] = useState(false);

  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [musicSearch, setMusicSearch] = useState("");
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [playingMusicId, setPlayingMusicId] = useState(null);

  const [selectedMood, setSelectedMood] = useState(null);

  const [isPosting, setIsPosting] = useState(false);

  /* =====================================================
     MEDIA UPLOAD
  ===================================================== */

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = (event) => {
  const files = Array.from(event.target.files || []);

    // Some mobile browsers can return an empty MIME type for
    // photos selected from the gallery. Fall back to the file
    // extension so valid mobile images are not rejected.
    const getMediaType = (file) => {
      const mimeType = (file.type || "").toLowerCase();
      const extension = file.name
        .split(".")
        .pop()
        .toLowerCase();

      const imageExtensions = [
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

      const videoExtensions = [
        "mp4",
        "mov",
        "webm",
        "m4v",
        "avi",
      ];

      if (mimeType.startsWith("video/") || videoExtensions.includes(extension)) {
        return "video";
      }

      if (mimeType.startsWith("image/") || imageExtensions.includes(extension)) {
        return "image";
      }

      return null;
    };

    const validFiles = files
      .map((file) => ({
        file,
        mediaType: getMediaType(file),
      }))
      .filter(({ mediaType }) => mediaType !== null);

    const newMedia = validFiles.map(({ file, mediaType }) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      type: mediaType,
      url: URL.createObjectURL(file),
      filter: "none",
      rotation: 0,
      crop: false,
    }));

    setMedia((previousMedia) => {
      const updatedMedia = [
        ...previousMedia,
        ...newMedia,
      ];

      if (previousMedia.length === 0) {
        setActiveIndex(0);
      }

      return updatedMedia;
    });

    event.target.value = "";
  };

  /* =====================================================
     REMOVE MEDIA
  ===================================================== */

  const removeMedia = (id) => {
    setMedia((previousMedia) => {
      const itemToRemove = previousMedia.find(
        (item) => item.id === id
      );

      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.url);
      }

      const updatedMedia = previousMedia.filter(
        (item) => item.id !== id
      );

      return updatedMedia;
    });

    setActiveIndex((currentIndex) => {
      if (currentIndex >= media.length - 1) {
        return Math.max(0, media.length - 2);
      }

      return currentIndex;
    });

    setEditingIndex(null);
  };

  /* =====================================================
     REORDER MEDIA
  ===================================================== */

  const moveMedia = (index, direction) => {
    setMedia((previousMedia) => {
      const updatedMedia = [...previousMedia];

      const targetIndex = index + direction;

      if (
        targetIndex < 0 ||
        targetIndex >= updatedMedia.length
      ) {
        return previousMedia;
      }

      [
        updatedMedia[index],
        updatedMedia[targetIndex],
      ] = [
        updatedMedia[targetIndex],
        updatedMedia[index],
      ];

      return updatedMedia;
    });

    setActiveIndex((currentIndex) => {
      if (currentIndex === index) {
        return index + direction;
      }

      if (currentIndex === index + direction) {
        return index;
      }

      return currentIndex;
    });
  };

  /* =====================================================
     CAROUSEL
  ===================================================== */

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

  /* =====================================================
     EDITOR
  ===================================================== */

  const openEditor = (index) => {
    const selectedMedia = media[index];

    setEditingIndex(index);

    setSelectedFilter(
      selectedMedia.filter || "none"
    );

    setRotation(
      selectedMedia.rotation || 0
    );

    setCropMode(
      selectedMedia.crop || false
    );
  };

  const closeEditor = () => {
    setEditingIndex(null);
    setCropMode(false);
  };

  const applyFilter = (filterValue) => {
    setSelectedFilter(filterValue);

    if (editingIndex === null) {
      return;
    }

    setMedia((previousMedia) =>
      previousMedia.map((item, index) =>
        index === editingIndex
          ? {
              ...item,
              filter: filterValue,
            }
          : item
      )
    );
  };

  const rotateImage = () => {
    if (editingIndex === null) {
      return;
    }

    const newRotation = rotation + 90;

    setRotation(newRotation);

    setMedia((previousMedia) =>
      previousMedia.map((item, index) =>
        index === editingIndex
          ? {
              ...item,
              rotation: newRotation,
            }
          : item
      )
    );
  };

  const toggleCrop = () => {
    if (editingIndex === null) {
      return;
    }

    const newCropState = !cropMode;

    setCropMode(newCropState);

    setMedia((previousMedia) =>
      previousMedia.map((item, index) =>
        index === editingIndex
          ? {
              ...item,
              crop: newCropState,
            }
          : item
      )
    );
  };

  /* =====================================================
     MUSIC
  ===================================================== */

  const filteredMusic = musicLibrary.filter((track) => {
    const search = musicSearch
      .toLowerCase()
      .trim();

    return (
      track.title
        .toLowerCase()
        .includes(search) ||
      track.artist
        .toLowerCase()
        .includes(search)
    );
  });

  const selectMusic = (track) => {
    setSelectedMusic(track);
    setShowMusicLibrary(false);
    setPlayingMusicId(null);

    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const removeMusic = () => {
    setSelectedMusic(null);
    setPlayingMusicId(null);

    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const toggleMusicPreview = (track) => {
    if (!track.audioUrl) {
      setPlayingMusicId((currentId) =>
        currentId === track.id
          ? null
          : track.id
      );

      return;
    }

    if (!audioRef.current) {
      return;
    }

    if (playingMusicId === track.id) {
      audioRef.current.pause();
      setPlayingMusicId(null);

      return;
    }

    audioRef.current.src = track.audioUrl;
    audioRef.current.currentTime = 0;

    audioRef.current
      .play()
      .then(() => {
        setPlayingMusicId(track.id);
      })
      .catch(() => {
        setPlayingMusicId(null);
      });
  };

  /* =====================================================
     CLEAR
  ===================================================== */

  const clearAll = () => {
    media.forEach((item) => {
      URL.revokeObjectURL(item.url);
    });

    setMedia([]);
    setCaption("");
    setActiveIndex(0);

    setEditingIndex(null);

    setSelectedMusic(null);
    setShowMusicLibrary(false);
    setMusicSearch("");
    setPlayingMusicId(null);

    setSelectedMood(null);
  };

  /* =====================================================
     POST
  ===================================================== */

 const handlePost = async () => {
  if (media.length === 0) {
    return;
  }

  const token = localStorage.getItem("token");

  if (!token) {
    console.error("No login token found.");
    return;
  }

  setIsPosting(true);

  try {
    const formData = new FormData();

    media.forEach((item) => {
      formData.append("media", item.file);
    });

    formData.append("caption", caption.trim());

    if (selectedMusic) {
      formData.append(
        "music",
        JSON.stringify({
          id: selectedMusic.id,
          title: selectedMusic.title,
          artist: selectedMusic.artist,
          audioUrl: selectedMusic.audioUrl || "",
        })
      );
    }

   const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

    const response = await fetch(
      `${API_URL}/api/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Create post failed:",
        data
      );
      return;
    }

    console.log(
      "Impressa post created successfully:",
      data
    );

    media.forEach((item) => {
      URL.revokeObjectURL(item.url);
    });

    setMedia([]);
    setCaption("");
    setActiveIndex(0);
    setSelectedMusic(null);
    setSelectedMood(null);
    setEditingIndex(null);

  } catch (error) {
    console.error(
      "Create post error:",
      error
    );
  } finally {
    setIsPosting(false);
  }
};

  /* =====================================================
     CLEANUP
  ===================================================== */

  useEffect(() => {
    return () => {
      media.forEach((item) => {
        URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  return (
    <main className="create-post-page">
      <section className="create-post-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="create-post-header">

          <div>
            <p className="create-post-small-title">
              IMPRESSA
            </p>

            <h1>Create Post</h1> 
          </div>

          <div className="media-count">
            {media.length === 0
              ? "New post"
              : `${media.length} media`}
          </div>

        </header>

        {/* =================================================
            EMPTY UPLOAD
        ================================================= */}

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
            {/* =============================================
                CAROUSEL
            ============================================= */}

            <div className="carousel-section">

              <div className="carousel">

                {media[activeIndex]?.type ===
                "image" ? (
                  <img
                    src={
                      media[activeIndex].url
                    }
                    alt={`Post media ${
                      activeIndex + 1
                    }`}
                    className={`carousel-media ${
                      media[activeIndex].crop
                        ? "cropped-media"
                        : ""
                    }`}
                    style={{
                      filter:
                        media[activeIndex]
                          .filter,
                      transform: `rotate(${
                        media[activeIndex]
                          .rotation
                      }deg)`,
                    }}
                  />
                ) : (
                  <video
                    src={
                      media[activeIndex].url
                    }
                    className="carousel-media"
                    controls
                    playsInline
                  />
                )}

                <div className="carousel-counter">
                  {activeIndex + 1} /{" "}
                  {media.length}
                </div>

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

                {activeIndex <
                  media.length - 1 && (
                  <button
                    type="button"
                    className="carousel-arrow next"
                    onClick={nextMedia}
                    aria-label="Next media"
                  >
                    ›
                  </button>
                )}

                <button
                  type="button"
                  className="edit-main-button"
                  onClick={() =>
                    openEditor(activeIndex)
                  }
                >
                  ✦ Edit
                </button>

              </div>

              <div className="carousel-dots">

                {media.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`carousel-dot ${
                      activeIndex === index
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveIndex(index)
                    }
                    aria-label={`Show media ${
                      index + 1
                    }`}
                  />
                ))}

              </div>

            </div>

            {/* =============================================
                ADD MORE MEDIA
            ============================================= */}

            <button
              type="button"
              className="add-more-media"
              onClick={openFilePicker}
            >
              <span>＋</span>
              Add more media
            </button>

            {/* =============================================
                MEDIA MANAGER
            ============================================= */}

            <div className="media-manager">

              <div className="section-heading">

                <div>
                  <h3>Your media</h3>
                  <p>
                    Arrange your carousel
                  </p>
                </div>

                <span>{media.length}</span>

              </div>

              <div className="media-list">

                {media.map((item, index) => (
                  <div
                    className={`media-item ${
                      activeIndex === index
                        ? "selected"
                        : ""
                    }`}
                    key={item.id}
                    onClick={() =>
                      setActiveIndex(index)
                    }
                  >

                    <div className="thumbnail-wrapper">

                      {item.type === "image" ? (
                        <img
                          src={item.url}
                          alt={`Thumbnail ${
                            index + 1
                          }`}
                          style={{
                            filter: item.filter,
                            transform: `rotate(${
                              item.rotation
                            }deg)`,
                          }}
                        />
                      ) : (
                        <>
                          <video
                            src={item.url}
                            muted
                            playsInline
                            preload="metadata"
                          />

                          <span className="video-badge">
                            ▶
                          </span>
                        </>
                      )}

                      <span className="media-number">
                        {index + 1}
                      </span>

                    </div>

                    <div className="media-actions">

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

                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveMedia(
                            index,
                            -1
                          );
                        }}
                        aria-label="Move media left"
                      >
                        ←
                      </button>

                      <button
                        type="button"
                        disabled={
                          index ===
                          media.length - 1
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          moveMedia(
                            index,
                            1
                          );
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
                          removeMedia(
                            item.id
                          );
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

        {/* =================================================
            CAPTION
        ================================================= */}

        <div className="caption-section">

          <div className="caption-heading">

            <h3>Caption</h3>

            <span>
              {caption.length}/500
            </span>

          </div>

          <textarea
            value={caption}
            onChange={(event) => {
              if (
                event.target.value.length <=
                500
              ) {
                setCaption(
                  event.target.value
                );
              }
            }}
            placeholder="Write something about this moment..."
            maxLength={500}
          />

        </div>

        {/* =================================================
            MUSIC
        ================================================= */}

        <section className="music-section">

          <div className="music-heading">

            <div>

              <div className="music-title-row">

                <span className="music-symbol">
                  ♪
                </span>

                <h3>Add Music</h3>

              </div>

              <p>
                Add one song to your entire post
              </p>

            </div>

            {selectedMusic && (
              <button
                type="button"
                className="change-music-btn"
                onClick={() =>
                  setShowMusicLibrary(true)
                }
              >
                Change
              </button>
            )}

          </div>

          {selectedMusic ? (
            <div className="selected-music-card">

              <div className="music-cover">
                ♪
              </div>

              <div className="selected-music-info">

                <strong>
                  {selectedMusic.title}
                </strong>

                <span>
                  {selectedMusic.artist}
                </span>

              </div>

              <button
                type="button"
                className="music-play-btn"
                onClick={() =>
                  toggleMusicPreview(
                    selectedMusic
                  )
                }
              >
                {playingMusicId ===
                selectedMusic.id
                  ? "Ⅱ"
                  : "▶"}
              </button>

              <button
                type="button"
                className="remove-music-btn"
                onClick={removeMusic}
                aria-label="Remove music"
              >
                ×
              </button>

            </div>
          ) : (
            <button
              type="button"
              className="add-music-card"
              onClick={() =>
                setShowMusicLibrary(true)
              }
            >

              <div className="music-add-icon">
                ♪
              </div>

              <div>

                <strong>
                  Choose a song
                </strong>

                <span>
                  From the Impressa music library
                </span>

              </div>

              <span className="music-arrow">
                ›
              </span>

            </button>
          )}

        </section>

        {/* =================================================
            MOOD
        ================================================= */}

        <section className="mood-section">

          <div className="mood-heading">

            <div>

              <div className="mood-title-row">

                <span className="mood-symbol">
                  ✦
                </span>

                <h3>Set the mood</h3>

              </div>

              <p>
                Tell people how this moment feels
              </p>

            </div>

            {selectedMood && (
              <button
                type="button"
                className="clear-mood-btn"
                onClick={() =>
                  setSelectedMood(null)
                }
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
                  selectedMood?.id === mood.id
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setSelectedMood(
                    selectedMood?.id ===
                      mood.id
                      ? null
                      : mood
                  );
                }}
              >

                <span className="mood-emoji">
                  {mood.emoji}
                </span>

                <span className="mood-name">
                  {mood.name}
                </span>

                {selectedMood?.id ===
                  mood.id && (
                  <span className="mood-check">
                    ✓
                  </span>
                )}

              </button>
            ))}

          </div>

        </section>

        {/* =================================================
            POST BUTTONS
        ================================================= */}

        <div className="create-post-actions">

          <button
            type="button"
            className="clear-btn"
            disabled={
              media.length === 0 &&
              !caption &&
              !selectedMusic &&
              !selectedMood
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
              isPosting
            }
            onClick={handlePost}
          >
            {isPosting
              ? "Posting..."
              : "Post on Impressa"}
          </button>

        </div>

      </section>

      {/* ===================================================
          MUSIC LIBRARY MODAL
      =================================================== */}

      {showMusicLibrary && (
        <div className="music-overlay">

          <div className="music-panel">

            <div className="music-panel-header">

              <div>

                <span>IMPRESSA</span>

                <h2>Music Library</h2>

              </div>

              <button
                type="button"
                className="close-music"
                onClick={() =>
                  setShowMusicLibrary(false)
                }
                aria-label="Close music library"
              >
                ×
              </button>

            </div>

            <div className="music-search">

              <span>⌕</span>

              <input
                type="text"
                value={musicSearch}
                onChange={(event) =>
                  setMusicSearch(
                    event.target.value
                  )
                }
                placeholder="Search songs or artists..."
              />

            </div>

            <div className="music-library-list">

              {filteredMusic.length > 0 ? (
                filteredMusic.map((track) => (
                  <div
                    className={`music-track ${
                      selectedMusic?.id ===
                      track.id
                        ? "selected"
                        : ""
                    }`}
                    key={track.id}
                  >

                    <div className="track-cover">
                      ♪
                    </div>

                    <div className="track-details">

                      <strong>
                        {track.title}
                      </strong>

                      <span>
                        {track.artist}
                      </span>

                    </div>

                    <span className="track-duration">
                      {track.duration}
                    </span>

                    <button
                      type="button"
                      className="track-play"
                      onClick={() =>
                        toggleMusicPreview(
                          track
                        )
                      }
                    >
                      {playingMusicId ===
                      track.id
                        ? "Ⅱ"
                        : "▶"}
                    </button>

                    <button
                      type="button"
                      className="select-track"
                      onClick={() =>
                        selectMusic(track)
                      }
                    >
                      {selectedMusic?.id ===
                      track.id
                        ? "✓"
                        : "Add"}
                    </button>

                  </div>
                ))
              ) : (
                <div className="no-music">

                  <span>♪</span>

                  <p>
                    No songs found
                  </p>

                </div>
              )}

            </div>

            <p className="music-library-note">
              Music available in Impressa will be
              properly licensed for use on the platform.
            </p>

          </div>

        </div>
      )}

      {/* ===================================================
          EDITOR MODAL
      =================================================== */}

      {editingIndex !== null &&
        media[editingIndex] && (
          <div className="editor-overlay">

            <div className="editor-panel">

              <div className="editor-header">

                <div>

                  <span>
                    IMPRESSA EDITOR
                  </span>

                  <h2>Edit Media</h2>

                </div>

                <button
                  type="button"
                  className="close-editor"
                  onClick={closeEditor}
                  aria-label="Close editor"
                >
                  ×
                </button>

              </div>

              <div className="editor-preview">

                {media[editingIndex].type ===
                "image" ? (
                  <img
                    src={
                      media[editingIndex].url
                    }
                    alt="Editing preview"
                    className={
                      cropMode
                        ? "editor-crop-preview"
                        : ""
                    }
                    style={{
                      filter:
                        selectedFilter,
                      transform: `rotate(${
                        rotation
                      }deg)`,
                    }}
                  />
                ) : (
                  <video
                    src={
                      media[editingIndex].url
                    }
                    controls
                    playsInline
                  />
                )}

              </div>

              {media[editingIndex].type ===
                "image" && (
                <div className="editor-tools">

                  <button
                    type="button"
                    className={
                      cropMode
                        ? "tool active"
                        : "tool"
                    }
                    onClick={toggleCrop}
                  >
                    <span>□</span>
                    Crop
                  </button>

                  <button
                    type="button"
                    className="tool"
                    onClick={rotateImage}
                  >
                    <span>↻</span>
                    Rotate
                  </button>

                </div>
              )}

              {media[editingIndex].type ===
                "image" && (
                <div className="filter-section">

                  <div className="filter-title">

                    <h3>Filters</h3>

                    <span>
                      Choose a look
                    </span>

                  </div>

                  <div className="filter-list">

                    {filters.map((filter) => (
                      <button
                        type="button"
                        key={filter.name}
                        className={
                          selectedFilter ===
                          filter.value
                            ? "filter-item active"
                            : "filter-item"
                        }
                        onClick={() =>
                          applyFilter(
                            filter.value
                          )
                        }
                      >

                        <div className="filter-preview">

                          <img
                            src={
                              media[
                                editingIndex
                              ].url
                            }
                            alt={filter.name}
                            style={{
                              filter:
                                filter.value,
                            }}
                          />

                        </div>

                        <span>
                          {filter.name}
                        </span>

                      </button>
                    ))}

                  </div>

                </div>
              )}

              <button
                type="button"
                className="done-editing"
                onClick={closeEditor}
              >
                Done
              </button>

            </div>

          </div>
        )}

      {/* ===================================================
          FILE INPUT
      =================================================== */}

   <input
  ref={fileInputRef}
  type="file"
  accept="image/*,video/*"
  multiple
  onChange={handleFiles}
  aria-label="Choose photos or videos"
  style={{ display: "none" }}
/>
      <audio
        ref={audioRef}
        onEnded={() =>
          setPlayingMusicId(null)
        }
      />

    </main>
  );
}

export default CreatePost;
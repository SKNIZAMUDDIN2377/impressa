const cloudinary = require("../config/cloudinary");

const getPublicId = (url) => {
  try {
    if (!url || !String(url).includes("res.cloudinary.com")) {
      return null;
    }

    const match = String(url).match(
      /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/
    );

    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
};

// Best-effort: a Cloudinary failure never blocks the deletion itself.
const deleteCloudinaryMedia = async (mediaItems = []) => {
  await Promise.allSettled(
    mediaItems.map((item) => {
      const publicId = getPublicId(item?.url);

      if (!publicId) return Promise.resolve();

      return cloudinary.uploader.destroy(publicId, {
        resource_type: item.type === "video" ? "video" : "image",
      });
    })
  );
};

module.exports = { deleteCloudinaryMedia };
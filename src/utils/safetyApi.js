const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const CACHE_KEY_PARTS = [
  "home_posts",
  "pulse_data",
  "search_",
  "impressa_profile_",
  "impressa_notifications",
];

// Removes cached feed/pulse/search/profile data. Called after block/unblock
// so blocked users' content cannot reappear from a stale cache.
const clearContentCaches = () => {
  try {
    [localStorage, sessionStorage].forEach((storage) => {
      Object.keys(storage).forEach((key) => {
        if (CACHE_KEY_PARTS.some((part) => key.includes(part))) {
          storage.removeItem(key);
        }
      });
    });
  } catch (error) {
    // storage unavailable: nothing to clear
  }
};

const request = async (path, options = {}) => {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    // no JSON body
  }

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong");
    error.status = response.status;
    throw error;
  }

  return data;
};

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_abuse", label: "Hate or abusive content" },
  { value: "sexual_content", label: "Sexual/explicit content" },
  { value: "violence", label: "Violence" },
  { value: "impersonation", label: "Impersonation" },
  { value: "copyright", label: "Copyright issue" },
  { value: "other", label: "Other" },
];

export const blockUser = async (username) => {
  const data = await request(
    `/api/blocks/${encodeURIComponent(username)}`,
    { method: "POST" }
  );

  clearContentCaches();

  return data;
};

export const unblockUser = async (username) => {
  const data = await request(
    `/api/blocks/${encodeURIComponent(username)}`,
    { method: "DELETE" }
  );

  clearContentCaches();

  return data;
};

export const getBlockedUsers = (search = "") =>
  request(`/api/blocks?search=${encodeURIComponent(search)}`);

export const reportUser = (username, reason, description = "") =>
  request(`/api/reports/user/${encodeURIComponent(username)}`, {
    method: "POST",
    body: JSON.stringify({ reason, description }),
  });

export const reportPost = (postId, reason, description = "") =>
  request(`/api/reports/post/${encodeURIComponent(postId)}`, {
    method: "POST",
    body: JSON.stringify({ reason, description }),
  });
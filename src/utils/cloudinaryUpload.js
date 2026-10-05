// ==========================================
// IMPRESSA DIRECT UPLOADS
// Browser -> Cloudinary (signed), then a tiny JSON request to the API.
// ==========================================

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const abortError = () =>
  Object.assign(new Error("Cancelled"), { name: "AbortError" });

// Wakes up a sleeping Render server (fire and forget)
export const warmUpServer = () => {
  try {
    fetch(`${API_URL}/api/health`, { cache: "no-store" }).catch(() => {});
  } catch (error) {
    // ignore
  }
};

// ------------------------------------------
// JSON requests with timeout + friendly errors
// ------------------------------------------

const withTimeout = (signal, ms) => {
  const controller = new AbortController();

  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);

  const onAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
};

async function requestJson(url, options, timeoutMs, signal) {
  const guard = withTimeout(signal, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: guard.signal,
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(
        data.message || `Request failed (${response.status})`
      );

      error.status = response.status;

      throw error;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;

    if (guard.didTimeOut()) {
      throw Object.assign(
        new Error(
          "The server is taking too long to respond. Please try again."
        ),
        { code: "timeout" }
      );
    }

    if (signal?.aborted) throw abortError();

    throw Object.assign(
      new Error(
        "Unable to reach Impressa server. Check your connection and try again."
      ),
      { code: "network" }
    );
  } finally {
    guard.done();
  }
}

export function fetchUploadSignature(token, signal) {
  return requestJson(
    `${API_URL}/api/posts/upload-signature`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
    60000, // allows for a Render cold start
    signal
  );
}

export function createPostRequest({ token, media, caption, music, signal }) {
  return requestJson(
    `${API_URL}/api/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ media, caption, music }),
    },
    60000,
    signal
  );
}

// ------------------------------------------
// CLOUDINARY UPLOAD (XHR, for real progress)
// ------------------------------------------

function uploadOnce({
  file,
  filename,
  resourceType,
  signature,
  onProgress,
  signal,
}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const xhr = new XMLHttpRequest();

    const form = new FormData();

    form.append("file", file, filename);
    form.append("api_key", signature.apiKey);
    form.append("timestamp", String(signature.timestamp));
    form.append("signature", signature.signature);
    form.append("folder", signature.folder);

    const onAbort = () => xhr.abort();

    signal?.addEventListener("abort", onAbort, { once: true });

    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`
    );

    xhr.timeout = 10 * 60 * 1000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.min(event.loaded, file.size));
      }
    };

    xhr.onload = () => {
      cleanup();

      let body = {};

      try {
        body = JSON.parse(xhr.responseText);
      } catch (parseError) {
        body = {};
      }

      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        resolve({
          url: body.secure_url,
          width: body.width,
          height: body.height,
        });

        return;
      }

      const error = new Error(
        body?.error?.message || `Upload failed (${xhr.status})`
      );

      error.retryable = xhr.status >= 500;

      reject(error);
    };

    xhr.onerror = () => {
      cleanup();

      reject(
        Object.assign(
          new Error("Network error while uploading. Please try again."),
          { retryable: true }
        )
      );
    };

    xhr.ontimeout = () => {
      cleanup();

      reject(
        Object.assign(new Error("The upload timed out."), {
          retryable: true,
        })
      );
    };

    xhr.onabort = () => {
      cleanup();
      reject(abortError());
    };

    xhr.send(form);
  });
}

export async function uploadWithRetry(options, retries = 2) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await uploadOnce(options);
    } catch (error) {
      if (
        error.name === "AbortError" ||
        !error.retryable ||
        attempt >= retries
      ) {
        throw error;
      }

      options.onProgress?.(0);

      await new Promise((resolve) =>
        setTimeout(resolve, 800 * (attempt + 1))
      );
    }
  }
}

// Runs async tasks with a limit on how many run at once
export async function runPool(tasks, limit) {
  let next = 0;
  let failure = null;

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (!failure) {
        const index = next;

        next += 1;

        if (index >= tasks.length) return;

        try {
          await tasks[index]();
        } catch (error) {
          failure = failure || error;
          return;
        }
      }
    }
  );

  await Promise.all(workers);

  if (failure) throw failure;
}
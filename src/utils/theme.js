const THEME_KEY = "impressa_theme";

export const getStoredTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch (error) {
    return "light";
  }
};

export const applyTheme = (theme) => {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
};

// Saves + applies instantly (no reload). Returns the applied theme.
export const setTheme = (theme) => {
  const next = theme === "dark" ? "dark" : "light";

  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (error) {
    // storage unavailable: theme still applies for this session
  }

  applyTheme(next);

  return next;
};
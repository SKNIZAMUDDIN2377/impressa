// Same rules the backend enforces (see getPasswordError in authController).

export const getPasswordRequirements = (password) => ({
  length: password.length >= 8 && password.length <= 64,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
  special: /[^A-Za-z\d]/.test(password),
  noSpaces: !/\s/.test(password),
});

// Returns the first unmet requirement as a short hint, or "" when valid.
export const getPasswordHint = (password) => {
  const rules = getPasswordRequirements(password);

  if (!rules.length) return "Use 8–64 characters";
  if (!rules.uppercase) return "Add an uppercase letter";
  if (!rules.lowercase) return "Add a lowercase letter";
  if (!rules.number) return "Add a number";
  if (!rules.special) return "Add a special character";
  if (!rules.noSpaces) return "Remove spaces";

  return "";
};
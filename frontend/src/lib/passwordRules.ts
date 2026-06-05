export type PasswordRuleResult =
  | { valid: true }
  | { valid: false; message: string };

export function validateStrongPassword(password: string): PasswordRuleResult {
  if (password.length < 8) {
    return { valid: false, message: "Use 8 characters or more." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Include at least one lowercase letter." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Include at least one uppercase letter." };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: "Include at least one number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: "Include at least one symbol." };
  }
  return { valid: true };
}

export const PASSWORD_REQUIREMENTS_COPY =
  "Use 8+ characters with at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 symbol.";

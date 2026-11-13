const MAX_NAME = 64;
const CONTROL = /\p{Cc}/u;

/** The API's rule: 1 to 64 characters after trimming, no control characters. */
export function validateProjectName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Enter a project name.";
  if ([...name].length > MAX_NAME) return `Name must be ${MAX_NAME} characters or fewer.`;
  if (CONTROL.test(name)) return "Name can't contain control characters.";
  return null;
}

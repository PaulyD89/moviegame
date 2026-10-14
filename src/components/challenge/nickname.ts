const KEY = "moviegame:nickname";

export function loadNickname(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(name: string) {
  try {
    localStorage.setItem(KEY, name.trim());
  } catch {
    // Not critical; they'll just retype it.
  }
}

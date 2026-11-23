export function clearCaseDrafts() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('case-draft:')) localStorage.removeItem(key);
  } catch {
    /* Storage can be disabled. */
  }
}

/** Full document load so a freshly set auth-token cookie is applied. */
export function hardNavigate(path: string): void {
  window.location.assign(path);
}

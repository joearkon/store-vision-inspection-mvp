export function cameraPageState(bootstrap, loadError) {
  if (bootstrap) return "ready";
  return loadError ? "error" : "loading";
}

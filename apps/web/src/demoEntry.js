export function demoEntryState({ showcase, actorId, currentUser, routePage, loading }) {
  if (!showcase) return "app";
  if (routePage === "login" || !actorId) return "login";
  if (loading) return "loading";
  return currentUser ? "app" : "login";
}

export function demoReturnRoute(savedRoute) {
  return /^#\/(dashboard|stores|runs|cameras|rectification|workorder|cards|rules|accounts|event\/[^/]+|run\/[^/]+|cameraDetail\/[^/]+)$/.test(savedRoute || "")
    ? savedRoute : "#/dashboard";
}

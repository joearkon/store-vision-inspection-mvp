import React from "react";

const paths = {
  dashboard: ["M4 4h6v6H4z", "M14 4h6v10h-6z", "M4 14h6v6H4z", "M14 18h6v2h-6z"],
  upload: ["M12 16V4", "m7 9 5-5 5 5", "M5 20h14"],
  camera: ["M4 7h11v10H4z", "m15 10 4 2V7l-4 2z"],
  rectification: ["M5 4h14v16H5z", "m8 12 2 2 4-5"],
  rules: ["M6 4h12", "M6 12h12", "M6 20h12", "M3 4h.01", "M3 12h.01", "M3 20h.01"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  store: ["M4 10h16", "M6 10v10h12V10", "M5 4h14l1 6H4z"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M4 21a8 8 0 0 1 16 0"],
  video: ["M4 6h12v12H4z", "m16 4 4-2v8l-4-2z"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M12 6v6l4 2"],
  plus: ["M12 5v14", "M5 12h14"],
  pulse: ["M2 12h5l3-7 4 14 3-7h5"],
  alert: ["M12 3 2 4h4l-3 4 2 4h-4l-1 5-1-5H7l2-4-3-4h4z"],
  check: ["m5 12 4 4L19 6"],
  close: ["m6 6 12 12", "m18 6-12 12"],
  arrow: ["m9 18 6-6-6-6"],
  play: ["m8 5 11 7-11 7z"]
};

export function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(paths[name] || paths.dashboard).map((path, index) => (
        <path d={path} key={index} />
      ))}
    </svg>
  );
}

// Shared UI components for the Store Visual Inspection prototype

const SEVERITY_STYLES = {
  P0: {
    bg: "rgba(220, 38, 38, 0.1)",
    border: "rgba(220, 38, 38, 0.3)",
    text: "#DC2626",
    label: "P0-严重"
  },
  P1: {
    bg: "rgba(234, 88, 12, 0.1)",
    border: "rgba(234, 88, 12, 0.3)",
    text: "#EA580C",
    label: "P1-一般"
  },
  P2: {
    bg: "rgba(217, 119, 6, 0.1)",
    border: "rgba(217, 119, 6, 0.3)",
    text: "#D97706",
    label: "P2-提示"
  }
};

const STATUS_STYLES = {
  pending: { bg: "rgba(220, 38, 38, 0.1)", text: "#DC2626", label: "待处理", dot: "#DC2626" },
  in_progress: { bg: "rgba(37, 99, 235, 0.1)", text: "#2563EB", label: "整改中", dot: "#2563EB" },
  resolved: { bg: "rgba(16, 185, 129, 0.1)", text: "#059669", label: "已解决", dot: "#059669" },
  overdue: { bg: "rgba(127, 29, 29, 0.15)", text: "#991B1B", label: "已超时", dot: "#991B1B" }
};

function SeverityBadge({ severity, size = "sm" }) {
  const style = SEVERITY_STYLES[severity];
  const padding = size === "lg" ? "6px 12px" : "3px 8px";
  const fontSize = size === "lg" ? "13px" : "11px";
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding,
        borderRadius: "4px",
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontSize,
        fontWeight: 600,
        letterSpacing: "0.02em"
      }
    },
    React.createElement("span", {
      style: {
        width: size === "lg" ? "8px" : "6px",
        height: size === "lg" ? "8px" : "6px",
        borderRadius: "50%",
        background: style.text
      }
    }),
    style.label
  );
}

function StatusBadge({ status, size = "sm" }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const padding = size === "lg" ? "6px 12px" : "3px 8px";
  const fontSize = size === "lg" ? "13px" : "11px";
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding,
        borderRadius: "4px",
        background: style.bg,
        color: style.text,
        fontSize,
        fontWeight: 500
      }
    },
    React.createElement("span", {
      style: {
        width: size === "lg" ? "8px" : "6px",
        height: size === "lg" ? "8px" : "6px",
        borderRadius: "50%",
        background: style.dot
      }
    }),
    style.label
  );
}

function ConfidenceChip({ confidence, size = "sm" }) {
  const fontSize = size === "lg" ? "13px" : "11px";
  const padding = size === "lg" ? "5px 10px" : "3px 8px";
  let color;
  if (confidence >= 90) color = "#059669";
  else if (confidence >= 80) color = "#2563EB";
  else color = "#D97706";
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding,
        borderRadius: "999px",
        background: "rgba(37, 99, 235, 0.08)",
        border: "1px solid rgba(37, 99, 235, 0.2)",
        color,
        fontSize,
        fontWeight: 600,
        fontFamily: "'SF Mono', 'Fira Code', monospace"
      }
    },
    React.createElement("svg", {
      width: size === "lg" ? "14" : "12",
      height: size === "lg" ? "14" : "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
      React.createElement("path", { d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" })
    ),
    `${confidence}% 置信度`
  );
}

function Card({ children, style, padding = "20px" }) {
  return React.createElement(
    "div",
    {
      style: {
        background: "#FFFFFF",
        borderRadius: "8px",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        padding,
        ...style
      }
    },
    children
  );
}

function SectionTitle({ children, subtitle }) {
  return React.createElement(
    "div",
    { style: { marginBottom: "16px" } },
    React.createElement("h3", {
      style: {
        fontSize: "15px",
        fontWeight: 600,
        color: "#0F172A",
        margin: 0,
        lineHeight: 1.4
      }
    }, children),
    subtitle && React.createElement("p", {
      style: {
        fontSize: "12px",
        color: "#64748B",
        margin: "4px 0 0 0",
        lineHeight: 1.5
      }
    }, subtitle)
  );
}

function Button({ children, variant = "primary", onClick, style, size = "md", icon }) {
  const sizes = {
    sm: { padding: "6px 12px", fontSize: "12px", borderRadius: "4px" },
    md: { padding: "8px 16px", fontSize: "13px", borderRadius: "6px" },
    lg: { padding: "10px 20px", fontSize: "14px", borderRadius: "6px" }
  };

  const variants = {
    primary: {
      background: "#4F46E5",
      color: "#FFFFFF",
      border: "1px solid #4F46E5",
      hoverBg: "#4338CA"
    },
    secondary: {
      background: "#FFFFFF",
      color: "#334155",
      border: "1px solid #CBD5E1",
      hoverBg: "#F8FAFC"
    },
    danger: {
      background: "#DC2626",
      color: "#FFFFFF",
      border: "1px solid #DC2626",
      hoverBg: "#B91C1C"
    },
    ghost: {
      background: "transparent",
      color: "#4F46E5",
      border: "1px solid transparent",
      hoverBg: "rgba(79, 70, 229, 0.08)"
    }
  };

  const [hovered, setHovered] = React.useState(false);
  const v = variants[variant];
  const s = sizes[size];

  return React.createElement(
    "button",
    {
      onClick,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 500,
        borderRadius: s.borderRadius,
        background: hovered ? v.hoverBg : v.background,
        color: v.color,
        border: v.border,
        cursor: "pointer",
        transition: "all 0.15s ease",
        fontFamily: "inherit",
        lineHeight: 1.4,
        ...style
      }
    },
    icon && React.createElement("span", { dangerouslySetInnerHTML: { __html: icon } }),
    children
  );
}

// Sidebar icons as inline SVGs
const ICONS = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  event: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  camera: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  rectification: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  workorder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><polyline points="8 5 8 6 8 5"/></svg>',
  card: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
};

Object.assign(window, {
  SEVERITY_STYLES,
  STATUS_STYLES,
  SeverityBadge,
  StatusBadge,
  ConfidenceChip,
  Card,
  SectionTitle,
  Button,
  ICONS
});

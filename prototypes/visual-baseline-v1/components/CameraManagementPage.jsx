// Camera Management Page

function CameraManagementPage() {
  const [cameras, setCameras] = React.useState(window.CAMERAS.map(c => ({ ...c, enabled: c.status === "online" })));
  const [showAddModal, setShowAddModal] = React.useState(false);

  const toggleCamera = (id) => {
    setCameras(prev => prev.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled, status: !c.enabled ? "online" : "offline" } : c
    ));
  };

  const onlineCount = cameras.filter(c => c.enabled).length;

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "20px" } },
      // Header
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between"
          }
        },
        React.createElement(
          "div",
          {},
          React.createElement("h1", {
            style: {
              fontSize: "22px",
              fontWeight: 700,
              color: "#0F172A",
              margin: "0 0 6px 0"
            }
          }, "摄像头管理"),
          React.createElement("p", {
            style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
          }, `共 ${cameras.length} 台摄像头，在线 ${onlineCount} 台，离线 ${cameras.length - onlineCount} 台`)
        ),
        React.createElement(
          window.Button,
          {
            variant: "primary",
            onClick: () => setShowAddModal(true),
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
          },
          "添加摄像头"
        )
      ),

      // Stats bar
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px"
          }
        },
        React.createElement(StatMini, {
          label: "在线摄像头",
          value: `${onlineCount}/${cameras.length}`,
          color: "#059669",
          icon: window.ICONS.camera
        }),
        React.createElement(StatMini, {
          label: "今日上传流量",
          value: "2.4 GB",
          color: "#2563EB",
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
        }),
        React.createElement(StatMini, {
          label: "平均在线时长",
          value: "22.5 h",
          color: "#7C3AED",
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
        })
      ),

      // Camera list table
      React.createElement(
        window.Card,
        { padding: "0px" },
        // Table header
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1fr 0.8fr",
              padding: "14px 20px",
              borderBottom: "1px solid #E2E8F0",
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748B",
              textTransform: "none",
              letterSpacing: "0.02em"
             }
           },
           React.createElement("span", {}, "摄像头信息"),
           React.createElement("span", {}, "位置"),
           React.createElement("span", {}, "状态"),
           React.createElement("span", {}, "最后心跳"),
           React.createElement("span", {}, "分辨率"),
           React.createElement("span", { style: { textAlign: "right" } }, "操作")
         ),
         // Camera rows
         cameras.map(cam => React.createElement(CameraRow, {
          key: cam.id,
          camera: cam,
          onToggle: () => toggleCamera(cam.id)
        }))
      ),

      // Add modal
      showAddModal && React.createElement(AddCameraModal, {
        onClose: () => setShowAddModal(false)
      })
    )
};

function StatMini({ label, value, color, icon }) {
  return React.createElement(
    "div",
    {
      style: {
        background: "#FFFFFF",
        borderRadius: "8px",
        border: "1px solid #E2E8F0",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "14px"
      }
    },
    React.createElement(
      "span",
      {
        style: {
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          background: `${color}12`,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        },
        dangerouslySetInnerHTML: { __html: icon }
      }
    ),
    React.createElement(
      "div",
      {},
      React.createElement("div", {
        style: { fontSize: "11px", color: "#64748B", fontWeight: 500, marginBottom: "4px" }
      }, label),
      React.createElement("div", {
        style: { fontSize: "18px", fontWeight: 700, color: "#0F172A" }
      }, value)
    )
  );
}

function CameraRow({ camera, onToggle }) {
  const isOnline = camera.enabled;

  return React.createElement(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1fr 0.8fr",
        padding: "16px 20px",
        borderBottom: "1px solid #F1F5F9",
        alignItems: "center",
        fontSize: "13px"
      }
    },
    // Camera info
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "12px" } },
      React.createElement(
        "div",
        {
          style: {
            width: "52px",
            height: "38px",
            borderRadius: "4px",
            overflow: "hidden",
            flexShrink: 0,
            position: "relative",
            filter: isOnline ? "none" : "grayscale(0.6)"
          }
        },
        React.createElement("img", {
          src: window.CAMERA_IMAGES[camera.imageKey],
          alt: camera.name,
          style: { width: "100%", height: "100%", objectFit: "cover" }
        })
      ),
      React.createElement(
        "div",
        {},
        React.createElement("div", {
          style: { fontWeight: 600, color: "#0F172A", marginBottom: "2px" }
        }, camera.name),
        React.createElement("div", {
          style: { fontSize: "11px", color: "#94A3B8", fontFamily: "'SF Mono', monospace" }
        }, `${camera.id} · ${camera.model}`)
      )
    ),
    // Location
    React.createElement(
      "span",
      { style: { color: "#334155" } },
      camera.locationZh
    ),
    // Status
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "6px" } },
      React.createElement("span", {
        style: {
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: isOnline ? "#10B981" : "#EF4444",
          boxShadow: isOnline ? "0 0 0 2px rgba(16, 185, 129, 0.2)" : "none"
        }
      }),
      React.createElement("span", {
        style: {
          color: isOnline ? "#059669" : "#DC2626",
          fontWeight: 500,
          fontSize: "12px"
        }
      }, isOnline ? "在线" : "离线")
    ),
    // Last heartbeat
    React.createElement(
      "span",
      {
        style: {
          color: "#64748B",
          fontSize: "12px",
          fontFamily: "'SF Mono', monospace"
        }
      },
      camera.lastHeartbeat
    ),
    // Resolution
    React.createElement(
      "span",
      {
        style: {
          color: "#64748B",
          fontSize: "12px",
          fontFamily: "'SF Mono', monospace"
        }
      },
      camera.resolution
    ),
    // Actions
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" } },
      // Toggle switch
      React.createElement(ToggleSwitch, { enabled: isOnline, onChange: onToggle })
    )
  );
}

function ToggleSwitch({ enabled, onChange }) {
  return React.createElement(
    "button",
    {
      onClick: onChange,
      style: {
        width: "40px",
        height: "22px",
        borderRadius: "11px",
        background: enabled ? "#10B981" : "#CBD5E1",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
        padding: 0
      }
    },
    React.createElement("div", {
      style: {
        position: "absolute",
        top: "2px",
        left: enabled ? "20px" : "2px",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 0.2s"
      }
    })
  );
}

function AddCameraModal({ onClose }) {
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("front_counter");
  const [ip, setIp] = React.useState("");
  const [model, setModel] = React.useState("EZVIZ C6W");

  return React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)"
      },
      onClick: onClose
    },
    React.createElement(
      "div",
      {
        onClick: e => e.stopPropagation(),
        style: {
          background: "#FFFFFF",
          borderRadius: "10px",
          width: "480px",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.2)",
          overflow: "hidden"
        }
      },
      React.createElement(
        "div",
        {
          padding: "18px 20px",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        },
        React.createElement("h3", {
          style: { fontSize: "15px", fontWeight: 600, color: "#0F172A", margin: 0 }
        }, "添加摄像头"),
        React.createElement(
          "button",
          {
            onClick: onClose,
            style: {
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              fontSize: "20px",
              padding: "4px"
            }
          },
          "×"
        )
      ),
      React.createElement(
        "div",
        { style: { padding: "20px", display: "flex", flexDirection: "column", gap: "14px" } },
        [
          { label: "摄像头名称", value: name, onChange: setName, type: "text", placeholder: "如：前台-02" },
          { label: "IP 地址", value: ip, onChange: setIp, type: "text", placeholder: "如：192.168.1.105" },
        ].map((field, i) => React.createElement("div", { key: i },
          React.createElement("label", {
            style: {
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "#334155",
              marginBottom: "6px"
            }
          }, field.label),
          React.createElement("input", {
            type: field.type,
            value: field.value,
            onChange: e => field.onChange(e.target.value),
            placeholder: field.placeholder,
            style: {
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              boxSizing: "border-box",
              fontFamily: "inherit"
            }
          })
        )),
        React.createElement("div", {},
          React.createElement("label", {
            style: {
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "#334155",
              marginBottom: "6px"
            }
          }, "摄像头位置"),
          React.createElement(
            "select",
            {
              value: location,
              onChange: e => setLocation(e.target.value),
              style: {
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                background: "#FFFFFF",
                fontFamily: "inherit"
              }
            },
            React.createElement("option", { value: "front_counter" }, "前台操作区"),
            React.createElement("option", { value: "back_kitchen" }, "后厨操作区"),
            React.createElement("option", { value: "storage" }, "仓储区"),
            React.createElement("option", { value: "pickup_area" }, "取餐区")
          )
        ),
        React.createElement("div", {},
          React.createElement("label", {
            style: {
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "#334155",
              marginBottom: "6px"
            }
          }, "设备型号"),
          React.createElement(
            "select",
            {
              value: model,
              onChange: e => setModel(e.target.value),
              style: {
                width: "100%",
                padding: "8px 12px",
                fontSize: "13px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                background: "#FFFFFF",
                fontFamily: "inherit"
              }
            },
            React.createElement("option", { value: "EZVIZ C6W" }, "EZVIZ C6W"),
            React.createElement("option", { value: "Hikvision DS-2CD" }, "Hikvision DS-2CD"),
            React.createElement("option", { value: "Dahua IPC-HDW" }, "Dahua IPC-HDW")
          )
        )
      ),
      React.createElement(
        "div",
        {
          padding: "14px 20px",
          borderTop: "1px solid #E2E8F0",
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          background: "#F8FAFC"
        },
        React.createElement(window.Button, { variant: "secondary", onClick: onClose }, "取消"),
        React.createElement(
          window.Button,
          {
            variant: "primary",
            onClick: onClose
          },
          "添加摄像头"
        )
      )
    )
  );
}

Object.assign(window, { CameraManagementPage });

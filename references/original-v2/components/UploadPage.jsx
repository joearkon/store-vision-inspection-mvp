// Upload Page - File drop zone + camera selection + analysis progress

function UploadPage({ onNavigate }) {
  const [selectedCamera, setSelectedCamera] = React.useState("CAM-001");
  const [fileName, setFileName] = React.useState("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(-1);
  const [analysisResult, setAnalysisResult] = React.useState(null);

  const cameras = window.CAMERAS;
  const steps = window.ANALYSIS_STEPS;

  const handleFile = (file) => {
    if (file && (file.type === "video/mp4" || file.name.endsWith(".mp4"))) {
      setFileName(file.name);
    } else {
      setFileName(file.name || "示例视频.mp4");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const startAnalysis = () => {
    if (!fileName) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setCurrentStep(0);

    let stepIdx = 0;
    const runStep = () => {
      if (stepIdx < steps.length) {
        setCurrentStep(stepIdx);
        setTimeout(() => {
          stepIdx++;
          runStep();
        }, steps[stepIdx]?.duration || 2000);
      } else {
        setCurrentStep(steps.length);
        // Show mock result
        setTimeout(() => {
          setAnalysisResult(window.EVENTS[0]);
        }, 500);
      }
    };
    runStep();
  };

  const resetAnalysis = () => {
    setAnalyzing(false);
    setCurrentStep(-1);
    setAnalysisResult(null);
    setFileName("");
  };

  return React.createElement(
    "div",
    { style: { maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" } },
      // Header
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
        }, "视频上传分析"),
        React.createElement("p", {
          style: { fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }
        }, "上传门店监控视频，AI 将自动识别卫生规范、安全隐患、操作合规等六类异常")
      ),

      // Upload card
      React.createElement(
        window.Card,
        { padding: "24px" },
        // Drop zone
        React.createElement(
          "div",
          {
            onDrop: handleDrop,
            onDragOver: e => { e.preventDefault(); setIsDragging(true); },
            onDragLeave: () => setIsDragging(false),
            onClick: () => {
              if (!analyzing) handleFile({ name: "monitor_20260927_0900.mp4" });
            },
            style: {
              border: `2px dashed ${isDragging ? "#4F46E5" : "#CBD5E1"}`,
              borderRadius: "8px",
              padding: "48px 24px",
              textAlign: "center",
              background: isDragging ? "rgba(79, 70, 229, 0.04)" : "#F8FAFC",
              cursor: analyzing ? "default" : "pointer",
              transition: "all 0.2s",
              marginBottom: "20px"
            }
          },
          React.createElement(
            "div",
            {
              style: {
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(79, 70, 229, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "#4F46E5"
              },
              dangerouslySetInnerHTML: {
                __html: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
              }
            }
          ),
          fileName ? (
            React.createElement(
              "div",
              {},
              React.createElement("p", {
                style: {
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#0F172A",
                  margin: "0 0 4px 0"
                }
              }, fileName),
              React.createElement("p", {
                style: { fontSize: "12px", color: "#64748B", margin: 0 }
              }, "点击或拖拽重新选择文件")
            )
          ) : (
            React.createElement(
              "div",
              {},
              React.createElement("p", {
                style: {
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#334155",
                  margin: "0 0 4px 0"
                }
              }, "拖拽 MP4 文件到此处，或点击选择"),
              React.createElement("p", {
                style: { fontSize: "12px", color: "#94A3B8", margin: 0 }
              }, "支持 MP4 格式，单文件不超过 500MB")
            )
          )
        ),

        // Camera selection
        React.createElement(
          "div",
          { style: { marginBottom: "20px" } },
          React.createElement("label", {
            style: {
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "#334155",
              marginBottom: "8px"
            }
          }, "选择摄像头位置"),
          React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "10px"
              }
            },
            cameras.map(cam => React.createElement(CameraOption, {
              key: cam.id,
              camera: cam,
              selected: selectedCamera === cam.id,
              onClick: () => setSelectedCamera(cam.id),
              disabled: analyzing
            }))
          )
        ),

        // Start button
        React.createElement(
          "div",
          { style: { display: "flex", gap: "10px" } },
          React.createElement(
            window.Button,
            {
              variant: "primary",
              size: "lg",
              onClick: startAnalysis,
              style: { flex: 1 }
            },
            "开始 AI 分析"
          ),
          analyzing && React.createElement(
            window.Button,
            { variant: "secondary", size: "lg", onClick: resetAnalysis },
            "重新上传"
          )
        )
      ),

      // Analysis progress
      analyzing && !analysisResult && React.createElement(
        window.Card,
        { padding: "24px" },
        React.createElement("h3", {
          style: {
            fontSize: "14px",
            fontWeight: 600,
            color: "#0F172A",
            margin: "0 0 16px 0"
          }
        }, "分析进度"),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "0" } },
          steps.map((step, i) => React.createElement(AnalysisStep, {
            key: step.id,
            label: step.label,
            status: i < currentStep ? "done" : i === currentStep ? "active" : "pending",
            isLast: i === steps.length - 1
          }))
         )
       ),

      // Analysis result
      analysisResult && React.createElement(
        AnalysisResult,
        { event: analysisResult, onViewDetail: () => onNavigate("event", { eventId: analysisResult.id }) }
       )
    );
}

function CameraOption({ camera, selected, onClick, disabled }) {
  return React.createElement(
    "div",
    {
      onClick: disabled ? undefined : onClick,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px",
        borderRadius: "6px",
        border: `1.5px solid ${selected ? "#4F46E5" : "#E2E8F0"}`,
        background: selected ? "rgba(79, 70, 229, 0.04)" : "#FFFFFF",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s"
      }
    },
    React.createElement(
      "div",
      {
        style: {
          width: "36px",
          height: "36px",
          borderRadius: "6px",
          overflow: "hidden",
          flexShrink: 0
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
      { style: { flex: 1, minWidth: 0 } },
      React.createElement("div", {
        style: { fontSize: "13px", fontWeight: 600, color: "#0F172A" }
      }, camera.name),
      React.createElement("div", {
        style: { fontSize: "11px", color: "#94A3B8" }
      }, camera.locationZh)
    ),
    React.createElement("div", {
      style: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: camera.status === "online" ? "#10B981" : "#EF4444"
      }
    })
  );
}

function AnalysisStep({ label, status, isLast }) {
  const isDone = status === "done";
  const isActive = status === "active";

  return React.createElement(
    "div",
    { style: { display: "flex", alignItems: "flex-start", gap: "12px", position: "relative" } },
    // Connector line
    !isLast && React.createElement("div", {
      style: {
        position: "absolute",
        left: "14px",
        top: "30px",
        bottom: "-10px",
        width: "2px",
        background: isDone ? "#10B981" : "#E2E8F0"
      }
    }),
    // Status dot
    React.createElement(
      "div",
      {
        style: {
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: isDone ? "#10B981" : isActive ? "#4F46E5" : "#E2E8F0",
          color: isDone || isActive ? "#FFFFFF" : "#94A3B8",
          fontSize: "12px",
          fontWeight: 600,
          transition: "all 0.3s"
        }
      },
      isDone ? (
        React.createElement("svg", {
          width: "14", height: "14", viewBox: "0 0 24 24",
          fill: "none", stroke: "currentColor", strokeWidth: "3",
          strokeLinecap: "round", strokeLinejoin: "round"
        },
          React.createElement("polyline", { points: "20 6 9 17 4 12" })
        )
      ) : isActive ? (
        React.createElement("div", {
          style: {
            width: "10px", height: "10px",
            borderRadius: "50%",
            background: "#FFFFFF",
            animation: "pulse 1s infinite"
          }
        })
      ) : (
        "·"
      )
    ),
    // Label
    React.createElement(
      "div",
      { style: { paddingTop: "4px", flex: 1 } },
      React.createElement("span", {
        style: {
          fontSize: "13px",
          fontWeight: isActive ? 600 : 500,
          color: isDone || isActive ? "#0F172A" : "#94A3B8"
        }
      }, label),
      isActive && React.createElement(
        "div",
        { style: { marginTop: "8px" } },
        React.createElement("div", {
          style: {
            height: "4px",
            background: "#E2E8F0",
            borderRadius: "2px",
            overflow: "hidden"
          }
        },
          React.createElement("div", {
            style: {
              height: "100%",
              width: "60%",
              background: "#4F46E5",
              borderRadius: "2px",
              animation: "progress 1.5s ease-in-out infinite"
            }
          })
        )
      )
    )
  );
}

function AnalysisResult(_ref) {
  var event = _ref.event;
  var onViewDetail = _ref.onViewDetail;
  var sevStyle = window.SEVERITY_STYLES[event.severity];

  return React.createElement(
    window.Card,
    { padding: "0px" },
    // Result header
    React.createElement(
      "div",
      {
        padding: "18px 24px",
        borderBottom: "1px solid #E2E8F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: `linear-gradient(135deg, ${sevStyle.text}08 0%, #4F46E505 100%)`
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("svg", {
          width: "20", height: "20", viewBox: "0 0 24 24",
          fill: "none", stroke: sevStyle.text, strokeWidth: "2",
          strokeLinecap: "round", strokeLinejoin: "round"
        },
          React.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
          React.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
          React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
        ),
        React.createElement("span", {
          style: {
            fontSize: "15px",
            fontWeight: 700,
            color: "#0F172A"
          }
        }, "检测到异常")
      ),
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement(window.ConfidenceChip, { confidence: event.confidence }),
        React.createElement(window.SeverityBadge, { severity: event.severity, size: "lg" })
      )
    ),
    // Result body
    React.createElement(
      "div",
      { style: { padding: "20px 24px", display: "flex", gap: "20px" } },
      // Thumbnail
      React.createElement(
        "div",
        {
          style: {
            width: "160px",
            height: "90px",
            borderRadius: "6px",
            overflow: "hidden",
            flexShrink: 0,
            position: "relative"
          }
        },
        React.createElement("img", {
          src: window.CAMERA_IMAGES[event.imageKey],
          alt: "detection",
          style: { width: "100%", height: "100%", objectFit: "cover" }
        }),
        React.createElement("div", {
          style: {
            position: "absolute",
            left: "30%",
            top: "30%",
            width: "35%",
            height: "50%",
            border: `1.5px solid ${sevStyle.text}`,
            borderRadius: "2px"
          }
        })
      ),
      // Details
      React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "10px" } },
        React.createElement("h4", {
          style: { fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }
        }, `${event.type} ${event.typeName}`),
        React.createElement("p", {
          style: {
            fontSize: "13px",
            color: "#475569",
            margin: 0,
            lineHeight: 1.6
          }
        }, event.description),
        React.createElement(
          "div",
          {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "12px",
            color: "#94A3B8"
          },
          React.createElement("span", {}, event.cameraName),
          React.createElement("span", { style: { color: "#CBD5E1" } }, "·"),
          React.createElement("span", {}, event.timestamp)
        )
      )
    ),
    // Actions
    React.createElement(
      "div",
      {
        padding: "14px 24px",
        borderTop: "1px solid #E2E8F0",
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
        background: "#F8FAFC"
      },
      React.createElement(window.Button, { variant: "secondary", onClick: onViewDetail }, "查看事件详情 →")
    )
  );
}

Object.assign(window, { UploadPage });

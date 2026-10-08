from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _project_path(value: str | Path, root: Path) -> Path:
    """Resolve configured relative paths from the repository, never the shell cwd."""
    path = Path(value)
    return (path if path.is_absolute() else root / path).resolve()


def _load_local_env(root: Path) -> None:
    """Load a small .env file without overriding process environment variables."""
    env_file = root / ".env"
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"").strip("'")
        if key:
            os.environ.setdefault(key, value)


@dataclass(frozen=True)
class Settings:
    project_root: Path = PROJECT_ROOT
    data_dir: Path = PROJECT_ROOT / "data"
    database_path: Path = PROJECT_ROOT / "data" / "store_vision.sqlite3"
    max_upload_bytes: int = 500 * 1024 * 1024
    frame_rate: float = 1.0
    e1_open_seconds: float = 30.0
    vision_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    vision_api_key: str = ""
    vision_model: str = "doubao-seed-2-1-lite-260915"
    vision_timeout_seconds: float = 90.0
    vision_max_attempts: int = 5
    feishu_webhook_url: str = ""
    feishu_signing_secret: str = ""
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_chat_id: str = ""
    public_base_url: str = "http://127.0.0.1:5173"

    @classmethod
    def from_env(cls) -> "Settings":
        _load_local_env(PROJECT_ROOT)
        root = Path(os.getenv("STORE_VISION_PROJECT_ROOT", str(PROJECT_ROOT))).resolve()
        data_dir = _project_path(os.getenv("STORE_VISION_DATA_DIR", "data"), root)
        return cls(
            project_root=root,
            data_dir=data_dir,
            database_path=_project_path(
                os.getenv("STORE_VISION_DATABASE", str(data_dir / "store_vision.sqlite3")), root
            ),
            max_upload_bytes=int(os.getenv("STORE_VISION_MAX_UPLOAD_BYTES", 500 * 1024 * 1024)),
            frame_rate=float(os.getenv("STORE_VISION_FRAME_RATE", "1")),
            e1_open_seconds=float(os.getenv("STORE_VISION_E1_OPEN_SECONDS", "30")),
            vision_base_url=os.getenv(
                "VOLC_ENGINE_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"
            ).rstrip("/"),
            vision_api_key=os.getenv("VOLC_ENGINE_API_KEY", ""),
            vision_model=os.getenv(
                "VOLC_ENGINE_VISION_MODEL", "doubao-seed-2-1-lite-260915"
            ),
            vision_timeout_seconds=float(os.getenv("VOLC_ENGINE_TIMEOUT_SECONDS", "90")),
            vision_max_attempts=int(os.getenv("VOLC_ENGINE_MAX_ATTEMPTS", "5")),
            feishu_webhook_url=os.getenv("FEISHU_WEBHOOK_URL", ""),
            feishu_signing_secret=os.getenv("FEISHU_SIGNING_SECRET", ""),
            feishu_app_id=os.getenv("FEISHU_APP_ID", ""),
            feishu_app_secret=os.getenv("FEISHU_APP_SECRET", ""),
            feishu_chat_id=os.getenv("FEISHU_CHAT_ID", ""),
            public_base_url=os.getenv("STORE_VISION_PUBLIC_BASE_URL", "http://127.0.0.1:5173"),
        )

    def ensure_directories(self) -> None:
        for path in (
            self.data_dir,
            self.data_dir / "videos",
            self.data_dir / "frames",
            self.data_dir / "evidence",
        ):
            path.mkdir(parents=True, exist_ok=True)

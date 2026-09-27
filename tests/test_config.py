from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from apps.api.app.config import PROJECT_ROOT, Settings


class ConfigTests(unittest.TestCase):
    def test_project_root_points_to_repository(self) -> None:
        self.assertTrue((PROJECT_ROOT / "pyproject.toml").is_file())
        self.assertTrue((PROJECT_ROOT / ".env.example").is_file())

    def test_default_vision_model_is_current(self) -> None:
        self.assertEqual(Settings().vision_model, "doubao-seed-2-1-lite-260915")

    def test_relative_data_paths_are_resolved_from_project_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_cwd:
            with patch.dict(
                os.environ,
                {
                    "STORE_VISION_PROJECT_ROOT": str(PROJECT_ROOT),
                    "STORE_VISION_DATA_DIR": "./data",
                    "STORE_VISION_DATABASE": "./data/store_vision.sqlite3",
                },
            ), patch("pathlib.Path.cwd", return_value=Path(temporary_cwd)):
                settings = Settings.from_env()

        self.assertEqual(settings.data_dir, (PROJECT_ROOT / "data").resolve())
        self.assertEqual(
            settings.database_path,
            (PROJECT_ROOT / "data" / "store_vision.sqlite3").resolve(),
        )


if __name__ == "__main__":
    unittest.main()

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from apps.api.app.playback import playback_path

class PlaybackTests(unittest.TestCase):
    def test_original_is_preserved_and_compatible_copy_is_preferred(self):
        with TemporaryDirectory() as folder:
            source = Path(folder) / "video.mp4"
            source.write_bytes(b"original")
            self.assertEqual(playback_path(str(source)), source)
            compatible = source.with_name("video.browser.mp4")
            compatible.write_bytes(b"compatible")
            self.assertEqual(playback_path(str(source)), compatible)
            self.assertEqual(source.read_bytes(), b"original")

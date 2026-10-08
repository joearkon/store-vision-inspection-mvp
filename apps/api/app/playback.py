from pathlib import Path

def playback_path(original: str) -> Path:
    source = Path(original)
    compatible = source.with_name(source.stem + ".browser.mp4")
    return compatible if compatible.is_file() else source

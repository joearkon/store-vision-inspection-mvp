from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class E1Observation:
    offset_seconds: float
    state: str
    confidence: float
    finding_id: str
    image_path: str


@dataclass(frozen=True)
class E1EventCandidate:
    first: E1Observation
    confirmed: E1Observation
    peak: E1Observation
    recovered: E1Observation | None


class E1FridgeDoorAggregator:
    """Aggregate consecutive fridge-open observations into one event."""

    def __init__(self, threshold_seconds: float = 30.0, max_gap_seconds: float = 2.5):
        self.threshold_seconds = threshold_seconds
        self.max_gap_seconds = max_gap_seconds

    def aggregate(self, observations: list[E1Observation]) -> list[E1EventCandidate]:
        ordered = sorted(observations, key=lambda item: item.offset_seconds)
        events: list[E1EventCandidate] = []
        open_segment: list[E1Observation] = []
        confirmed: E1Observation | None = None

        def finish(recovered: E1Observation | None) -> None:
            nonlocal open_segment, confirmed
            if open_segment and confirmed:
                peak = max(open_segment, key=lambda item: item.confidence)
                events.append(
                    E1EventCandidate(
                        first=open_segment[0],
                        confirmed=confirmed,
                        peak=peak,
                        recovered=recovered,
                    )
                )
            open_segment = []
            confirmed = None

        previous_offset: float | None = None
        for observation in ordered:
            gap = (
                observation.offset_seconds - previous_offset
                if previous_offset is not None
                else 0
            )
            previous_offset = observation.offset_seconds
            if gap > self.max_gap_seconds:
                finish(None)

            if observation.state == "open":
                open_segment.append(observation)
                if (
                    confirmed is None
                    and observation.offset_seconds - open_segment[0].offset_seconds
                    >= self.threshold_seconds
                ):
                    confirmed = observation
            elif observation.state == "closed":
                finish(observation)
            else:
                # Unknown observations neither prove recovery nor extend a long gap.
                continue

        finish(None)
        return events

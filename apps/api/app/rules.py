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
    last_open: E1Observation
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
                        last_open=open_segment[-1],
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


@dataclass(frozen=True)
class A1EventCandidate:
    first: E1Observation
    confirmed: E1Observation
    peak: E1Observation
    last_violation: E1Observation
    recovered: E1Observation | None


class A1PPEAggregator:
    """Confirm visible PPE violations when at least 3 of the latest 5 valid frames hit."""

    def __init__(self, window_size: int = 5, required_hits: int = 3, max_gap_seconds: float = 3.0):
        self.window_size = window_size
        self.required_hits = required_hits
        self.max_gap_seconds = max_gap_seconds

    def aggregate(self, observations: list[E1Observation]) -> list[A1EventCandidate]:
        valid = sorted(
            (item for item in observations if item.state in {"violation", "compliant"}),
            key=lambda item: item.offset_seconds,
        )
        events: list[A1EventCandidate] = []
        window: list[E1Observation] = []
        active_hits: list[E1Observation] = []
        first: E1Observation | None = None
        confirmed: E1Observation | None = None
        compliant_streak = 0
        previous_offset: float | None = None

        def finish(recovered: E1Observation | None) -> None:
            nonlocal window, active_hits, first, confirmed, compliant_streak
            if first and confirmed and active_hits:
                events.append(A1EventCandidate(
                    first=first,
                    confirmed=confirmed,
                    peak=max(active_hits, key=lambda item: item.confidence),
                    last_violation=active_hits[-1],
                    recovered=recovered,
                ))
            window = []
            active_hits = []
            first = None
            confirmed = None
            compliant_streak = 0

        for observation in valid:
            if previous_offset is not None and observation.offset_seconds - previous_offset > self.max_gap_seconds:
                finish(None)
            previous_offset = observation.offset_seconds
            window.append(observation)
            window = window[-self.window_size:]
            if observation.state == "violation":
                if first is None:
                    first = observation
                active_hits.append(observation)
                compliant_streak = 0
            else:
                compliant_streak += 1

            hits = [item for item in window if item.state == "violation"]
            if confirmed is None and len(window) >= self.window_size and len(hits) >= self.required_hits:
                confirmed = observation
            if confirmed is not None and compliant_streak >= self.required_hits:
                finish(observation)

        finish(None)
        return events


class TimedObservationAggregator:
    """Confirm a visible state using observed video timestamps, never wall-clock time.

    Unknown and contradictory observations break a candidate. Sparse two-stage
    observations must be validated against a video-screened interval by the caller.
    """

    def __init__(self, state: str | set[str], threshold_seconds: float,
                 max_gap_seconds: float = 2.5, min_confidence: float = 0.7):
        self.states = {state} if isinstance(state, str) else state
        self.threshold_seconds = threshold_seconds
        self.max_gap_seconds = max_gap_seconds
        self.min_confidence = min_confidence

    def aggregate(self, observations: list[E1Observation]) -> list[E1EventCandidate]:
        ordered = sorted(observations, key=lambda item: item.offset_seconds)
        events: list[E1EventCandidate] = []
        hits: list[E1Observation] = []
        confirmed: E1Observation | None = None
        previous: E1Observation | None = None

        def finish(recovered: E1Observation | None) -> None:
            nonlocal hits, confirmed
            if confirmed is not None and hits:
                events.append(E1EventCandidate(
                    first=hits[0], confirmed=confirmed,
                    peak=max(hits, key=lambda item: item.confidence),
                    last_open=hits[-1], recovered=recovered,
                ))
            hits = []
            confirmed = None

        for item in ordered:
            if previous and item.offset_seconds - previous.offset_seconds > self.max_gap_seconds:
                finish(None)
            previous = item
            if item.state in self.states and item.confidence >= self.min_confidence:
                hits.append(item)
                if confirmed is None and item.offset_seconds - hits[0].offset_seconds >= self.threshold_seconds:
                    confirmed = item
            else:
                finish(item if item.state not in self.states | {"unknown", "uncertain"} else None)
        finish(None)
        return events

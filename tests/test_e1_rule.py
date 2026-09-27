from __future__ import annotations

import unittest

from apps.api.app.rules import E1FridgeDoorAggregator, E1Observation


def observation(second: int, state: str, confidence: float = 0.9) -> E1Observation:
    return E1Observation(second, state, confidence, f"F-{second}", f"frame-{second}.jpg")


class E1AggregatorTests(unittest.TestCase):
    def test_short_open_does_not_create_event(self) -> None:
        frames = [observation(second, "open") for second in range(0, 20)]
        frames.append(observation(20, "closed"))
        self.assertEqual(E1FridgeDoorAggregator(30).aggregate(frames), [])

    def test_thirty_seconds_creates_one_event_with_recovery(self) -> None:
        frames = [observation(second, "open", 0.8 + second / 1000) for second in range(31)]
        frames.append(observation(31, "closed"))
        events = E1FridgeDoorAggregator(30).aggregate(frames)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].first.offset_seconds, 0)
        self.assertEqual(events[0].confirmed.offset_seconds, 30)
        self.assertEqual(events[0].recovered.offset_seconds, 31)

    def test_two_open_periods_create_two_events(self) -> None:
        frames = [observation(second, "open") for second in range(31)]
        frames.append(observation(31, "closed"))
        frames.extend(observation(second, "open") for second in range(40, 71))
        frames.append(observation(71, "closed"))
        self.assertEqual(len(E1FridgeDoorAggregator(30).aggregate(frames)), 2)

    def test_unknown_frame_does_not_claim_recovery(self) -> None:
        frames = [observation(second, "open") for second in range(16)]
        frames.append(observation(16, "unknown", 0.2))
        frames.extend(observation(second, "open") for second in range(17, 31))
        events = E1FridgeDoorAggregator(30).aggregate(frames)
        self.assertEqual(len(events), 1)
        self.assertIsNone(events[0].recovered)

    def test_large_observation_gap_resets_duration(self) -> None:
        frames = [observation(second, "open") for second in range(16)]
        frames.extend(observation(second, "open") for second in range(25, 41))
        self.assertEqual(E1FridgeDoorAggregator(30, max_gap_seconds=2).aggregate(frames), [])


if __name__ == "__main__":
    unittest.main()

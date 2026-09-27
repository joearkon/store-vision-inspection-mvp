from __future__ import annotations

import unittest

from apps.api.app.rules import A1PPEAggregator, E1FridgeDoorAggregator, E1Observation


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
        self.assertEqual(events[0].last_open.offset_seconds, 30)
        self.assertEqual(events[0].recovered.offset_seconds, 31)

    def test_unrecovered_event_tracks_last_open_not_peak_confidence(self) -> None:
        frames = [observation(second, "open", 0.99 if second == 1 else 0.8) for second in range(50)]
        event = E1FridgeDoorAggregator(30).aggregate(frames)[0]

        self.assertEqual(event.peak.offset_seconds, 1)
        self.assertEqual(event.last_open.offset_seconds, 49)
        self.assertIsNone(event.recovered)

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


class A1PPEAggregatorTests(unittest.TestCase):
    def test_three_of_five_visible_violations_confirm_event(self) -> None:
        frames = [
            observation(0, "violation", .91),
            observation(1, "compliant", .8),
            observation(2, "violation", .93),
            observation(3, "unknown", .2),
            observation(4, "violation", .96),
            observation(5, "compliant", .9),
            observation(6, "compliant", .9),
            observation(7, "compliant", .9),
        ]
        event = A1PPEAggregator().aggregate(frames)[0]
        self.assertEqual(event.first.offset_seconds, 0)
        self.assertEqual(event.confirmed.offset_seconds, 5)
        self.assertEqual(event.peak.offset_seconds, 4)
        self.assertEqual(event.recovered.offset_seconds, 7)

    def test_unknown_or_two_hits_do_not_create_event(self) -> None:
        frames = [
            observation(0, "unknown"), observation(1, "violation"),
            observation(2, "compliant"), observation(3, "violation"),
            observation(4, "compliant"), observation(5, "compliant"),
        ]
        self.assertEqual(A1PPEAggregator().aggregate(frames), [])


if __name__ == "__main__":
    unittest.main()

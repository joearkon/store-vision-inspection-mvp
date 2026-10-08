import unittest
from apps.api.app.table_evidence import table_followup_findings

class TableEvidenceTests(unittest.TestCase):
    def test_later_consecutive_frames_and_end_are_retained(self):
        rows = [{"id":str(t),"captured_offset":t} for t in [0,6,8,9,10,19,20,21,29,30,31]]
        selected = table_followup_findings(rows,9)
        self.assertEqual([row["captured_offset"] for _, row in selected],[19,20,21,31])
        self.assertEqual(selected[-1][0],"video_end")
    def test_short_video_does_not_invent_future_evidence(self):
        rows = [{"id":"9","captured_offset":9}]
        self.assertEqual(table_followup_findings(rows,9),[])
        self.assertEqual(len(table_followup_findings(rows,8)),1)

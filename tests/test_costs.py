from __future__ import annotations

import unittest

from apps.api.app.costs import estimate_analysis_cost


class AnalysisCostTests(unittest.TestCase):
    def test_lite_and_pro_use_separate_published_rates(self):
        usage = {"request_count": 7, "prompt_tokens": 16537, "completion_tokens": 553}
        self.assertEqual(estimate_analysis_cost(usage | {
            "model_id": "doubao-seed-2-1-lite-260915"
        })["estimated_cost_yuan"], 0.014723)
        self.assertEqual(estimate_analysis_cost(usage | {
            "observed_model": "doubao-seed-2-1-pro-260915"
        })["estimated_cost_yuan"], 0.115812)

    def test_turbo_uses_regular_input_and_output_rates(self):
        result = estimate_analysis_cost({"model_id": "doubao-seed-2-1-turbo-260628",
            "request_count": 30, "prompt_tokens": 60000, "completion_tokens": 620})
        self.assertEqual(result["cost_status"], "estimated")
        self.assertEqual(result["estimated_cost_yuan"], 0.1893)
        self.assertIsNone(result["cost_range_yuan"])

    def test_missing_historical_model_returns_range_not_false_precision(self):
        result = estimate_analysis_cost({
            "request_count": 1, "prompt_tokens": 6748, "completion_tokens": 12,
        })
        self.assertEqual(result["cost_status"], "model_unrecorded")
        self.assertIsNone(result["estimated_cost_yuan"])
        self.assertEqual(result["cost_range_yuan"], [0.005431, 0.040848])

    def test_missing_usage_is_not_zero_cost(self):
        turbo=estimate_analysis_cost({'model_id':'unconfigured-model','request_count':1,'prompt_tokens':100})
        self.assertEqual(turbo['cost_status'],'price_unconfigured')
        self.assertIsNone(turbo['cost_range_yuan'])
        result = estimate_analysis_cost({"status": "completed", "request_count": 0})
        self.assertEqual(result["cost_status"], "usage_unrecorded")
        self.assertIsNone(result["estimated_cost_yuan"])


if __name__ == "__main__":
    unittest.main()

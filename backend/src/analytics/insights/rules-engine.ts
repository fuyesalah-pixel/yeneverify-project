// ============================================================
// Yene Verify — Rules engine (Step 18)
//
// Pure orchestration over the recommendation rules: run each rule
// once, drop the nulls, cap at 5. No I/O, no date handling — the
// caller decides whether an anomaly is "recent".
// ============================================================

import type { RecommendationDto } from '../dto/analytics-response.dto';
import { RECOMMENDATION_RULES, type RuleInputs } from './recommendations';

/** Hard cap so the response stays dashboard-sized even if rules grow. */
const MAX_RECOMMENDATIONS = 5;

export function generateRecommendations(inputs: RuleInputs): RecommendationDto[] {
  const out: RecommendationDto[] = [];
  for (const rule of RECOMMENDATION_RULES) {
    if (out.length >= MAX_RECOMMENDATIONS) break;
    const rec = rule(inputs);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * The JSON returned by POST /api/analyze-food, as the dashboard consumes it.
 *
 * It was `any` at the point of use, which meant a renamed field in the route
 * would still compile and then render "undefined" in the scan dialog. The
 * shape below mirrors the `response` object built at the end of the route.
 */
export interface AnalysisFinding {
  title: string;
  level: string;
  details: string;
}

export interface FoodAnalysis {
  is_food: boolean;
  health_score: string;
  health_grade_text: string;
  processing_level: string;
  data_accuracy_warning: string;
  /** Display strings such as "12.3 g" or "N/A", keyed by nutrient. */
  macronutrients: Record<string, string>;
  concerns: AnalysisFinding[];
  positives: AnalysisFinding[];
  alternatives: Array<{ name: string; score: string }>;
}

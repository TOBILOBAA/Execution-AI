export interface ExecutionGrade {
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  message: string;
  rangeLabel: string;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildRealismScore(completionRate: number): number {
  return clampPercent((completionRate / 80) * 100);
}

export function buildMomentumScore(rates: number[]): number {
  const clean = rates.filter((rate) => Number.isFinite(rate));
  if (clean.length === 0) return 0;
  if (clean.length === 1) return clampPercent(clean[0]);

  const sliceSize = Math.max(1, Math.ceil(clean.length / 3));
  const firstWindow = clean.slice(0, sliceSize);
  const recentWindow = clean.slice(-sliceSize);
  const baseline = average(firstWindow);
  const recent = average(recentWindow);
  const trendScore = clampPercent(50 + (recent - baseline));

  return clampPercent(trendScore * 0.6 + recent * 0.4);
}

export function buildExecutionScore(metrics: {
  completion: number;
  consistency: number;
  alignment: number;
  realism: number;
  momentum: number;
}): number {
  return clampPercent(
    metrics.completion * 0.3 +
      metrics.consistency * 0.25 +
      metrics.alignment * 0.2 +
      metrics.realism * 0.1 +
      metrics.momentum * 0.15,
  );
}

export function getExecutionGrade(score: number): ExecutionGrade {
  if (score >= 85) {
    return {
      grade: "A",
      label: "Elite Execution",
      message: "You’re executing consistently and staying aligned with your plans.",
      rangeLabel: "85-100",
    };
  }
  if (score >= 70) {
    return {
      grade: "B",
      label: "Strong Execution",
      message: "You’re doing well, but small inefficiencies are limiting your output.",
      rangeLabel: "70-84",
    };
  }
  if (score >= 55) {
    return {
      grade: "C",
      label: "Average Execution",
      message: "Your execution is unstable. Good periods are being offset by avoidable drop-offs.",
      rangeLabel: "55-69",
    };
  }
  if (score >= 40) {
    return {
      grade: "D",
      label: "Weak Execution",
      message: "You’re planning more than you’re reliably executing right now.",
      rangeLabel: "40-54",
    };
  }
  return {
    grade: "F",
    label: "Critical",
    message: "There is no stable execution system in place yet.",
    rangeLabel: "0-39",
  };
}

/** Расчёты по телу: ИМТ, базовый обмен, норма калорий. */

export const ACTIVITY: Record<string, { factor: number; label: string }> = {
  low:     { factor: 1.2,   label: "Сидячий образ жизни" },
  light:   { factor: 1.375, label: "Лёгкая активность, 1–3 тренировки" },
  medium:  { factor: 1.55,  label: "Средняя, 3–5 тренировок" },
  high:    { factor: 1.725, label: "Высокая, 6–7 тренировок" },
  athlete: { factor: 1.9,   label: "Очень высокая, спорт дважды в день" },
};

export function bmi(weightKg: number, heightCm: number) {
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

/** Категории ВОЗ. Это ориентир, а не диагноз. */
export function bmiCategory(value: number) {
  if (value < 16) return { key: "very-low", label: "Выраженный дефицит" };
  if (value < 18.5) return { key: "low", label: "Дефицит массы" };
  if (value < 25) return { key: "normal", label: "Норма" };
  if (value < 30) return { key: "high", label: "Избыточная масса" };
  if (value < 35) return { key: "obese-1", label: "Ожирение I степени" };
  if (value < 40) return { key: "obese-2", label: "Ожирение II степени" };
  return { key: "obese-3", label: "Ожирение III степени" };
}

/** Миффлина — Сан Жеора: самый ходовой расчёт базового обмена. */
export function basalRate(input: { weightKg: number; heightCm: number; age: number; sex: "male" | "female" }) {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === "male" ? base + 5 : base - 161;
}

export function maintenance(basal: number, activityLevel: string) {
  return basal * (ACTIVITY[activityLevel]?.factor ?? ACTIVITY.light.factor);
}

/**
 * Норма под цель. Дефицит и профицит держим в пределах 20%:
 * более резкие правки веса без врача советовать нечестно.
 */
export function goalCalories(maintain: number, direction: "lose" | "keep" | "gain") {
  if (direction === "lose") return Math.round(maintain * 0.8);
  if (direction === "gain") return Math.round(maintain * 1.1);
  return Math.round(maintain);
}

/** Примерный срок до целевого веса: 1 кг жира ≈ 7700 ккал. */
export function weeksToTarget(currentKg: number, targetKg: number, dailyGap: number) {
  const difference = Math.abs(currentKg - targetKg);
  if (difference < 0.1 || dailyGap <= 0) return null;
  return Math.ceil((difference * 7700) / dailyGap / 7);
}

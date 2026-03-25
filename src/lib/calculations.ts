import { Goal, Pace, ActivityLevel, Sex } from '../types';

export interface CalculationMetrics {
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
  pace: Pace;
}

export function calculateDailyTargets(metrics: CalculationMetrics) {
  const { age, sex, height_cm, weight_kg, activity_level, goal, pace } = metrics;

  // Basic BMR calculation (Mifflin-St Jeor)
  let bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  bmr += sex === 'male' ? 5 : -161;

  // Activity multiplier
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = bmr * multipliers[activity_level];

  // Goal adjustment
  let calorieTarget = tdee;
  if (goal === 'bulk') {
    calorieTarget += pace === 'slow' ? 250 : pace === 'normal' ? 500 : 750;
  } else if (goal === 'cut') {
    calorieTarget -= pace === 'slow' ? 250 : pace === 'normal' ? 500 : 750;
  }

  // Protein target (approx 2.2g per kg of bodyweight)
  const proteinTarget = Math.round(weight_kg * 2.2);
  
  // Remaining calories for carbs and fat
  const remainingCals = calorieTarget - (proteinTarget * 4);
  const fatTarget = Math.round((calorieTarget * 0.25) / 9); // 25% of calories from fat
  const carbsTarget = Math.round((remainingCals - (fatTarget * 9)) / 4);

  return {
    calories: Math.round(calorieTarget),
    protein: proteinTarget,
    carbs: carbsTarget,
    fat: fatTarget,
  };
}

export type Goal = 'bulk' | 'cut' | 'maintain';
export type Pace = 'slow' | 'normal' | 'aggressive';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Sex = 'male' | 'female';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Profile {
  id: string;
  premium: boolean;
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
  pace: Pace;
  created_at: string;
}

export interface DailyTarget {
  id: string;
  user_id: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

export interface MealEntry {
  id: string;
  user_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: MealType;
  image_url?: string;
  date: string;
  created_at: string;
}

export interface WeighIn {
  id: string;
  user_id: string;
  weight_kg: number;
  date: string;
  created_at: string;
}

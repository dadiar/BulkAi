-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  premium BOOLEAN DEFAULT FALSE,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female')),
  height_cm NUMERIC,
  weight_kg NUMERIC,
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal TEXT CHECK (goal IN ('bulk', 'cut', 'maintain')),
  pace TEXT CHECK (pace IN ('slow', 'normal', 'aggressive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create daily_targets table
CREATE TABLE daily_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL,
  carbs INTEGER NOT NULL,
  fat INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create meal_entries table
CREATE TABLE meal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL,
  carbs INTEGER NOT NULL,
  fat INTEGER NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  image_url TEXT, -- This was missing in the previous schema
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create weigh_ins table
CREATE TABLE weigh_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weigh_ins ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own targets" ON daily_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own targets" ON daily_targets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own meals" ON meal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own meals" ON meal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own meals" ON meal_entries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own weigh-ins" ON weigh_ins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own weigh-ins" ON weigh_ins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own weigh-ins" ON weigh_ins FOR DELETE USING (auth.uid() = user_id);

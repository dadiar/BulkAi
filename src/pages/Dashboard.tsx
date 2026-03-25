import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DailyTarget, MealEntry, Profile, WeighIn } from '../types';
import { format, addDays, startOfWeek, subDays, isWithinInterval, parseISO } from 'date-fns';
import { Plus, Flame, Activity, Scale, Apple, Minus, Settings, ChevronRight, Footprints, Dumbbell, Droplets, TrendingUp, Target, Sparkles, Lock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";

interface MealIdea {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [target, setTarget] = useState<DailyTarget | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [weeklyMeals, setWeeklyMeals] = useState<MealEntry[]>([]);
  const [weeklyWeights, setWeeklyWeights] = useState<WeighIn[]>([]);
  const [latestWeight, setLatestWeight] = useState<WeighIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [mealIdeas, setMealIdeas] = useState<MealIdea[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);

  const weeklyStats = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      const dayMeals = weeklyMeals.filter(m => m.date === date);
      const dayWeight = weeklyWeights.find(w => w.date === date);
      
      return {
        date: format(parseISO(date), 'MMM d'),
        calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
        weight: dayWeight?.weight_kg || null,
        fullDate: date
      };
    });

    const avgCalories = Math.round(days.reduce((sum, d) => sum + d.calories, 0) / 7);
    const weightData = days.filter(d => d.weight !== null);

    return { days, avgCalories, weightData };
  }, [weeklyMeals, weeklyWeights]);

  const generateMealIdeas = async () => {
    if (!target || !profile?.premium) return;
    
    setGeneratingIdeas(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 3-5 healthy meal ideas for a user with these daily targets: ${target.calories} calories, ${target.protein}g protein, ${target.carbs}g carbs, ${target.fat}g fat. The user's goal is ${profile.goal}.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER }
              },
              required: ["name", "description", "calories", "protein", "carbs", "fat"]
            }
          }
        }
      });

      if (response.text) {
        setMealIdeas(JSON.parse(response.text));
      }
    } catch (err) {
      console.error('Error generating meal ideas:', err);
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const fetchData = async () => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    try {
      const startTime = Date.now();
      const [profileRes, targetRes, mealsRes, weeklyMealsRes, weightRes, weeklyWeightsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('daily_targets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('meal_entries').select('*').eq('user_id', user.id).eq('date', today).order('created_at', { ascending: false }),
        supabase.from('meal_entries').select('*').eq('user_id', user.id).gte('date', sevenDaysAgo).order('date', { ascending: true }),
        supabase.from('weigh_ins').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(1).single(),
        supabase.from('weigh_ins').select('*').eq('user_id', user.id).gte('date', sevenDaysAgo).order('date', { ascending: true })
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;
      const minDuration = 2000; // 2 seconds minimum loading for "cool" factor

      if (duration < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - duration));
      }

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (targetRes.data) setTarget(targetRes.data as DailyTarget);
      if (mealsRes.data) setMeals(mealsRes.data as MealEntry[]);
      if (weeklyMealsRes.data) setWeeklyMeals(weeklyMealsRes.data as MealEntry[]);
      if (weightRes.data) setLatestWeight(weightRes.data as WeighIn);
      if (weeklyWeightsRes.data) setWeeklyWeights(weeklyWeightsRes.data as WeighIn[]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleDeleteMeal = async (mealId: string) => {
    // Optimistic update
    const previousMeals = [...meals];
    setMeals(meals.filter(m => m.id !== mealId));

    try {
      const { error } = await supabase.from('meal_entries').delete().eq('id', mealId);
      if (error) throw error;
      
      // Clean up local storage image
      localStorage.removeItem(`meal_image_${mealId}`);
    } catch (err: any) {
      console.error('Failed to delete meal:', err);
      // Rollback if failed
      setMeals(previousMeals);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper relative overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 atmosphere opacity-60" />
      
      <div className="relative z-10 flex flex-col items-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="w-24 h-24 md:w-32 md:h-32 border border-gold/20 rounded-full flex items-center justify-center mb-12 relative"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-t-2 border-gold rounded-full"
          />
          <Apple className="text-gold w-8 h-8 md:w-12 md:h-12" />
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <h2 className="font-serif text-4xl md:text-6xl italic text-black mb-4 tracking-tight">Preparing your journal</h2>
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[12px] md:text-[14px] uppercase tracking-[0.5em] font-bold text-ink/60"
          >
            Synchronizing data
          </motion.div>
        </motion.div>
      </div>
    </div>
  );

  if (!target || !profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper p-8 text-center">
      <h2 className="font-serif text-3xl mb-4">Welcome to Cal AI</h2>
      <p className="text-ink/60 mb-8 max-w-md">Start tracking your nutrition to reach your fitness goals.</p>
      <Link to="/onboarding" className="luxury-button">Get Started</Link>
    </div>
  );

  const eatenCals = meals.reduce((sum, m) => sum + m.calories, 0);
  const eatenProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  const eatenCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
  const eatenFat = meals.reduce((sum, m) => sum + m.fat, 0);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="min-h-screen bg-paper pb-32">
      {/* Hero Section */}
      <section className="relative h-[40vh] overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=2000" 
          alt="Healthy Food" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="luxury-label mb-4 md:mb-6">Daily Summary</span>
            <h1 className="font-serif text-5xl md:text-9xl leading-[0.85] mb-6 md:mb-8 tracking-tighter">
              Daily <br />
              <span className="text-gold">Progress</span>
            </h1>
          </motion.div>
        </div>
      </section>

      {/* Main Stats */}
      <div className="px-4 md:px-12 -mt-10 md:-mt-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
          {/* Calorie Progress */}
          <div className="luxury-card p-6 md:p-12 lg:col-span-2 flex flex-col md:flex-row items-center gap-8 md:gap-16">
            <div className="relative w-48 h-48 md:w-64 md:h-64">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="90"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  className="text-ink/5 md:hidden"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  className="text-ink/5 hidden md:block"
                />
                <motion.circle
                  cx="96"
                  cy="96"
                  r="90"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={565}
                  initial={{ strokeDashoffset: 565 }}
                  animate={{ strokeDashoffset: 565 - (Math.min(eatenCals, target.calories) / target.calories) * 565 }}
                  transition={{ duration: 2, ease: "circOut" }}
                  strokeLinecap="round"
                  className="text-gold md:hidden"
                />
                <motion.circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={754}
                  initial={{ strokeDashoffset: 754 }}
                  animate={{ strokeDashoffset: 754 - (Math.min(eatenCals, target.calories) / target.calories) * 754 }}
                  transition={{ duration: 2, ease: "circOut" }}
                  strokeLinecap="round"
                  className="text-gold hidden md:block"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif text-4xl md:text-6xl text-ink">{eatenCals}</span>
                <span className="luxury-label mt-1 md:mt-2">Consumed</span>
              </div>
            </div>

            <div className="flex-1 space-y-8 md:space-y-10 w-full">
              <div>
                <h3 className="luxury-heading text-2xl md:text-3xl mb-2 md:mb-4">Daily Target</h3>
                <p className="text-ink/80 font-sans text-lg md:text-xl leading-relaxed">
                  You have <span className="text-ink font-bold">{target.calories - eatenCals}</span> calories remaining.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 md:gap-8">
                <div className="space-y-2 md:space-y-3">
                  <p className="luxury-label !text-ink/80 !text-[8px] md:!text-[10px]">Protein</p>
                  <p className="font-serif text-lg md:text-2xl text-ink">{eatenProtein}g</p>
                  <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(eatenProtein / target.protein) * 100}%` }}
                      className="h-full bg-gold/40"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:space-y-3">
                  <p className="luxury-label !text-ink/80 !text-[8px] md:!text-[10px]">Carbs</p>
                  <p className="font-serif text-lg md:text-2xl text-ink">{eatenCarbs}g</p>
                  <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(eatenCarbs / target.carbs) * 100}%` }}
                      className="h-full bg-gold/40"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:space-y-3">
                  <p className="luxury-label !text-[8px] md:!text-[10px]">Fat</p>
                  <p className="font-serif text-lg md:text-2xl text-ink">{eatenFat}g</p>
                  <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(eatenFat / target.fat) * 100}%` }}
                      className="h-full bg-gold/40"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Weight Card */}
          <div className="luxury-card p-8 md:p-12 flex flex-col justify-between bg-white text-ink">
            <div>
              <span className="luxury-label text-ink/40 mb-4 md:mb-6">Current Weight</span>
              <h3 className="font-serif text-5xl md:text-7xl mb-2 md:mb-4 text-ink">{latestWeight?.weight_kg || '--'} <span className="text-xl md:text-2xl text-ink/40 uppercase tracking-widest font-sans font-bold">kg</span></h3>
              <p className="text-ink/50 font-sans text-base md:text-lg">Last logged {latestWeight ? format(new Date(latestWeight.date), 'MMMM do') : 'never'}</p>
            </div>
            
            <Link to="/profile" className="flex items-center justify-between group pt-8 md:pt-10 border-t border-ink/10 mt-8 md:mt-0">
            <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold text-ink/80 group-hover:text-gold transition-colors">Update Metrics</span>
            <ChevronRight size={18} className="text-ink/40 group-hover:translate-x-2 transition-transform group-hover:text-gold" />
            </Link>
          </div>
        </div>
      </div>

      {/* Weekly Progress Section */}
      <div className="px-4 md:px-12 mt-16 md:mt-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-6">
          <div>
            <span className="luxury-label mb-2 md:mb-4">Analysis</span>
            <h2 className="luxury-heading text-3xl md:text-4xl">Weekly Progress</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
          {/* Weight Graph */}
          <div className="luxury-card p-6 md:p-10 lg:col-span-2 h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-gold" />
                </div>
                <div>
                  <h3 className="font-serif text-xl">Weight Trend</h3>
                  <p className="text-[10px] uppercase tracking-widest text-ink/40">Last 7 Days</p>
                </div>
              </div>
            </div>
            
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyStats.days}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#14141460' }}
                    dy={10}
                  />
                  <YAxis 
                    hide 
                    domain={['dataMin - 2', 'dataMax + 2']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #14141410',
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
                    }}
                    labelStyle={{ fontFamily: 'serif', marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#D4AF37" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorWeight)" 
                    connectNulls
                    dot={{ r: 4, fill: '#D4AF37', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calorie Summary */}
          <div className="luxury-card p-6 md:p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center">
                  <Target size={20} className="text-ink" />
                </div>
                <div>
                  <h3 className="font-serif text-xl">Calorie Summary</h3>
                  <p className="text-[10px] uppercase tracking-widest text-ink/40">Weekly Average</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <p className="luxury-label text-ink/40 mb-2">Avg. Daily Intake</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-5xl">{weeklyStats.avgCalories}</span>
                    <span className="text-sm uppercase tracking-widest text-ink/40">kcal</span>
                  </div>
                </div>

                <div>
                  <p className="luxury-label text-ink/40 mb-2">Daily Target</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-3xl text-ink/60">{target.calories}</span>
                    <span className="text-xs uppercase tracking-widest text-ink/40">kcal</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-ink/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-ink/60">Target Adherence</span>
                    <span className="text-[10px] font-bold text-gold">
                      {Math.round((weeklyStats.avgCalories / target.calories) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-ink/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((weeklyStats.avgCalories / target.calories) * 100, 100)}%` }}
                      className="h-full bg-gold"
                    />
                  </div>
                  <p className="mt-4 text-xs text-ink/50 leading-relaxed">
                    {weeklyStats.avgCalories > target.calories 
                      ? "You're averaging slightly above your target. Consider adjusting your portions."
                      : "You're staying within your target range. Great consistency!"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Logged */}
      <div className="px-4 md:px-12 mt-16 md:mt-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-6">
          <div>
            <span className="luxury-label mb-2 md:mb-4">Journal</span>
            <h2 className="luxury-heading text-3xl md:text-4xl">Recent Entries</h2>
          </div>
          <Link to="/add-meal" className="luxury-button py-3 px-8 text-[10px] w-full md:w-auto text-center">Log New Entry</Link>
        </div>
        
        {meals.length === 0 ? (
          <div className="text-center py-20 md:py-32 luxury-card bg-transparent border-dashed border-ink/10">
            <p className="font-sans text-ink/50 text-xl md:text-2xl">Your journal is empty for today.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
            {meals.map(meal => (
              <motion.div 
                key={meal.id} 
                onClick={() => navigate(`/edit-meal/${meal.id}`)}
                className="luxury-card overflow-hidden group cursor-pointer hover:shadow-xl transition-all"
              >
                <div className="h-48 md:h-64 overflow-hidden relative">
                  <img 
                    src={localStorage.getItem(`meal_image_${meal.id}`) || meal.image_url || `https://picsum.photos/seed/${meal.name}/800/600`} 
                    alt={meal.name} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 md:top-6 md:right-6 flex flex-col items-end gap-2">
                    <div className="glass-card px-3 py-1.5 md:px-4 md:py-2 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
                      {meal.calories} kcal
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                      className="glass-card p-2 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                      title="Remove Selection"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-6 md:p-10">
                  <div className="flex justify-between items-start mb-4 md:mb-6">
                    <h3 className="font-serif text-xl md:text-2xl">{meal.name}</h3>
                    <span className="text-[8px] md:text-[10px] font-bold text-ink/40 uppercase tracking-[0.2em]">{format(new Date(meal.created_at), 'h:mm a')}</span>
                  </div>
                  <div className="flex gap-6 md:gap-10">
                    <div className="space-y-1">
                      <p className="luxury-label !mb-0 text-[7px] md:text-[8px]">Protein</p>
                      <p className="font-sans text-base md:text-lg">{meal.protein}g</p>
                    </div>
                    <div className="space-y-1">
                      <p className="luxury-label !mb-0 text-[7px] md:text-[8px]">Carbs</p>
                      <p className="font-sans text-base md:text-lg">{meal.carbs}g</p>
                    </div>
                    <div className="space-y-1">
                      <p className="luxury-label !mb-0 text-[7px] md:text-[8px]">Fat</p>
                      <p className="font-sans text-base md:text-lg">{meal.fat}g</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* AI Meal Ideas Section */}
      <div className="px-4 md:px-12 mt-16 md:mt-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-6">
          <div>
            <span className="luxury-label mb-2 md:mb-4">AI Assistant</span>
            <h2 className="luxury-heading text-3xl md:text-4xl flex items-center gap-3">
              AI Meal Ideas
              <Sparkles className="text-gold" size={24} />
            </h2>
          </div>
          {profile.premium && (
            <button 
              onClick={generateMealIdeas}
              disabled={generatingIdeas}
              className="luxury-button py-3 px-8 text-[10px] w-full md:w-auto text-center flex items-center justify-center gap-2"
            >
              {generatingIdeas ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              {mealIdeas.length > 0 ? 'Refresh Ideas' : 'Generate Ideas'}
            </button>
          )}
        </div>

        {!profile.premium ? (
          <div className="luxury-card p-12 md:p-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
              <Lock className="text-gold" size={24} />
            </div>
            <h3 className="font-serif text-2xl md:text-3xl mb-4">Premium Feature</h3>
            <p className="text-ink/60 mb-8 max-w-md mx-auto">
              Unlock personalized AI-generated meal ideas tailored to your specific nutritional targets and fitness goals.
            </p>
            <Link to="/upgrade" className="luxury-button">Upgrade to Premium</Link>
          </div>
        ) : mealIdeas.length === 0 && !generatingIdeas ? (
          <div className="text-center py-20 md:py-32 luxury-card bg-transparent border-dashed border-ink/10">
            <p className="font-sans text-ink/50 text-xl md:text-2xl">Click generate to get personalized meal ideas.</p>
          </div>
        ) : generatingIdeas ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="luxury-card p-8 animate-pulse">
                <div className="h-6 w-3/4 bg-ink/5 rounded mb-4" />
                <div className="h-20 w-full bg-ink/5 rounded mb-6" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-10 bg-ink/5 rounded" />
                  <div className="h-10 bg-ink/5 rounded" />
                  <div className="h-10 bg-ink/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
            {mealIdeas.map((idea, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="luxury-card p-8 md:p-10 flex flex-col justify-between hover:border-gold/30 transition-colors"
              >
                <div>
                  <h3 className="font-serif text-xl md:text-2xl mb-4">{idea.name}</h3>
                  <p className="text-ink/60 text-sm md:text-base leading-relaxed mb-8">
                    {idea.description}
                  </p>
                </div>
                
                <div className="pt-6 border-t border-ink/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Estimated Macros</span>
                    <span className="text-xs font-bold text-gold">{idea.calories} kcal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-[8px] uppercase tracking-widest text-ink/40 mb-1">Protein</p>
                      <p className="font-serif text-lg">{idea.protein}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] uppercase tracking-widest text-ink/40 mb-1">Carbs</p>
                      <p className="font-serif text-lg">{idea.carbs}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] uppercase tracking-widest text-ink/40 mb-1">Fat</p>
                      <p className="font-serif text-lg">{idea.fat}g</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

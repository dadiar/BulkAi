import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Goal, Pace, ActivityLevel, Sex } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { Brain, Sparkles, Target, Zap, CheckCircle2 } from 'lucide-react';

export function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calculationStep, setCalculationStep] = useState(0);

  const calculationMessages = [
    "Analyzing body metrics...",
    "Calculating metabolic rate...",
    "Optimizing requirements...",
    "Adjusting for activity...",
    "Finalizing your plan..."
  ];

  useEffect(() => {
    if (calculating) {
      const interval = setInterval(() => {
        setCalculationStep(s => (s < calculationMessages.length - 1 ? s + 1 : s));
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [calculating]);

  const [formData, setFormData] = useState({
    age: '' as any,
    sex: 'male' as Sex,
    height_cm: '' as any,
    weight_kg: '' as any,
    activity_level: 'moderate' as ActivityLevel,
    goal: 'bulk' as Goal,
    pace: 'normal' as Pace,
  });

  const handleNext = () => {
    if (step === 1) {
      if (!formData.age || !formData.height_cm || !formData.weight_kg) {
        setError('Please fill in all fields.');
        return;
      }
    }
    setError(null);
    setStep(s => s + 1);
  };
  const handleBack = () => setStep(s => s - 1);

  const calculateTargets = () => {
    const age = Number(formData.age);
    const height = Number(formData.height_cm);
    const weight = Number(formData.weight_kg);

    // Basic BMR calculation (Mifflin-St Jeor)
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += formData.sex === 'male' ? 5 : -161;

    // Activity multiplier
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };
    const tdee = bmr * multipliers[formData.activity_level];

    // Goal adjustment
    let calorieTarget = tdee;
    if (formData.goal === 'bulk') {
      calorieTarget += formData.pace === 'slow' ? 250 : formData.pace === 'normal' ? 500 : 750;
    } else if (formData.goal === 'cut') {
      calorieTarget -= formData.pace === 'slow' ? 250 : formData.pace === 'normal' ? 500 : 750;
    }

    // Protein target (approx 2g per kg of bodyweight)
    const proteinTarget = Math.round(weight * 2.2);
    
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
  };

  const calculateTargetsWithAI = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Calculate daily nutritional targets for a ${formData.age} year old ${formData.sex}, height ${formData.height_cm}cm, weight ${formData.weight_kg}kg. 
        Activity level: ${formData.activity_level}. 
        Goal: ${formData.goal} at a ${formData.pace} pace.
        Return ONLY a JSON object with: calories (number), protein (number in grams), carbs (number in grams), fat (number in grams).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fat: { type: Type.NUMBER },
            },
            required: ["calories", "protein", "carbs", "fat"],
          },
        },
      });

      const text = response.text;
      if (text) {
        return JSON.parse(text);
      }
      throw new Error("AI failed to generate targets");
    } catch (err) {
      console.error("AI calculation failed, falling back to formula:", err);
      return calculateTargets();
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('You must be logged in to finish setup.');
      return;
    }
    setLoading(true);
    setCalculating(true);
    setError(null);

    try {
      const targets = await calculateTargetsWithAI();

      // Reduced delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 1. Save profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        ...formData,
        age: Number(formData.age),
        height_cm: Number(formData.height_cm),
        weight_kg: Number(formData.weight_kg),
        premium: false,
      });

      if (profileError) throw profileError;

      // 2. Save targets
      const { error: targetError } = await supabase.from('daily_targets').insert({
        user_id: user.id,
        ...targets,
      });

      if (targetError) throw targetError;

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper p-6 md:p-16 flex flex-col">
      <AnimatePresence mode="wait">
        {calculating ? (
          <motion.div 
            key="calculating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full"
          >
            <div className="relative mb-8 md:mb-16">
              <motion.div 
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 90, 180, 270, 360]
                }}
                transition={{ 
                  duration: 12,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="w-32 h-32 md:w-40 md:h-40 bg-gold/5 rounded-full flex items-center justify-center border border-gold/10 shadow-[0_0_50px_rgba(212,175,55,0.1)]"
              >
                <Brain className="text-gold w-12 h-12 md:w-16 md:h-16" />
              </motion.div>
              <motion.div 
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-4 -right-4 md:-top-6 md:-right-6"
              >
                <Sparkles className="text-gold w-8 h-8 md:w-10 md:h-10" />
              </motion.div>
            </div>

            <h2 className="font-serif text-4xl md:text-6xl mb-4 md:mb-6">Setting up your profile</h2>
            <p className="text-ink/60 font-sans text-xl md:text-2xl mb-12 md:mb-16 h-8">
              {calculationMessages[calculationStep]}
            </p>

            <div className="w-full max-w-md space-y-6 md:space-y-8">
              {calculationMessages.map((msg, i) => (
                <div key={i} className="flex items-center gap-4 md:gap-6">
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all duration-700 border ${
                    i < calculationStep ? 'bg-gold border-gold' : 
                    i === calculationStep ? 'bg-gold/10 border-gold/30 animate-pulse' : 'bg-ink/5 border-ink/5'
                  }`}>
                    {i < calculationStep ? (
                      <CheckCircle2 className="text-ink w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${i === calculationStep ? 'bg-gold' : 'bg-ink/10'}`} />
                    )}
                  </div>
                  <span className={`text-[8px] md:text-[10px] uppercase tracking-wider font-bold transition-all duration-700 text-left ${
                    i <= calculationStep ? 'text-ink' : 'text-ink/60'
                  }`}>
                    {msg}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="onboarding"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 max-w-3xl mx-auto w-full pt-12 md:pt-24"
          >
            <div className="mb-12 md:mb-20">
              <div className="h-1 w-full bg-ink/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / 3) * 100}%` }}
                  className="h-full bg-gold transition-all duration-700 ease-out"
                />
              </div>
              <div className="flex justify-between mt-4 md:mt-6">
                <span className="luxury-label">Step {step} of 3</span>
              </div>
            </div>

            {error && (
              <div className="mb-10 md:mb-16 p-6 md:p-8 bg-red-500/5 text-red-900 text-[10px] md:text-[11px] uppercase tracking-wider font-bold rounded-[24px] md:rounded-[32px] border border-red-500/10">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-10 md:space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <header>
                  <span className="luxury-label mb-2 md:mb-4">Personal Details</span>
                  <h2 className="font-serif text-5xl md:text-8xl leading-none">The Basics</h2>
                </header>
                
                <div className="space-y-10 md:space-y-16">
                  <div className="space-y-4 md:space-y-6">
                    <label className="luxury-label">Biological Sex</label>
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                      {['male', 'female'].map(s => (
                        <button
                          key={s}
                          onClick={() => setFormData({ ...formData, sex: s as Sex })}
                          className={`py-4 md:py-6 rounded-full text-[8px] md:text-[10px] uppercase tracking-wider font-bold transition-all border ${
                            formData.sex === s ? 'bg-ink text-white border-ink' : 'border-ink/40 text-ink/60 hover:border-ink/80'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 md:space-y-6">
                    <label className="luxury-label">Age</label>
                    <input
                      type="number"
                      placeholder="Years"
                      value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value })}
                      className="luxury-input w-full !text-3xl md:!text-5xl !py-6 md:!py-8"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
                    <div className="space-y-4 md:space-y-6">
                      <label className="luxury-label">Height (cm)</label>
                      <input
                        type="number"
                        placeholder="175"
                        value={formData.height_cm}
                        onChange={e => setFormData({ ...formData, height_cm: e.target.value })}
                        className="luxury-input w-full !text-3xl md:!text-5xl !py-6 md:!py-8"
                      />
                    </div>
                    <div className="space-y-4 md:space-y-6">
                      <label className="luxury-label">Weight (kg)</label>
                      <input
                        type="number"
                        placeholder="70"
                        value={formData.weight_kg}
                        onChange={e => setFormData({ ...formData, weight_kg: e.target.value })}
                        className="luxury-input w-full !text-3xl md:!text-5xl !py-6 md:!py-8"
                      />
                    </div>
                  </div>
                </div>
                
                <button onClick={handleNext} className="w-full luxury-button mt-10 md:mt-16 py-5 md:py-6 text-base md:text-lg">
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10 md:space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <header>
                  <span className="luxury-label mb-2 md:mb-4">Goal</span>
                  <h2 className="font-serif text-5xl md:text-8xl leading-none">Your Objective</h2>
                </header>
                
                <div className="space-y-4 md:space-y-6">
                  {[
                    { id: 'bulk', label: 'Bulk', desc: 'Sculpting muscle mass' },
                    { id: 'cut', label: 'Cut', desc: 'Refining body composition' },
                    { id: 'maintain', label: 'Maintain', desc: 'Sustaining excellence' },
                  ].map(g => (
                    <button
                      key={g.id}
                      onClick={() => setFormData({ ...formData, goal: g.id as Goal })}
                      className={`w-full p-6 md:p-10 rounded-[24px] md:rounded-[40px] border text-left transition-all group ${
                        formData.goal === g.id ? 'bg-white border-gold shadow-2xl' : 'border-ink/5 hover:bg-white/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                          <div className={`font-serif text-2xl md:text-3xl transition-colors ${formData.goal === g.id ? 'text-ink' : 'text-ink/60 group-hover:text-ink/80'}`}>{g.label}</div>
                          {formData.goal === g.id && <div className="w-2 h-2 md:w-3 md:h-3 bg-gold rounded-full" />}
                        </div>
                        <div className={`text-[8px] md:text-[10px] uppercase tracking-wider font-bold mt-2 md:mt-4 transition-colors ${formData.goal === g.id ? 'text-gold' : 'text-ink/40'}`}>{g.desc}</div>
                    </button>
                  ))}
                </div>

                {formData.goal !== 'maintain' && (
                  <div className="space-y-6 md:space-y-8">
                    <label className="luxury-label">Pace of Transformation</label>
                    <div className="grid grid-cols-3 gap-3 md:gap-6">
                      {['slow', 'normal', 'aggressive'].map(p => (
                        <button
                          key={p}
                          onClick={() => setFormData({ ...formData, pace: p as Pace })}
                          className={`py-4 md:py-5 rounded-full text-[8px] md:text-[10px] uppercase tracking-wider font-bold transition-all border ${
                            formData.pace === p ? 'bg-ink text-white border-ink' : 'border-ink/10 text-ink/50 hover:text-ink/70'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 md:gap-8 mt-10 md:mt-16">
                  <button onClick={handleBack} className="flex-1 py-4 md:py-6 text-[8px] md:text-[10px] uppercase tracking-wider font-bold text-ink/40 hover:text-ink transition-colors">
                    Back
                  </button>
                  <button onClick={handleNext} className="flex-[2] luxury-button py-4 md:py-6 text-base md:text-lg">
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-10 md:space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <header>
                  <span className="luxury-label mb-2 md:mb-4">Lifestyle</span>
                  <h2 className="font-serif text-5xl md:text-8xl leading-none">Activity</h2>
                </header>
                
                <div className="space-y-4 md:space-y-6">
                  {[
                    { id: 'sedentary', label: 'Sedentary', desc: 'Minimal exertion' },
                    { id: 'light', label: 'Lightly Active', desc: 'Occasional movement' },
                    { id: 'moderate', label: 'Moderately Active', desc: 'Consistent discipline' },
                    { id: 'active', label: 'Active', desc: 'High-performance lifestyle' },
                    { id: 'very_active', label: 'Very Active', desc: 'Peak physical demand' },
                  ].map(a => (
                    <button
                      key={a.id}
                      onClick={() => setFormData({ ...formData, activity_level: a.id as ActivityLevel })}
                      className={`w-full p-6 md:p-10 rounded-[24px] md:rounded-[40px] border text-left transition-all group ${
                        formData.activity_level === a.id ? 'bg-white border-gold shadow-2xl' : 'border-ink/5 hover:bg-white/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                          <div className={`font-serif text-2xl md:text-3xl transition-colors ${formData.activity_level === a.id ? 'text-ink' : 'text-ink/60 group-hover:text-ink/80'}`}>{a.label}</div>
                          {formData.activity_level === a.id && <div className="w-2 h-2 md:w-3 md:h-3 bg-gold rounded-full" />}
                        </div>
                        <div className={`text-[8px] md:text-[10px] uppercase tracking-wider font-bold mt-2 md:mt-4 transition-colors ${formData.activity_level === a.id ? 'text-gold' : 'text-ink/40'}`}>{a.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 md:gap-8 mt-10 md:mt-16">
                  <button onClick={handleBack} className="flex-1 py-4 md:py-6 text-[8px] md:text-[10px] uppercase tracking-wider font-bold text-ink/40 hover:text-ink transition-colors">
                    Back
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="flex-[2] luxury-button py-4 md:py-6 text-base md:text-lg"
                  >
                    {loading ? 'Finalizing...' : 'Complete Profile'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

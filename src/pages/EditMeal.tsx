import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { MealType } from '../types';

export function EditMeal() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeal = async () => {
      if (!user || !id) return;
      
      try {
        const { data, error: fetchError } = await supabase
          .from('meal_entries')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (fetchError) throw fetchError;
        if (data) {
          setMealName(data.name);
          setCalories(data.calories.toString());
          setProtein(data.protein.toString());
          setCarbs(data.carbs.toString());
          setFat(data.fat.toString());
          setMealType(data.meal_type as MealType);
          
          // Check local storage for image
          const localImage = localStorage.getItem(`meal_image_${id}`);
          if (localImage) {
            setImagePreview(localImage);
          } else if (data.image_url) {
            setImagePreview(data.image_url);
          }
        }
      } catch (err: any) {
        console.error('Error fetching meal:', err);
        setError('Failed to load meal details.');
      } finally {
        setLoading(false);
      }
    };

    fetchMeal();
  }, [id, user]);

  const handleUpdateMeal = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setSaving(true);
    setError(null);
    
    try {
      const { error: updateError } = await supabase
        .from('meal_entries')
        .update({
          name: mealName,
          calories: parseInt(calories),
          protein: parseInt(protein),
          carbs: parseInt(carbs),
          fat: parseInt(fat),
          meal_type: mealType,
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-32 pt-16 md:pt-32">
      <div className="max-w-4xl mx-auto px-4 md:px-12">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors mb-8 group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] uppercase tracking-widest font-bold">Back to Journal</span>
        </button>

        <header className="mb-12 md:mb-16">
          <span className="luxury-label mb-2 md:mb-4">Journal Entry</span>
          <h1 className="font-serif text-5xl md:text-7xl leading-none">Edit Selection</h1>
        </header>

        {error && (
          <div className="mb-12 p-6 bg-red-500/5 rounded-2xl flex items-start gap-4 border border-red-500/10">
            <AlertCircle className="text-red-500 shrink-0 mt-1" size={20} />
            <p className="text-sm text-red-900 font-medium tracking-wide uppercase text-[10px]">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Image Preview */}
          <div className="lg:col-span-1">
            <div className="luxury-card overflow-hidden aspect-square lg:aspect-[3/4] relative">
              <img 
                src={imagePreview || `https://picsum.photos/seed/${mealName}/800/600`} 
                alt={mealName} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/20 to-transparent" />
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleUpdateMeal} className="luxury-card p-8 md:p-12 space-y-10">
              <div className="space-y-4">
                <label className="luxury-label">Selection Name</label>
                <input 
                  type="text" 
                  required 
                  value={mealName} 
                  onChange={e => setMealName(e.target.value)} 
                  className="luxury-input w-full !text-xl md:!text-2xl" 
                />
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-10">
                <div className="space-y-4">
                  <label className="luxury-label">Calories</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required 
                      value={calories} 
                      onChange={e => setCalories(e.target.value)} 
                      className="luxury-input w-full !text-xl md:!text-2xl pr-16" 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">kcal</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="luxury-label">Protein</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required 
                      value={protein} 
                      onChange={e => setProtein(e.target.value)} 
                      className="luxury-input w-full !text-xl md:!text-2xl pr-8" 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="luxury-label">Carbohydrates</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required 
                      value={carbs} 
                      onChange={e => setCarbs(e.target.value)} 
                      className="luxury-input w-full !text-xl md:!text-2xl pr-8" 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="luxury-label">Fats</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required 
                      value={fat} 
                      onChange={e => setFat(e.target.value)} 
                      className="luxury-input w-full !text-xl md:!text-2xl pr-8" 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <label className="luxury-label">Category</label>
                <div className="grid grid-cols-2 gap-4">
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type as MealType)}
                      className={`py-4 px-4 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] transition-all border ${
                        mealType === type ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink/30 border-ink/10 hover:border-ink/30'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => navigate(-1)}
                  className="flex-1 py-4 text-[10px] uppercase tracking-widest font-bold text-ink/40 hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="flex-[2] luxury-button py-4"
                >
                  {saving ? 'Updating...' : 'Update Selection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

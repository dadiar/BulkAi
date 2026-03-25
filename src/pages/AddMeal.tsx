import { useState, useRef, FormEvent, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Search, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { motion } from 'motion/react';
import { MealType } from '../types';
import { format } from 'date-fns';

const cleanJsonString = (str: string) => {
  if (!str) return '';
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
};

export function AddMeal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ai' | 'search' | 'quick'>('quick');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  
  // AI State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [aiAnalyzed, setAiAnalyzed] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a list of exactly 20 specific food items or variations related to "${searchQuery}". For each item, provide a realistic estimate for a standard serving size of calories, protein (g), carbs (g), and fat (g). Return ONLY a JSON array of objects matching the requested schema.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                food_name: { type: Type.STRING, description: "Name of the food with serving size, e.g., 'Chicken Breast (100g)'" },
                calories: { type: Type.INTEGER },
                protein: { type: Type.INTEGER },
                carbs: { type: Type.INTEGER },
                fat: { type: Type.INTEGER }
              },
              required: ["food_name", "calories", "protein", "carbs", "fat"]
            }
          }
        }
      });

      const text = response.text || '[]';
      const results = JSON.parse(cleanJsonString(text));
      setSearchResults(results);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(`Search failed: ${err.message || 'Please try again.'}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (food: any) => {
    setMealName(food.food_name);
    setCalories(food.calories?.toString() || '0');
    setProtein(food.protein?.toString() || '0');
    setCarbs(food.carbs?.toString() || '0');
    setFat(food.fat?.toString() || '0');
    setActiveTab('quick');
  };

  const handleQuickAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    try {
      const { data, error: insertError } = await supabase.from('meal_entries').insert({
        user_id: user.id,
        name: mealName,
        calories: parseInt(calories),
        protein: parseInt(protein),
        carbs: parseInt(carbs),
        fat: parseInt(fat),
        meal_type: mealType,
        date: format(new Date(), 'yyyy-MM-dd'),
      }).select();

      if (insertError) throw insertError;

      // Save image to local storage if it exists
      if (data && data[0] && imagePreview) {
        try {
          // Check if image is too large (approx 2MB limit for safety)
          if (imagePreview.length > 2 * 1024 * 1024) {
            console.warn('Image too large for localStorage');
            setError('The photo is too large to store in your journal. The meal was saved, but the photo might not appear on your dashboard.');
            setLoading(false);
            await new Promise(resolve => setTimeout(resolve, 4000));
          } else {
            localStorage.setItem(`meal_image_${data[0].id}`, imagePreview);
          }
        } catch (e: any) {
          console.error('Storage error:', e);
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            setError('Journal is full: Meal saved, but photo could not be stored locally. Please delete old entries to free up space.');
            setLoading(false);
            // Wait for user to see the message before navigating
            await new Promise(resolve => setTimeout(resolve, 4000));
          } else {
            console.warn('Failed to save image to localStorage', e);
          }
        }
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check premium status
    const { data: profile } = await supabase
      .from('profiles')
      .select('premium')
      .eq('id', user.id)
      .single();

    if (!profile?.premium) {
      navigate('/upgrade');
      return;
    }

    setSelectedFile(file);
    setAiAnalyzed(false);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result.length > 2 * 1024 * 1024) {
        setError('This photo is very large and might not be stored in your journal. Try a smaller image if possible.');
      }
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    try {
      // Convert image to base64 for Gemini
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      
      const promptText = `Analyze this food image with extreme precision. 
      1. Identify every visible food item and ingredient.
      2. Estimate portions sizes accurately (in grams or standard units).
      3. Calculate total calories, protein (g), carbs (g), and fat (g) based on the identified items and portions.
      ${imageCaption ? `IMPORTANT CONTEXT: The user says: "${imageCaption}". Prioritize this information if it clarifies ambiguous items.` : ''}
      Return ONLY a JSON object with: food_name, calories, protein, carbs, fat.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: selectedFile.type,
                data: base64Data
              }
            },
            {
              text: promptText
            }
          ]
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              food_name: { type: Type.STRING },
              calories: { type: Type.INTEGER },
              protein: { type: Type.INTEGER },
              carbs: { type: Type.INTEGER },
              fat: { type: Type.INTEGER }
            },
            required: ["food_name", "calories", "protein", "carbs", "fat"]
          },
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || '{}';
      const result = JSON.parse(cleanJsonString(text));
      
      setMealName(result.food_name || 'Unknown Food');
      setCalories(result.calories?.toString() || '0');
      setProtein(result.protein?.toString() || '0');
      setCarbs(result.carbs?.toString() || '0');
      setFat(result.fat?.toString() || '0');
      setAiAnalyzed(true);
      
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setError(`Analysis failed: ${err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper pb-32 pt-16 md:pt-32">
      <div className="max-w-6xl mx-auto px-4 md:px-12">
        <header className="mb-12 md:mb-20">
          <span className="luxury-label mb-2 md:mb-4">Journal Entry</span>
          <h1 className="font-serif text-5xl md:text-8xl leading-none">Add Meal</h1>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-ink/5 mb-8 md:mb-16 overflow-x-auto no-scrollbar w-full">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex items-center justify-center gap-2 md:gap-3 py-4 md:py-6 px-4 md:px-10 text-[7px] md:text-[10px] uppercase tracking-wider font-bold transition-all relative whitespace-nowrap ${
              activeTab === 'ai' ? 'text-ink' : 'text-ink/40 hover:text-ink/60'
            }`}
          >
            {activeTab === 'ai' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
            <Camera size={14} className="shrink-0" />
            AI Analysis
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 flex items-center justify-center gap-2 md:gap-3 py-4 md:py-6 px-4 md:px-10 text-[7px] md:text-[10px] uppercase tracking-wider font-bold transition-all relative whitespace-nowrap ${
              activeTab === 'search' ? 'text-ink' : 'text-ink/40 hover:text-ink/60'
            }`}
          >
            {activeTab === 'search' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
            <Search size={14} className="shrink-0" />
            Search
          </button>
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 flex items-center justify-center gap-2 md:gap-3 py-4 md:py-6 px-4 md:px-10 text-[7px] md:text-[10px] uppercase tracking-wider font-bold transition-all relative whitespace-nowrap ${
              activeTab === 'quick' ? 'text-ink' : 'text-ink/40 hover:text-ink/60'
            }`}
          >
            {activeTab === 'quick' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
            <Zap size={14} className="shrink-0" />
            Manual Entry
          </button>
        </div>

        {error && (
          <div className="mb-16 p-8 bg-red-500/5 rounded-[32px] flex items-start gap-6 border border-red-500/10">
            <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
            <p className="text-sm text-red-900 font-medium tracking-wide uppercase text-[11px]">{error}</p>
          </div>
        )}

        {/* AI Tab */}
        {activeTab === 'ai' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {!imagePreview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="luxury-card bg-transparent border-dashed border-ink/10 p-10 md:p-20 flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 transition-all text-center min-h-[300px] md:min-h-[400px] group"
              >
                <div className="w-16 h-16 md:w-24 md:h-24 bg-gold/5 rounded-full flex items-center justify-center mb-6 md:mb-8 border border-gold/10 group-hover:scale-105 transition-transform">
                  <Camera className="text-gold" size={24} />
                </div>
                <h3 className="font-serif text-3xl md:text-4xl mb-4 md:mb-6">Capture Food</h3>
                <p className="text-ink/60 font-sans text-lg md:text-xl max-w-md leading-relaxed">Use AI to analyze your meal and get instant nutritional insights.</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16">
                <div className="relative h-[400px] md:h-[600px] w-full luxury-card overflow-hidden border-none shadow-2xl">
                  <img src={imagePreview} alt="Meal preview" className="w-full h-full object-cover" />
                  
                  {loading && (
                    <div className="absolute inset-0 bg-paper/90 flex flex-col items-center justify-center backdrop-blur-md">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 md:w-16 md:h-16 border-2 border-gold/10 border-t-gold rounded-full mb-6 md:mb-8"
                      />
                      <p className="font-sans text-xl md:text-2xl text-ink/60">Analyzing meal...</p>
                    </div>
                  )}

                  {aiAnalyzed && !loading && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-6 right-6 md:top-10 md:right-10 bg-gold text-ink p-3 md:p-4 rounded-full shadow-2xl z-10"
                    >
                      <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-gold" />
                    </motion.div>
                  )}
                </div>

                <div className="space-y-10 md:space-y-16">
                  {!aiAnalyzed && !loading && (
                    <div className="luxury-card p-8 md:p-12 space-y-8 md:space-y-12">
                      <div className="space-y-4">
                        <label className="luxury-label">Additional Context</label>
                        <textarea
                          rows={4}
                          value={imageCaption}
                          onChange={e => setImageCaption(e.target.value)}
                          placeholder="Any extra details about this meal?"
                          className="luxury-input w-full !text-lg md:!text-xl resize-none"
                        />
                      </div>
                      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                          <button
                            onClick={() => { setImagePreview(null); setSelectedFile(null); setImageCaption(''); }}
                            className="py-4 md:py-5 text-[10px] uppercase tracking-wider font-bold text-ink/80 hover:text-ink transition-colors order-2 md:order-1"
                          >
                            Discard
                          </button>
                        <button
                          onClick={analyzeImage}
                          className="luxury-button py-4 md:py-5 order-1 md:order-2"
                        >
                          Analyze Meal
                        </button>
                      </div>
                    </div>
                  )}

                  {aiAnalyzed && (
                    <form onSubmit={handleQuickAdd} className="luxury-card p-8 md:p-12 space-y-8 md:space-y-10">
                      <div className="flex justify-between items-end mb-4">
                        <h3 className="luxury-heading text-2xl md:text-3xl">Edit Details</h3>
                        <button type="button" onClick={() => { setImagePreview(null); setSelectedFile(null); setAiAnalyzed(false); setImageCaption(''); }} className="text-[10px] font-bold uppercase tracking-wider text-gold hover:text-gold/80 transition-colors">Retake</button>
                      </div>

                      {error && (
                        <div className="p-4 bg-red-500/5 text-red-500 text-[10px] uppercase tracking-wider font-bold rounded-2xl border border-red-500/10">
                          {error}
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <label className="luxury-label">Meal Name</label>
                        <input type="text" required value={mealName} onChange={e => setMealName(e.target.value)} className="luxury-input w-full !text-xl md:!text-2xl" />
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 md:gap-x-10 gap-y-8 md:gap-y-10">
                        <div className="space-y-4">
                          <label className="luxury-label">Calories</label>
                          <div className="relative">
                            <input type="number" required value={calories} onChange={e => setCalories(e.target.value)} className="luxury-input w-full !text-xl md:!text-2xl pr-16" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">kcal</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="luxury-label">Protein</label>
                          <div className="relative">
                            <input type="number" required value={protein} onChange={e => setProtein(e.target.value)} className="luxury-input w-full !text-xl md:!text-2xl pr-8" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="luxury-label">Carbs</label>
                          <div className="relative">
                            <input type="number" required value={carbs} onChange={e => setCarbs(e.target.value)} className="luxury-input w-full !text-xl md:!text-2xl pr-8" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="luxury-label">Fat</label>
                          <div className="relative">
                            <input type="number" required value={fat} onChange={e => setFat(e.target.value)} className="luxury-input w-full !text-xl md:!text-2xl pr-8" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <label className="luxury-label">Category</label>
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                          {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setMealType(type as MealType)}
                              className={`py-3 md:py-4 px-4 md:px-6 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] transition-all border ${
                                mealType === type ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink/60 border-ink/10 hover:border-ink/80'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button type="submit" disabled={loading} className="w-full luxury-button mt-4 md:mt-6 py-4 md:py-5">
                        {loading ? 'Saving...' : 'Save Meal'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="luxury-card p-6 md:p-12 space-y-10 md:space-y-16">
              <form onSubmit={handleSearch} className="flex items-center gap-2 md:gap-4 border-b border-ink/10 focus-within:border-gold transition-all group px-2 md:px-4">
                <Search className="text-ink/20 group-focus-within:text-gold transition-colors w-5 h-5 md:w-8 md:h-8 flex-shrink-0" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search food..." 
                  className="flex-grow min-w-0 bg-transparent border-none outline-none !text-lg md:!text-4xl px-2 md:px-4 !py-6 md:!py-10 !rounded-none font-sans placeholder:text-ink/30" 
                />
                <button 
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="flex-shrink-0 text-[9px] md:text-[12px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold hover:text-ink transition-all disabled:opacity-30"
                >
                  {isSearching ? '...' : 'Explore'}
                </button>
              </form>

              {searchResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-h-[60vh] overflow-y-auto pr-2 md:pr-6 custom-scrollbar">
                  {searchResults.map((food, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-6 md:p-10 luxury-card bg-transparent hover:bg-white hover:shadow-2xl transition-all group border-ink/5"
                    >
                      <div className="flex justify-between items-start mb-4 md:mb-6">
                        <h3 className="font-serif text-xl md:text-2xl italic group-hover:text-gold transition-colors pr-4">{food.food_name}</h3>
                        <button 
                          onClick={() => handleSelectSearchResult(food)}
                          className="luxury-button !py-2 !px-4 !text-[8px] whitespace-nowrap"
                        >
                          Select
                        </button>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="font-serif text-2xl md:text-3xl italic text-ink">{food.calories} <span className="text-[10px] not-italic text-ink/40 uppercase tracking-[0.2em] font-bold">kcal</span></span>
                        <div className="flex gap-4 md:gap-6 text-[7px] md:text-[8px] font-bold text-ink/40 uppercase tracking-[0.3em]">
                          <span>P: {food.protein}g</span>
                          <span>C: {food.carbs}g</span>
                          <span>F: {food.fat}g</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 md:py-20">
                  <p className="font-serif italic text-ink/30 text-2xl md:text-3xl">Discover nutritional insights for any selection.</p>
                  <p className="luxury-label mt-6 md:mt-8 !text-ink/10">Try "Wild Salmon", "Wagyu Beef", or "Truffle Risotto"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual Entry Tab */}
        {activeTab === 'quick' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <form onSubmit={handleQuickAdd} className="luxury-card p-8 md:p-16 space-y-10 md:space-y-16">
              {error && (
                <div className="p-4 bg-red-500/5 text-red-500 text-[10px] uppercase tracking-wider font-bold rounded-2xl border border-red-500/10">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <label className="luxury-label">Selection Name</label>
                <input type="text" required value={mealName} onChange={e => setMealName(e.target.value)} placeholder="e.g., Afternoon Tea" className="luxury-input w-full !text-xl md:!text-2xl !py-4 md:!py-5" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 md:gap-x-16 gap-y-10 md:gap-y-16">
                <div className="space-y-4">
                  <label className="luxury-label">Calories</label>
                  <div className="relative">
                    <input type="number" required value={calories} onChange={e => setCalories(e.target.value)} placeholder="0" className="luxury-input w-full !text-xl md:!text-2xl pr-16" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">kcal</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="luxury-label">Protein</label>
                  <div className="relative">
                    <input type="number" required value={protein} onChange={e => setProtein(e.target.value)} placeholder="0" className="luxury-input w-full !text-xl md:!text-2xl pr-8" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="luxury-label">Carbohydrates</label>
                  <div className="relative">
                    <input type="number" required value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="0" className="luxury-input w-full !text-xl md:!text-2xl pr-8" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="luxury-label">Fats</label>
                  <div className="relative">
                    <input type="number" required value={fat} onChange={e => setFat(e.target.value)} placeholder="0" className="luxury-input w-full !text-xl md:!text-2xl pr-8" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 font-sans text-xs md:text-sm font-bold uppercase tracking-wider">g</span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <label className="luxury-label">Category</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type as MealType)}
                      className={`py-4 md:py-5 px-4 md:px-8 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] transition-all border ${
                        mealType === type ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink/30 border-ink/10 hover:border-ink/30'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full luxury-button mt-8 md:mt-12 py-5 md:py-6 text-base md:text-lg">
                {loading ? 'Documenting...' : 'Record Selection'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

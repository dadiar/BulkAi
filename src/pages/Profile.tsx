import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Profile as ProfileType, WeighIn, Goal, Pace, ActivityLevel } from '../types';
import { format } from 'date-fns';
import { LogOut, Crown, Scale, ChevronRight, Settings, Save, Edit3, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDailyTargets } from '../lib/calculations';

export function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [weight, setWeight] = useState('');
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [editData, setEditData] = useState({
    height_cm: 0,
    goal: 'maintain' as Goal,
    pace: 'normal' as Pace,
    activity_level: 'moderate' as ActivityLevel,
  });
  const [recentWeights, setRecentWeights] = useState<WeighIn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchProfileData = async () => {
      try {
        const startTime = Date.now();
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profileData) {
          setProfile(profileData as ProfileType);
          setEditData({
            height_cm: profileData.height_cm,
            goal: profileData.goal,
            pace: profileData.pace,
            activity_level: profileData.activity_level,
          });
        }

        const { data: weightsData } = await supabase
          .from('weigh_ins')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(5);
        if (weightsData) {
          setRecentWeights(weightsData as WeighIn[]);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        const minDuration = 1500; // 1.5 seconds minimum loading

        if (duration < minDuration) {
          await new Promise(resolve => setTimeout(resolve, minDuration - duration));
        }
      } catch (err) {
        console.error('Error fetching profile data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleLogWeight = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !weight || !profile) return;
    setLoggingWeight(true);
    setError(null);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const newWeight = parseFloat(weight);
      
      if (isNaN(newWeight)) {
        throw new Error('Please enter a valid weight.');
      }

      // Delete any existing weigh-in for today (to simulate upsert since unique constraint is missing)
      await supabase
        .from('weigh_ins')
        .delete()
        .eq('user_id', user.id)
        .eq('date', today);

      // Insert new weigh-in
      const { error: weighInError } = await supabase
        .from('weigh_ins')
        .insert({
          user_id: user.id,
          weight_kg: newWeight,
          date: today,
        });

      if (weighInError) throw weighInError;

      // Update profile weight
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ weight_kg: newWeight })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Recalculate targets based on new weight
      const newTargets = calculateDailyTargets({
        age: profile.age,
        sex: profile.sex,
        height_cm: profile.height_cm,
        weight_kg: newWeight,
        activity_level: profile.activity_level,
        goal: profile.goal,
        pace: profile.pace,
      });

      // Update targets in DB
      const { error: targetError } = await supabase
        .from('daily_targets')
        .insert({
          user_id: user.id,
          ...newTargets,
        });

      if (targetError) throw targetError;

      // Refresh profile state locally
      setProfile(prev => prev ? { ...prev, weight_kg: newWeight } : null);

      // Refresh weights
      const { data: weightsData } = await supabase
        .from('weigh_ins')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);
      if (weightsData) {
        setRecentWeights(weightsData as WeighIn[]);
      }
      
      setWeight('');
    } catch (err: any) {
      console.error('Failed to log weight', err);
      setError(err.message || 'Failed to record metrics. Please try again.');
    } finally {
      setLoggingWeight(false);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setUpdatingProfile(true);
    setError(null);

    try {
      // 1. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          height_cm: Number(editData.height_cm),
          goal: editData.goal,
          pace: editData.pace,
          activity_level: editData.activity_level,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Recalculate targets
      const newTargets = calculateDailyTargets({
        age: profile.age,
        sex: profile.sex,
        height_cm: Number(editData.height_cm),
        weight_kg: profile.weight_kg,
        activity_level: editData.activity_level,
        goal: editData.goal,
        pace: editData.pace,
      });

      // 3. Save new targets
      const { error: targetError } = await supabase
        .from('daily_targets')
        .insert({
          user_id: user.id,
          ...newTargets,
        });

      if (targetError) throw targetError;

      // 4. Update local state
      setProfile(prev => prev ? {
        ...prev,
        height_cm: Number(editData.height_cm),
        goal: editData.goal,
        pace: editData.pace,
        activity_level: editData.activity_level,
      } : null);

      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update profile', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setUpdatingProfile(false);
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
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-b-2 border-gold rounded-full"
          />
          <Settings className="text-gold w-8 h-8 md:w-12 md:h-12 animate-pulse" />
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <h2 className="font-serif text-4xl md:text-6xl italic text-black mb-4 tracking-tight">Accessing your profile</h2>
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[12px] md:text-[14px] uppercase tracking-[0.5em] font-bold text-ink/60"
          >
            Authenticating session
          </motion.div>
        </motion.div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="font-serif text-2xl text-ink/60 italic">Profile not found</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper pb-32 pt-16 md:pt-32">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <header className="mb-12 md:mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8">
          <div>
            <span className="luxury-label mb-2 md:mb-4">Account</span>
            <h1 className="font-serif text-5xl md:text-8xl leading-none">Profile</h1>
            <p className="text-ink/60 font-sans text-lg md:text-xl mt-2 md:mt-4">{user?.email}</p>
          </div>
          <button 
            onClick={handleSignOut}
            className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-red-500/60 hover:text-red-500 transition-all border border-red-500/10 px-5 md:px-6 py-2 md:py-3 rounded-full hover:bg-red-500/5"
          >
            Sign Out
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 md:gap-16">
          <div className="lg:col-span-3 space-y-10 md:space-y-16">
            {/* Premium Banner */}
            {!profile.premium ? (
              <Link to="/upgrade" className="block luxury-card p-8 md:p-12 bg-ink text-paper group overflow-hidden relative border-none shadow-xl">
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4 md:mb-6">
                    <Crown className="w-6 h-6 md:w-8 md:h-8 text-gold" />
                    <h2 className="font-serif text-2xl md:text-4xl text-paper">Upgrade to Premium</h2>
                  </div>
                  <p className="text-paper/60 font-sans text-lg md:text-xl mb-8 md:mb-10 leading-relaxed max-w-lg">Unlock AI photo logging, custom meal libraries, and more.</p>
                  <div className="flex items-center text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-gold group-hover:translate-x-2 transition-transform">
                    View Premium Features <ChevronRight className="ml-2 md:ml-3 w-3.5 h-3.5 md:w-4 h-4" />
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-gold/5 rounded-full -mr-24 -mt-24 md:-mr-32 md:-mt-32 blur-[80px] md:blur-[100px]" />
              </Link>
            ) : (
              <div className="luxury-card p-8 md:p-12 bg-ink text-paper border-none shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-4 md:gap-6 relative z-10">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20">
                    <Crown className="w-6 h-6 md:w-8 md:h-8 text-gold" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl md:text-3xl text-paper">Premium Member</h2>
                    <p className="text-gold/60 text-[8px] md:text-[10px] uppercase tracking-wider font-bold mt-1 md:mt-2">All features unlocked</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-gold/5 rounded-full -mr-24 -mt-24 md:-mr-32 md:-mt-32 blur-[60px] md:blur-[80px]" />
              </div>
            )}

            {/* Stats */}
            <div className="luxury-card p-8 md:p-12 relative overflow-hidden">
              <div className="flex justify-between items-center mb-8 md:mb-12">
                <span className="luxury-label !mb-0">Profile Details</span>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-gold hover:text-gold/80 transition-colors"
                >
                  {isEditing ? (
                    <><X className="w-3 h-3" /> Cancel</>
                  ) : (
                    <><Edit3 className="w-3 h-3" /> Edit Metrics</>
                  )}
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.form 
                    key="edit-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleUpdateProfile} 
                    className="space-y-8 md:space-y-10 relative z-10"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                      <div className="space-y-3">
                        <label className="luxury-label">Goal</label>
                        <select 
                          value={editData.goal}
                          onChange={e => setEditData({ ...editData, goal: e.target.value as Goal })}
                          className="luxury-input w-full bg-paper/50"
                        >
                          <option value="bulk">Bulk</option>
                          <option value="cut">Cut</option>
                          <option value="maintain">Maintain</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="luxury-label">Pace</label>
                        <select 
                          value={editData.pace}
                          onChange={e => setEditData({ ...editData, pace: e.target.value as Pace })}
                          className="luxury-input w-full bg-paper/50"
                          disabled={editData.goal === 'maintain'}
                        >
                          <option value="slow">Slow</option>
                          <option value="normal">Normal</option>
                          <option value="aggressive">Aggressive</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="luxury-label">Activity Level</label>
                        <select 
                          value={editData.activity_level}
                          onChange={e => setEditData({ ...editData, activity_level: e.target.value as ActivityLevel })}
                          className="luxury-input w-full bg-paper/50"
                        >
                          <option value="sedentary">Sedentary</option>
                          <option value="light">Lightly Active</option>
                          <option value="moderate">Moderately Active</option>
                          <option value="active">Active</option>
                          <option value="very_active">Very Active</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="luxury-label">Height (cm)</label>
                        <input 
                          type="number"
                          value={editData.height_cm}
                          onChange={e => setEditData({ ...editData, height_cm: parseInt(e.target.value) })}
                          className="luxury-input w-full bg-paper/50"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={updatingProfile}
                      className="luxury-button w-full flex items-center justify-center gap-3"
                    >
                      {updatingProfile ? 'Updating...' : <><Save className="w-4 h-4" /> Save Changes & Recalculate</>}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="display-stats"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-x-10 md:gap-x-16 gap-y-8 md:gap-y-10"
                  >
                    <div className="space-y-2 pb-4 md:pb-6 border-b border-ink/5">
                      <span className="luxury-label !mb-0 text-[8px]">Goal</span>
                      <p className="font-serif text-xl md:text-2xl capitalize text-ink">{profile.goal}</p>
                    </div>
                    <div className="space-y-2 pb-4 md:pb-6 border-b border-ink/5">
                      <span className="luxury-label !mb-0 text-[8px]">Pace</span>
                      <p className="font-serif text-xl md:text-2xl capitalize text-ink">{profile.pace}</p>
                    </div>
                    <div className="space-y-2 pb-4 md:pb-6 border-b border-ink/5">
                      <span className="luxury-label !mb-0 text-[8px]">Activity</span>
                      <p className="font-serif text-xl md:text-2xl capitalize text-ink">{profile.activity_level.replace('_', ' ')}</p>
                    </div>
                    <div className="space-y-2 pb-4 md:pb-6 border-b border-ink/5">
                      <span className="luxury-label !mb-0 text-[8px]">Height</span>
                      <p className="font-serif text-xl md:text-2xl text-ink">{profile.height_cm} <span className="text-[10px] md:text-xs text-ink/40 uppercase tracking-wider font-sans font-bold">cm</span></p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-10 md:space-y-16">
            {/* Log Weight */}
            <div className="luxury-card p-8 md:p-12 bg-white/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8 md:mb-12">
                <div>
                  <span className="luxury-label mb-2 md:mb-4">Metrics Tracking</span>
                  <h2 className="luxury-heading text-2xl md:text-3xl">Weight Entry</h2>
                </div>
                <Scale className="text-gold/20 w-6 h-6 md:w-8 md:h-8" />
              </div>
              
              <form onSubmit={handleLogWeight} className="space-y-8 md:space-y-10">
                {error && (
                  <div className="p-4 bg-red-500/5 text-red-500 text-[10px] uppercase tracking-wider font-bold rounded-2xl border border-red-500/10">
                    {error}
                  </div>
                )}
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    required 
                    value={weight} 
                    onChange={e => setWeight(e.target.value)} 
                    placeholder={profile.weight_kg.toString()} 
                    className="luxury-input w-full text-4xl md:text-6xl !py-6 md:!py-8" 
                  />
                  <span className="absolute right-0 bottom-6 md:bottom-8 text-ink/20 font-serif text-xl md:text-2xl italic">kg</span>
                </div>
                <button 
                  type="submit" 
                  disabled={loggingWeight} 
                  className="luxury-button w-full py-4 md:py-5"
                >
                  {loggingWeight ? 'Documenting...' : 'Record Metrics'}
                </button>
              </form>

              {recentWeights.length > 0 && (
                <div className="mt-10 md:mt-16 pt-10 md:pt-16 border-t border-ink/5">
                  <h3 className="luxury-label mb-6 md:mb-8">Historical Records</h3>
                  <div className="space-y-4 md:space-y-6">
                    {recentWeights.map(w => (
                      <div key={w.id} className="flex justify-between items-end group">
                        <span className="text-ink/30 font-serif italic text-base md:text-lg">{format(new Date(w.date), 'MMMM do, yyyy')}</span>
                        <div className="flex-1 border-b border-dotted border-ink/10 mx-4 md:mx-6 mb-2" />
                        <span className="font-serif text-xl md:text-2xl italic text-ink">{w.weight_kg} <span className="text-[8px] md:text-[10px] not-italic text-ink/20 uppercase tracking-widest font-sans font-bold">kg</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

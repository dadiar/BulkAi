import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Apple, Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        navigate('/onboarding');
      } else {
        const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();
            
          if (!profile) {
            navigate('/onboarding');
          } else {
            navigate('/');
          }
        }
      }
    } catch (err: any) {
      if (err.message?.includes('rate limit')) {
        setError('Email rate limit exceeded. You can try again in an hour.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 md:p-16 bg-paper relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gold/20" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gold/20" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl flex flex-col items-center"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="mb-16"
        >
          <div className="w-24 h-24 bg-gold/5 rounded-full flex items-center justify-center border border-gold/10 shadow-[0_0_40px_rgba(212,175,55,0.1)]">
            <Apple size={48} className="text-gold" fill="currentColor" />
          </div>
        </motion.div>
        
        <div className="text-center w-full mb-16">
          <h1 className="font-serif text-6xl md:text-7xl mb-6 leading-tight">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="luxury-label !text-ink/60">
            {isSignUp 
              ? 'Start tracking your nutrition' 
              : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="w-full space-y-12">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 bg-red-500/5 text-red-900 text-[11px] uppercase tracking-wider font-bold rounded-[32px] border border-red-500/10 text-center flex items-center justify-center gap-4"
              >
                <AlertCircle size={16} className="text-red-500" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="space-y-10">
            <div className="space-y-4">
              <label className="luxury-label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 text-ink/40" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="luxury-input w-full !text-2xl pl-10 !py-4"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <label className="luxury-label">Password</label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 text-ink/40" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="luxury-input w-full !text-2xl pl-10 !py-4"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full luxury-button flex items-center justify-center gap-4 py-6 text-lg"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : (isSignUp ? 'Create Account' : 'Sign In')}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="mt-16 text-[11px] font-bold uppercase tracking-[0.4em] text-ink/40 hover:text-gold transition-all hover:tracking-[0.5em]"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </motion.div>
    </div>
  );
}

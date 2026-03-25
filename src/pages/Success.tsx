import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export function Success() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const activatePremium = async () => {
      try {
        // In a real app, a Stripe webhook would handle this securely.
        // For this MVP, we optimistically set premium = true on the success page.
        const { error } = await supabase
          .from('profiles')
          .update({ premium: true })
          .eq('id', user.id);

        if (error) throw error;
      } catch (err) {
        console.error('Failed to activate premium:', err);
      } finally {
        setLoading(false);
      }
    };

    activatePremium();
  }, [user]);

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-xl luxury-card p-8 md:p-16 text-center animate-in zoom-in-95 duration-1000">
        <div className="w-16 h-16 md:w-24 md:h-24 bg-gold/5 rounded-full flex items-center justify-center mx-auto mb-8 md:mb-12 border border-gold/10">
          <CheckCircle2 className="text-gold w-8 h-8 md:w-10 md:h-10" />
        </div>
        
        <h1 className="font-serif text-3xl md:text-5xl italic text-ink mb-4 md:mb-6">Excellence Awaits</h1>
        <p className="text-ink/60 font-serif italic text-lg md:text-xl mb-10 md:mb-12 leading-relaxed">
          {loading ? 'Finalizing your membership...' : 'Your premium experience is now active. Every feature is at your command.'}
        </p>

        <Link 
          to="/"
          className={`w-full luxury-button flex items-center justify-center gap-4 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          Enter Dashboard
          <ArrowRight size={20} />
        </Link>
      </div>
    </div>
  );
}

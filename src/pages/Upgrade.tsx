import { useAuth } from '../contexts/AuthContext';
import { Check, Crown, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function Upgrade() {
  const { user } = useAuth();
  const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK;

  const navigate = useNavigate();

  useEffect(() => {
    console.log('Upgrade page mounted');
    console.log('Current user:', user?.id);
  }, [user]);
  
  const handleUpgrade = async () => {
    if (!user) return;
    
    if (paymentLink) {
      // Open Stripe Payment Link in a new tab because Stripe blocks iframes
      window.open(paymentLink, '_blank');
      // Optimistically navigate to success page in the current window
      // so when they return, they see the success state.
      navigate('/success');
      return;
    }

    // Fallback for testing if no payment link is set
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ premium: true })
        .eq('id', user.id);

      if (error) throw error;

      navigate('/success');
    } catch (err) {
      console.error('Failed to upgrade:', err);
      // alert replaced with a more subtle error handling or custom UI if needed
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto min-h-screen flex flex-col justify-center">
      <div className="luxury-card p-8 md:p-12 relative overflow-hidden bg-white text-ink">
        {/* Subtle Background Accent */}
        <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-gold/5 rounded-full blur-3xl -mr-24 -mt-24 md:-mr-32 md:-mt-32" />

        <header className="mb-8 md:mb-12 flex items-center justify-between">
          <Link to="/profile" className="p-2.5 md:p-3 bg-ink/5 rounded-full hover:bg-ink/10 transition-colors border border-ink/10">
            <ArrowLeft className="text-ink w-4.5 h-4.5 md:w-5 md:h-5" />
          </Link>
          <div className="flex items-center gap-2 bg-gold/10 text-gold px-3 md:px-4 py-1 md:py-1.5 rounded-full border border-gold/20">
            <Crown className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">The Elite Tier</span>
          </div>
        </header>

        <div className="text-center mb-10 md:mb-16">
          <h1 className="font-serif text-3xl md:text-5xl italic mb-4 md:mb-6 leading-tight text-ink">
            Refined Nutrition. <br />
            Uncompromising Results.
          </h1>
          <p className="text-ink/40 font-serif italic text-lg md:text-xl">
            Experience the pinnacle of health management.
          </p>
        </div>

        <div className="bg-ink/5 border border-ink/10 rounded-2xl p-6 md:p-10 mb-8 md:mb-12">
          <div className="flex items-baseline justify-center gap-2 md:gap-3 mb-4 md:mb-6">
            <span className="font-serif text-4xl md:text-5xl italic text-gold">£1.50</span>
            <span className="text-ink/40 font-serif italic text-base md:text-lg">initial month</span>
          </div>
          <p className="text-ink/30 text-[10px] md:text-xs text-center mb-8 md:mb-10 uppercase tracking-widest">Then £2.99/month. Cancel at your discretion.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[
              'AI Visual Food Analysis',
              'Bespoke Meal Library',
              'Weekly Strategic Adjustments',
              'Advanced Progress Insights',
              'Pristine Ad-Free Interface'
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 md:gap-4">
                <div className="bg-gold/10 p-1 md:p-1.5 rounded-full border border-gold/20">
                  <Check className="text-gold w-2.5 h-2.5 md:w-3 md:h-3" />
                </div>
                <span className="text-[10px] md:text-[11px] font-medium text-ink/70 tracking-wide uppercase">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={handleUpgrade}
          className="w-full luxury-button bg-gold text-ink hover:bg-gold/90 border-none py-5 md:py-6 text-base md:text-lg"
        >
          {paymentLink ? 'Begin Your Journey' : 'Activate Membership'}
        </button>

        <p className="text-center text-[10px] text-paper/20 mt-8 uppercase tracking-[0.3em]">
          {paymentLink 
            ? 'Securely processed via Stripe' 
            : 'Instant activation enabled for evaluation'}
        </p>
      </div>
    </div>
  );
}

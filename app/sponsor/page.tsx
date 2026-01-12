import Header from '@/components/Header'
import SponsorshipForm, { PastSponsors } from '@/components/sponsorship/SponsorshipForm'

export const metadata = {
  title: 'Sponsor a Shiur | Rabbi Kraz',
  description: 'Dedicate a shiur and support Rabbi Kraz\'s teachings. Sponsor in honor, in memory, or for a refuah sheleima.',
}

export default function SponsorPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      {/* Hero Section */}
      <div className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-primary/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        </div>
        <div className="relative max-w-4xl mx-auto text-center z-10">
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Partner in <span className="text-primary italic">Torah</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Dedicate a lesson and support the continued spread of timeless wisdom.
            Your partnership powers our mission.
          </p>
        </div>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 pb-20">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* Main Form */}
          <div className="lg:col-span-8">
            <SponsorshipForm />
          </div>

          {/* Sidebar - Past Sponsors */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-8">
            <PastSponsors />

            {/* Additional Info Card */}
            <div className="bg-card rounded-xl border border-white/10 p-6 shadow-xl">
              <h4 className="font-serif font-bold text-lg mb-4 text-primary">Why Sponsor?</h4>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Your dedication is announced at the beginning of the shiur, reaching thousands of listeners.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Listing on our website and email newsletters as a Partner in Torah.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Receive a tax-deductible receipt automatically via email.</span>
                </li>
              </ul>
              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-xs text-muted-foreground">Questions? Email us at <a href="mailto:rabbikraz1@gmail.com" className="text-primary hover:underline">rabbikraz1@gmail.com</a></p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="text-center py-8 border-t border-white/10 bg-card/30">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Rabbi Kraz. Secure payments processed by Stripe.
        </p>
      </footer>
    </div>
  )
}

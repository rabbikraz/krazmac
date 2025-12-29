import Header from '@/components/Header'

export default function SponsorPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Header />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-6">
            Sponsor a Shiur
          </h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-6">
              Support the continued production of these shiurim by sponsoring an episode.
              Your sponsorship helps make these teachings accessible to everyone.
            </p>
            <p className="text-gray-700 mb-6">
              To sponsor a shiur, please contact us at{' '}
              <a href="mailto:rabbikraz1@gmail.com" className="text-primary hover:underline">
                rabbikraz1@gmail.com
              </a>
            </p>
            <p className="text-gray-700">
              Thank you for your support!
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}


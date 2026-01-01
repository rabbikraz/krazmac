'use client'

import { useState, useMemo } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import {
    SPONSORSHIP_OPPORTUNITIES,
    SPONSORSHIP_TYPES,
    PAST_SPONSORS,
    SponsorshipType
} from './constants'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx')

const formSteps = ['Sponsor', 'Details', 'Info', 'Payment']

function ProgressBar({ currentStep }: { currentStep: number }) {
    return (
        <div className="w-full py-4">
            <div className="relative flex items-center justify-between">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full -z-10" />
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-primary rounded-full -z-10 transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / (formSteps.length - 1)) * 100}%` }}
                />
                {formSteps.map((step, i) => {
                    const num = i + 1
                    const done = num < currentStep
                    const current = num === currentStep
                    return (
                        <div key={step} className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 transition-all z-10
                ${done ? 'bg-primary border-primary text-white' :
                                    current ? 'bg-white border-primary text-primary scale-110 shadow-lg' :
                                        'bg-white border-gray-200 text-gray-300'}`}>
                                {done ? '✓' : num}
                            </div>
                            <span className={`hidden sm:block mt-2 text-xs font-semibold uppercase tracking-wider
                ${current ? 'text-primary' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                                {step}
                            </span>
                        </div>
                    )
                })}
            </div>
            <div className="sm:hidden text-center mt-4">
                <span className="text-xs font-bold text-primary uppercase">Step {currentStep} of {formSteps.length}</span>
                <h4 className="text-lg font-bold">{formSteps[currentStep - 1]}</h4>
            </div>
        </div>
    )
}

function CheckoutForm({ amount, onSuccess, onBack }: { amount: number; onSuccess: () => void; onBack: () => void }) {
    const stripe = useStripe()
    const elements = useElements()
    const [error, setError] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!stripe || !elements) return
        setProcessing(true)
        setError(null)

        const { error, token } = await stripe.createToken(elements.getElement(CardElement)!)
        if (error) {
            setError(error.message || 'Payment failed')
            setProcessing(false)
        } else {
            console.log('Token:', token)
            setTimeout(() => { setProcessing(false); onSuccess() }, 1500)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-xl border-2 border-gray-200 p-4 mb-6 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                <CardElement options={{
                    style: {
                        base: { color: '#1f2937', fontSize: '18px', fontWeight: '500', '::placeholder': { color: '#9ca3af' } },
                        invalid: { color: '#ef4444' }
                    },
                    hidePostalCode: true
                }} />
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-medium">{error}</div>}
            <div className="flex gap-3">
                <button type="button" onClick={onBack} disabled={processing}
                    className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all disabled:opacity-50">
                    Back
                </button>
                <button type="submit" disabled={!stripe || processing}
                    className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50">
                    {processing ? 'Processing...' : `Pay $${amount.toLocaleString()}`}
                </button>
            </div>
        </form>
    )
}

export default function SponsorshipForm() {
    const [step, setStep] = useState(1)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [customAmount, setCustomAmount] = useState('')
    const [date, setDate] = useState('')
    const [isNextShiur, setIsNextShiur] = useState(false)
    const [type, setType] = useState<SponsorshipType>(SponsorshipType.InHonorOf)
    const [dedicationName, setDedicationName] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [otherDedication, setOtherDedication] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [submitted, setSubmitted] = useState(false)

    const selected = SPONSORSHIP_OPPORTUNITIES.find(o => o.id === selectedId)
    const amount = selectedId === 6 ? parseFloat(customAmount) || 0 : selected?.amount || 0
    const showHonoree = [SponsorshipType.InHonorOf, SponsorshipType.InMemoryOf, SponsorshipType.RefuahSheleima].includes(type)
    const honoreeLabel = type === SponsorshipType.InMemoryOf ? 'Deceased Name' : type === SponsorshipType.RefuahSheleima ? "Ill Person's Name" : 'Honoree Name'

    const validate = () => {
        const e: Record<string, string> = {}
        if (step === 1) {
            if (!selectedId) e.opp = 'Select a level'
            else if (selectedId === 6 && amount <= 0) e.custom = 'Enter amount'
        } else if (step === 2) {
            if (!date && !isNextShiur) e.date = 'Select date'
            if (showHonoree && !dedicationName) e.ded = 'Required'
        } else if (step === 3) {
            if (!firstName) e.fn = 'Required'
            if (!lastName) e.ln = 'Required'
            if (!email || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email required'
        }
        setErrors(e)
        return !Object.keys(e).length
    }

    const next = () => validate() && setStep(s => s + 1)
    const back = () => setStep(s => s - 1)
    const reset = () => { setStep(1); setSelectedId(null); setSubmitted(false) }

    if (submitted) {
        return (
            <div className="bg-white rounded-2xl p-10 text-center shadow-lg border animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-3xl font-bold mb-4">Sponsorship Confirmed!</h2>
                <p className="text-gray-600 mb-8">Thank you for supporting Torah. A receipt has been sent to {email}.</p>
                <button onClick={reset} className="px-6 py-3 bg-primary text-white rounded-xl font-bold">Sponsor Again</button>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border">
            <ProgressBar currentStep={step} />

            <div className="mt-8 min-h-[400px]">
                {/* Step 1: Select Level */}
                {step === 1 && (
                    <div>
                        <h3 className="text-xl font-bold mb-1">Sponsorship Level</h3>
                        <p className="text-gray-500 text-sm mb-4">Choose how you'd like to support</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {SPONSORSHIP_OPPORTUNITIES.map(op => (
                                <div key={op.id} onClick={() => setSelectedId(op.id)}
                                    className={`p-4 rounded-xl cursor-pointer border-2 transition-all
                    ${selectedId === op.id ? 'bg-primary/5 border-primary shadow-md scale-[1.02]' : 'border-gray-100 hover:border-primary/50'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-xl text-primary">
                                            {op.id === 6 ? (
                                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            ) : `$${op.amount.toLocaleString()}`}
                                        </span>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${selectedId === op.id ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                                            {selectedId === op.id && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </div>
                                    <h4 className="font-bold">{op.title}</h4>
                                    <p className="text-sm text-gray-500">{op.description}</p>
                                </div>
                            ))}
                        </div>
                        {selectedId === 6 && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-primary/30">
                                <label className="block text-sm font-bold mb-2">Custom Amount ($)</label>
                                <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-2xl font-bold text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                                {errors.custom && <p className="text-red-500 text-sm mt-1">{errors.custom}</p>}
                            </div>
                        )}
                        {errors.opp && <p className="mt-4 p-3 bg-red-50 rounded-lg text-red-500 font-medium">{errors.opp}</p>}
                    </div>
                )}

                {/* Step 2: Details */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Dedication Details</h3>
                            <p className="text-gray-500 text-sm mb-4">When and for whom?</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl">
                            <label className="font-bold text-sm mb-3 block">Requested Date</label>

                            {/* Toggle buttons for Date vs Next Available */}
                            <div className="flex gap-2 mb-3">
                                <button type="button" onClick={() => setIsNextShiur(false)}
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border-2
                                        ${!isNextShiur ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary/50'}`}>
                                    📅 Choose Date
                                </button>
                                <button type="button" onClick={() => { setIsNextShiur(true); setDate('') }}
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border-2
                                        ${isNextShiur ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary/50'}`}>
                                    ⏭️ Next Available
                                </button>
                            </div>

                            {!isNextShiur ? (
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none" />
                            ) : (
                                <div className="p-3 bg-primary/10 rounded-lg text-primary font-medium text-sm text-center">
                                    {selectedId === 1 || selectedId === 3
                                        ? 'Your sponsorship will be assigned to the next available month'
                                        : 'Your sponsorship will be assigned to the next available shiur'}
                                </div>
                            )}
                            {errors.date && <p className="text-red-500 text-sm mt-2">{errors.date}</p>}
                        </div>

                        <div>
                            <label className="font-bold text-sm mb-2 block">Dedication Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {SPONSORSHIP_TYPES.map(t => (
                                    <label key={t.value}
                                        className={`px-4 py-3 rounded-xl cursor-pointer border-2 transition-all text-sm font-medium
                      ${type === t.value ? 'bg-primary/5 border-primary' : 'border-gray-100 hover:border-primary/30'}`}>
                                        <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />
                                        {t.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {showHonoree && (
                            <div className="bg-gray-50 p-4 rounded-xl">
                                <label className="font-bold text-sm mb-2 block">{honoreeLabel}</label>
                                <input type="text" value={dedicationName} onChange={e => setDedicationName(e.target.value)} placeholder="Enter full name..."
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none" />
                                {errors.ded && <p className="text-red-500 text-sm mt-1">{errors.ded}</p>}
                            </div>
                        )}

                        {/* Text box for Other/No Dedication */}
                        {type === SponsorshipType.Other && (
                            <div className="bg-gray-50 p-4 rounded-xl">
                                <label className="font-bold text-sm mb-2 block">Custom Dedication Text (Optional)</label>
                                <textarea
                                    value={otherDedication}
                                    onChange={e => setOtherDedication(e.target.value)}
                                    placeholder="Enter your custom dedication message or leave blank for no dedication..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none resize-none"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Info */}
                {step === 3 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Your Information</h3>
                            <p className="text-gray-500 text-sm mb-4">Where should we send your receipt?</p>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">First Name</label>
                                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none" />
                                {errors.fn && <p className="text-red-500 text-xs">{errors.fn}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Last Name</label>
                                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none" />
                                {errors.ln && <p className="text-red-500 text-xs">{errors.ln}</p>}
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none" />
                                {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="font-bold text-sm mb-2 block">Message to Rabbi (Optional)</label>
                            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary outline-none resize-none" />
                        </div>
                    </div>
                )}

                {/* Step 4: Payment */}
                {step === 4 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Review & Pay</h3>
                            <p className="text-gray-500 text-sm mb-4">Complete your sponsorship</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl border overflow-hidden">
                            <div className="px-5 py-4 bg-white border-b flex justify-between items-center">
                                <span className="font-semibold text-gray-600">Total</span>
                                <span className="text-3xl font-bold text-primary">${amount.toLocaleString()}</span>
                            </div>
                            <div className="p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Level:</span><span className="font-medium">{selected?.title}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Date:</span><span className="font-medium">{isNextShiur ? 'Next Available' : date}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Type:</span><span className="font-medium">{type}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Sponsor:</span><span className="font-medium">{firstName} {lastName}</span></div>
                            </div>
                        </div>
                        <Elements stripe={stripePromise}>
                            <CheckoutForm amount={amount} onSuccess={() => setSubmitted(true)} onBack={back} />
                        </Elements>
                    </div>
                )}
            </div>

            {/* Navigation */}
            {step < 4 && (
                <div className="mt-8 pt-6 border-t flex gap-3">
                    {step > 1 && (
                        <button onClick={back} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all">
                            Back
                        </button>
                    )}
                    <button onClick={next} className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all">
                        {step === 1 ? 'Choose This Level' : 'Continue'}
                    </button>
                </div>
            )}
        </div>
    )
}

export function PastSponsors() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-5 bg-gray-50 border-b">
                <h3 className="font-bold text-gray-900 uppercase tracking-wide text-sm">Recent Dedications</h3>
            </div>
            <div className="divide-y">
                {PAST_SPONSORS.map((s, i) => (
                    <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-baseline mb-1">
                            <h4 className="font-bold text-gray-900">{s.sponsorName}</h4>
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{s.parsha}</span>
                        </div>
                        <p className="text-sm text-gray-600 italic">"{s.dedication}"</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

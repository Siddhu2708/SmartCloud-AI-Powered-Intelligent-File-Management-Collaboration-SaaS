'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Cloud, Lock, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // If there is an active session, skip the landing page entirely
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          router.replace('/dashboard')
        }
        // Always clear checking — component may stay mounted briefly during redirect
        setChecking(false)
      })
      .catch(() => {
        // Network/config error — still show the landing page, never hang
        setChecking(false)
      })
  }, [router])

  // Show nothing while we're checking — avoids a flash of the landing page
  // for already-logged-in users
  if (checking) return null

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black text-white text-center selection:bg-white selection:text-black">
      <div className="relative group">
        <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <Cloud className="w-24 h-24 mb-6 text-white relative z-10 transition-transform duration-500 group-hover:scale-110" />
      </div>

      <h1 className="text-5xl font-extrabold tracking-tight mb-4">
        SmartCloud
      </h1>
      <p className="text-xl mb-12 max-w-lg text-neutral-400 font-light">
        AI-Powered SaaS Cloud Storage &amp; Collaboration Platform. Secure file
        management, semantic search, and RAG-based document Q&amp;A.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-neutral-900/50 p-8 rounded-2xl border border-neutral-800 hover:border-neutral-600 transition-colors">
          <Lock className="w-8 h-8 mb-4 mx-auto text-white" />
          <h3 className="font-semibold text-lg mb-2 text-white">Secure Storage</h3>
          <p className="text-sm text-neutral-400">Row Level Security and permissioned sharing.</p>
        </div>
        <div className="bg-neutral-900/50 p-8 rounded-2xl border border-neutral-800 hover:border-neutral-600 transition-colors">
          <Search className="w-8 h-8 mb-4 mx-auto text-white" />
          <h3 className="font-semibold text-lg mb-2 text-white">Semantic Search</h3>
          <p className="text-sm text-neutral-400">Find documents by meaning, not just keywords.</p>
        </div>
        <div className="bg-neutral-900/50 p-8 rounded-2xl border border-neutral-800 hover:border-neutral-600 transition-colors">
          <Cloud className="w-8 h-8 mb-4 mx-auto text-white" />
          <h3 className="font-semibold text-lg mb-2 text-white">AI Q&amp;A</h3>
          <p className="text-sm text-neutral-400">Chat with a single document or your entire Drive.</p>
        </div>
      </div>

      <div className="flex space-x-6">
        <Link
          href="/login"
          className="px-8 py-3 bg-white text-black font-semibold rounded-full shadow-lg hover:bg-neutral-200 transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-8 py-3 bg-transparent border border-neutral-600 text-white font-semibold rounded-full hover:bg-neutral-900 hover:border-neutral-400 transition-colors"
        >
          View Dashboard
        </Link>
      </div>
    </div>
  )
}

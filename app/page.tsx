"use client";

import { authClient } from "@/lib/auth-client";
import { Mic, Eye, Brain, LineChart, ChevronRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: <Mic className="h-6 w-6" />,
    title: "Live Voice Interface",
    description: "Conducts natural, low-latency conversational interviews, capturing nuances in tone and speech.",
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: "Behavioral Vision",
    description: "Observes facial expressions, eye movement, and non-verbal cues via camera to assess confidence.",
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: "Adaptive LLM Evaluation",
    description: "Dynamically morphs the questionnaire in real-time based on cognitive capability and candidate responses.",
  },
  {
    icon: <LineChart className="h-6 w-6" />,
    title: "Deep Analytics",
    description: "Generates multi-dimensional performance matrices with actionable pre and post-interview feedback.",
  },
];

export default function Home() {
  const { data } = authClient.useSession();
  const user = data?.user;

  return (
    <div className="relative min-h-screen bg-slate-950 font-sans text-slate-50 selection:bg-blue-500/30 overflow-hidden">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-slate-950 to-slate-950"></div>
      <div className="pointer-events-none absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[100px] mix-blend-screen animate-pulse"></div>
      <div className="pointer-events-none absolute bottom-0 left-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[120px] mix-blend-screen"></div>

      {/* Header */}
      <header className="absolute top-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-slate-950/20 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-widest text-slate-200">INTERV<span className="text-blue-500">AI</span></span>
        </div>
        
        {user ? (
          <div className="flex items-center gap-3 rounded-full border border-blue-500/30 bg-slate-900/80 px-3 py-1.5 shadow-[0_0_15px_rgba(37,99,235,0.15)] backdrop-blur">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name ? `${user.name} avatar` : "GitHub avatar"}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-500/50"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 text-xs font-semibold text-blue-100">
                {user.name?.slice(0, 2).toUpperCase() ?? "GH"}
              </div>
            )}
            <p className="max-w-[150px] truncate text-sm font-medium text-slate-200 pr-2">
              {user.name ?? "User"}
            </p>
          </div>
        ) : (
          <a href="/login" className="text-sm font-semibold tracking-wide text-blue-400 hover:text-blue-300 transition-colors">SIGN IN</a>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pt-32 pb-20 text-center sm:pt-40 lg:px-8">
        <div className="max-w-4xl space-y-8">
          <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300 backdrop-blur-sm transition-transform hover:scale-105">
            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 mr-2.5 animate-ping"></span>
            v1.0 Platform Live
          </div>
          
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-7xl">
            AI Agentic <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-600 bg-clip-text text-transparent drop-shadow-sm mt-2 inline-block">
              Interview Platform
            </span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Experience the next evolution of talent acquisition. Our autonomous system combines voice recognition, behavioral vision analysis, and large language models to conduct intelligent, adaptive interviews.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-8">
            <a href="/dashboard" className="w-full sm:w-auto">
              <Button className="h-14 w-full px-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold tracking-wide shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all hover:scale-105 active:scale-95 text-base hover:border-blue-400 border border-transparent">
                Start Assessment
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <Button variant="outline" className="h-14 w-full sm:w-auto px-10 rounded-full border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 backdrop-blur-sm transition-all hover:scale-105 text-base">
              View Architecture
            </Button>
          </div>
        </div>

        {/* Core Features Grid */}
        <div className="mt-32 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <div 
              key={i}
              className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-left backdrop-blur-md transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-800/80 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(37,99,235,0.15)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 border border-slate-800 text-blue-400 shadow-inner group-hover:bg-blue-500/20 group-hover:text-blue-300 group-hover:border-blue-500/30 transition-all duration-300">
                {feature.icon}
              </div>
              <h3 className="mb-3 text-xl font-bold tracking-tight text-slate-200 group-hover:text-white transition-colors">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400 group-hover:text-slate-300 transition-colors">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

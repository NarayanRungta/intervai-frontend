"use client";
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client";

export default function Login() {
  const handleLogin = async () => {
    await authClient.signIn.social({
      provider: "github",
    });
  };
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-8 antialiased sm:px-6">
      {/* Advanced Layered Background */}
      <div className="auth-grid-bg pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div className="auth-glow pointer-events-none absolute top-0 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] opacity-40 mix-blend-screen" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 translate-y-1/2 rounded-full bg-blue-600/10 blur-[100px]" />

      <section className="auth-panel auth-fade-up relative w-full max-w-[400px] overflow-hidden rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
        {/* Glossy top edge reflection */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent opacity-50" />
        
        <div className="flex flex-col items-center text-center">
          {/* Animated 3D-like Logo Placeholder */}
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner ring-1 ring-white/5 backdrop-blur-md">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          <p className="auth-eyebrow mb-3 text-[11px] font-bold tracking-[0.3em]">
            Intervai Platform
          </p>
          
          <h1 className="font-heading mt-1 text-3xl font-black tracking-widest text-white uppercase sm:text-4xl">
            System Access
          </h1>
          
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Authenticate with your authorized GitHub account to enter the dashboard.
          </p>
        </div>

        <div className="mt-10 mb-2">
          <Button
            type="button"
            variant="ghost"
            className="group relative h-14 w-full overflow-hidden rounded-xl border border-white/20 bg-white/5 text-white transition-all duration-300 hover:bg-white/10 hover:border-white/40 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98]"
            onClick={handleLogin}
          >
            {/* Shine effect on hover */}
            <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
              <div className="relative h-full w-12 bg-white/20 blur-[4px]" />
            </div>
            
            <div className="relative z-10 flex items-center justify-center gap-3">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5 transition-transform duration-300 group-hover:scale-110"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.093.682-.217.682-.483 0-.237-.008-.866-.013-1.7-2.782.605-3.369-1.344-3.369-1.344-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.607.069-.607 1.004.071 1.532 1.033 1.532 1.033.892 1.53 2.341 1.088 2.91.833.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.03-2.688-.103-.253-.447-1.272.098-2.65 0 0 .84-.27 2.75 1.027A9.56 9.56 0 0 1 12 6.844c.85.004 1.705.115 2.503.337 1.909-1.297 2.748-1.027 2.748-1.027.547 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.337-.012 2.417-.012 2.747 0 .269.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z" />
              </svg>
              <span className="font-semibold tracking-wide">Continue with GitHub</span>
            </div>
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent to-white/10" />
          <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Secure Connection
          </span>
          <div className="h-px w-full bg-gradient-to-l from-transparent to-white/10" />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500/80">
          UI layout only. No backend integration.
        </p>
      </section>
    </main>
  )
}

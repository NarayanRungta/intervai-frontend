"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { 
  Clock, 
  Settings2, 
  Play, 
  BriefcaseBusiness,
  Activity,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { listInterviewSummaries, type InterviewSummaryView } from "@/actions/interview";

export default function DashboardPage() {
  const { data } = authClient.useSession();
  const user = data?.user;
  const router = useRouter();

  const [duration, setDuration] = useState([15]);
  const [selectedTopic, setSelectedTopic] = useState("react");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [tone, setTone] = useState("professional");
  const [customContext, setCustomContext] = useState("");
  const [history, setHistory] = useState<InterviewSummaryView[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (!user?.id) {
        setHistory([]);
        setIsHistoryLoading(false);
        setHistoryError("");
        return;
      }

      setIsHistoryLoading(true);
      setHistoryError("");

      const result = await listInterviewSummaries();
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setHistory([]);
        setHistoryError(result.error);
        setIsHistoryLoading(false);
        return;
      }

      setHistory(result.data);
      setIsHistoryLoading(false);
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const launchInterview = () => {
    if (!user) {
      router.push("/login");
      return;
    }

    const params = new URLSearchParams({
      topic: selectedTopic,
      duration: String(duration[0]),
      difficulty,
      tone,
    });

    const contextValue = customContext.trim();
    if (contextValue) {
      params.set("context", contextValue.slice(0, 1200));
    }

    router.push(`/interview?${params.toString()}`);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) {
      return "-";
    }

    return new Date(iso).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#020817] font-sans text-slate-50 selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-900/20 via-[#020817] to-[#020817]"></div>
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-slate-800 bg-[#020817]/60 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-widest text-slate-200">INTERV<span className="text-blue-500">AI</span></span>
          <span className="ml-4 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">Dashboard</span>
        </div>
        
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-400">Welcome back, {user.name?.split(' ')[0] ?? "User"}</span>
            {user.image ? (
              <img src={user.image} alt={user.name} className="h-8 w-8 rounded-full border border-blue-500/50" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 text-xs font-semibold text-blue-100">
                {user.name?.slice(0, 2).toUpperCase() ?? "GH"}
              </div>
            )}
          </div>
        ) : (
          <a href="/login" className="text-sm font-semibold text-blue-400 hover:text-blue-300">Sign In</a>
        )}
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Configure Interview</h1>
          <p className="mt-2 text-slate-400 text-lg">Define parameters, adjust behavior, and configure the AI agent for your next candidate.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          
          {/* Left Column: Form Settings */}
          <div className="md:col-span-2 space-y-6">
            <Card className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-slate-200">
                  <BriefcaseBusiness className="h-5 w-5 text-blue-400" /> 
                  Role & Context
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Specify the position details so the AI tailors its vocabulary and rigor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-slate-300">Target Role / Position</Label>
                  <Select defaultValue="frontend">
                    <SelectTrigger className="border-slate-800 bg-slate-950/50 text-slate-100 focus:ring-blue-500">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                      <SelectItem value="frontend">Frontend Engineer</SelectItem>
                      <SelectItem value="backend">Backend Engineer</SelectItem>
                      <SelectItem value="fullstack">Full Stack Engineer</SelectItem>
                      <SelectItem value="devops">DevOps / SRE</SelectItem>
                      <SelectItem value="pm">Product Manager</SelectItem>
                      <SelectItem value="data">Data Scientist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">Primary Interview Domain / Topics</Label>
                  <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                    <SelectTrigger className="border-slate-800 bg-slate-950/50 text-slate-100 focus:ring-blue-500">
                      <SelectValue placeholder="Select interview topics" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                      <SelectItem value="react">React, Next.js & UI Architecture</SelectItem>
                      <SelectItem value="node">Node.js, APIs & Microservices</SelectItem>
                      <SelectItem value="sysdesign">Distributed Systems & Scalability</SelectItem>
                      <SelectItem value="behavioral">Behavioral, Leadership & Culture</SelectItem>
                      <SelectItem value="python">Python, AI & Data Engineering</SelectItem>
                      <SelectItem value="agile">Agile, Product Strategy & Execution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 pt-2">
                  <Label htmlFor="custom-context" className="text-slate-300">Additional Context (Optional)</Label>
                  <Textarea 
                    id="custom-context" 
                    placeholder="Provide any specific custom questions or company context..." 
                    value={customContext}
                    onChange={(event) => setCustomContext(event.target.value)}
                    className="min-h-20 resize-none border-slate-800 bg-slate-950/50 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-slate-200">
                  <Settings2 className="h-5 w-5 text-blue-400" />
                  Agent Parameters
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Configure the difficulty and tone of the AI interviewer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 flex flex-col sm:flex-row gap-6 sm:space-y-0">
                <div className="flex-1 space-y-2">
                  <Label className="text-slate-300">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="border-slate-800 bg-slate-950/50 text-slate-100 focus:ring-blue-500">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                      <SelectItem value="beginner">Beginner / Junior</SelectItem>
                      <SelectItem value="intermediate">Intermediate / Mid-Level</SelectItem>
                      <SelectItem value="advanced">Advanced / Senior</SelectItem>
                      <SelectItem value="expert">Expert / Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1 space-y-2">
                  <Label className="text-slate-300">AI Personality / Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="border-slate-800 bg-slate-950/50 text-slate-100 focus:ring-blue-500">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                      <SelectItem value="casual">Casual & Friendly</SelectItem>
                      <SelectItem value="professional">Formal & Professional</SelectItem>
                      <SelectItem value="strict">Strict & Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Timing and Launch */}
          <div className="space-y-6">
            <Card className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-slate-200">
                  <Clock className="h-5 w-5 text-blue-400" />
                  Time Allocation
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Set the duration for the live interview session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-slate-300">Interview Length (Mins)</Label>
                    <span className="text-blue-400 font-bold">{duration[0]} min</span>
                  </div>
                  
                  <Slider 
                    value={duration} 
                    onValueChange={setDuration} 
                    max={60} 
                    min={10} 
                    step={5} 
                    className="py-2" 
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>10m</span>
                    <span>30m</span>
                    <span>60m</span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800/60">
                  <Label className="text-slate-300">Quick Select</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDuration([15])}
                      className={`border-slate-700 hover:bg-slate-800 hover:text-white ${duration[0] === 15 ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-900/50 text-slate-400'}`}
                    >
                      15 min
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDuration([30])}
                      className={`border-slate-700 hover:bg-slate-800 hover:text-white ${duration[0] === 30 ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-900/50 text-slate-400'}`}
                    >
                      30 min
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDuration([45])}
                      className={`border-slate-700 hover:bg-slate-800 hover:text-white ${duration[0] === 45 ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-900/50 text-slate-400'}`}
                    >
                      45 min
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDuration([60])}
                      className={`border-slate-700 hover:bg-slate-800 hover:text-white ${duration[0] === 60 ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-900/50 text-slate-400'}`}
                    >
                      60 min
                    </Button>
                  </div>
                </div>

              </CardContent>
              <CardFooter className="pt-2">
                <Button
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={launchInterview}
                >
                  <Play className="mr-2 h-4 w-4" fill="currentColor" />
                  Launch Interview
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        <section className="mt-12 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Previous Interview Summaries</h2>
              <p className="mt-1 text-sm text-slate-400">
                Review final score, AI judgement summary, clothing score, and improvement points from past sessions.
              </p>
            </div>
          </div>

          {isHistoryLoading ? (
            <Card className="border-slate-800 bg-slate-900/40">
              <CardContent className="flex items-center gap-2 px-4 py-4 text-sm text-slate-300">
                <Clock className="h-4 w-4 animate-pulse text-blue-400" />
                Loading interview history...
              </CardContent>
            </Card>
          ) : null}

          {!isHistoryLoading && historyError ? (
            <Card className="border-rose-500/40 bg-rose-500/10">
              <CardContent className="px-4 py-4 text-sm text-rose-100">{historyError}</CardContent>
            </Card>
          ) : null}

          {!isHistoryLoading && !historyError && history.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/40">
              <CardContent className="px-4 py-4 text-sm text-slate-300">
                No interview summaries yet. Launch your first interview to generate reports.
              </CardContent>
            </Card>
          ) : null}

          {!isHistoryLoading && !historyError && history.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {history.map((item) => (
                <Card key={item.interviewId} className="border-slate-800 bg-slate-900/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-slate-100">{item.topic}</CardTitle>
                        <CardDescription className="mt-1 text-slate-400">
                          {item.difficulty} • {item.tone}
                        </CardDescription>
                      </div>
                      <div
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          item.status === "completed"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        {item.status}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-300">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Final Score</div>
                        <div className="mt-1 font-semibold text-blue-200">{item.finalScore ?? "-"}</div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Clothing Score</div>
                        <div className="mt-1 font-semibold text-blue-200">{item.outfitRating ?? "-"}</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">Started: {formatDate(item.startedAt)}</div>
                    <div className="text-xs text-slate-400">Completed: {formatDate(item.completedAt)}</div>
                    <div className="text-xs text-slate-400">Answers: {item.turnsCount}</div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">AI Summary</div>
                      <div className="text-sm text-slate-200">{item.summary ?? "Summary will appear once interview is completed."}</div>
                    </div>

                    {item.topImprovements.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Top Improvements</div>
                        {item.topImprovements.map((point, index) => (
                          <div key={`${item.interviewId}-improvement-${index}`} className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 text-xs text-slate-300">
                            {point}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                      onClick={() => router.push(`/interview?interviewId=${encodeURIComponent(item.interviewId)}`)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Full Report
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

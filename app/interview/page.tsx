"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Maximize2,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  completeInterview,
  getInterviewSession,
  saveInterviewOutfitReport,
  startInterview,
  submitInterviewAnswer,
  type FinalInterviewReport,
  type InterviewSessionView,
} from "@/actions/interview";
import { rateInterviewOutfit, type OutfitRatingReport } from "@/actions/ai";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMonitoringSocket } from "@/src/hooks/use-monitoring-socket";
import type { MonitoringViolationSeverity } from "@/src/types/monitoring";

type InterviewPhase =
  | "idle"
  | "interviewer-speaking"
  | "candidate-answering"
  | "processing";

type SecurityViolationCode =
  | "camera-permission"
  | "camera-unavailable"
  | "fullscreen-required"
  | "devtools-detected"
  | "copy-paste-detected";

type SecurityViolation = {
  code: SecurityViolationCode;
  message: string;
};

function getCameraFailureDetails(error: unknown, permissionState: PermissionState | null): SecurityViolation {
  const domError = error instanceof DOMException ? error : null;
  const errorName = domError?.name ?? "UnknownError";

  if (errorName === "NotAllowedError" || errorName === "SecurityError" || permissionState === "denied") {
    return {
      code: "camera-permission",
      message: "Camera permission was denied. Grant camera access in browser settings and try again.",
    };
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return {
      code: "camera-unavailable",
      message: "No camera device was found. Connect a camera and try again.",
    };
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return {
      code: "camera-unavailable",
      message: "Camera is busy in another app. Close camera-using apps and re-enable secure mode.",
    };
  }

  if (errorName === "OverconstrainedError") {
    return {
      code: "camera-unavailable",
      message: "Requested camera quality is unsupported on this device. Re-enable secure mode to retry with fallback settings.",
    };
  }

  return {
    code: "camera-unavailable",
    message: "Unable to start secure camera session. Check camera availability and browser permissions, then try again.",
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function getPhaseLabel(phase: InterviewPhase) {
  if (phase === "interviewer-speaking") {
    return "Interviewer speaking";
  }

  if (phase === "candidate-answering") {
    return "Listening to your answer";
  }

  if (phase === "processing") {
    return "Analyzing your response";
  }

  return "Ready";
}

function getPhaseClasses(phase: InterviewPhase) {
  if (phase === "interviewer-speaking") {
    return "border-blue-400/40 bg-blue-500/10 text-blue-200";
  }

  if (phase === "candidate-answering") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  }

  if (phase === "processing") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  }

  return "border-slate-700 bg-slate-900/70 text-slate-300";
}

function getRiskLabel(score: number) {
  if (score >= 70) {
    return "high";
  }

  if (score >= 40) {
    return "medium";
  }

  return "low";
}

function getRiskClasses(score: number) {
  if (score >= 70) {
    return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  }

  if (score >= 40) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }

  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
}

function getSeverityBadgeClasses(severity: MonitoringViolationSeverity) {
  if (severity === "critical") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  }

  if (severity === "high") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-100";
  }

  if (severity === "medium") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }

  return "border-blue-500/40 bg-blue-500/10 text-blue-100";
}

function formatSeverityLabel(severity: MonitoringViolationSeverity) {
  if (severity === "critical") {
    return "Critical";
  }

  if (severity === "high") {
    return "High";
  }

  if (severity === "medium") {
    return "Medium";
  }

  return "Low";
}

function ReportList({ title, points }: { title: string; points: string[] }) {
  return (
    <Card className="border-slate-800 bg-slate-900/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-100">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-300">
        {points.map((point, index) => (
          <div key={`${title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
            {point}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function InterviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: authData, isPending: isAuthPending } = authClient.useSession();

  const [session, setSession] = useState<InterviewSessionView | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [answerDraft, setAnswerDraft] = useState("");
  const [isTextEditorVisible, setIsTextEditorVisible] = useState(false);
  const [error, setError] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [interviewPhase, setInterviewPhase] = useState<InterviewPhase>("idle");
  const [isSecureModeReady, setIsSecureModeReady] = useState(false);
  const [isSecureModeBooting, setIsSecureModeBooting] = useState(false);
  const [securityViolation, setSecurityViolation] = useState<SecurityViolation | null>(null);
  const [outfitReport, setOutfitReport] = useState<OutfitRatingReport | null>(null);
  const [isOutfitAnalyzing, setIsOutfitAnalyzing] = useState(false);
  const [outfitAnalysisError, setOutfitAnalysisError] = useState("");

  const initializedRef = useRef(false);
  const autoCompleteTriggeredRef = useRef(false);
  const spokenQuestionRef = useRef<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const outfitRatedInterviewRef = useRef<string | null>(null);

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  const isMonitoringEnabled = Boolean(session && session.status === "active" && isSecureModeReady);

  const {
    socketState,
    healthState,
    backendConnectivityError,
    integrityScore,
    riskScore,
    activeViolation,
    dismissActiveViolation,
  } = useMonitoringSocket({
    enabled: isMonitoringEnabled,
  });

  const stopCameraStream = useCallback(() => {
    if (!cameraStreamRef.current) {
      return;
    }

    for (const track of cameraStreamRef.current.getTracks()) {
      track.stop();
    }

    cameraStreamRef.current = null;
  }, []);

  const getCameraPermissionState = useCallback(async (): Promise<PermissionState | null> => {
    if (typeof window === "undefined" || !navigator.permissions?.query) {
      return null;
    }

    try {
      const status = await navigator.permissions.query({ name: "camera" as PermissionName });
      return status.state;
    } catch {
      return null;
    }
  }, []);

  const requestCameraStream = useCallback(async (): Promise<MediaStream> => {
    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: "user",
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let lastError: unknown = null;

    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Unable to access camera stream.");
  }, []);

  const captureOutfitFrame = useCallback(async () => {
    if (typeof window === "undefined" || !cameraStreamRef.current) {
      return null;
    }

    const video = document.createElement("video");
    video.srcObject = cameraStreamRef.current;
    video.muted = true;
    video.playsInline = true;

    await video.play().catch(() => undefined);

    await new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => resolve(), 1200);
      video.onloadeddata = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
    });

    const sourceWidth = video.videoWidth > 0 ? video.videoWidth : 640;
    const sourceHeight = video.videoHeight > 0 ? video.videoHeight : 480;
    const targetWidth = Math.min(sourceWidth, 960);
    const targetHeight = Math.max(1, Math.round((targetWidth / sourceWidth) * sourceHeight));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      video.pause();
      video.srcObject = null;
      return null;
    }

    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);

    video.pause();
    video.srcObject = null;
    return dataUrl;
  }, []);

  const runOutfitAssessment = useCallback(async () => {
    if (!session || session.status !== "active" || isOutfitAnalyzing) {
      return;
    }

    if (outfitRatedInterviewRef.current === session.interviewId) {
      return;
    }

    const capturedFrame = await captureOutfitFrame();
    if (!capturedFrame) {
      setOutfitAnalysisError("Outfit report could not be generated because a camera frame was unavailable.");
      return;
    }

    setIsOutfitAnalyzing(true);
    setOutfitAnalysisError("");

    try {
      const result = await rateInterviewOutfit({
        imageDataUrl: capturedFrame,
        topic: session.topic,
        difficulty: session.difficulty,
        tone: session.tone,
      });

      if (!result.ok) {
        setOutfitAnalysisError(result.error);
        return;
      }

      setOutfitReport(result.data);

      const persistResult = await saveInterviewOutfitReport({
        interviewId: session.interviewId,
        outfitReport: result.data,
      });

      if (!persistResult.ok) {
        setOutfitAnalysisError(persistResult.error);
      }

      outfitRatedInterviewRef.current = session.interviewId;
    } finally {
      setIsOutfitAnalyzing(false);
    }
  }, [captureOutfitFrame, isOutfitAnalyzing, session]);

  const triggerSecurityViolation = useCallback((code: SecurityViolationCode, message: string) => {
    setSecurityViolation((current) => {
      if (current?.code === code && current.message === message) {
        return current;
      }

      return { code, message };
    });
    setIsSecureModeReady(false);
    stopCameraStream();
  }, [stopCameraStream]);

  const enableSecureMode = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !session ||
      session.status !== "active" ||
      isSecureModeBooting
    ) {
      return;
    }

    setIsSecureModeBooting(true);
    setIsSecureModeReady(false);
    setSecurityViolation(null);
    setError("");
    stopCameraStream();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        triggerSecurityViolation(
          "camera-unavailable",
          "Camera API is not available in this browser. Secure interview mode cannot start."
        );
        return;
      }

      const prePermissionState = await getCameraPermissionState();
      if (prePermissionState === "denied") {
        triggerSecurityViolation(
          "camera-permission",
          "Camera permission is blocked. Allow camera access in browser settings to continue."
        );
        return;
      }

      const fullscreenRequest = document.fullscreenElement
        ? Promise.resolve(true)
        : document.documentElement
            .requestFullscreen()
            .then(() => true)
            .catch(() => false);

      let stream: MediaStream | null = null;
      let streamError: unknown = null;

      try {
        stream = await requestCameraStream();
      } catch (error) {
        streamError = error;
      }

      const fullscreenReady = await fullscreenRequest;

      if (!fullscreenReady || !document.fullscreenElement) {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        triggerSecurityViolation(
          "fullscreen-required",
          "Fullscreen mode is mandatory for this interview. Exiting fullscreen is not allowed."
        );
        return;
      }

      if (!stream) {
        const postPermissionState = await getCameraPermissionState();
        const isBusyCameraError =
          streamError instanceof DOMException &&
          (streamError.name === "NotReadableError" || streamError.name === "TrackStartError");

        if (isBusyCameraError && postPermissionState === "granted") {
          setIsSecureModeReady(true);
          return;
        }

        const failure = getCameraFailureDetails(streamError, postPermissionState);
        triggerSecurityViolation(failure.code, failure.message);
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        stream.getTracks().forEach((track) => track.stop());
        triggerSecurityViolation(
          "camera-unavailable",
          "Working camera stream not detected. Please connect and allow your camera."
        );
        return;
      }

      videoTrack.onended = () => {
        triggerSecurityViolation("camera-unavailable", "Camera access was removed during interview. This is not allowed.");
      };
      videoTrack.onmute = () => {
        if (videoTrack.muted) {
          triggerSecurityViolation("camera-unavailable", "Camera feed became unavailable during interview. This is not allowed.");
        }
      };

      cameraStreamRef.current = stream;

      setIsSecureModeReady(true);
      void runOutfitAssessment();
    } catch (error) {
      const permissionState = await getCameraPermissionState();
      const failure = getCameraFailureDetails(error, permissionState);
      triggerSecurityViolation(failure.code, failure.message);
    } finally {
      setIsSecureModeBooting(false);
    }
  }, [
    getCameraPermissionState,
    isSecureModeBooting,
    requestCameraStream,
    runOutfitAssessment,
    session,
    stopCameraStream,
    triggerSecurityViolation,
  ]);

  const hasActiveMonitoringViolation = Boolean(isMonitoringEnabled && activeViolation);
  const hasBlockingViolation = Boolean(hasActiveMonitoringViolation || securityViolation);
  const monitorStatusLabel = isMonitoringEnabled ? `${socketState}/${healthState}` : "off";
  const monitorHealthy = isMonitoringEnabled && socketState === "open" && healthState === "ok";
  const displayedIntegrityScore = isMonitoringEnabled ? integrityScore : 100;
  const displayedRiskScore = isMonitoringEnabled ? riskScore : 0;

  const queryParams = useMemo(() => {
    const interviewId = searchParams.get("interviewId");
    const topic = searchParams.get("topic") ?? "react";
    const durationRaw = Number(searchParams.get("duration") ?? "15");
    const duration = Number.isFinite(durationRaw) ? clampNumber(Math.round(durationRaw), 5, 120) : 15;
    const difficulty = searchParams.get("difficulty") ?? "intermediate";
    const tone = searchParams.get("tone") ?? "professional";
    const customContext = (searchParams.get("context") ?? "").slice(0, 1200);

    return {
      interviewId,
      topic,
      duration,
      difficulty,
      tone,
      customContext,
    };
  }, [searchParams]);

  const speakQuestion = useCallback((text: string) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;

      const englishVoice = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith("en"));

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const applySession = useCallback((nextSession: InterviewSessionView) => {
    setSession(nextSession);
    setSecondsRemaining(nextSession.secondsRemaining);
    autoCompleteTriggeredRef.current = nextSession.status === "completed";

    if (nextSession.status === "completed") {
      setInterviewPhase("idle");
    }
  }, []);

  const initializeInterview = useCallback(async () => {
    setIsBooting(true);
    setInterviewPhase("processing");
    setError("");

    try {
      if (queryParams.interviewId) {
        const result = await getInterviewSession({ interviewId: queryParams.interviewId });
        if (!result.ok) {
          setError(result.error);
          return;
        }

        applySession(result.data);
        return;
      }

      const result = await startInterview({
        topic: queryParams.topic,
        durationMinutes: queryParams.duration,
        difficulty: queryParams.difficulty,
        tone: queryParams.tone,
        customContext: queryParams.customContext,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      applySession(result.data);
      router.replace(`/interview?interviewId=${encodeURIComponent(result.data.interviewId)}`);
    } finally {
      setIsBooting(false);
      setInterviewPhase("idle");
    }
  }, [applySession, queryParams, router]);

  const handleCompleteInterview = useCallback(async () => {
    if (!session) {
      return;
    }

    void SpeechRecognition.stopListening();
    setIsCompleting(true);
    setInterviewPhase("processing");
    setError("");

    const result = await completeInterview({ interviewId: session.interviewId });

    if (!result.ok) {
      setError(result.error);
      setIsCompleting(false);
      setInterviewPhase("idle");
      return;
    }

    applySession(result.data);
    setIsCompleting(false);
  }, [applySession, session]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!session || session.status !== "active") {
      return;
    }

    if (hasActiveMonitoringViolation || securityViolation || !isSecureModeReady) {
      setError("Resolve active monitoring alert before submitting your answer.");
      return;
    }

    void SpeechRecognition.stopListening();

    const finalAnswer = transcript.trim() || answerDraft.trim();
    if (!finalAnswer) {
      setError("Please provide an answer before continuing.");
      return;
    }

    setIsSubmitting(true);
    setInterviewPhase("processing");
    setError("");

    const result = await submitInterviewAnswer({
      interviewId: session.interviewId,
      answer: finalAnswer,
    });

    if (!result.ok) {
      setError(result.error);
      setIsSubmitting(false);
      setInterviewPhase("idle");
      return;
    }

    spokenQuestionRef.current = null;
    applySession(result.data);
    setAnswerDraft("");
    resetTranscript();
    setIsSubmitting(false);
  }, [answerDraft, applySession, hasActiveMonitoringViolation, isSecureModeReady, resetTranscript, securityViolation, session, transcript]);

  const startVoiceAnswer = useCallback(async () => {
    if (
      !session ||
      session.status !== "active" ||
      !browserSupportsSpeechRecognition ||
      hasActiveMonitoringViolation ||
      securityViolation ||
      !isSecureModeReady
    ) {
      return;
    }

    setError("");
    setInterviewPhase("candidate-answering");
    await SpeechRecognition.startListening({
      language: "en-US",
      continuous: true,
    });
  }, [browserSupportsSpeechRecognition, hasActiveMonitoringViolation, isSecureModeReady, securityViolation, session]);

  const stopVoiceAnswer = useCallback(async () => {
    await SpeechRecognition.stopListening();
    if (!isSubmitting && !isCompleting) {
      setInterviewPhase("idle");
    }
  }, [isCompleting, isSubmitting]);

  useEffect(() => {
    if (isAuthPending) {
      return;
    }

    if (!authData?.user || initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void initializeInterview();
  }, [authData?.user, initializeInterview, isAuthPending]);

  useEffect(() => {
    if (!session || session.status !== "active") {
      return;
    }

    setSecondsRemaining(session.secondsRemaining);
    const timer = window.setInterval(() => {
      setSecondsRemaining((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session?.interviewId, session?.secondsRemaining, session?.status, session]);

  useEffect(() => {
    if (!session || session.status !== "active") {
      return;
    }

    if (secondsRemaining > 0 || autoCompleteTriggeredRef.current) {
      return;
    }

    autoCompleteTriggeredRef.current = true;
    void handleCompleteInterview();
  }, [handleCompleteInterview, secondsRemaining, session]);

  useEffect(() => {
    if (!session || session.status !== "active" || !session.currentQuestion) {
      return;
    }

    if (!isSecureModeReady) {
      return;
    }

    if (spokenQuestionRef.current === session.currentQuestion) {
      return;
    }

    spokenQuestionRef.current = session.currentQuestion;
    let cancelled = false;

    const runVoiceCycle = async () => {
      await SpeechRecognition.stopListening();
      setInterviewPhase("interviewer-speaking");
      await speakQuestion(session.currentQuestion || "");

      if (cancelled || session.status !== "active" || !isSecureModeReady) {
        return;
      }

      if (browserSupportsSpeechRecognition) {
        await SpeechRecognition.startListening({
          language: "en-US",
          continuous: true,
        });
        if (!cancelled) {
          setInterviewPhase("candidate-answering");
        }
      } else if (!cancelled) {
        setInterviewPhase("idle");
      }
    };

    void runVoiceCycle();

    return () => {
      cancelled = true;
    };
  }, [browserSupportsSpeechRecognition, isSecureModeReady, session, speakQuestion]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
      }
      void SpeechRecognition.stopListening();
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    if (!listening) {
      return;
    }

    if (transcript.trim()) {
      setAnswerDraft(transcript.trim());
    }
  }, [listening, transcript]);

  useEffect(() => {
    if (!isMonitoringEnabled || !activeViolation) {
      return;
    }

    void SpeechRecognition.stopListening();
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }

    if (!isSubmitting && !isCompleting) {
      setInterviewPhase("idle");
    }
  }, [activeViolation, isCompleting, isMonitoringEnabled, isSubmitting]);

  useEffect(() => {
    if (!isMonitoringEnabled || !activeViolation) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissActiveViolation();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeViolation, dismissActiveViolation, isMonitoringEnabled]);

  useEffect(() => {
    if (!securityViolation) {
      return;
    }

    void SpeechRecognition.stopListening();
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }

    if (!isSubmitting && !isCompleting) {
      setInterviewPhase("idle");
    }
  }, [isCompleting, isSubmitting, securityViolation]);

  useEffect(() => {
    if (!session?.interviewId) {
      setOutfitReport(null);
      setOutfitAnalysisError("");
      setIsOutfitAnalyzing(false);
      outfitRatedInterviewRef.current = null;
      return;
    }

    if (outfitRatedInterviewRef.current && outfitRatedInterviewRef.current !== session.interviewId) {
      setOutfitReport(null);
      setOutfitAnalysisError("");
      setIsOutfitAnalyzing(false);
      outfitRatedInterviewRef.current = null;
    }
  }, [session?.interviewId]);

  useEffect(() => {
    if (!session || session.status !== "active") {
      setIsSecureModeReady(false);
      setIsSecureModeBooting(false);
      setSecurityViolation(null);
      stopCameraStream();
      return;
    }

    setIsSecureModeReady(false);
    setIsSecureModeBooting(false);
    setSecurityViolation(null);
    stopCameraStream();
  }, [session, stopCameraStream]);

  useEffect(() => {
    if (!session || session.status !== "active" || !isSecureModeReady) {
      return;
    }

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerSecurityViolation(
          "fullscreen-required",
          "Fullscreen mode was exited during interview. This action is not allowed."
        );
      }
    };

    const onCopyOrPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      triggerSecurityViolation(
        "copy-paste-detected",
        "Copy, cut, and paste actions are blocked in secure interview mode."
      );
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      triggerSecurityViolation("copy-paste-detected", "Right-click and context actions are not allowed during interview.");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      const attemptedDevtools =
        event.key === "F12" ||
        (ctrlOrMeta && event.shiftKey && ["i", "j", "c", "k"].includes(key)) ||
        (ctrlOrMeta && key === "u");

      const attemptedClipboard = ctrlOrMeta && ["c", "v", "x"].includes(key);

      if (attemptedDevtools) {
        event.preventDefault();
        triggerSecurityViolation("devtools-detected", "Developer tools access is not allowed during interview.");
        return;
      }

      if (attemptedClipboard) {
        event.preventDefault();
        triggerSecurityViolation(
          "copy-paste-detected",
          "Copy, cut, and paste shortcuts are blocked in secure interview mode."
        );
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("copy", onCopyOrPaste);
    document.addEventListener("cut", onCopyOrPaste);
    document.addEventListener("paste", onCopyOrPaste);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("copy", onCopyOrPaste);
      document.removeEventListener("cut", onCopyOrPaste);
      document.removeEventListener("paste", onCopyOrPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSecureModeReady, session, triggerSecurityViolation]);

  if (!isAuthPending && !authData?.user) {
    return (
      <div className="min-h-screen bg-[#020817] px-4 py-12 text-slate-100">
        <div className="mx-auto max-w-xl">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription className="text-slate-400">
                This interview flow is linked to your account session and persisted in the database.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => router.push("/login")}>Go to Login</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const finalReport: FinalInterviewReport | null = session?.finalReport ?? null;
  const effectiveOutfitReport = finalReport?.outfitReport ?? outfitReport;

  if (isMonitoringEnabled && backendConnectivityError && session?.status === "active") {
    throw new Error(backendConnectivityError);
  }

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100 selection:bg-blue-500/30">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_35%)]" />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              Voice-First Session
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Professional Interview</h1>
            <p className="mt-2 text-slate-300">
              Topic: {session?.topic ?? "Preparing..."} • Difficulty: {session?.difficulty ?? "-"} • Tone: {session?.tone ?? "-"}
            </p>
          </div>

          <Card className="border-slate-800 bg-slate-900/50 md:min-w-60">
            <CardContent className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Clock3 className="h-4 w-4 text-blue-300" />
                Time Remaining
              </div>
              <div className={`text-lg font-bold ${secondsRemaining < 60 ? "text-rose-300" : "text-blue-300"}`}>
                {formatDuration(secondsRemaining)}
              </div>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <Card className="mb-6 border-rose-500/40 bg-rose-500/10">
            <CardContent className="px-4 py-3 text-sm text-rose-100">{error}</CardContent>
          </Card>
        ) : null}

        {isBooting || !session ? (
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="flex items-center gap-3 px-4 py-6 text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing your interview environment...
            </CardContent>
          </Card>
        ) : null}

        {!isBooting && session && session.status === "active" ? (
          <div className="space-y-5 auth-fade-up">
            {!isSecureModeReady ? (
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardHeader>
                  <CardTitle className="text-amber-100">Secure Mode Required</CardTitle>
                  <CardDescription className="text-amber-50/90">
                    Camera permission and fullscreen mode are mandatory. Copy/paste and developer tools are blocked.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-amber-500/30 bg-slate-950/40 px-3 py-2 text-xs text-amber-100">
                    <Camera className="mb-1 h-4 w-4" />
                    Working camera permission is required
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-slate-950/40 px-3 py-2 text-xs text-amber-100">
                    <Maximize2 className="mb-1 h-4 w-4" />
                    Fullscreen mode must remain active
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="button"
                    className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                    onClick={() => void enableSecureMode()}
                    disabled={isSecureModeBooting}
                  >
                    {isSecureModeBooting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enabling Secure Mode...
                      </>
                    ) : (
                      "Enable Secure Interview Mode"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wider ${getPhaseClasses(interviewPhase)}`}>
                <Radio className="h-3.5 w-3.5" />
                {getPhaseLabel(interviewPhase)}
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                {listening ? <Mic className="h-3.5 w-3.5 text-emerald-300" /> : <MicOff className="h-3.5 w-3.5 text-slate-500" />}
                {listening ? "Mic Live" : "Mic Idle"}
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                {monitorHealthy ? <Wifi className="h-3.5 w-3.5 text-emerald-300" /> : <WifiOff className="h-3.5 w-3.5 text-amber-300" />}
                Monitor: {monitorStatusLabel}
              </div>

              <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wider ${getRiskClasses(displayedRiskScore)}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Integrity {displayedIntegrityScore} • {getRiskLabel(displayedRiskScore)}
              </div>
            </div>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-2xl">Question {session.currentQuestionIndex}</CardTitle>
                <CardDescription className="text-slate-400">
                  Voice-first mode is active. Speak naturally, then submit your response.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 text-slate-100">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-300">
                    <Headphones className="h-3.5 w-3.5" />
                    Interviewer Prompt
                  </div>
                  <div className="text-lg leading-relaxed">{session.currentQuestion ?? "Generating your next question..."}</div>
                </div>

                {browserSupportsSpeechRecognition ? (
                  <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        className="bg-blue-600 text-white hover:bg-blue-500"
                        onClick={() => void startVoiceAnswer()}
                        disabled={
                          listening ||
                          isSubmitting ||
                          isCompleting ||
                          hasBlockingViolation ||
                          !isSecureModeReady ||
                          interviewPhase === "interviewer-speaking"
                        }
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        Start Voice Capture
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                        onClick={() => void stopVoiceAnswer()}
                        disabled={!listening}
                      >
                        <MicOff className="mr-2 h-4 w-4" />
                        Pause Capture
                      </Button>

                      <div className={`inline-flex items-center gap-1.5 text-xs ${listening ? "text-emerald-300" : "text-slate-500"}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${listening ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                        {listening ? "Listening..." : "Waiting"}
                      </div>
                    </div>

                    {transcript ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Live transcript</div>
                        <div className="line-clamp-5">{transcript}</div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-400">
                        Text editor is optional and hidden by default.
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-slate-300 hover:bg-slate-800"
                        onClick={() => setIsTextEditorVisible((current) => !current)}
                      >
                        {isTextEditorVisible ? "Hide text editor" : "Use text editor"}
                      </Button>
                    </div>

                    {isTextEditorVisible ? (
                      <div className="space-y-2">
                        <Label htmlFor="candidate-answer" className="text-slate-300">
                          Candidate response draft
                        </Label>
                        <Textarea
                          id="candidate-answer"
                          value={answerDraft}
                          onChange={(event) => setAnswerDraft(event.target.value)}
                          placeholder="Voice transcript appears here. Edit only if needed."
                          className="min-h-28 border-slate-800 bg-slate-950/50 text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                    Your browser does not support speech recognition. Switch to a supported browser for voice-first mode.
                  </div>
                )}

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                  Keep your response structured: context, approach, trade-offs, and final decision.
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-500"
                  onClick={() => void handleSubmitAnswer()}
                  disabled={
                    isSubmitting ||
                    isCompleting ||
                    hasBlockingViolation ||
                    !isSecureModeReady ||
                    interviewPhase === "interviewer-speaking" ||
                    secondsRemaining === 0 ||
                    (!transcript.trim() && !answerDraft.trim())
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <MicOff className="mr-2 h-4 w-4" />
                      Submit Answer
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                  onClick={() => session.currentQuestion && speakQuestion(session.currentQuestion)}
                  disabled={!session.currentQuestion || isSubmitting || isCompleting}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Replay Prompt
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                  onClick={() => void handleCompleteInterview()}
                  disabled={isCompleting || isSubmitting}
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    "Finish Interview"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : null}

        {!isBooting && session && session.status === "completed" ? (
          <div className="space-y-6">
            <Card className="border-emerald-500/30 bg-emerald-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-100">
                  <CheckCircle2 className="h-5 w-5" />
                  Interview Completed
                </CardTitle>
                <CardDescription className="text-emerald-50/80">
                  Final score: {session.finalScore ?? 0}/100 • Questions answered: {session.turns.length}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle>Outfit Readiness Report</CardTitle>
                <CardDescription className="text-slate-400">
                  Captured from camera once secure mode permission was granted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isOutfitAnalyzing ? (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing interview outfit...
                  </div>
                ) : null}

                {effectiveOutfitReport ? (
                  <>
                    <div className="inline-flex rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                      Total Rating: {effectiveOutfitReport.totalRating}/100
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200">
                      {effectiveOutfitReport.summary}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="border-slate-800 bg-slate-950/40">
                        <CardContent className="p-4">
                          <div className="text-xs uppercase tracking-wider text-slate-400">Professionalism</div>
                          <div className="text-2xl font-bold text-blue-300">{effectiveOutfitReport.categoryScores.professionalism}</div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-800 bg-slate-950/40">
                        <CardContent className="p-4">
                          <div className="text-xs uppercase tracking-wider text-slate-400">Neatness</div>
                          <div className="text-2xl font-bold text-blue-300">{effectiveOutfitReport.categoryScores.neatness}</div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-800 bg-slate-950/40">
                        <CardContent className="p-4">
                          <div className="text-xs uppercase tracking-wider text-slate-400">Color Coordination</div>
                          <div className="text-2xl font-bold text-blue-300">{effectiveOutfitReport.categoryScores.colorCoordination}</div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-800 bg-slate-950/40">
                        <CardContent className="p-4">
                          <div className="text-xs uppercase tracking-wider text-slate-400">Interview Readiness</div>
                          <div className="text-2xl font-bold text-blue-300">{effectiveOutfitReport.categoryScores.interviewReadiness}</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <ReportList title="What Looks Good" points={effectiveOutfitReport.whatLooksGood} />
                      <ReportList title="What To Improve" points={effectiveOutfitReport.whatToImprove} />
                    </div>
                  </>
                ) : null}

                {!isOutfitAnalyzing && !effectiveOutfitReport ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                    {outfitAnalysisError || "Outfit analysis was not available for this session."}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle>Final Insights Report</CardTitle>
                <CardDescription className="text-slate-400">
                  AI-generated assessment summary with measurable interview metrics and improvement points.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-slate-200">
                  {finalReport?.summary ?? "Report generation fallback was used. See scores and per-question feedback below."}
                </div>

                <div className="inline-flex rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                  Recommendation: {finalReport?.hireRecommendation ?? "Hold"}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-wider text-slate-400">Knowledge Depth</div>
                      <div className="text-2xl font-bold text-blue-300">
                        {finalReport?.insightMetrics.knowledgeDepth ?? 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-wider text-slate-400">Problem Solving</div>
                      <div className="text-2xl font-bold text-blue-300">
                        {finalReport?.insightMetrics.problemSolving ?? 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-wider text-slate-400">Communication</div>
                      <div className="text-2xl font-bold text-blue-300">
                        {finalReport?.insightMetrics.communicationClarity ?? 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-wider text-slate-400">Consistency</div>
                      <div className="text-2xl font-bold text-blue-300">
                        {finalReport?.insightMetrics.consistency ?? 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <ReportList title="Key Strengths" points={finalReport?.keyStrengths ?? []} />
                  <ReportList title="Points To Improve" points={finalReport?.improvementAreas ?? []} />
                  <ReportList title="Next Steps" points={finalReport?.nextSteps ?? []} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle>Interview Turn History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.turns.map((turn) => (
                  <div key={turn.id} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-100">Question {turn.questionIndex}</div>
                      <div className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-200">
                        Score {turn.score ?? 0}/10
                      </div>
                    </div>
                    <div className="text-sm text-slate-200">{turn.question}</div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                      {turn.answer}
                    </div>
                    <div className="text-sm text-slate-400">
                      AI judgement: {turn.feedback ?? "Included in final report summary."}
                    </div>
                    {turn.competency ? (
                      <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        Competency: {turn.competency}
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button onClick={() => router.push("/dashboard")} className="bg-blue-600 hover:bg-blue-500">
                  Start Another Interview
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : null}
      </main>

      {isMonitoringEnabled && activeViolation && session?.status === "active" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="monitoring-alert-title"
            className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-slate-900/95 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 id="monitoring-alert-title" className="text-lg font-bold text-slate-100">
                  Monitoring violation detected
                </h2>
                <p className="mt-1 text-sm text-slate-300">{activeViolation.message}</p>
              </div>
            </div>

            <div className="mb-4 grid gap-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Severity</div>
                <div
                  className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getSeverityBadgeClasses(activeViolation.severity)}`}
                >
                  {formatSeverityLabel(activeViolation.severity)}
                </div>
              </div>
            </div>

            {activeViolation.snapshot ? (
              <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
                Eye: {activeViolation.snapshot.eye} • Head: {activeViolation.snapshot.head} • Phone: {String(activeViolation.snapshot.phone)} • Suspicion: {activeViolation.snapshot.suspicion_score.toFixed(2)}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button className="bg-blue-600 text-white hover:bg-blue-500" onClick={dismissActiveViolation}>
                I Understand
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                onClick={() => void handleCompleteInterview()}
                disabled={isCompleting}
              >
                End Interview Now
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {securityViolation && session?.status === "active" ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="security-alert-title"
            className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-slate-900/95 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 id="security-alert-title" className="text-lg font-bold text-slate-100">
                  Action not allowed
                </h2>
                <p className="mt-1 text-sm text-slate-300">{securityViolation.message}</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
              Secure mode checks: camera access, fullscreen lock, copy/paste restriction, and developer-tools monitoring.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-blue-600 text-white hover:bg-blue-500"
                onClick={() => void enableSecureMode()}
                disabled={isSecureModeBooting}
              >
                {isSecureModeBooting ? "Re-checking..." : "Re-enable Secure Mode"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                onClick={() => void handleCompleteInterview()}
                disabled={isCompleting}
              >
                End Interview Now
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
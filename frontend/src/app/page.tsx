"use client";

import { useState, useEffect } from "react";

type Detection = {
  camera: string;
  timestamp: string;
  score: number;
};

export default function Home() {
  const [missingImage, setMissingImage] = useState<File | null>(null);
  const [cam1, setCam1] = useState<File | null>(null);
  const [cam2, setCam2] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<Detection[]>([]);
  const [backendStatus, setBackendStatus] = useState<"connecting" | "online" | "offline">("connecting");

  // Check backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:8001/health");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "Online") {
            setBackendStatus("online");
          } else {
            setBackendStatus("offline");
          }
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll alerts rapidly when session is active
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8001/api/alerts/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.alerts);
        }
      } catch (err) {
        console.error("Failed to poll alerts", err);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleRunAnalysis = async () => {
    if (!missingImage || !cam1 || !cam2) {
      setError("Please provide all required files.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSessionId(null);

    const formData = new FormData();
    formData.append("missing_image", missingImage);
    formData.append("cam1_video", cam1);
    formData.append("cam2_video", cam2);

    try {
      const response = await fetch("http://localhost:8001/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.detail || "Analysis failed on the server.");
      }

      const data = await response.json();
      setSessionId(data.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col items-center py-10 px-4 md:px-20">
      <div className="w-full max-w-6xl space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-black pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight">Surveillance Command Center</h1>
            <p className="text-lg text-gray-600">YOLOv8 Accelerated Person Detection + Real-Time Video Overlays.</p>
          </div>
          
          <div className={`flex items-center gap-3 px-4 py-2 rounded-full border-2 font-bold transition-all ${
            backendStatus === "online" ? "border-green-500 text-green-700 bg-green-50" : 
            backendStatus === "offline" ? "border-red-500 text-red-700 bg-red-50" : 
            "border-gray-300 text-gray-500 bg-gray-50 animate-pulse"
          }`}>
            <span className={`w-3 h-3 rounded-full ${
              backendStatus === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : 
              backendStatus === "offline" ? "bg-red-500" : 
              "bg-gray-400"
            }`}></span>
            {backendStatus === "online" ? "ENGINE ONLINE" : 
             backendStatus === "offline" ? "ENGINE OFFLINE" : 
             "CONNECTING..."}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Inputs */}
          <section className="flex flex-col gap-6 bg-gray-50 border border-gray-200 p-6 rounded-2xl shadow-sm md:col-span-1 h-fit">
            <h2 className="text-2xl font-bold">Input Feeds</h2>
            
            <div className="flex flex-col gap-2">
              <label className="font-semibold">Missing Person Reference Image</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setMissingImage(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-semibold">Camera Feed 1 (MP4)</label>
              <input 
                type="file" 
                accept="video/mp4"
                onChange={(e) => setCam1(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-semibold">Camera Feed 2 (MP4)</label>
              <input 
                type="file" 
                accept="video/mp4"
                onChange={(e) => setCam2(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer"
              />
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={loading || !!sessionId}
              className={`mt-4 py-3 px-6 rounded-full font-bold text-white transition-all shadow-md active:scale-95 ${
                loading || sessionId ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800"
              }`}
            >
              {loading ? "Starting Stream..." : sessionId ? "Stream Active" : "Initiate Live Analysis"}
            </button>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 font-medium">
                {error}
              </div>
            )}
          </section>

          {/* Outputs */}
          <section className="flex flex-col gap-6 md:col-span-2">
            
            {/* Live Streams */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-lg">CAM-1 Stream (2x Speed)</h3>
                <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border-4 border-gray-900 shadow-xl flex items-center justify-center">
                  {sessionId ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={`http://localhost:8001/api/stream/${sessionId}/CAM-1`} alt="CAM-1 Live Feed" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-gray-500 font-medium">
                        {backendStatus === "online" ? "System Ready" : "Awaiting Backend..."}
                      </span>
                      {backendStatus === "online" && <span className="text-xs text-gray-600">Upload feeds to begin</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-lg">CAM-2 Stream (2x Speed)</h3>
                <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border-4 border-gray-900 shadow-xl flex items-center justify-center">
                  {sessionId ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={`http://localhost:8001/api/stream/${sessionId}/CAM-2`} alt="CAM-2 Live Feed" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-gray-500 font-medium">
                        {backendStatus === "online" ? "System Ready" : "Awaiting Backend..."}
                      </span>
                      {backendStatus === "online" && <span className="text-xs text-gray-600">Upload feeds to begin</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-200 w-full my-2"></div>

            <h2 className="text-2xl font-bold flex items-center justify-between">
              <div className="flex items-center gap-3">
                Live Alert Console 
                {sessionId && <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>}
              </div>
              {results.length > 0 && (
                <button 
                  onClick={() => {
                    const blob = new Blob([
                      "Surveillance AI Evidence Report\n",
                      "===========================\n\n",
                      ...results.map(r => `[${r.timestamp}] ${r.camera}: Match Confidence ${(r.score * 100).toFixed(1)}%\n`)
                    ], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `evidence_report_${sessionId?.slice(0,8)}.txt`;
                    a.click();
                  }}
                  className="text-sm bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-all font-bold"
                >
                  Export Evidence
                </button>
              )}
            </h2>

            <div className="flex flex-col gap-4">
              {results.length === 0 ? (
                <div className="p-6 bg-gray-100 rounded-2xl text-center font-medium border border-gray-200 text-gray-500">
                  {sessionId ? "Scanning for targets matching reference footprint..." : "System dormant."}
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-200 rounded-2xl shadow-sm">
                  <table className="w-full text-left bg-white">
                    <thead className="bg-gray-50 uppercase text-xs tracking-wider border-b border-gray-200 font-bold">
                      <tr>
                        <th className="px-6 py-4">Camera</th>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4 text-right">Confidence Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.map((res, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors animate-in fade-in slide-in-from-top-2">
                          <td className="px-6 py-4 font-semibold text-red-600">{res.camera}</td>
                          <td className="px-6 py-4 text-gray-600 font-mono">{res.timestamp}</td>
                          <td className="px-6 py-4 text-right font-bold text-green-700">{(res.score * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
      <footer className="mt-20 text-gray-400 text-xs flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          DeepFace Engine Active
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          YOLOv8 Core Linked
        </div>
      </footer>
    </div>
  );
}

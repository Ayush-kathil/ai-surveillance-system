"use client";

import { useState } from "react";
import Image from "next/image";

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
  const [results, setResults] = useState<Detection[] | null>(null);

  const handleRunAnalysis = async () => {
    if (!missingImage || !cam1 || !cam2) {
      setError("Please provide all required files.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

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
      setResults(data.detections);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col items-center py-10 px-4 md:px-20">
      <div className="w-full max-w-5xl space-y-8">
        
        {/* Header */}
        <header className="flex flex-col gap-2 border-b-2 border-black pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Surveillance AI</h1>
          <p className="text-lg text-gray-600">Cross-camera target acquisition utilizing optimized OpenCV heuristics.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Inputs */}
          <section className="flex flex-col gap-6 bg-gray-50 border border-gray-200 p-6 rounded-2xl shadow-sm">
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
              disabled={loading}
              className={`mt-4 py-3 px-6 rounded-full font-bold text-white transition-all shadow-md active:scale-95 ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800"
              }`}
            >
              {loading ? "Processing..." : "Initiate System Search"}
            </button>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 font-medium">
                {error}
              </div>
            )}
          </section>

          {/* Outputs */}
          <section className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold">Analysis Results</h2>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 h-64">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 font-medium text-gray-500">Executing sequential frame scanning...</p>
                <p className="text-xs text-gray-400">This may take several minutes depending on video size.</p>
              </div>
            ) : results ? (
              <div className="flex flex-col gap-4">
                {results.length === 0 ? (
                  <div className="p-6 bg-gray-100 rounded-2xl text-center font-medium">
                    No matching traces found for the target in the provided feeds.
                  </div>
                ) : (
                  <div className="overflow-hidden border border-gray-200 rounded-2xl">
                    <table className="w-full text-left bg-white">
                      <thead className="bg-gray-100 uppercase text-xs tracking-wider border-b border-gray-200 font-bold">
                        <tr>
                          <th className="px-6 py-4">Camera</th>
                          <th className="px-6 py-4">Timestamp</th>
                          <th className="px-6 py-4 text-right">Confidence Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {results.map((res, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-semibold">{res.camera}</td>
                            <td className="px-6 py-4 text-gray-600 font-mono">{res.timestamp}</td>
                            <td className="px-6 py-4 text-right font-medium">{(res.score * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 border-2 border-dashed border-gray-300 flex items-center justify-center rounded-2xl bg-gray-50 text-gray-500 min-h-[250px]">
                Awaiting feeds...
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

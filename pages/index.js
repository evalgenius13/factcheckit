import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleFactCheck = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch('/api/fact-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ claim: inputText }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        // Auto-copy to clipboard
        try {
          await navigator.clipboard.writeText(data.formattedResponse);
          setCopied(true);
          // Vibrate on mobile if supported
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
        } catch (clipboardError) {
          console.log('Clipboard access failed:', clipboardError);
        }
      } else {
        setResult({ error: data.error || 'Something went wrong' });
      }
    } catch (error) {
      setResult({ error: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualCopy = async () => {
    if (result?.formattedResponse) {
      try {
        await navigator.clipboard.writeText(result.formattedResponse);
        setCopied(true);
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
      } catch (error) {
        // Fallback: select text for manual copy
        const textArea = document.createElement('textarea');
        textArea.value = result.formattedResponse;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFactCheck();
    }
  };

  return (
    <>
      <Head>
        <title>Fact-CheckIt - Instant AI Fact Checking</title>
        <meta name="description" content="Paste any claim and get instant fact-checking with sources" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto pt-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Fact-CheckIt
            </h1>
            <p className="text-gray-600 text-sm">
              Paste → Fact-Check → Copy → Done
            </p>
          </div>

          {/* Main Interface */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="mb-4">
              <label htmlFor="claim" className="block text-sm font-medium text-gray-700 mb-2">
                Paste the claim to fact-check:
              </label>
              <textarea
                id="claim"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Paste the comment or claim you want to fact-check..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24 text-sm"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleFactCheck}
              disabled={loading || !inputText.trim()}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all ${
                loading || !inputText.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Fact-Checking...
                </div>
              ) : (
                'Fact-Check It!'
              )}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 animate-fadeIn">
              {result.error ? (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-full mb-4">
                    <span className="text-2xl">❌</span>
                  </div>
                  <p className="font-semibold text-red-200 mb-2">Error</p>
                  <p className="text-red-200/80 text-sm">{result.error}</p>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold mb-4 ${
                      result.verdict === 'TRUE' ? 'bg-green-500/20 text-green-200 border border-green-500/30' :
                      result.verdict === 'FALSE' ? 'bg-red-500/20 text-red-200 border border-red-500/30' :
                      result.verdict === 'MISLEADING' ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30' :
                      'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                    }`}>
                      <span className="mr-2">
                        {result.verdict === 'TRUE' ? '✅' :
                         result.verdict === 'FALSE' ? '❌' :
                         result.verdict === 'MISLEADING' ? '⚠️' :
                         '🔍'}
                      </span>
                      {result.verdict === 'TRUE' ? 'VERIFIED TRUE' :
                       result.verdict === 'FALSE' ? 'FALSE CLAIM' :
                       result.verdict === 'MISLEADING' ? 'MISLEADING' :
                       'CANNOT VERIFY'}
                    </div>
                    
                    <p className="text-white/90 text-sm leading-relaxed mb-6">
                      {result.explanation}
                    </p>

                    {result.sources && result.sources.length > 0 && (
                      <div className="mb-6">
                        <p className="text-xs font-semibold text-white/70 mb-3 flex items-center">
                          <span className="mr-2">📚</span>
                          SOURCES:
                        </p>
                        <div className="space-y-2">
                          {result.sources.map((source, index) => (
                            <a
                              key={index}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-300 hover:text-blue-200 truncate bg-white/5 p-2 rounded-lg border border-white/10 hover:border-blue-400/50 transition-all duration-200"
                            >
                              🔗 {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/20 pt-6">
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-white/70 mb-3 flex items-center">
                        <span className="mr-2">📋</span>
                        FORMATTED RESPONSE 
                        {copied && <span className="text-green-400 ml-2 animate-pulse">(✅ COPIED!)</span>}
                      </p>
                      <div className="bg-black/20 backdrop-blur p-4 rounded-xl text-sm font-mono text-white/90 break-words border border-white/10">
                        {result.formattedResponse}
                      </div>
                    </div>

                    {!copied ? (
                      <button
                        onClick={handleManualCopy}
                        className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold text-sm transition-all duration-200 transform hover:scale-105 shadow-xl"
                      >
                        <span className="flex items-center justify-center">
                          <span className="mr-2">📋</span>
                          Copy Response
                        </span>
                      </button>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        padding: '1rem',
                        backgroundColor: '#d1fae5',
                        border: '1px solid #a7f3d0',
                        borderRadius: '8px',
                        color: '#065f46',
                        fontWeight: '600'
                      }}>
                        ✅ Ready to paste back to social media!
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '3rem',
          paddingBottom: '2rem'
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '0.9rem',
            margin: '0 0 1rem 0'
          }}>
            🤖 Powered by AI • Always verify important claims
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2rem',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.8rem'
          }}>
            <span>🔒 Secure</span>
            <span>⚡ Fast</span>
            <span>🎯 Accurate</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (max-width: 640px) {
          h1 {
            font-size: 2.5rem !important;
          }
          
          .main-content {
            padding: 1rem !important;
          }
        }
      `}</style>
    </>
  );
}

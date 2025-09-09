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
            <div className="bg-white rounded-xl shadow-lg p-6">
              {result.error ? (
                <div className="text-red-600 text-center">
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{result.error}</p>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3 ${
                      result.verdict === 'TRUE' ? 'bg-green-100 text-green-800' :
                      result.verdict === 'FALSE' ? 'bg-red-100 text-red-800' :
                      result.verdict === 'MISLEADING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {result.verdict === 'TRUE' ? '✅ TRUE' :
                       result.verdict === 'FALSE' ? '❌ FALSE' :
                       result.verdict === 'MISLEADING' ? '⚠️ MISLEADING' :
                       '🔍 CANNOT VERIFY'}
                    </div>
                    
                    <p className="text-gray-800 text-sm leading-relaxed mb-4">
                      {result.explanation}
                    </p>

                    {result.sources && result.sources.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-600 mb-2">SOURCES:</p>
                        <div className="space-y-1">
                          {result.sources.map((source, index) => (
                            <a
                              key={index}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-600 hover:text-blue-800 truncate"
                            >
                              {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        FORMATTED RESPONSE {copied && <span className="text-green-600">(✅ COPIED!)</span>}
                      </p>
                      <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono text-gray-800 break-words">
                        {result.formattedResponse}
                      </div>
                    </div>

                    {!copied && (
                      <button
                        onClick={handleManualCopy}
                        className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
                      >
                        📋 Copy Response
                      </button>
                    )}

                    {copied && (
                      <div className="text-center text-green-600 font-medium text-sm py-2">
                        ✅ Ready to paste back to social media!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-8 text-xs text-gray-500">
            <p>Powered by AI • Always verify important claims</p>
          </div>
        </div>
      </div>
    </>
  );
}

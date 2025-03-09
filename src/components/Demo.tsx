"use client";
import { useEffect, useCallback, useState } from "react";
import { Input } from "../components/ui/input";
import sdk, { type Context } from "@farcaster/frame-sdk";
import { Button } from "~/components/ui/Button";
import { Label } from "~/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import contractABI from '~/app/contracts/FlareFactChecker.json';
import { http, createConfig } from '@wagmi/core'
import { flareTestnet } from '@wagmi/core/chains'
import { watchContractEvent } from "@wagmi/core";

export const config = createConfig({
  chains: [flareTestnet],
  transports: {
    [flareTestnet.id]: http(),
  },
})


// Define interfaces for our data structures
interface VerificationResult {
  requestId: number;
  verifier: string;
  result: string;
  parsedResult?: {
    confirming: string[];
    refuting: string[];
    response: string;
    correctness_score: number;
  };
  blockNumber?: number;
  transactionHash?: string;
}

interface ResultSummary {
  confirming: number;
  refuting: number;
  neutral: number;
}

export default function MathFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [resultSummary, setResultSummary] = useState<ResultSummary>({ confirming: 0, refuting: 0, neutral: 0 });
  const [currentRequestId, setCurrentRequestId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<VerificationResult | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [logs, setLogs] = useState({})

  useEffect(() => {
    console.log('watching evetns')
    if (!currentRequestId){
      return;
    }
    const unwatch = watchContractEvent(config, {
      address: '0xBb242f415dd53e47b0a8c6E71f8D1A0A32ce4F90',
      abi: contractABI.abi,
      eventName: 'VerificationResultSubmitted',
      onLogs(logs) {
        console.log('New logs!', logs);
        setLogs((prevLogs) => {
          const newLogs = { ...prevLogs };
          logs.forEach((log) => {
            const logRequestId = parseInt(log.args.requestId.toString());
            if (logRequestId === currentRequestId) {
              console.log('found a match!')
              newLogs[log.args.verifier] = JSON.parse(log.args.result);
            }
          });
          console.log(newLogs)
          return newLogs;
        });
      },
    })  
    return () => {
      unwatch();
      setLogs({})
    };
  }, [currentRequestId])

  
  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      setContext(context);
      
      console.log("Calling ready");
      sdk.actions.ready({});
    };
    if (sdk && !isSDKLoaded) {
      console.log("Loading SDK");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded]);

  

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['factcheck'],
    queryFn: async () => {
      const response = await fetch("/api/request-factcheck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expression: inputText }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fact check statement");
      }
      
      const responseData = await response.json();
      
      // Set the current requestId for polling
      if (responseData.result && responseData.result.requestId) {
        console.log(parseInt(responseData.result.requestId))
        setCurrentRequestId(parseInt(responseData.result.requestId));
        // Reset verification results for new request
        setVerificationResults([]);
        setResultSummary({ confirming: 0, refuting: 0, neutral: 0 });
      }
      
      return responseData;
    },
    enabled: false,
    retry: false
  });
  
  const factCheck = async () => {
    if (!inputText.trim()) {
      setError("Please enter a statement to fact check");
      return;
    }
    
    setError("");
    refetch();
  }
  
  const shareResult = useCallback(() => {
    const shareText = `Statement: ${inputText}\nFact check ID: ${currentRequestId}\n${
      resultSummary.confirming > 0 ? `✓ Confirming: ${resultSummary.confirming}` : ''
    }${
      resultSummary.refuting > 0 ? `\n✗ Refuting: ${resultSummary.refuting}` : ''
    }${
      resultSummary.neutral > 0 ? `\n• Neutral: ${resultSummary.neutral}` : ''
    }${
      verificationResults.length > 0 && verificationResults[0].parsedResult 
        ? `\n\n${verificationResults[0].parsedResult.response}` 
        : ''
    }`;
    
    sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`);
  }, [inputText, currentRequestId, resultSummary, verificationResults]);
  
  // Helper functions
  const shortenAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  const shortenHash = (hash: string) => {
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
  };
  
  const openResultDetails = (result) => {
    setSelectedResult(result);
    setShowDetailPanel(true);
  };
  
  const closeResultDetails = () => {
    setShowDetailPanel(false);
    setSelectedResult(null);
  };
  
  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }
  
  // Determine overall verification status
  let verificationStatus = "Pending";
  let statusColor = "text-yellow-600";
  
  if (verificationResults.length > 0) {
    if (resultSummary.confirming > resultSummary.refuting) {
      verificationStatus = "Mostly Confirmed";
      statusColor = "text-green-600";
    } else if (resultSummary.refuting > resultSummary.confirming) {
      verificationStatus = "Mostly Refuted";
      statusColor = "text-red-600";
    } else if (resultSummary.confirming > 0 || resultSummary.refuting > 0) {
      verificationStatus = "Mixed Results";
      statusColor = "text-yellow-600";
    }
  }
  
  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        {/* Main content (hidden when detail panel is shown) */}
        {!showDetailPanel && (
          <>
            <h1 style={{color: '#c10f45'}} className="text-2xl font-bold text-center mt-3"><span>Flare Fact Checker</span></h1>
            <h2 className="text-l font-bold text-center mb-4">as a Farcaster Frame</h2>
            <hr className="border-t border-gray-300 my-4" />
            <p className="text-sm">This is a fact checker for Farcaster powered by Flare Network. We are using multiple Trusted Execution Environments and LLMs to fact check and find references to the provided statement.</p>
            <p className="text-sm mt-4">The LLM outputs (opinions) are aggregated and pushed on the Flare Network according to the Conensus Learning mechanism along with their respective hardware attestations.</p>
            <hr className="border-t border-gray-300 my-4" />
            <div className="mb-4">
              <Label 
                className="text-md font-semibold mb-2 block" 
                htmlFor="statement-input"
              >
                Enter a statement ({currentRequestId})
              </Label>
              <Input
                id="statement-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g., Covid-19 is a bacterial infection"
                className="mb-2"
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <div className="mb-4">
              <Button 
                onClick={factCheck} 
                disabled={isFetching}
                isLoading={isFetching}
                className="w-full text-sm"
              >
                Start Fact Check
              </Button>
            </div>
            <hr className="border-t border-gray-300 my-4" />
            
            {/* Initial request information */}
            {data?.result && (
              <div className="mb-4">
                <div className="p-4 mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <h3 className="font-bold mb-2">Fact Check Initiated</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold">Request ID:</span> {data.result.requestId}
                    </div>
                    <div>
                      <span className="font-semibold">Statement:</span> {data.result.text}
                    </div>
                    <div>
                      <span className="font-semibold">Transaction:</span>{" "}
                      <a
                        href={`https://coston2-explorer.flare.network/tx/${data.result.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {shortenHash(data.result.transactionHash)}
                      </a>
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span>{" "}
                      <span className={data.result.status.includes("succeeded") ? "text-green-600" : "text-yellow-600"}>
                        {data.result.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Results Summary */}    
            {/* Verification Results List */}
            {Object.entries(logs).length > 0? (
              <div className="mb-4">
                <h3 className="font-bold mb-2">Verification Results ({Object.entries(logs).length})</h3>
                <div className="space-y-2">
                  {Object.entries(logs).map(([hash, result], index) => {
                    // Determine result type based on correctness score
                    let resultType = "Neutral";
                    let resultBg = "bg-gray-100 dark:bg-gray-800";
                    let scoreBadge = "bg-gray-500";
                    
                    if (result.response_json) {
                      if (result.response_json.correctness_score > 0.6) {
                        resultType = "Confirming";
                        resultBg = "bg-green-100 dark:bg-green-900";
                        scoreBadge = "bg-green-500";
                      } else if (result.response_json.correctness_score < 0.4) {
                        resultType = "Refuting";
                        resultBg = "bg-red-100 dark:bg-red-900";
                        scoreBadge = "bg-red-500";
                      }
                    }
                    
                    return (
                      <div 
                        key={index} 
                        className={`p-3 ${resultBg} rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                        onClick={() => openResultDetails(result)}
                      >
                        <div className="flex justify-between mb-2">
                          <div className="text-xs font-semibold">Verifier: {shortenAddress(hash)}</div>
                          <div className={`text-xs px-2 py-0.5 rounded-full text-white ${scoreBadge}`}>
                            {resultType}: {result.response_json.confirming.length} vs {result.response_json.refuting.length}
                          </div>

                        </div>
                        <div className="text-sm line-clamp-2">
                          {result.response_json?.response || "Click to view details"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ): currentRequestId? "Awaiting verifications, please wait..." : ""}
            
            {/* Share Button */}
            {currentRequestId && logs.length > 0 && (
              <Button 
                onClick={shareResult}
                className="w-full mt-3"
              >
                Share Results on Warpcast
              </Button>
            )}
            
          </>
        )}
        
        {/* Detail Panel (shows when a result is selected) */}
        {showDetailPanel && selectedResult && (
          <div className="p-4">
            
            <div className="space-y-4">
              
              
              {selectedResult.response_json && (
                <>
                                  <div>
                    <h4 className="font-semibold mb-1">Correctness Score</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedResult.response_json.correctness_score}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">Raw Response</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedResult.response_json.response}</p>
                  </div>
                  
                  {selectedResult.response_json.confirming?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Confirming Sources ({selectedResult.response_json.confirming.length})</h4>
                      <ul className="list-disc pl-5">
                        {selectedResult.response_json.confirming.map((source, i) => (
                          <li key={i} className="text-sm">
                            <a 
                              href={source} 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline break-all"
                            >
                              {source}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {selectedResult.response_json.refuting?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Refuting Sources ({selectedResult.response_json.refuting.length})</h4>
                      <ul className="list-disc pl-5">
                        {selectedResult.response_json.refuting.map((source, i) => (
                          <li key={i} className="text-sm">
                            <a 
                              href={source} 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline break-all"
                            >
                              {source}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              
              <Button 
                onClick={closeResultDetails}
                className="w-full mt-4"
              >
                Back to Results
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
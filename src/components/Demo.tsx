"use client";
import { useEffect, useCallback, useState } from "react";
import { Input } from "../components/ui/input";
import sdk, { type Context } from "@farcaster/frame-sdk";
import { Button } from "~/components/ui/Button";
import { Label } from "~/components/ui/label";
import { useQuery } from "@tanstack/react-query";

export default function MathFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      setContext(context);
      
      // If the frame is being viewed in a reply context, get the parent cast content
      
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
      
      return await response.json();
    },
    enabled: false, // Don't run automatically
    retry: false
  });

  const factCheck = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Please enter a statement to fact check");
      return;
    }
    
    setError("");
    refetch();
  }, [inputText, refetch]);

  const shareResult = useCallback(() => {
    if (data?.result) {
      const shareText = `Statement: ${inputText}\nFact check ID: ${data.result.requestId}\nTransaction: ${data.result.transactionHash}`;
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`);
    }
  }, [inputText, data]);
  
  if (!isSDKLoaded) {
    return <div>Loading...</div>;
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
            Enter a statement
          </Label>
          <Input
            id="statement-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g., grass is usually blue"
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
                    className="text-blue-500 hover:underline break-all"
                  >
                    {data.result.transactionHash}
                  </a>
                </div>
                <div>
                  <span className="font-semibold">Block Number:</span> {data.result.blockNumber}
                </div>
                <div>
                  <span className="font-semibold">Status:</span>{" "}
                  <span className={data.result.status.includes("succeeded") ? "text-green-600" : "text-yellow-600"}>
                    {data.result.status}
                  </span>
                </div>
              </div>
            </div>
            <Button 
              onClick={shareResult}
              className="w-full mt-3"
            >
              Share on Warpcast
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
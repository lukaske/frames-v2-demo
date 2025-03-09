"use client";
import { useEffect, useCallback, useState } from "react";
import { Input } from "../components/ui/input";
import sdk, { type Context } from "@farcaster/frame-sdk";
import { Button } from "~/components/ui/Button";
import { Label } from "~/components/ui/label";

export default function MathFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      setContext(context);
      
      // If the frame is being viewed in a reply context, get the parent cast content
      if (context?.parent?.castContent) {
        setInputText(context.parent.castContent.text);
      }
      
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

  const interpretMath = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Please enter a mathematical expression");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      
      const response = await fetch("/api/interpret-math", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expression: inputText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to interpret expression");
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [inputText]);

  const shareResult = useCallback(() => {
    if (result) {
      const shareText = `Expression: ${inputText}\nResult: ${result}`;
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`);
    }
  }, [inputText, result]);

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
            htmlFor="math-expression"
          >
            Enter a statement
          </Label>
          <Input
            id="math-expression"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g., grass is usually blue"
            className="mb-2"
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <div className="mb-4">
          <Button 
            onClick={interpretMath} 
            disabled={isLoading}
            isLoading={isLoading}
            className="w-full text-sm"
          >
            Start Fact Check
          </Button>
        </div>
        <hr className="border-t border-gray-300 my-4" />

        {result && (
          <div className="mb-4">
            <div className="p-4 mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <h3 className="font-bold mb-1">Result:</h3>
              <div className="font-mono text-sm whitespace-pre-wrap break-words">
                {result}
              </div>
            </div>
            <Button 
              onClick={shareResult}
              className="w-full mt-2"
            >
              Share on Warpcast
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
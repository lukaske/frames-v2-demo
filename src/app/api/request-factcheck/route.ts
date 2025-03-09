import { NextRequest, NextResponse } from 'next/server';
import { 
  createPublicClient,
  createWalletClient,
  http, 
  getContract,
} from 'viem';
import { flareTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import contractABI from '~/app/contracts/FlareFactChecker.json';

// Contract details
const CONTRACT_ADDRESS = '0xBb242f415dd53e47b0a8c6E71f8D1A0A32ce4F90';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }
  
  try {
    const { expression } = await req.json();
    console.log('Expression:', expression);
    if (!expression || typeof expression !== 'string') {
      return NextResponse.json(
        { error: 'No expression provided or invalid format' },
        { status: 400 }
      );
    }
    
    // Call the contract on flareTestnet network with the provided expression
    const result = await callContractSubmitRequest(expression);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error calling contract:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call contract' },
      { status: 500 }
    );
  }
}

async function callContractSubmitRequest(text: string): Promise<string> {
  try {
    // Get private key from environment variables
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('WALLET_PRIVATE_KEY environment variable is not set');
    }
    
    // Create an account from the private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // Create a public client to interact with the Flare Testnet
    const publicClient = createPublicClient({
      chain: flareTestnet,
      transport: http('https://coston2-api.flare.network/ext/C/rpc')
    });
    
    // Create a wallet client
    const walletClient = createWalletClient({
      account,
      chain: flareTestnet,
      transport: http('https://coston2-api.flare.network/ext/C/rpc')
    });
    
    // Create a contract instance
    const contract = getContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI.abi,
      client: { public: publicClient, wallet: walletClient }

    });
    
    // Prepare the fee
    const fee = await contract.read.verificationFee(); // 1 C2FLR
    console.log('using fee:', fee);
    // Send the transaction using the contract instance
    const { result } = await contract.simulate.submitRequest(
      [text],
      {
        value: fee,
      }
    );
    const hash = await contract.write.submitRequest(
      [text],
      {
        value: fee,
      }
    );
    
    // Wait for the transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      confirmations: 0 // Wait for 1 confirmation
    });
    
    // Return the transaction result
    return {
      requestId: result.toString(),
      transactionHash: hash.toString(),
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status === 'success' ? 'Transaction succeeded' : 'Transaction failed',
      contractAddress: CONTRACT_ADDRESS,
      text
    };
    
  } catch (error) {
    console.error('Error in callContractSubmitRequest:', error);
    throw error;
  }
}
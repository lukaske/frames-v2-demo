import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    const { expression } = await req.json();

    if (!expression || typeof expression !== 'string') {
      return NextResponse.json(
        { error: 'No expression provided or invalid format' },
        { status: 400 }
      );
    }

    // Call external API to interpret the mathematical expression
    // In this example, we're using a fictional Math API endpoint
    // You could also use libraries like mathjs, but for more complex calculations
    // you might want to use a specialized service
    const result = await interpretExpression(expression);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error interpreting expression:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to interpret expression' },
      { status: 500 }
    );
  }
}

async function interpretExpression(expression: string): Promise<string> {
    const data = 'sent data: ' + expression;
    
    // Extract the result from Wolfram Alpha response
    // This is a simplified example - actual parsing depends on the API response structure
    const result = data;
    return result || 'No result found';
}
import { NextRequest, NextResponse } from 'next/server'

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com'

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = '1328*1328', style = '<auto>', negativePrompt = '' } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY
    console.log(dashscopeApiKey);


    if (!dashscopeApiKey) {
      return NextResponse.json(
        { error: 'dashscopeApiKey is not configured' },
        { status: 500 }
      )
    }

    const endpoint = `${DASHSCOPE_BASE_URL}/api/v1/services/aigc/multimodal-generation/generation`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${dashscopeApiKey}`,
      'Content-Type': 'application/json',
    }

    const parameters = {
      size,
      n: 1,
      style,
      negative_prompt: negativePrompt,
      watermark: false,
      prompt_extend: true,
    }

    const messagesBody = {
      model: 'qwen-image-plus',
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
      },
      parameters,
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(messagesBody),
    })

    if (!res.ok) {
      const errorData = await res.text()
      console.error('Qwen API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate image', details: errorData },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Extract image URL from response
    // Response structure: data.output.choices[0].message.content[0].image
    const imageUrl = data.output?.choices?.[0]?.message?.content?.[0]?.image

    if (!imageUrl) {
      console.error('No image URL in response:', data)
      return NextResponse.json(
        { error: 'No image URL in response', response: data },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt,
    })
  } catch (error) {
    console.error('Error generating image:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

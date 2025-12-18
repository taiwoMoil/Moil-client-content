import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { 
      currentContent, 
      contentType, 
      corrections,
      context 
    } = await request.json()

    if (!currentContent || !contentType) {
      return NextResponse.json(
        { error: 'Current content and content type are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY_2

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google API key is not configured' },
        { status: 500 }
      )
    }

    // Build the prompt based on content type and corrections
    let prompt = ''
    
    if (contentType === 'hook') {
      prompt = `You are a social media expert. Regenerate this hook for a social media post.
      
Current hook: "${currentContent}"

${corrections && corrections.length > 0 ? `Please address these corrections:\n${corrections.map((c: string) => `- ${c}`).join('\n')}` : 'Make it more engaging and attention-grabbing.'}

${context ? `Additional context:\n- Platform: ${context.platform?.join(', ') || 'Social Media'}\n- Post type: ${context.type || 'Post'}\n- Date: ${context.date || ''}` : ''}

Provide ONLY the new hook text, nothing else. Keep it concise (1-2 sentences max).`
    } else if (contentType === 'caption') {
      prompt = `You are a social media expert. Regenerate this caption for a social media post.
      
Current caption: "${currentContent}"

${corrections && corrections.length > 0 ? `Please address these corrections:\n${corrections.map((c: string) => `- ${c}`).join('\n')}` : 'Make it more engaging and compelling.'}

${context ? `Additional context:\n- Platform: ${context.platform?.join(', ') || 'Social Media'}\n- Post type: ${context.type || 'Post'}\n- Hook: ${context.hook || ''}\n- Date: ${context.date || ''}` : ''}

Provide ONLY the new caption text, nothing else. Include relevant hashtags and emojis where appropriate.`
    } else if (contentType === 'image_prompt') {
      prompt = `You are an AI image generation expert. Regenerate this image generation prompt.
      
Current prompt: "${currentContent}"

${corrections && corrections.length > 0 ? `Please address these corrections:\n${corrections.map((c: string) => `- ${c}`).join('\n')}` : 'Make it more detailed and visually descriptive.'}

${context ? `Additional context:\n- Platform: ${context.platform?.join(', ') || 'Social Media'}\n- Post type: ${context.type || 'Post'}\n- Hook: ${context.hook || ''}\n- Caption: ${context.copy || ''}\n- Date: ${context.date || ''}` : ''}

Provide ONLY the new image prompt text, nothing else. Be specific about visual elements, style, colors, composition, and mood.`
    }

    // Call Gemini API
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Gemini API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to regenerate content', details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Extract the generated text from Gemini response
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!generatedText) {
      console.error('No generated text in response:', data)
      return NextResponse.json(
        { error: 'No generated text in response', response: data },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      generatedContent: generatedText.trim(),
      contentType,
    })
  } catch (error) {
    console.error('Error regenerating content:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

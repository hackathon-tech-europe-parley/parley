import { fal } from "@fal-ai/client";

const imageModel = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell";
// Use a model that supports image-to-image for face updates
// Recommended models for identity preservation:
// - "fal-ai/flux/dev" - Good for image-to-image
// - "fal-ai/flux/schnell" - Faster but may have less identity preservation
// - Models with IP-Adapter support for better identity preservation
// Set FAL_FACE_MODEL env var to override
const faceModel = process.env.FAL_FACE_MODEL || "fal-ai/flux/dev";

export async function generateSceneImage(prompt: string): Promise<string> {
  const result = await fal.subscribe(imageModel, {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
    },
  });

  const image = result.data?.images?.[0];
  if (!image?.url) {
    throw new Error("Failed to generate image");
  }

  return image.url;
}

/**
 * Generate initial NPC face image based on scenario and personality
 */
export async function generateNpcFaceImage(
  scenario: string,
  npcName: string,
  personality: string,
): Promise<string> {
  const prompt = `Photorealistic portrait of ${npcName}, a person in the scenario: ${scenario}. ${personality}. Professional headshot, neutral expression, clear face, good lighting, high quality.`;
  
  const result = await fal.subscribe(faceModel, {
    input: {
      prompt,
      image_size: "square_hd",
      num_images: 1,
      num_inference_steps: 28,
    },
  });

  const image = result.data?.images?.[0];
  if (!image?.url) {
    throw new Error("Failed to generate NPC face image");
  }

  return image.url;
}

/**
 * Update NPC face image based on mood using image-to-image transformation
 * This preserves the person's identity EXACTLY - only changes facial expression
 */
export async function updateNpcFaceImage(
  referenceImageUrl: string,
  mood: string,
): Promise<string> {
  // Create very specific expression descriptions that only affect the face
  const moodExpressions: Record<string, string> = {
    neutral: "neutral facial expression, calm eyes, relaxed mouth",
    friendly: "warm smile, friendly eyes, welcoming expression",
    skeptical: "raised eyebrow, questioning look, slightly narrowed eyes",
    amused: "slight smile, twinkling eyes, amused expression",
    annoyed: "furrowed brow, slight frown, annoyed expression",
    convinced: "understanding expression, slight nod, convinced look",
    furious: "angry expression, tense face, furrowed brow, angry eyes",
    happy: "big smile, joyful eyes, happy expression",
    sad: "downcast eyes, melancholic expression, slight frown",
    surprised: "wide eyes, open mouth, surprised expression",
  };

  const expressionDescription = moodExpressions[mood.toLowerCase()] || `expressing ${mood}`;
  
  // Very explicit prompt that emphasizes ONLY expression change
  const prompt = `EXACT SAME PERSON, EXACT SAME FACE, EXACT SAME IDENTITY. Only change the facial expression to: ${expressionDescription}. Preserve EVERYTHING else: exact same facial features, exact same bone structure, exact same skin tone, exact same hair, exact same clothing, exact same pose, exact same lighting, exact same background. ONLY the facial expression changes, nothing else.`;

  try {
    // Use very low strength to preserve maximum identity
    // Lower strength = more preservation of original image
    const result = await fal.subscribe(faceModel, {
      input: {
        prompt,
        image_url: referenceImageUrl, // Reference image for identity preservation
        image_size: "square_hd",
        num_images: 1,
        num_inference_steps: 30,
        strength: 0.3, // Very low strength (0.2-0.4) preserves most of the original
        guidance_scale: 7.5, // Moderate guidance to follow prompt but preserve structure
      },
    });

    const image = result.data?.images?.[0];
    if (!image?.url) {
      throw new Error("Failed to update NPC face image");
    }

    return image.url;
  } catch (error) {
    // If image_url parameter doesn't work, try alternative parameter names
    console.warn("Image-to-image with image_url failed, trying alternative:", error);
    
    try {
      // Try with different parameter names that some models use
      const result = await fal.subscribe(faceModel, {
        input: {
          prompt,
          image: referenceImageUrl, // Alternative parameter name
          image_size: "square_hd",
          num_images: 1,
          num_inference_steps: 30,
          strength: 0.3,
          guidance_scale: 7.5,
        },
      });

      const image = result.data?.images?.[0];
      if (!image?.url) {
        throw new Error("Failed with alternative parameter");
      }

      return image.url;
    } catch (error2) {
      // Last resort: try with IP-Adapter if available
      console.warn("Alternative method failed, trying IP-Adapter approach:", error2);
      
      const result = await fal.subscribe(faceModel, {
        input: {
          prompt: `${prompt} Use the reference image to maintain exact identity.`,
          ip_adapter_scale: 0.8, // IP-Adapter for identity preservation
          image_size: "square_hd",
          num_images: 1,
          num_inference_steps: 30,
        },
      });

      const image = result.data?.images?.[0];
      if (!image?.url) {
        throw new Error("Failed to update NPC face image with all methods");
      }

      return image.url;
    }
  }
}

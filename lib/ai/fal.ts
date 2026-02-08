import { fal } from "@fal-ai/client";
import { FAL_IMAGE_MODEL } from "../env";

const imageModel = FAL_IMAGE_MODEL;

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

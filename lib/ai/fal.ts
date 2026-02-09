import { fal } from "@fal-ai/client";
import { FAL_IMAGE_MODEL } from "../env";
import { createLogger } from "../logger";

const log = createLogger("ai:fal");
const imageModel = FAL_IMAGE_MODEL;

export async function generateSceneImage(prompt: string): Promise<string> {
  log.info("generating scene image");
  const start = Date.now();
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

  log.info({ durationMs: Date.now() - start }, "scene image generated");
  return image.url;
}

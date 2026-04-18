"use server";
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const outfitReportSchema = z.object({
    totalRating: z.number().int().min(0).max(100),
    summary: z.string().min(20).max(400),
    whatLooksGood: z.array(z.string().min(3).max(180)).min(2).max(5),
    whatToImprove: z.array(z.string().min(3).max(180)).min(2).max(6),
    categoryScores: z.object({
        professionalism: z.number().int().min(0).max(100),
        neatness: z.number().int().min(0).max(100),
        colorCoordination: z.number().int().min(0).max(100),
        interviewReadiness: z.number().int().min(0).max(100),
    }),
});

export type OutfitRatingReport = z.infer<typeof outfitReportSchema>;

type OutfitRatingResult =
    | { ok: true; data: OutfitRatingReport }
    | { ok: false; error: string };

function parseImageDataUrl(imageDataUrl: string) {
    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) {
        throw new Error("Invalid image format. Please retry camera capture.");
    }

    const mimeType = match[1].toLowerCase();
    const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (!allowedMimeTypes.has(mimeType)) {
        throw new Error("Unsupported image type. Please use JPEG, PNG, or WEBP.");
    }

    const base64Payload = match[2].replace(/\s+/g, "");
    const imageBytes = Buffer.from(base64Payload, "base64");

    if (imageBytes.length === 0) {
        throw new Error("Empty image received. Please retry capture.");
    }

    if (imageBytes.length > 5 * 1024 * 1024) {
        throw new Error("Captured image is too large. Please retry.");
    }

    return {
        mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
        imageBytes,
    };
}

export const getTest = async (topic: string = "General Software Engineering") => {
        const { text } = await generateText({
         model: google("gemini-2.5-flash-lite"),
    prompt: `Create exactly one interview question for the topic: ${topic}.

Rules:
- Return only one question.
- Keep it practical and clear.
- Do not include explanation, bullets, numbering, or extra text.`,

})
return text;
}

export async function rateInterviewOutfit(input: {
    imageDataUrl: string;
    topic?: string;
    difficulty?: string;
    tone?: string;
}): Promise<OutfitRatingResult> {
    try {
        const imageDataUrl = input.imageDataUrl?.trim();
        if (!imageDataUrl) {
            return { ok: false, error: "Outfit image is required." };
        }

        const { imageBytes } = parseImageDataUrl(imageDataUrl);

        const { object } = await generateObject({
            model: google("gemini-2.5-flash"),
            schema: outfitReportSchema,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Evaluate interview outfit readiness based only on visible clothing and presentation.

Context:
- Interview topic: ${input.topic ?? "General Software Engineering"}
- Difficulty: ${input.difficulty ?? "intermediate"}
- Tone: ${input.tone ?? "professional"}

Rules:
- Focus on professional appearance, neatness, color coordination, and role appropriateness.
- Do not infer protected traits, identity, ethnicity, religion, or socioeconomic background.
- Keep advice practical, respectful, and actionable.
- Return strict JSON matching the schema.`,
                        },
                        {
                            type: "image",
                            image: imageBytes,
                        },
                    ],
                },
            ],
        });

        return {
            ok: true,
            data: object,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to analyze outfit.";
        return {
            ok: false,
            error: message,
        };
    }
}

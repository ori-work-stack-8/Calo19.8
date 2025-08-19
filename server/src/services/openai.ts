import OpenAI from "openai";
import { extractCleanJSON, parsePartialJSON } from "../utils/openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export class OpenAIService {
  static async analyzeMealImage(
    imageBase64: string,
    language: string = "english",
    updateText?: string,
    editedIngredients: any[] = []
  ) {
    try {
      console.log("🤖 Starting OpenAI meal analysis...");
      console.log("🌐 Language:", language);
      console.log("📝 Update text provided:", !!updateText);
      console.log("🥗 Edited ingredients:", editedIngredients.length);

      if (!openai || !process.env.OPENAI_API_KEY) {
        console.log("⚠️ No OpenAI API key, using fallback analysis");
        return this.getFallbackAnalysis(language);
      }

      // Validate image data
      if (!imageBase64 || imageBase64.trim() === "") {
        throw new Error("Image data is required");
      }

      // Clean base64 data
      let cleanBase64 = imageBase64;
      if (imageBase64.startsWith("data:image/")) {
        cleanBase64 = imageBase64.split(",")[1];
      }

      // Validate base64 format
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(cleanBase64)) {
        throw new Error("Invalid base64 image format");
      }

      console.log("✅ Image validation passed");

      const isHebrew = language === "hebrew";
      const systemPrompt = this.createAnalysisPrompt(isHebrew, updateText, editedIngredients);

      console.log("🔄 Calling OpenAI API...");

      // Remove the invalid timeout parameter and use proper OpenAI client
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use gpt-4o instead of gpt-5
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: updateText || (isHebrew 
                  ? "נתח את התמונה הזו של האוכל ותן לי פירוט תזונתי מדויק."
                  : "Analyze this food image and provide detailed nutritional information."
                ),
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${cleanBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      console.log("✅ OpenAI response received");
      console.log("📄 Response preview:", content.substring(0, 200) + "...");

      // Parse the JSON response
      const cleanedJSON = extractCleanJSON(content);
      const analysis = parsePartialJSON(cleanedJSON);

      // Validate and normalize the response
      const normalizedAnalysis = this.normalizeAnalysisResponse(analysis);

      console.log("✅ Analysis completed successfully");
      return normalizedAnalysis;
    } catch (error: any) {
      console.error("💥 OpenAI analysis error:", error);

      // Handle specific OpenAI errors
      if (error.status === 400) {
        throw new Error("Invalid image data or request format");
      } else if (error.status === 401) {
        throw new Error("OpenAI API authentication failed");
      } else if (error.status === 429) {
        throw new Error("OpenAI API rate limit exceeded. Please try again later.");
      } else if (error.status === 500) {
        throw new Error("OpenAI service temporarily unavailable");
      }

      // For any other error, provide fallback
      console.log("🔄 Using fallback analysis due to error");
      return this.getFallbackAnalysis(language);
    }
  }

  static async updateMealAnalysis(
    originalAnalysis: any,
    updateText: string,
    language: string = "english"
  ) {
    try {
      console.log("🔄 Updating meal analysis with AI...");

      if (!openai || !process.env.OPENAI_API_KEY) {
        console.log("⚠️ No OpenAI API key, using basic update");
        return this.getBasicUpdate(originalAnalysis, updateText);
      }

      const isHebrew = language === "hebrew";
      const prompt = this.createUpdatePrompt(originalAnalysis, updateText, isHebrew);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: isHebrew
              ? "אתה מנתח תזונה מומחה. עדכן את הניתוח הקיים בהתבסס על המידע החדש שהמשתמש סיפק."
              : "You are an expert nutrition analyst. Update the existing analysis based on the new information provided by the user.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const cleanedJSON = extractCleanJSON(content);
      const updatedAnalysis = parsePartialJSON(cleanedJSON);

      return this.normalizeAnalysisResponse(updatedAnalysis);
    } catch (error) {
      console.error("💥 Error updating meal analysis:", error);
      return this.getBasicUpdate(originalAnalysis, updateText);
    }
  }

  static async generateText(prompt: string, maxTokens: number = 1000): Promise<string> {
    try {
      if (!openai || !process.env.OPENAI_API_KEY) {
        return "AI text generation not available - no API key configured";
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || "No response generated";
    } catch (error) {
      console.error("💥 Error generating text:", error);
      throw error;
    }
  }

  private static createAnalysisPrompt(
    isHebrew: boolean,
    updateText?: string,
    editedIngredients: any[] = []
  ): string {
    const basePrompt = isHebrew
      ? `אתה מנתח תזונה מומחה. נתח את תמונת האוכל ותן פירוט תזונתי מדויק.

החזר JSON בפורמט הזה בדיוק:
{
  "name": "שם המנה",
  "description": "תיאור קצר",
  "calories": מספר,
  "protein": מספר,
  "carbs": מספר,
  "fat": מספר,
  "fiber": מספר,
  "sugar": מספר,
  "sodium": מספר,
  "saturated_fats_g": מספר,
  "polyunsaturated_fats_g": מספר,
  "monounsaturated_fats_g": מספר,
  "omega_3_g": מספר,
  "omega_6_g": מספר,
  "soluble_fiber_g": מספר,
  "insoluble_fiber_g": מספר,
  "cholesterol_mg": מספר,
  "alcohol_g": מספר,
  "caffeine_mg": מספר,
  "liquids_ml": מספר,
  "serving_size_g": מספר,
  "glycemic_index": מספר,
  "insulin_index": מספר,
  "food_category": "קטגוריה",
  "processing_level": "רמת עיבוד",
  "cooking_method": "שיטת הכנה",
  "health_risk_notes": "הערות בריאות",
  "confidence": מספר (0-100),
  "ingredients": [
    {
      "name": "שם המרכיב",
      "calories": מספר,
      "protein": מספר,
      "carbs": מספר,
      "fat": מספר,
      "fiber": מספר,
      "sugar": מספר,
      "sodium_mg": מספר
    }
  ],
  "healthNotes": "הערות בריאות והמלצות",
  "recommendations": "המלצות תזונתיות"
}`
      : `You are an expert nutrition analyst. Analyze the food image and provide detailed nutritional information.

Return JSON in this exact format:
{
  "name": "Dish name",
  "description": "Brief description",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number,
  "saturated_fats_g": number,
  "polyunsaturated_fats_g": number,
  "monounsaturated_fats_g": number,
  "omega_3_g": number,
  "omega_6_g": number,
  "soluble_fiber_g": number,
  "insoluble_fiber_g": number,
  "cholesterol_mg": number,
  "alcohol_g": number,
  "caffeine_mg": number,
  "liquids_ml": number,
  "serving_size_g": number,
  "glycemic_index": number,
  "insulin_index": number,
  "food_category": "category",
  "processing_level": "processing level",
  "cooking_method": "cooking method",
  "health_risk_notes": "health notes",
  "confidence": number (0-100),
  "ingredients": [
    {
      "name": "ingredient name",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "fiber": number,
      "sugar": number,
      "sodium_mg": number
    }
  ],
  "healthNotes": "Health notes and recommendations",
  "recommendations": "Nutritional recommendations"
}`;

    if (updateText) {
      return basePrompt + (isHebrew 
        ? `\n\nמידע נוסף מהמשתמש: ${updateText}`
        : `\n\nAdditional user information: ${updateText}`
      );
    }

    if (editedIngredients.length > 0) {
      return basePrompt + (isHebrew
        ? `\n\nמרכיבים שערך המשתמש: ${JSON.stringify(editedIngredients)}`
        : `\n\nUser-edited ingredients: ${JSON.stringify(editedIngredients)}`
      );
    }

    return basePrompt;
  }

  private static createUpdatePrompt(
    originalAnalysis: any,
    updateText: string,
    isHebrew: boolean
  ): string {
    const prompt = isHebrew
      ? `עדכן את הניתוח התזונתי הקיים בהתבסס על המידע החדש.

ניתוח קיים:
${JSON.stringify(originalAnalysis, null, 2)}

מידע חדש מהמשתמש:
${updateText}

החזר JSON מעודכן באותו פורמט של הניתוח המקורי.`
      : `Update the existing nutritional analysis based on the new information.

Current analysis:
${JSON.stringify(originalAnalysis, null, 2)}

New user information:
${updateText}

Return updated JSON in the same format as the original analysis.`;

    return prompt;
  }

  private static normalizeAnalysisResponse(analysis: any) {
    // Ensure all required fields exist with proper types
    return {
      name: analysis.name || "Unknown Meal",
      description: analysis.description || "",
      calories: Number(analysis.calories) || 0,
      protein: Number(analysis.protein) || 0,
      carbs: Number(analysis.carbs) || 0,
      fat: Number(analysis.fat) || 0,
      fiber: Number(analysis.fiber) || 0,
      sugar: Number(analysis.sugar) || 0,
      sodium: Number(analysis.sodium) || 0,
      saturated_fats_g: Number(analysis.saturated_fats_g) || 0,
      polyunsaturated_fats_g: Number(analysis.polyunsaturated_fats_g) || 0,
      monounsaturated_fats_g: Number(analysis.monounsaturated_fats_g) || 0,
      omega_3_g: Number(analysis.omega_3_g) || 0,
      omega_6_g: Number(analysis.omega_6_g) || 0,
      soluble_fiber_g: Number(analysis.soluble_fiber_g) || 0,
      insoluble_fiber_g: Number(analysis.insoluble_fiber_g) || 0,
      cholesterol_mg: Number(analysis.cholesterol_mg) || 0,
      alcohol_g: Number(analysis.alcohol_g) || 0,
      caffeine_mg: Number(analysis.caffeine_mg) || 0,
      liquids_ml: Number(analysis.liquids_ml) || 0,
      serving_size_g: Number(analysis.serving_size_g) || 100,
      glycemic_index: analysis.glycemic_index ? Number(analysis.glycemic_index) : null,
      insulin_index: analysis.insulin_index ? Number(analysis.insulin_index) : null,
      food_category: analysis.food_category || "Mixed",
      processing_level: analysis.processing_level || "Moderate",
      cooking_method: analysis.cooking_method || "Mixed",
      health_risk_notes: analysis.health_risk_notes || "",
      confidence: Number(analysis.confidence) || 75,
      ingredients: Array.isArray(analysis.ingredients) ? analysis.ingredients : [],
      healthNotes: analysis.healthNotes || analysis.recommendations || "",
      recommendations: analysis.recommendations || analysis.healthNotes || "",
      // Additional fields for compatibility
      meal_name: analysis.name || "Unknown Meal",
      protein_g: Number(analysis.protein) || 0,
      carbs_g: Number(analysis.carbs) || 0,
      fats_g: Number(analysis.fat) || 0,
      fiber_g: Number(analysis.fiber) || 0,
      sugar_g: Number(analysis.sugar) || 0,
      sodium_mg: Number(analysis.sodium) || 0,
    };
  }

  private static getFallbackAnalysis(language: string) {
    const isHebrew = language === "hebrew";
    
    return {
      name: isHebrew ? "ארוחה מנותחת" : "Analyzed Meal",
      description: isHebrew ? "ניתוח בסיסי של הארוחה" : "Basic meal analysis",
      calories: 400,
      protein: 25,
      carbs: 45,
      fat: 15,
      fiber: 8,
      sugar: 10,
      sodium: 600,
      saturated_fats_g: 5,
      polyunsaturated_fats_g: 3,
      monounsaturated_fats_g: 7,
      omega_3_g: 1,
      omega_6_g: 2,
      soluble_fiber_g: 4,
      insoluble_fiber_g: 4,
      cholesterol_mg: 50,
      alcohol_g: 0,
      caffeine_mg: 0,
      liquids_ml: 200,
      serving_size_g: 250,
      glycemic_index: 55,
      insulin_index: 45,
      food_category: isHebrew ? "מעורב" : "Mixed",
      processing_level: isHebrew ? "בינוני" : "Moderate",
      cooking_method: isHebrew ? "מעורב" : "Mixed",
      health_risk_notes: "",
      confidence: 70,
      ingredients: [
        {
          name: isHebrew ? "מרכיב עיקרי" : "Main ingredient",
          calories: 200,
          protein: 15,
          carbs: 25,
          fat: 8,
          fiber: 4,
          sugar: 5,
          sodium_mg: 300,
        },
        {
          name: isHebrew ? "מרכיב משני" : "Secondary ingredient",
          calories: 200,
          protein: 10,
          carbs: 20,
          fat: 7,
          fiber: 4,
          sugar: 5,
          sodium_mg: 300,
        },
      ],
      healthNotes: isHebrew 
        ? "ניתוח בסיסי - לתוצאות מדויקות יותר, הוסף מפתח OpenAI"
        : "Basic analysis - for more accurate results, add OpenAI API key",
      recommendations: isHebrew
        ? "המלצות כלליות לתזונה בריאה"
        : "General healthy nutrition recommendations",
      // Compatibility fields
      meal_name: isHebrew ? "ארוחה מנותחת" : "Analyzed Meal",
      protein_g: 25,
      carbs_g: 45,
      fats_g: 15,
      fiber_g: 8,
      sugar_g: 10,
      sodium_mg: 600,
    };
  }

  private static getBasicUpdate(originalAnalysis: any, updateText: string) {
    // Simple text-based update without AI
    const updated = { ...originalAnalysis };
    
    // Basic keyword-based adjustments
    const lowerUpdate = updateText.toLowerCase();
    
    if (lowerUpdate.includes("more protein") || lowerUpdate.includes("חלבון")) {
      updated.protein = Math.round(updated.protein * 1.2);
      updated.protein_g = updated.protein;
    }
    
    if (lowerUpdate.includes("less calories") || lowerUpdate.includes("פחות קלוריות")) {
      updated.calories = Math.round(updated.calories * 0.8);
    }
    
    if (lowerUpdate.includes("more vegetables") || lowerUpdate.includes("ירקות")) {
      updated.fiber = Math.round(updated.fiber * 1.3);
      updated.fiber_g = updated.fiber;
    }

    updated.healthNotes = `Updated based on user input: ${updateText}`;
    updated.confidence = Math.max(50, updated.confidence - 10);

    return updated;
  }
}
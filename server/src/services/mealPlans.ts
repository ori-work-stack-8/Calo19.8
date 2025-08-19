import { prisma } from "../lib/database";
import { OpenAIService } from "./openai";
import { UserMealPlanConfig, WeeklyMealPlan } from "../types/mealPlans";

export class MealPlanService {
  static async createUserMealPlan(userId: string, config: UserMealPlanConfig) {
    try {
      console.log("🎯 Creating meal plan for user:", userId);
      console.log("📋 Config:", config);

      // Get user's questionnaire for personalization
      const questionnaire = await prisma.userQuestionnaire.findFirst({
        where: { user_id: userId },
        orderBy: { date_completed: "desc" },
      });

      if (!questionnaire) {
        throw new Error("User questionnaire not found. Please complete the questionnaire first.");
      }

      // Create the meal plan
      const mealPlan = await prisma.userMealPlan.create({
        data: {
          user_id: userId,
          name: config.name,
          plan_type: config.plan_type,
          meals_per_day: config.meals_per_day,
          snacks_per_day: config.snacks_per_day,
          rotation_frequency_days: config.rotation_frequency_days,
          include_leftovers: config.include_leftovers,
          fixed_meal_times: config.fixed_meal_times,
          dietary_preferences: config.dietary_preferences.join(", "),
          excluded_ingredients: config.excluded_ingredients.join(", "),
          start_date: new Date(),
          is_active: true,
        },
      });

      console.log("✅ Meal plan created successfully");
      return mealPlan;
    } catch (error) {
      console.error("💥 Error creating meal plan:", error);
      throw error;
    }
  }

  static async replaceMealInPlan(
    userId: string,
    planId: string,
    dayOfWeek: number,
    mealTiming: string,
    mealOrder: number,
    preferences: any
  ) {
    try {
      console.log("🔄 Replacing meal in plan:", {
        planId,
        dayOfWeek,
        mealTiming,
        mealOrder,
      });

      // Find the existing schedule entry
      const existingSchedule = await prisma.mealPlanSchedule.findFirst({
        where: {
          plan_id: planId,
          day_of_week: dayOfWeek,
          meal_timing: mealTiming as any,
          meal_order: mealOrder,
        },
        include: {
          template: true,
        },
      });

      if (!existingSchedule) {
        throw new Error("Meal schedule not found");
      }

      // Generate a replacement meal template
      const newTemplate = await this.generateReplacementTemplate(
        existingSchedule.template,
        preferences,
        userId
      );

      // Update the schedule to use the new template
      const updatedSchedule = await prisma.mealPlanSchedule.update({
        where: { schedule_id: existingSchedule.schedule_id },
        data: {
          template_id: newTemplate.template_id,
        },
        include: {
          template: true,
        },
      });

      console.log("✅ Meal replaced successfully");
      return updatedSchedule;
    } catch (error) {
      console.error("💥 Error replacing meal:", error);
      throw error;
    }
  }

  static async generateShoppingList(
    userId: string,
    planId: string,
    weekStartDate: string
  ) {
    try {
      console.log("🛒 Generating shopping list for plan:", planId);

      const plan = await prisma.userMealPlan.findFirst({
        where: {
          plan_id: planId,
          user_id: userId,
        },
        include: {
          schedules: {
            include: {
              template: true,
            },
          },
        },
      });

      if (!plan) {
        throw new Error("Meal plan not found");
      }

      // Aggregate ingredients from all meals
      const ingredientMap = new Map();

      plan.schedules.forEach((schedule) => {
        const ingredients = schedule.template.ingredients_json as any[];
        if (Array.isArray(ingredients)) {
          ingredients.forEach((ingredient) => {
            const key = ingredient.name?.toLowerCase() || "unknown";
            if (ingredientMap.has(key)) {
              const existing = ingredientMap.get(key);
              existing.quantity += ingredient.quantity || 1;
            } else {
              ingredientMap.set(key, {
                name: ingredient.name || "Unknown ingredient",
                quantity: ingredient.quantity || 1,
                unit: ingredient.unit || "piece",
                category: ingredient.category || "other",
                estimated_cost: 5,
              });
            }
          });
        }
      });

      const items = Array.from(ingredientMap.values());
      const totalCost = items.reduce((sum, item) => sum + item.estimated_cost, 0);

      const shoppingList = await prisma.shoppingList.create({
        data: {
          user_id: userId,
          plan_id: planId,
          name: `Shopping List - ${plan.name}`,
          week_start_date: new Date(weekStartDate),
          items_json: items,
          total_estimated_cost: totalCost,
        },
      });

      console.log("✅ Shopping list generated successfully");
      return shoppingList;
    } catch (error) {
      console.error("💥 Error generating shopping list:", error);
      throw error;
    }
  }

  static async saveMealPreference(
    userId: string,
    templateId: string,
    preferenceType: string,
    rating?: number,
    notes?: string
  ) {
    try {
      const preference = await prisma.userMealPreference.upsert({
        where: {
          user_id_template_id_preference_type: {
            user_id: userId,
            template_id: templateId,
            preference_type: preferenceType,
          },
        },
        update: {
          rating,
          notes,
        },
        create: {
          user_id: userId,
          template_id: templateId,
          preference_type: preferenceType,
          rating,
          notes,
        },
      });

      return preference;
    } catch (error) {
      console.error("💥 Error saving meal preference:", error);
      throw error;
    }
  }

  static async activatePlan(userId: string, planId: string) {
    try {
      const plan = await prisma.userMealPlan.update({
        where: { plan_id: planId },
        data: { is_active: true },
      });

      // Update user's active plan reference
      await prisma.user.update({
        where: { user_id: userId },
        data: { active_meal_plan_id: planId },
      });

      return plan;
    } catch (error) {
      console.error("💥 Error activating plan:", error);
      throw error;
    }
  }

  static async deactivateUserPlans(userId: string) {
    try {
      await prisma.userMealPlan.updateMany({
        where: { user_id: userId },
        data: { is_active: false },
      });

      await prisma.user.update({
        where: { user_id: userId },
        data: { active_meal_plan_id: null },
      });
    } catch (error) {
      console.error("💥 Error deactivating plans:", error);
      throw error;
    }
  }

  static async completePlan(
    userId: string,
    planId: string,
    feedback: {
      rating?: number;
      liked?: string;
      disliked?: string;
      suggestions?: string;
    }
  ) {
    try {
      await prisma.userMealPlan.update({
        where: { plan_id: planId },
        data: {
          completed_at: new Date(),
          rating: feedback.rating,
          feedback_liked: feedback.liked,
          feedback_disliked: feedback.disliked,
          feedback_suggestions: feedback.suggestions,
          is_active: false,
        },
      });

      return { message: "Plan completed successfully" };
    } catch (error) {
      console.error("💥 Error completing plan:", error);
      throw error;
    }
  }

  static async savePlanFeedback(
    userId: string,
    planId: string,
    rating?: number,
    liked?: string,
    disliked?: string,
    suggestions?: string
  ) {
    try {
      await prisma.userMealPlan.updateMany({
        where: {
          plan_id: planId,
          user_id: userId,
        },
        data: {
          rating,
          feedback_liked: liked,
          feedback_disliked: disliked,
          feedback_suggestions: suggestions,
        },
      });
    } catch (error) {
      console.error("💥 Error saving plan feedback:", error);
      throw error;
    }
  }

  static async deactivateMealPlan(userId: string, planId: string) {
    try {
      await prisma.userMealPlan.updateMany({
        where: {
          plan_id: planId,
          user_id: userId,
        },
        data: { is_active: false },
      });

      // Clear user's active plan reference if it matches
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
        select: { active_meal_plan_id: true },
      });

      if (user?.active_meal_plan_id === planId) {
        await prisma.user.update({
          where: { user_id: userId },
          data: { active_meal_plan_id: null },
        });
      }
    } catch (error) {
      console.error("💥 Error deactivating meal plan:", error);
      throw error;
    }
  }

  private static async generateReplacementTemplate(
    currentTemplate: any,
    preferences: any,
    userId: string
  ) {
    try {
      // Create a new template based on the current one with modifications
      const newTemplate = await prisma.mealTemplate.create({
        data: {
          name: `${currentTemplate.name} (Alternative)`,
          description: currentTemplate.description,
          meal_timing: currentTemplate.meal_timing,
          dietary_category: currentTemplate.dietary_category,
          prep_time_minutes: currentTemplate.prep_time_minutes,
          difficulty_level: currentTemplate.difficulty_level,
          calories: currentTemplate.calories,
          protein_g: currentTemplate.protein_g,
          carbs_g: currentTemplate.carbs_g,
          fats_g: currentTemplate.fats_g,
          fiber_g: currentTemplate.fiber_g,
          sugar_g: currentTemplate.sugar_g,
          sodium_mg: currentTemplate.sodium_mg,
          ingredients_json: currentTemplate.ingredients_json,
          instructions_json: currentTemplate.instructions_json,
          allergens_json: currentTemplate.allergens_json,
          image_url: currentTemplate.image_url,
          is_active: true,
        },
      });

      return newTemplate;
    } catch (error) {
      console.error("💥 Error generating replacement template:", error);
      throw error;
    }
  }
}
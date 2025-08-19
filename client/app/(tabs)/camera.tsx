import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/src/store";
import {
  analyzeMeal,
  updateMeal,
  postMeal,
  clearPendingMeal,
  clearError,
  processImage,
} from "@/src/store/mealSlice";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  CameraIcon,
  Send,
  Edit3,
  Trash2,
  Plus,
  Minus,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
  Save,
  RefreshCw,
  Heart,
  Star,
  Clock,
  Flame,
  Zap,
  Droplets,
  Wheat,
  Apple,
  Award,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { useMealDataRefresh } from "@/hooks/useMealDataRefresh";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useTheme } from "@/src/context/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

interface Ingredient {
  name: string;
  calories: number;
  protein_g?: number;
  protein?: number;
  carbs_g?: number;
  carbs?: number;
  fats_g?: number;
  fat?: number;
  fats?: number;
  fiber_g?: number;
  fiber?: number;
  sugar_g?: number;
  sugar?: number;
  sodium_mg?: number;
  sodium?: number;
  estimated_portion_g?: number;
}

interface AnalysisData {
  name?: string;
  meal_name?: string;
  description?: string;
  calories: number;
  protein_g?: number;
  protein?: number;
  carbs_g?: number;
  carbs?: number;
  fats_g?: number;
  fat?: number;
  fats?: number;
  fiber_g?: number;
  fiber?: number;
  sugar_g?: number;
  sugar?: number;
  sodium_mg?: number;
  sodium?: number;
  saturated_fats_g?: number;
  polyunsaturated_fats_g?: number;
  monounsaturated_fats_g?: number;
  omega_3_g?: number;
  omega_6_g?: number;
  cholesterol_mg?: number;
  serving_size_g?: number;
  ingredients?: Ingredient[];
  healthScore?: string;
  recommendations?: string;
  cookingMethod?: string;
  cooking_method?: string;
  food_category?: string;
  confidence?: number;
  servingSize?: string;
  healthNotes?: string;
}

export default function CameraScreen() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const { refreshAllMealData } = useMealDataRefresh();
  const colorScheme = useColorScheme(); // For fallback if ThemeContext is not available
  const { colors, isDark } = useTheme();

  const { pendingMeal, isAnalyzing, isPosting, isUpdating, error } =
    useSelector((state: RootState) => state.meal);

  // Local state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [userComment, setUserComment] = useState("");
  const [editedIngredients, setEditedIngredients] = useState<Ingredient[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(
    null
  );
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [hasBeenAnalyzed, setHasBeenAnalyzed] = useState(false);
  const [showNutritionDetails, setShowNutritionDetails] = useState(true);
  const [showAdvancedNutrition, setShowAdvancedNutrition] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showResults, setShowResults] = useState(false); // Added for modal visibility

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const nutritionCardAnim = useRef(new Animated.Value(0)).current;

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);

  // Request camera permission on mount
  useEffect(() => {
    const requestCameraPermission = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };
    requestCameraPermission();
  }, []);

  // Clear error on mount
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Update local state when pendingMeal changes
  useEffect(() => {
    console.log("🔄 Pending meal changed:", pendingMeal);

    if (pendingMeal?.analysis) {
      console.log("📊 Setting analysis data:", pendingMeal.analysis);
      setAnalysisData(pendingMeal.analysis);

      const ingredients = pendingMeal.analysis.ingredients || [];
      console.log("🥗 Setting ingredients:", ingredients);
      setEditedIngredients(ingredients);
      setHasBeenAnalyzed(true);
      setShowResults(true); // Show the results/modal

      if (pendingMeal.image_base_64) {
        const imageUri = pendingMeal.image_base_64.startsWith("data:")
          ? pendingMeal.image_base_64
          : `data:image/jpeg;base64,${pendingMeal.image_base_64}`;
        setSelectedImage(imageUri);
      }

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(nutritionCardAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }
  }, [pendingMeal, fadeAnim, slideAnim, nutritionCardAnim]);

  // Helper function to get nutrition value with fallbacks
  const getNutritionValue = (
    data: AnalysisData | Ingredient | undefined,
    field: string
  ): number => {
    if (!data) return 0;

    const variations = [
      field,
      field.replace("_g", ""),
      field.replace("_mg", ""),
      field.replace("g", ""),
      field.replace("mg", ""),
    ];

    for (const variation of variations) {
      const value = data[variation as keyof typeof data];
      if (typeof value === "number" && value > 0) {
        return Math.round(value);
      }
      if (typeof value === "string" && !isNaN(parseFloat(value))) {
        return Math.round(parseFloat(value));
      }
    }
    return 0;
  };

  const getNutritionValueForIngredient = (
    ingredient: Ingredient | undefined,
    field: string
  ): number => {
    if (!ingredient) return 0;

    const variations = [
      field,
      field.replace("_g", ""),
      field.replace("_mg", ""),
      field.replace("g", ""),
      field.replace("mg", ""),
    ];

    for (const variation of variations) {
      const value = ingredient[variation as keyof Ingredient];
      if (typeof value === "number" && value > 0) {
        return Math.round(value);
      }
      if (typeof value === "string" && !isNaN(parseFloat(value))) {
        return Math.round(parseFloat(value));
      }
    }
    return 0;
  };

  // Helper function to get meal name
  const getMealName = (data: AnalysisData): string => {
    return data?.name || data?.meal_name || "Analyzed Meal";
  };

  // Image selection handlers
  const handleTakePhoto = async () => {
    if (hasPermission === null) {
      Alert.alert(
        t("common.error"),
        "Camera permission is still being checked."
      );
      return;
    }
    if (!hasPermission) {
      Alert.alert(
        t("camera.permission"),
        "Camera permission is required to take photos. Please grant permission in settings."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false, // Base64 is handled by processImage later
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        resetAnalysisState();
        setShowResults(false); // Close the results modal if it was open
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert(t("common.error"), "Failed to take photo");
    }
  };

  const handleSelectFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("camera.permission"),
          "Gallery permission is required to select photos"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [ImagePicker.MediaType.Images],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false, // Base64 is handled by processImage later
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        resetAnalysisState();
        setShowResults(false); // Close the results modal if it was open
          language: "hebrew",
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert(t("common.error"), "Failed to select image");
    }
  };

  // Reset analysis state when new image is selected or analysis is discarded
  const resetAnalysisState = () => {
    setAnalysisData(null);
    setEditedIngredients([]);
    setUserComment("");
    setHasBeenAnalyzed(false);
    setShowNutritionDetails(true);
    setShowAdvancedNutrition(false);
    dispatch(clearPendingMeal());
    dispatch(clearError());

    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    nutritionCardAnim.setValue(0);
  };

  // Initial analysis
  const handleAnalyzeImage = async () => {
    if (!selectedImage) {
      Alert.alert(t("common.error"), "Please select an image first");
      return;
    }

    try {
      console.log("🔍 Starting initial meal analysis...");

      const base64Image = await processImage(selectedImage);
      if (!base64Image) {
        Alert.alert(t("common.error"), "Could not process image.");
        return;
      }

      const analysisParams = {
        imageBase64: base64Image,
        language: isRTL ? "hebrew" : "english", // Use language from context
        includeDetailedIngredients: true,
        includeNutritionBreakdown: true,
      };

      analysisParams.updateText =
        (userComment.trim()
          ? userComment.trim() +
            " " +
            "Please provide a comprehensive list of ALL ingredients with detailed nutritional information."
          : "Please identify ALL ingredients in this meal with complete nutritional information for each ingredient including calories, protein, carbs, fat, fiber, sugar, and sodium content.") ||
        "";

          language: "hebrew",
      const result = await dispatch(analyzeMeal(analysisParams));

      if (analyzeMeal.fulfilled.match(result)) {
        console.log("✅ Initial analysis completed successfully");
        if (result.payload?.analysis?.ingredients) {
          console.log(
            "🥗 Ingredients found:",
            result.payload.analysis.ingredients.length
          );
        }
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        console.error("❌ Analysis failed:", result.payload);
        Alert.alert(
          t("camera.analysis_failed"),
          typeof result.payload === "string"
            ? result.payload
            : "Failed to analyze meal. Please try again."
        );
      }
    } catch (error) {
      console.error("💥 Analysis error:", error);
      Alert.alert(
        t("camera.analysis_failed"),
        error instanceof Error ? error.message : "Analysis failed"
      );
    }
  };

  // Re-analysis after edits
  const handleReAnalyze = async () => {
    if (!selectedImage || !hasBeenAnalyzed) {
      Alert.alert(t("common.error") || "Error", "No meal to re-analyze");
      return;
    }

    try {
      console.log("🔄 Starting re-analysis with edits...");

      const base64Image = await processImage(selectedImage);
      if (!base64Image) {
        Alert.alert(
          t("common.error") || "Error",
          "Could not process image for re-analysis."
        );
        return;
      }

      // Create update text based on user comment and edited ingredients
      let updateText = userComment.trim();
      if (editedIngredients.length > 0) {
        const ingredientsList = editedIngredients
          .map((ing) => ing.name)
          .join(", ");
        updateText +=
          (updateText ? " " : "") +
          `Please re-analyze considering these ingredients: ${ingredientsList}. Provide updated nutritional information.`;
      }
      if (!updateText) {
        updateText =
          "Please re-analyze this meal with updated nutritional information.";
      }

      const reAnalysisParams = {
        imageBase64: base64Image,
        language: isRTL ? "hebrew" : "english",
        includeDetailedIngredients: true,
        includeNutritionBreakdown: true,
        updateText: updateText,
      };

      const result = await dispatch(analyzeMeal(reAnalysisParams));

      if (analyzeMeal.fulfilled.match(result)) {
        console.log("✅ Re-analysis completed successfully");
        Alert.alert(
          t("common.success") || "Success",
          "Meal re-analyzed successfully with your edits!"
        );
        // Scroll to top to see updated results
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        console.error("❌ Re-analysis failed:", result.payload);
        Alert.alert(
          "Re-analysis Failed",
          typeof result.payload === "string"
            ? result.payload
            : "Failed to re-analyze meal. Please try again."
        );
      }
    } catch (error) {
      console.error("💥 Re-analysis error:", error);
      Alert.alert(
        "Re-analysis Failed",
        error instanceof Error ? error.message : "Re-analysis failed"
      );
    }
  };

  // Save meal to database
  const handleSaveMeal = async () => {
    if (!analysisData) {
      Alert.alert(t("common.error"), "No analysis data to save");
      return;
    }

    try {
      console.log("💾 Saving meal to database...");

      const result = await dispatch(postMeal());

      if (postMeal.fulfilled.match(result)) {
        console.log("✅ Meal saved successfully");

        await refreshAllMealData(); // Refresh the global list of meals

        Alert.alert(t("camera.save_success"), "Meal saved successfully!", [
          {
            text: t("common.ok"),
            onPress: () => {
              resetAnalysisState();
              setSelectedImage(null);
              setShowResults(false);
            },
          },
        ]);
      } else {
        console.error("❌ Save failed:", result.payload);
        Alert.alert(
          t("camera.save_failed"),
          typeof result.payload === "string"
            ? result.payload
            : "Failed to save meal. Please try again."
        );
      }
    } catch (error) {
      console.error("💥 Save error:", error);
      Alert.alert(
        t("camera.save_failed"),
        error instanceof Error ? error.message : "Save failed"
      );
    }
  };

  // Discard analysis
  const handleDeleteMeal = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteMeal = () => {
    console.log("🗑️ Discarding meal analysis...");
    resetAnalysisState();
    setSelectedImage(null);
    setShowDeleteConfirm(false);
    setShowResults(false);
    Alert.alert(t("common.success"), "Meal analysis discarded successfully");
  };

  // Ingredient editing functions
  const handleEditIngredient = (ingredient: Ingredient, index: number) => {
    setEditingIngredient({ ...ingredient });
    setEditingIndex(index);
    setShowEditModal(true);
  };

  const handleAddIngredient = () => {
    const newIngredient: Ingredient = {
      name: "",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium_mg: 0,
    };
    setEditingIngredient(newIngredient);
    setEditingIndex(-1); // -1 indicates adding a new ingredient
    setShowEditModal(true);
  };

  const handleRemoveIngredient = (index: number) => {
    const updatedIngredients = editedIngredients.filter((_, i) => i !== index);
    setEditedIngredients(updatedIngredients);
  };

  const handleSaveIngredient = () => {
    if (!editingIngredient || !editingIngredient.name.trim()) {
      Alert.alert(t("common.error"), "Ingredient name is required");
      return;
    }

    const updatedIngredients = [...editedIngredients];

    if (editingIndex >= 0) {
      // Update existing ingredient
      updatedIngredients[editingIndex] = editingIngredient;
    } else {
      // Add new ingredient
      updatedIngredients.push(editingIngredient);
    }

    setEditedIngredients(updatedIngredients);
    setShowEditModal(false);
    setEditingIngredient(null);
    setEditingIndex(-1);
  };

  // Calculate total nutrition from current data
  const calculateTotalNutrition = () => {
    // Use editedIngredients if available, otherwise fallback to analysisData.ingredients
    const currentIngredients =
      editedIngredients.length > 0
        ? editedIngredients
        : analysisData?.ingredients || [];

    if (!analysisData && currentIngredients.length === 0) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      };
    }

    // If analysisData exists, use its overall totals first, then sum ingredients if needed for detail
    const totalCalories = analysisData?.calories || 0;
    const totalProtein = analysisData
      ? getNutritionValue(analysisData, "protein_g") ||
        getNutritionValue(analysisData, "protein") ||
        0
      : 0;
    const totalCarbs = analysisData
      ? getNutritionValue(analysisData, "carbs_g") ||
        getNutritionValue(analysisData, "carbs") ||
        0
      : 0;
    const totalFat = analysisData
      ? getNutritionValue(analysisData, "fats_g") ||
        getNutritionValue(analysisData, "fat") ||
        0
      : 0;
    const totalFiber = analysisData
      ? getNutritionValue(analysisData, "fiber_g") ||
        getNutritionValue(analysisData, "fiber") ||
        0
      : 0;
    const totalSugar = analysisData
      ? getNutritionValue(analysisData, "sugar_g") ||
        getNutritionValue(analysisData, "sugar") ||
        0
      : 0;
    const totalSodium = analysisData
      ? getNutritionValue(analysisData, "sodium_mg") ||
        getNutritionValue(analysisData, "sodium") ||
        0
      : 0;
    // If ingredients are available, calculate their sum as a fallback or for finer detail
    if (currentIngredients.length > 0) {
      let ingredientSumCalories = 0;
      let ingredientSumProtein = 0;
      let ingredientSumCarbs = 0;
      let ingredientSumFat = 0;
      let ingredientSumFiber = 0;
      let ingredientSumSugar = 0;
      let ingredientSumSodium = 0;

      currentIngredients.forEach((ingredient) => {
        ingredientSumCalories += getNutritionValueForIngredient(
          ingredient,
          "calories"
        );
        ingredientSumProtein +=
          getNutritionValueForIngredient(ingredient, "protein_g") ||
          getNutritionValueForIngredient(ingredient, "protein");
        ingredientSumCarbs +=
          getNutritionValueForIngredient(ingredient, "carbs_g") ||
          getNutritionValueForIngredient(ingredient, "carbs");
        ingredientSumFat +=
          getNutritionValueForIngredient(ingredient, "fats_g") ||
          getNutritionValueForIngredient(ingredient, "fat");
        ingredientSumFiber +=
          getNutritionValueForIngredient(ingredient, "fiber_g") ||
          getNutritionValueForIngredient(ingredient, "fiber");
        ingredientSumSugar +=
          getNutritionValueForIngredient(ingredient, "sugar_g") ||
          getNutritionValueForIngredient(ingredient, "sugar");
        ingredientSumSodium +=
          getNutritionValueForIngredient(ingredient, "sodium_mg") ||
          getNutritionValueForIngredient(ingredient, "sodium");
      });

      // Prioritize sums from ingredients if they are more representative or if main analysis is missing
      return {
        calories: ingredientSumCalories || totalCalories,
        protein: ingredientSumProtein || totalProtein,
        carbs: ingredientSumCarbs || totalCarbs,
        fat: ingredientSumFat || totalFat,
        fiber: ingredientSumFiber || totalFiber,
        sugar: ingredientSumSugar || totalSugar,
        sodium: ingredientSumSodium || totalSodium,
      };
    }

    return {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      fiber: totalFiber,
      sugar: totalSugar,
      sodium: totalSodium,
    };
  };

  // Get nutrition quality score
  const getNutritionQuality = () => {
    if (!analysisData)
      return { score: 0, label: "Unknown", color: colors.textSecondary };

    const totalNutrition = calculateTotalNutrition();

    let score = 50; // Base score

    // Protein bonus
    if (totalNutrition.protein > 20) score += 20;
    else if (totalNutrition.protein > 10) score += 10;

    // Fiber bonus
    if (totalNutrition.fiber > 10) score += 15;
    else if (totalNutrition.fiber > 5) score += 8;

    // Sugar penalty
    if (totalNutrition.sugar > 25) score -= 15;
    else if (totalNutrition.sugar > 15) score -= 8;

    // Calorie balance (example: moderate calories are good)
    if (totalNutrition.calories > 100 && totalNutrition.calories < 600)
      score += 10;
    else if (totalNutrition.calories >= 600) score -= 10; // Penalize very high calories

    score = Math.max(0, Math.min(100, score));

    if (score >= 80)
      return { score, label: "Excellent", color: colors.success };
    if (score >= 60) return { score, label: "Good", color: colors.warning };
    if (score >= 40)
      return { score, label: "Fair", color: colors.textSecondary };
    return { score, label: "Poor", color: colors.error };
  };

  // Render functions
  const renderImageSelection = () => (
    <View style={styles.imageSelectionContainer}>
      <LinearGradient
        colors={[colors.surface, colors.surfaceVariant]}
        style={styles.imageSelectionGradient}
      >
        <View style={styles.imageSelectionHeader}>
          <View style={styles.cameraIconContainer}>
            <Camera size={60} color={colors.primary} />
          </View>
          <Text
            style={[
              styles.imageSelectionTitle,
              isRTL && styles.rtlText,
              { color: colors.primary },
            ]}
          >
            Smart Meal Analysis
          </Text>
          <Text
            style={[
              styles.imageSelectionSubtitle,
              isRTL && styles.rtlText,
              { color: colors.primary },
            ]}
          >
            Take a photo or select from gallery to get detailed nutritional
            information
          </Text>
        </View>

        <View style={styles.imageSelectionButtons}>
          <TouchableOpacity
            style={styles.imageSelectionButton}
            onPress={handleTakePhoto}
          >
            <LinearGradient
              colors={[colors.primary, colors.primary]}
              style={styles.imageButtonGradient}
            >
              <Camera size={24} color="#ffffff" />
              <Text style={styles.imageButtonText}>Take Photo</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageSelectionButton}
            onPress={handleSelectFromGallery}
          >
            <LinearGradient
              colors={[colors.secondary, colors.secondaryDark]}
              style={styles.imageButtonGradient}
            >
              <ImageIcon size={24} color="#ffffff" />
              <Text style={styles.imageButtonText}>Choose from Gallery</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={[styles.tipContainer, { backgroundColor: colors.card }]}>
          <Info size={20} color={colors.primary} />
          <View style={styles.tipTextContainer}>
            <Text
              style={[
                styles.tipTitle,
                isRTL && styles.rtlText,
                { color: colors.primary },
              ]}
            >
              Pro Tips for Better Results
            </Text>
            <Text
              style={[
                styles.tipDescription,
                isRTL && styles.rtlText,
                { color: colors.primary },
              ]}
            >
              • Ensure good lighting and clear view of the food{"\n"}• Include
              all components of your meal{"\n"}• Avoid shadows and reflections
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderMealHeader = () => {
    if (!analysisData) return null;

    const quality = getNutritionQuality();

    return (
      <Animated.View
        style={[
          styles.mealHeaderContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primary]}
          style={styles.mealHeaderGradient}
        >
          <View style={styles.mealHeaderContent}>
            <View style={styles.mealTitleRow}>
              <View style={styles.mealTitleContainer}>
                <Text style={[styles.mealTitle, isRTL && styles.rtlText]}>
                  {getMealName(analysisData)}
                </Text>
                <View style={styles.confidenceContainer}>
                  <Eye size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.confidenceText}>
                    {Math.round(analysisData.confidence || 85)}% confidence
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.qualityBadge,
                  { backgroundColor: quality.color },
                ]}
              >
                <Star size={12} color="#ffffff" />
                <Text style={styles.qualityText}>{quality.label}</Text>
              </View>
            </View>

            <View style={styles.mealMetaRow}>
              <View style={styles.metaItem}>
                <Clock size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.metaText}>
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>

              {(analysisData.cooking_method || analysisData.cookingMethod) && (
                <View style={styles.metaItem}>
                  <Apple size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.metaText}>
                    {analysisData.cooking_method || analysisData.cookingMethod}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderNutritionSummary = () => {
    if (!analysisData) return null;

    const totalNutrition = calculateTotalNutrition();

    console.log("🍎 Rendering nutrition summary:", totalNutrition);
    console.log("🥗 Current ingredients:", editedIngredients);

    return (
      <Animated.View
        style={[
          styles.nutritionContainer,
          {
            opacity: nutritionCardAnim,
            transform: [{ scale: nutritionCardAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={[colors.card, colors.surface]}
          style={styles.nutritionGradient}
        >
          <View style={styles.nutritionHeader}>
            <Text style={[styles.nutritionTitle, isRTL && styles.rtlText]}>
              Nutritional Information
            </Text>
            <Text style={styles.nutritionSubtitle}>
              Complete breakdown of your meal
            </Text>
          </View>

          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionCard}>
              <View
                style={[
                  styles.nutritionIconContainer,
                  { backgroundColor: "#fee2e2" },
                ]}
              >
                <Flame size={24} color="#ef4444" />
              </View>
              <Text style={styles.nutritionValue}>
                {totalNutrition.calories}
              </Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>

            <View style={styles.nutritionCard}>
              <View
                style={[
                  styles.nutritionIconContainer,
                  { backgroundColor: "#dbeafe" },
                ]}
              >
                <Zap size={24} color="#3b82f6" />
              </View>
              <Text style={styles.nutritionValue}>
                {totalNutrition.protein}g
              </Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>

            <View style={styles.nutritionCard}>
              <View
                style={[
                  styles.nutritionIconContainer,
                  { backgroundColor: "#fef3c7" },
                ]}
              >
                <Wheat size={24} color="#f59e0b" />
              </View>
              <Text style={styles.nutritionValue}>{totalNutrition.carbs}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>

            <View style={styles.nutritionCard}>
              <View
                style={[
                  styles.nutritionIconContainer,
                  { backgroundColor: "#ecfdf5" },
                ]}
              >
                <Droplets size={24} color="#10b981" />
              </View>
              <Text style={styles.nutritionValue}>{totalNutrition.fat}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>

          {(totalNutrition.fiber > 0 ||
            totalNutrition.sugar > 0 ||
            totalNutrition.sodium > 0) && (
            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => setShowNutritionDetails(!showNutritionDetails)}
            >
              <Text style={styles.detailsToggleText}>
                {showNutritionDetails ? "Hide Details" : "Show More Details"}
              </Text>
              <Animated.View
                style={[
                  styles.chevron,
                  showNutritionDetails && styles.chevronRotated,
                ]}
              >
                <ChevronDown size={18} color={colors.primary} />
              </Animated.View>
            </TouchableOpacity>
          )}

          {showNutritionDetails && (
            <Animated.View style={styles.detailedNutrition}>
              {totalNutrition.fiber > 0 && (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    <Apple size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>Fiber</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {totalNutrition.fiber}g
                  </Text>
                </View>
              )}
              {totalNutrition.sugar > 0 && (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    <Heart size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>Sugar</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {totalNutrition.sugar}g
                  </Text>
                </View>
              )}
              {totalNutrition.sodium > 0 && (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    <Droplets size={16} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>Sodium</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {totalNutrition.sodium}mg
                  </Text>
                </View>
              )}

              {/* Advanced nutrition */}
              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={() => setShowAdvancedNutrition(!showAdvancedNutrition)}
              >
                <Text style={styles.advancedToggleText}>
                  Advanced Nutrition
                </Text>
                <Animated.View
                  style={[showAdvancedNutrition && styles.chevronRotated]}
                >
                  <ChevronDown size={16} color={colors.primary} />
                </Animated.View>
              </TouchableOpacity>

              {showAdvancedNutrition && (
                <View style={styles.advancedNutrition}>
                  {getNutritionValue(analysisData, "saturated_fats_g") > 0 && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailLabelContainer}>
                        <Droplets size={16} color={colors.textSecondary} />
                        <Text style={styles.detailLabel}>Saturated Fat</Text>
                      </View>
                      <Text style={styles.detailValue}>
                        {getNutritionValue(analysisData, "saturated_fats_g")}g
                      </Text>
                    </View>
                  )}
                  {getNutritionValue(analysisData, "cholesterol_mg") > 0 && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailLabelContainer}>
                        <Heart size={16} color={colors.textSecondary} />
                        <Text style={styles.detailLabel}>Cholesterol</Text>
                      </View>
                      <Text style={styles.detailValue}>
                        {getNutritionValue(analysisData, "cholesterol_mg")}mg
                      </Text>
                    </View>
                  )}
                  {getNutritionValue(analysisData, "serving_size_g") > 0 && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailLabelContainer}>
                        <Apple size={16} color={colors.textSecondary} />
                        <Text style={styles.detailLabel}>Serving Size</Text>
                      </View>
                      <Text style={styles.detailValue}>
                        {getNutritionValue(analysisData, "serving_size_g")}g
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderSelectedImage = () => (
    <View style={styles.selectedImageContainer}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: selectedImage! }} style={styles.selectedImage} />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.3)"]}
          style={styles.imageGradientOverlay}
        />

        {/* Image overlay with quick actions */}
        <View style={styles.imageOverlay}>
          <TouchableOpacity
            style={[styles.overlayButton, styles.deleteOverlayButton]}
            onPress={() => {
              resetAnalysisState();
              setSelectedImage(null);
              setShowResults(false);
            }}
          >
            <X size={18} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.overlayButton, styles.retakeOverlayButton]}
            onPress={handleTakePhoto}
          >
            <RotateCcw size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {!hasBeenAnalyzed && (
        <>
          <View style={styles.commentContainer}>
            <Text style={[styles.commentLabel, isRTL && styles.rtlText]}>
              Additional Information (Optional)
            </Text>
            <TextInput
              style={[
                styles.commentInput,
                isRTL && styles.rtlTextInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Add any details about the meal (ingredients, cooking method, etc.)"
              placeholderTextColor={colors.textSecondary}
              value={userComment}
              onChangeText={setUserComment}
              multiline
              numberOfLines={3}
              textAlign={isRTL ? "right" : "left"}
            />
          </View>

          <TouchableOpacity
            style={[styles.analyzeButton, isAnalyzing && styles.buttonDisabled]}
            onPress={handleAnalyzeImage}
            disabled={isAnalyzing}
          >
            <LinearGradient
              colors={
                isAnalyzing
                  ? [colors.error, colors.textSecondary]
                  : [colors.primary, colors.primary]
              }
              style={styles.analyzeButtonGradient}
            >
              {isAnalyzing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={20} color="#ffffff" />
              )}
              <Text style={styles.analyzeButtonText}>
                {isAnalyzing ? "Analyzing Meal..." : "Analyze My Meal"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderAnalysisResults = () => {
    if (!analysisData) return null;

    console.log("🔄 Rendering analysis results with data:", analysisData);

    return (
      <View style={styles.analysisContainer}>
        {renderMealHeader()}
        {renderNutritionSummary()}

        {/* Ingredients Section */}
        <View style={styles.ingredientsSection}>
          <View style={styles.ingredientsHeader}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              Identified Ingredients (
              {
                (editedIngredients.length > 0
                  ? editedIngredients
                  : analysisData.ingredients || []
                ).length
              }
              )
            </Text>
            <TouchableOpacity
              style={styles.addIngredientButton}
              onPress={handleAddIngredient}
            >
              <Plus size={16} color={colors.primary} />
              <Text style={[styles.addIngredientText, isRTL && styles.rtlText]}>
                {isRTL ? "הוסף" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>

          {editedIngredients.length > 0 ? (
            editedIngredients.map((ingredient, index) => (
              <View key={`edited-${index}`} style={styles.ingredientItem}>
                <View style={styles.ingredientHeader}>
                  <Text
                    style={[
                      styles.ingredientName,
                      isRTL && styles.rtlText,
                      { color: colors.text },
                    ]}
                  >
                    {ingredient.name || `Ingredient ${index + 1}`}
                  </Text>
                  <View style={styles.ingredientActions}>
                    <TouchableOpacity
                      style={styles.ingredientActionButton}
                      onPress={() => handleEditIngredient(ingredient, index)}
                    >
                      <Edit3 size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.ingredientActionButton}
                      onPress={() => handleRemoveIngredient(index)}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.ingredientNutrition}>
                  <Text style={styles.ingredientNutritionText}>
                    {Math.round(
                      getNutritionValueForIngredient(ingredient, "calories") ||
                        0
                    )}{" "}
                    cal
                  </Text>
                  {(getNutritionValueForIngredient(ingredient, "protein_g") ||
                    getNutritionValueForIngredient(ingredient, "protein")) >
                    0 && (
                    <Text style={styles.ingredientNutritionText}>
                      •{" "}
                      {Math.round(
                        getNutritionValueForIngredient(
                          ingredient,
                          "protein_g"
                        ) ||
                          getNutritionValueForIngredient(
                            ingredient,
                            "protein"
                          ) ||
                          0
                      )}
                      g protein
                    </Text>
                  )}
                  {(getNutritionValueForIngredient(ingredient, "carbs_g") ||
                    getNutritionValueForIngredient(ingredient, "carbs")) >
                    0 && (
                    <Text style={styles.ingredientNutritionText}>
                      •{" "}
                      {Math.round(
                        getNutritionValueForIngredient(ingredient, "carbs_g") ||
                          getNutritionValueForIngredient(ingredient, "carbs") ||
                          0
                      )}
                      g carbs
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : analysisData.ingredients &&
            analysisData.ingredients.length > 0 ? (
            analysisData.ingredients.map((ingredient, index) => (
              <View key={`original-${index}`} style={styles.ingredientItem}>
                <View style={styles.ingredientHeader}>
                  <Text
                    style={[
                      styles.ingredientName,
                      isRTL && styles.rtlText,
                      { color: colors.text },
                    ]}
                  >
                    {typeof ingredient === "string"
                      ? ingredient
                      : ingredient.name || `Ingredient ${index + 1}`}
                  </Text>
                  <View style={styles.ingredientActions}>
                    <TouchableOpacity
                      style={styles.ingredientActionButton}
                      onPress={() => {
                        const ingredientToEdit =
                          typeof ingredient === "string"
                            ? {
                                name: ingredient,
                                calories: 0,
                                protein: 0,
                                carbs: 0,
                                fat: 0,
                              }
                            : ingredient;
                        handleEditIngredient(ingredientToEdit, index);
                      }}
                    >
                      <Edit3 size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.ingredientNutrition}>
                  {typeof ingredient !== "string" && (
                    <>
                      <Text style={styles.ingredientNutritionText}>
                        {Math.round(
                          getNutritionValueForIngredient(
                            ingredient,
                            "calories"
                          ) || 0
                        )}{" "}
                        cal
                      </Text>
                      {(getNutritionValueForIngredient(
                        ingredient,
                        "protein_g"
                      ) ||
                        getNutritionValueForIngredient(ingredient, "protein")) >
                        0 && (
                        <Text style={styles.ingredientNutritionText}>
                          •{" "}
                          {Math.round(
                            getNutritionValueForIngredient(
                              ingredient,
                              "protein_g"
                            ) ||
                              getNutritionValueForIngredient(
                                ingredient,
                                "protein"
                              ) ||
                              0
                          )}
                          g protein
                        </Text>
                      )}
                      {(getNutritionValueForIngredient(ingredient, "carbs_g") ||
                        getNutritionValueForIngredient(ingredient, "carbs")) >
                        0 && (
                        <Text style={styles.ingredientNutritionText}>
                          •{" "}
                          {Math.round(
                            getNutritionValueForIngredient(
                              ingredient,
                              "carbs_g"
                            ) ||
                              getNutritionValueForIngredient(
                                ingredient,
                                "carbs"
                              ) ||
                              0
                          )}
                          g carbs
                        </Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noIngredientsContainer}>
              <Text
                style={[
                  styles.noIngredientsText,
                  isRTL && styles.rtlText,
                  { color: colors.textSecondary },
                ]}
              >
                No ingredients identified. Add some manually or re-analyze the
                image.
              </Text>
            </View>
          )}
        </View>

        {/* Recommendations Section */}
        {(analysisData.recommendations || analysisData.healthNotes) && (
          <View style={styles.recommendationsSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              AI Health Recommendations
            </Text>
            <View style={styles.recommendationCard}>
              <TrendingUp size={20} color={colors.primary} />
              <Text
                style={[
                  styles.recommendationText,
                  isRTL && styles.rtlText,
                  { color: colors.text },
                ]}
              >
                {analysisData.recommendations || analysisData.healthNotes}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleDeleteMeal}
          >
            <Trash2 size={18} color={colors.error} />
            <Text style={[styles.secondaryButtonText, { color: colors.error }]}>
              Delete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              isUpdating && styles.buttonDisabled,
            ]}
            onPress={handleReAnalyze}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <RefreshCw size={18} color={colors.primary} />
            )}
            <Text
              style={[styles.secondaryButtonText, { color: colors.primary }]}
            >
              {isUpdating ? "Updating..." : "Re-analyze"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, isPosting && styles.buttonDisabled]}
            onPress={handleSaveMeal}
            disabled={isPosting}
          >
            <LinearGradient
              colors={
                isPosting
                  ? [colors.error, colors.textSecondary]
                  : [colors.success, colors.emerald600]
              }
              style={styles.primaryButtonGradient}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Save size={20} color="#ffffff" />
              )}
              <Text style={styles.primaryButtonText}>
                {isPosting ? "Saving..." : "Save Meal"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowEditModal(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingIndex >= 0 ? "Edit" : "Add"} Ingredient
            </Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <X size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Name *
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={editingIngredient?.name || ""}
                onChangeText={(text) =>
                  setEditingIngredient((prev) =>
                    prev ? { ...prev, name: text } : null
                  )
                }
                placeholder="Enter ingredient name"
                placeholderTextColor={colors.textSecondary}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Calories
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.calories?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, calories: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Protein (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.protein?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, protein: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Carbs (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.carbs?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, carbs: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Fat (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.fat?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, fat: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Fiber (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.fiber?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, fiber: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Sugar (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.sugar?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, sugar: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Sodium (mg)
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={editingIngredient?.sodium_mg?.toString() || "0"}
                onChangeText={(text) =>
                  setEditingIngredient((prev) =>
                    prev ? { ...prev, sodium_mg: parseFloat(text) || 0 } : null
                  )
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </ScrollView>

          <View
            style={[styles.modalActions, { borderTopColor: colors.border }]}
          >
            <TouchableOpacity
              style={[
                styles.modalCancelButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setShowEditModal(false)}
            >
              <Text
                style={[
                  styles.modalCancelText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveIngredient}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary]}
                style={styles.modalSaveButtonGradient}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderDeleteConfirmModal = () => (
    <Modal
      visible={showDeleteConfirm}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowDeleteConfirm(false)}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[styles.confirmModalContent, { backgroundColor: colors.card }]}
        >
          <View style={styles.warningIconContainer}>
            <AlertTriangle size={48} color={colors.error} />
          </View>
          <Text style={[styles.confirmTitle, { color: colors.text }]}>
            Delete Analysis
          </Text>
          <Text
            style={[styles.confirmMessage, { color: colors.textSecondary }]}
          >
            Are you sure you want to delete this meal analysis? This action
            cannot be undone.
          </Text>

          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={() => setShowDeleteConfirm(false)}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmDeleteButton}
              onPress={confirmDeleteMeal}
            >
              <LinearGradient
                colors={[colors.error, "#dc2626"]}
                style={styles.confirmDeleteButtonGradient}
              >
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Error display
  const renderError = () => {
    if (!error) return null;

    return (
      <View
        style={[
          styles.errorContainer,
          {
            backgroundColor: isDark ? "#2d1b1b" : "#fef2f2",
            borderColor: isDark ? "#5b2d2d" : "#fecaca",
          },
        ]}
      >
        <AlertTriangle size={20} color={colors.error} />
        <Text
          style={[
            styles.errorText,
            isRTL && styles.rtlText,
            { color: colors.error },
          ]}
        >
          {error}
        </Text>
        <TouchableOpacity
          style={styles.errorDismiss}
          onPress={() => dispatch(clearError())}
        >
          <X size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  const createStyles = (colors: any, isDark: boolean) =>
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.background,
      },
      scrollView: {
        flex: 1,
      },
      scrollContent: {
        paddingBottom: 32,
      },
      header: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        alignItems: "center",
      },
      title: {
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 8,
        color: colors.text,
      },
      subtitle: {
        fontSize: 16,
        textAlign: "center",
        lineHeight: 24,
        color: colors.textSecondary,
      },
      rtlText: {
        textAlign: "right",
        writingDirection: "rtl",
      },
      rtlTextInput: {
        textAlign: "right",
      },

      // Error styles
      errorContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 24,
        marginBottom: 16,
      },
      errorText: {
        flex: 1,
        fontSize: 14,
        marginLeft: 12,
      },
      errorDismiss: {
        padding: 4,
      },

      // Image selection styles
      imageSelectionContainer: {
        marginHorizontal: 24,
        borderRadius: 24,
        overflow: "hidden",
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      imageSelectionGradient: {
        padding: 40,
      },
      imageSelectionHeader: {
        alignItems: "center",
        marginBottom: 40,
      },
      cameraIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      imageSelectionTitle: {
        fontSize: 28,
        fontWeight: "bold",
        color: colors.primary,
        marginBottom: 12,
        textAlign: "center",
      },
      imageSelectionSubtitle: {
        fontSize: 16,
        color: colors.primary,
        textAlign: "center",
        lineHeight: 24,
        paddingHorizontal: 20,
      },
      imageSelectionButtons: {
        gap: 16,
        marginBottom: 32,
      },
      imageSelectionButton: {
        borderRadius: 16,
        overflow: "hidden",
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      imageButtonGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 18,
        paddingHorizontal: 24,
        gap: 12,
      },
      imageButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#ffffff",
      },
      tipContainer: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: 16,
        padding: 20,
        gap: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      tipTextContainer: {
        flex: 1,
      },
      tipTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.primary,
        marginBottom: 8,
      },
      tipDescription: {
        fontSize: 14,
        color: colors.primary,
        lineHeight: 20,
      },

      // Selected image styles
      selectedImageContainer: {
        marginHorizontal: 24,
        marginBottom: 24,
      },
      imageWrapper: {
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      selectedImage: {
        width: "100%",
        height: 280,
        backgroundColor: colors.surface,
      },
      imageGradientOverlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
      },
      imageOverlay: {
        position: "absolute",
        top: 16,
        right: 16,
        flexDirection: "row",
        gap: 12,
      },
      overlayButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      deleteOverlayButton: {
        backgroundColor: "rgba(239, 68, 68, 0.9)",
      },
      retakeOverlayButton: {
        backgroundColor: "rgba(59, 130, 246, 0.9)",
      },
      commentContainer: {
        marginTop: 20,
      },
      commentLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 12,
      },
      commentInput: {
        borderWidth: 2,
        borderRadius: 16,
        padding: 18,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: "top",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      analyzeButton: {
        marginTop: 24,
        borderRadius: 20,
        overflow: "hidden",
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      analyzeButtonGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
        gap: 12,
      },
      analyzeButtonText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#ffffff",
      },

      // Analysis results styles
      analysisContainer: {
        marginHorizontal: 24,
        gap: 24,
      },

      // Meal header styles
      mealHeaderContainer: {
        borderRadius: 24,
        overflow: "hidden",
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      mealHeaderGradient: {
        padding: 24,
      },
      mealHeaderContent: {
        gap: 16,
      },
      mealTitleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
      },
      mealTitleContainer: {
        flex: 1,
        marginRight: 16,
      },
      mealTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#ffffff",
        marginBottom: 6,
      },
      confidenceContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      },
      confidenceText: {
        fontSize: 14,
        color: "rgba(255,255,255,0.8)",
        fontWeight: "500",
      },
      qualityBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
      },
      qualityText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#ffffff",
      },
      mealMetaRow: {
        flexDirection: "row",
        gap: 20,
        flexWrap: "wrap",
      },
      metaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      },
      metaText: {
        fontSize: 14,
        color: "rgba(255,255,255,0.9)",
        fontWeight: "500",
      },

      // Nutrition summary styles
      nutritionContainer: {
        borderRadius: 20,
        overflow: "hidden",
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      nutritionGradient: {
        padding: 24,
      },
      nutritionHeader: {
        marginBottom: 20,
      },
      nutritionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 4,
      },
      nutritionSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
      },
      nutritionCard: {
        flex: 1,
        minWidth: (screenWidth - 96) / 2 - 6,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
        elevation: 2,
        shadowColor: isDark ? "#000" : "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 8,
      },
      nutritionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
      },
      nutritionValue: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 4,
      },
      nutritionLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      },
      detailsToggle: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 12,
        gap: 8,
      },
      detailsToggleText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: "600",
      },
      chevron: {
        // Base chevron container style
      },
      chevronRotated: {
        transform: [{ rotate: "180deg" }],
      },
      detailedNutrition: {
        marginTop: 16,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 12,
      },
      detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
      },
      detailLabelContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      },
      detailLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: "500",
      },
      detailValue: {
        fontSize: 14,
        color: colors.text,
        fontWeight: "600",
      },
      advancedToggle: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        marginTop: 12,
      },
      advancedToggleText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: "600",
      },
      advancedNutrition: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 8,
      },

      // Ingredients styles
      ingredientsSection: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 24,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.08,
        shadowRadius: 12,
      },
      ingredientsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
      },
      sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
      },
      addIngredientButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.mint,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary,
        gap: 4,
      },
      addIngredientText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: "600",
      },
      ingredientItem: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary || "#10b981",
        shadowColor: isDark ? "#000" : "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.2 : 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
      ingredientHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      ingredientName: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
        flex: 1,
      },
      ingredientNutrition: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: 2,
        marginTop: 4,
      },
      ingredientNutritionText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginRight: 5,
      },
      ingredientPortion: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: "italic",
      },
      ingredientActions: {
        flexDirection: "row",
        gap: 8,
      },
      ingredientActionButton: {
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.card,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },

      // Recommendations styles
      recommendationsSection: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 24,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.08,
        shadowRadius: 12,
      },
      recommendationCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: colors.seafoam,
        borderRadius: 16,
        padding: 20,
        gap: 16,
        marginTop: 12,
      },
      recommendationText: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
      },

      // Action buttons styles
      actionButtons: {
        flexDirection: "row",
        gap: 12,
        flexWrap: "wrap",
      },
      primaryButton: {
        flex: 2,
        minWidth: 200,
        borderRadius: 16,
        overflow: "hidden",
        elevation: 6,
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      primaryButtonGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        gap: 8,
      },
      primaryButtonText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#ffffff",
      },
      secondaryButton: {
        flex: 1,
        minWidth: 100,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 16,
        paddingVertical: 16,
        gap: 6,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      secondaryButtonText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textSecondary,
      },
      buttonDisabled: {
        opacity: 0.6,
      },

      // Modal styles
      modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
      },
      modalContent: {
        backgroundColor: colors.card,
        borderRadius: 24,
        width: screenWidth - 48,
        maxHeight: "85%",
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
      },
      modalBody: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        maxHeight: 400,
      },
      inputGroup: {
        marginBottom: 16,
      },
      inputRow: {
        flexDirection: "row",
        gap: 12,
      },
      inputLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 8,
      },
      modalInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: colors.text,
      },
      modalActions: {
        flexDirection: "row",
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 12,
      },
      modalCancelButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
      },
      modalCancelText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.textSecondary,
      },
      modalSaveButton: {
        flex: 1,
        borderRadius: 12,
        overflow: "hidden",
      },
      modalSaveButtonGradient: {
        paddingVertical: 14,
        alignItems: "center",
      },
      modalSaveText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#ffffff",
      },

      // No ingredients styles
      noIngredientsContainer: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
      },
      noIngredientsText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
      },

      // Confirm modal styles
      confirmModalContent: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 32,
        alignItems: "center",
        marginHorizontal: 24,
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      warningIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#fef2f2",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
      },
      confirmTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 8,
        textAlign: "center",
      },
      confirmMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 32,
      },
      confirmActions: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
      },
      confirmCancelButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
      },
      confirmCancelText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.textSecondary,
      },
      confirmDeleteButton: {
        flex: 1,
        borderRadius: 12,
        overflow: "hidden",
      },
      confirmDeleteButtonGradient: {
        paddingVertical: 14,
        alignItems: "center",
      },
      confirmDeleteText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#ffffff",
      },
      // Permission styles
      permissionContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      },
      permissionText: {
        fontSize: 18,
        textAlign: "center",
        marginBottom: 20,
      },
      permissionButton: {
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 8,
      },
      permissionButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "600",
      },
      // Modal specific styles
      modalContainer: {
        flex: 1,
      },
    });

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      {!hasPermission && (
        <View
          style={[
            styles.permissionContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <Text style={[styles.permissionText, { color: colors.text }]}>
            {t("camera.permission") || "Camera permission is required"}
          </Text>
          <TouchableOpacity
            style={[
              styles.permissionButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={async () => {
              const { status } =
                await ImagePicker.requestCameraPermissionsAsync();
              setHasPermission(status === "granted");
            }}
          >
            <Text style={styles.permissionButtonText}>
              {t("camera.grantPermission") || "Grant Permission"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {hasPermission && (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                isRTL && styles.rtlText,
                { color: colors.text },
              ]}
            >
              Meal Scanner
            </Text>
            <Text
              style={[
                styles.subtitle,
                isRTL && styles.rtlText,
                { color: colors.textSecondary },
              ]}
            >
              Discover nutritional insights with AI-powered food analysis
            </Text>
          </View>

          {/* Error Display */}
          {renderError()}

          {/* Main Content */}
          {!selectedImage ? (
            renderImageSelection()
          ) : (
            <>
              {renderSelectedImage()}
              {/* Conditionally render analysis results based on showResults state */}
              {showResults && renderAnalysisResults()}
            </>
          )}
        </ScrollView>
      )}

      {/* Modals */}
      {renderEditModal()}
      {renderDeleteConfirmModal()}
    </SafeAreaView>
  );
}

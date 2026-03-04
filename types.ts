
export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_PLAN = 'GENERATING_PLAN',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ImagePrompt {
  description: string; // The descriptive text for the UI
  generationPrompt: string; // The prompt for the AI model (Traditional Chinese requested)
}

export interface Step {
  action: string;
  description: string;
  visualFocus: string; // Specific visual description for this step (Traditional Chinese)
}

export interface Ingredient {
  name: string;
  amount: string;
}

export interface RecipePlan {
  topic: string;
  date: string;
  signature: string;
  
  // Cover Data
  coverHeadline: string;
  coverSubtext: string;
  
  // Steps Data
  ingredients: Ingredient[];
  steps: Step[];
  tips: string[];
  
  // Final Data
  finalDishName: string;
  finalDishDescription: string;
  
  // Newsletter
  newsletterContent: string;
  
  // AI Image Prompts
  prompts: {
    cover: ImagePrompt;
    ingredients: ImagePrompt; // NEW: Prompt for the ingredients illustration
    final: ImagePrompt;
  };
}

export interface GeneratedImages {
  cover?: string;
  ingredients?: string; // NEW: The generated ingredients image
  steps: (string | undefined)[]; 
  final?: string;
}

import React, { useState, useEffect, useRef } from 'react';
import { generateRecipePlan, generateJournalImage } from './services/geminiService';
import { RecipePlan, GeneratedImages, GenerationStatus } from './types';
import { WashiTape } from './components/WashiTape';
import { 
  SparklesIcon, 
  HeartIcon,
  KeyIcon,
  ArrowPathIcon,
  CameraIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  EnvelopeIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  StarIcon
} from '@heroicons/react/24/solid';

// --- SVG Icons for Hand-Drawn Elements ---
const ArrowCurvedDownRight = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 50 50" className={`fill-none stroke-[#8D6E63] stroke-2 ${className}`} style={{ filter: 'drop-shadow(1px 1px 0px rgba(0,0,0,0.1))' }}>
    <path d="M5,10 Q25,5 35,25 T40,45" strokeLinecap="round" markerEnd="url(#arrowhead)" />
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#8D6E63" />
      </marker>
    </defs>
  </svg>
);

const ArrowCurvedDownLeft = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 50 50" className={`fill-none stroke-[#8D6E63] stroke-2 ${className}`} style={{ filter: 'drop-shadow(1px 1px 0px rgba(0,0,0,0.1))' }}>
    <path d="M45,10 Q25,5 15,25 T10,45" strokeLinecap="round" markerEnd="url(#arrowhead)" />
  </svg>
);

const StarDoodle = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`fill-[#F4D35E] text-[#FBC02D] ${className}`}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

// --- Helper Component: Prompt Modal ---
interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptText: string;
  onConfirm: (newPrompt: string) => void;
  isLoading: boolean;
}

const PromptModal: React.FC<PromptModalProps> = ({ isOpen, onClose, promptText, onConfirm, isLoading }) => {
  const [text, setText] = useState(promptText);

  useEffect(() => {
    setText(promptText);
  }, [promptText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-4 border-[#5D4037]">
        <div className="bg-[#5D4037] p-4 flex justify-between items-center">
          <h3 className="text-[#FFF8E1] font-bubbly-cn text-xl">調整繪圖指令</h3>
          <button onClick={onClose} className="text-[#FFF8E1] hover:bg-white/10 rounded-full p-1">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-2 font-hand-cn">您可以修改下方的提示詞來重新生成圖片 (英文效果較佳):</p>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 p-3 border-2 border-[#D7CCC8] rounded-xl focus:border-[#8D6E63] outline-none font-hand-cn text-[#5D4037] text-lg resize-none bg-[#FFFDF5]"
          />
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border-2 border-[#8D6E63] text-[#8D6E63] font-bold font-hand-cn hover:bg-[#EFEBE9]">
              取消
            </button>
            <button 
              onClick={() => onConfirm(text)} 
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-[#5D4037] text-white font-bold font-hand-cn hover:bg-[#4E342E] flex items-center justify-center gap-2"
            >
              {isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
              重新生成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Helper Component: Loading/Status Overlay ---
const LoadingOverlay: React.FC<{ status: GenerationStatus, progressText: string }> = ({ status, progressText }) => {
  if (status === GenerationStatus.IDLE || status === GenerationStatus.COMPLETED || status === GenerationStatus.ERROR) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-[#5D4037] text-[#FFF8E1] px-6 py-3 rounded-full shadow-xl flex items-center gap-4 border-2 border-[#FFF8E1]">
      <div className="w-5 h-5 border-2 border-[#FFF8E1] border-t-transparent rounded-full animate-spin"></div>
      <span className="font-hand-cn text-lg tracking-wider">{progressText}</span>
    </div>
  );
};

// --- Main App Component ---
const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(true);
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [progressText, setProgressText] = useState('');
  const [plan, setPlan] = useState<RecipePlan | null>(null);
  
  const [images, setImages] = useState<GeneratedImages>({ steps: [] });
  const [imageErrors, setImageErrors] = useState<{cover?: boolean, ingredients?: boolean, steps?: boolean[], final?: boolean}>({});
  const [error, setError] = useState<string | null>(null);

  // Refs for Downloading
  const coverRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);

  // Regeneration State
  const [modalOpen, setModalOpen] = useState(false);
  const [activePromptType, setActivePromptType] = useState<'cover' | 'final' | 'ingredients' | 'step' | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [currentPromptText, setCurrentPromptText] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const SIGNATURE = "Designed by 尹甄的生活美學";



  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setStatus(GenerationStatus.GENERATING_PLAN);
    setProgressText("正在撰寫食譜計畫...");
    setError(null);
    setPlan(null);
    setImages({ steps: [] });
    setImageErrors({});

    try {
      const result = await generateRecipePlan(topic);
      setPlan(result);
      
      setStatus(GenerationStatus.GENERATING_IMAGES);
      
      // Trigger image generation
      setProgressText("正在繪製：封面、材料與完成圖...");
      triggerSingleImage(result.prompts.cover.generationPrompt, 'cover');
      triggerSingleImage(result.prompts.ingredients.generationPrompt, 'ingredients');
      triggerSingleImage(result.prompts.final.generationPrompt, 'final');
      
      // Steps
      const stepPrompts = result.steps.map(s => s.visualFocus);
      triggerStepImages(stepPrompts);

    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("403") || err.message.includes("permission"))) {
        setError("權限不足。請重新連結您的 Google API Key。");
        setHasApiKey(false);
      } else {
        const msg = err.message || "未知錯誤";
        setError(`無法產生食譜計畫: ${msg}`);
      }
      setStatus(GenerationStatus.ERROR);
    }
  };

  const triggerSingleImage = async (prompt: string, type: 'cover' | 'final' | 'ingredients') => {
    try {
      setImageErrors(prev => ({ ...prev, [type]: false }));
      const img = await generateJournalImage(prompt, type);
      setImages(prev => ({ ...prev, [type]: img }));
    } catch (e) {
      console.error(`Failed to generate ${type}`, e);
      setImageErrors(prev => ({ ...prev, [type]: true }));
    }
  };

  const triggerStepImages = async (prompts: string[]) => {
    setImages(prev => ({ ...prev, steps: new Array(prompts.length).fill(undefined) }));
    setImageErrors(prev => ({ ...prev, steps: new Array(prompts.length).fill(false) }));

    for (let i = 0; i < prompts.length; i++) {
        setProgressText(`正在繪製：步驟 ${i+1} / ${prompts.length}...`);
        try {
            const img = await generateJournalImage(prompts[i], 'steps');
            setImages(prev => {
                const newSteps = [...prev.steps];
                newSteps[i] = img;
                return { ...prev, steps: newSteps };
            });
            await new Promise(r => setTimeout(r, 800));
        } catch (e) {
            console.error(`Step ${i} generation failed`, e);
            setImageErrors(prev => {
                const newErrors = prev.steps ? [...prev.steps] : new Array(prompts.length).fill(false);
                newErrors[i] = true;
                return { ...prev, steps: newErrors };
            });
        }
    }
    setStatus(GenerationStatus.COMPLETED);
    setProgressText("");
  };

  const retryStepImage = async (index: number) => {
    if (!plan) return;
    const prompt = plan.steps[index].visualFocus;
    
    setImages(prev => {
      const newSteps = [...prev.steps];
      newSteps[index] = undefined;
      return { ...prev, steps: newSteps };
    });
    
    setImageErrors(prev => {
      const newErrors = prev.steps ? [...prev.steps] : [];
      newErrors[index] = false;
      return { ...prev, steps: newErrors };
    });

    try {
      const img = await generateJournalImage(prompt, 'steps');
      setImages(prev => {
        const newSteps = [...prev.steps];
        newSteps[index] = img;
        return { ...prev, steps: newSteps };
      });
    } catch (e) {
      console.error(`Retry step ${index} failed`, e);
      setImageErrors(prev => {
        const newErrors = prev.steps ? [...prev.steps] : [];
        newErrors[index] = true;
        return { ...prev, steps: newErrors };
      });
    }
  };

  // --- Regeneration Logic ---
  const openRegenModal = (type: 'cover' | 'final' | 'ingredients' | 'step', stepIndex: number = -1) => {
    if (!plan) return;
    setActivePromptType(type);
    setActiveStepIndex(stepIndex);
    
    if (type === 'cover') setCurrentPromptText(plan.prompts.cover.generationPrompt);
    else if (type === 'final') setCurrentPromptText(plan.prompts.final.generationPrompt);
    else if (type === 'ingredients') setCurrentPromptText(plan.prompts.ingredients.generationPrompt);
    else if (type === 'step' && stepIndex >= 0) setCurrentPromptText(plan.steps[stepIndex].visualFocus);
    
    setModalOpen(true);
  };

  const handleRegenerateConfirm = async (newPrompt: string) => {
    setIsRegenerating(true);
    try {
      if (activePromptType === 'cover') {
        await triggerSingleImage(newPrompt, 'cover');
        if (plan) plan.prompts.cover.generationPrompt = newPrompt; 
      } else if (activePromptType === 'final') {
        await triggerSingleImage(newPrompt, 'final');
        if (plan) plan.prompts.final.generationPrompt = newPrompt;
      } else if (activePromptType === 'ingredients') {
        await triggerSingleImage(newPrompt, 'ingredients');
        if (plan) plan.prompts.ingredients.generationPrompt = newPrompt;
      } else if (activePromptType === 'step' && activeStepIndex >= 0) {
         const img = await generateJournalImage(newPrompt, 'steps');
         setImages(prev => {
             const newSteps = [...prev.steps];
             newSteps[activeStepIndex] = img;
             return { ...prev, steps: newSteps };
         });
         if (plan) plan.steps[activeStepIndex].visualFocus = newPrompt;
      }
      setModalOpen(false);
    } catch (e) {
      console.error("Regeneration failed", e);
    } finally {
      setIsRegenerating(false);
    }
  };

  // --- Download Logic ---
  const downloadCard = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    try {
      // @ts-ignore
      const canvas = await window.html2canvas(ref.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#FFFDF5', 
        logging: false
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Screenshot failed", err);
      alert("下載失敗，請稍後再試。");
    }
  };

  const handleDownloadAll = () => {
    if (coverRef.current) downloadCard(coverRef, `${topic}_封面.png`);
    setTimeout(() => { if (stepsRef.current) downloadCard(stepsRef, `${topic}_教程.png`); }, 500);
    setTimeout(() => { if (finalRef.current) downloadCard(finalRef, `${topic}_成品.png`); }, 1000);
  };



  return (
    <div className="min-h-screen bg-[#F9F5F0] text-[#5D4037] font-sans pb-20 overflow-x-hidden">
      <div className="fixed inset-0 opacity-30 pointer-events-none z-0 bg-[radial-gradient(#D7CCC8_1.5px,transparent_1.5px)] bg-[length:20px_20px]"></div>
      
      <LoadingOverlay status={status} progressText={progressText} />
      
      <PromptModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        promptText={currentPromptText} 
        onConfirm={handleRegenerateConfirm}
        isLoading={isRegenerating}
      />

      <header className="relative pt-10 pb-6 text-center z-10">
        <h1 className="mb-2 transform -rotate-1 inline-block text-5xl md:text-6xl font-bubbly-cn text-[#2F4F4F]">
          尹甄の生活美學
        </h1>
      </header>

      <section className="max-w-xl mx-auto px-6 mb-8 relative z-20">
        <form onSubmit={handleGeneratePlan} className="relative group">
          <div className="absolute inset-0 bg-[#A1887F] rounded-full transform translate-x-1 translate-y-2 opacity-30"></div>
          <div className="relative bg-white border-2 border-[#8D6E63] rounded-full flex overflow-hidden shadow-sm p-1">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="輸入主題 (例: 茶葉蛋, 草莓蛋糕)..."
              className="flex-1 px-6 py-3 text-xl outline-none font-hand-cn placeholder-[#D7CCC8] text-[#5D4037] bg-transparent"
              disabled={status === GenerationStatus.GENERATING_PLAN}
            />
            <button
              type="submit"
              disabled={status === GenerationStatus.GENERATING_PLAN || !topic}
              className="bg-[#5D4037] text-[#FFF8E1] px-8 py-2 rounded-full font-bold flex items-center gap-2 font-hand-cn text-lg"
            >
              {status === GenerationStatus.GENERATING_PLAN ? '繪製中...' : '製作'}
            </button>
          </div>
        </form>
      </section>

      {error && <div className="max-w-md mx-auto text-center mb-8 font-hand-cn text-red-500 z-20 relative px-4 break-words">{error}</div>}

      {plan && (
        <>
          {/* Global Actions */}
          <div className="max-w-[1200px] mx-auto px-4 mb-4 flex justify-end relative z-20">
             <button onClick={handleDownloadAll} className="text-sm font-hand-cn text-[#8DA399] hover:underline flex items-center gap-1">
               <ArrowDownTrayIcon className="w-4 h-4" /> 下載所有圖片
             </button>
          </div>

          <main className="max-w-[1200px] mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10 mb-12">
            
            {/* ============ CARD 1: COVER ============ */}
            <div className="relative w-full max-w-[380px] mx-auto flex flex-col">
              <div className="flex justify-end mb-2">
                 <button onClick={() => downloadCard(coverRef, `${topic}_封面.png`)} className="bg-white border border-[#D7CCC8] text-[#5D4037] rounded-full p-2 shadow-sm hover:bg-[#FFFDF5] active:scale-95 transition-transform" title="下載此圖片">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                 </button>
              </div>
              <div 
                ref={coverRef}
                className="group relative aspect-[3/4] bg-[#FFFDF5] rounded-sm shadow-xl overflow-hidden flex flex-col transition-all hover:shadow-2xl"
              >
                <div className="texture-overlay"></div>
                <div className="absolute top-0 left-0 w-full h-2 bg-[#D7CCC8] opacity-20"></div>
                
                <WashiTape color="bg-tape-teal" className="top-4 -right-6 rotate-45 z-20 w-32 shadow-md" />
                <WashiTape color="bg-tape-red" className="bottom-20 -left-4 -rotate-12 z-20 w-24 opacity-80" />

                <div className="flex-1 flex flex-col p-6 relative">
                    <div className="mb-6 mt-4 relative z-10">
                       <div className="flex justify-between items-start">
                          <div className="bg-white/80 border border-gray-200 px-2 py-1 transform -rotate-2 shadow-sm inline-block">
                             <p className="font-hand-cn text-xs text-gray-500 tracking-widest">{plan.date}</p>
                          </div>
                          <StarDoodle className="w-8 h-8 opacity-60 transform rotate-12" />
                       </div>
                       
                       <h2 className="text-5xl font-bubbly-cn text-ink-dark mt-2 leading-none relative">
                          {plan.coverHeadline}
                          <span className="absolute -top-4 -right-2 text-3xl text-[#F4D35E] opacity-80 animate-pulse">✨</span>
                       </h2>
                       
                       <div className="mt-2 ml-4 bg-[#F4D35E] px-3 py-1 inline-block transform -rotate-1 shadow-sm">
                          <p className="font-hand-cn text-[#5D4037] text-lg font-bold">{plan.coverSubtext}</p>
                       </div>
                    </div>

                    <div className="relative flex-1 mb-10 transform rotate-2">
                       <div className="absolute inset-0 bg-gray-200 clip-torn-paper transform translate-x-1 translate-y-1"></div>
                       <div className="relative w-full h-64 bg-white clip-torn-paper overflow-hidden z-10">
                          {imageErrors.cover ? (
                              <div className="w-full h-full bg-[#FFF0F0] flex flex-col items-center justify-center text-red-400">
                                  <ExclamationCircleIcon className="w-12 h-12 mb-2" />
                                  <button onClick={() => triggerSingleImage(plan.prompts.cover.generationPrompt, 'cover')} className="px-3 py-1 bg-white border border-red-200 rounded-full text-xs">重試</button>
                              </div>
                          ) : images.cover ? (
                              <img src={images.cover} alt="Cover" className="w-full h-full object-cover" />
                          ) : (
                              <div className="w-full h-full bg-[#EEE] animate-pulse"></div>
                          )}
                       </div>
                       <button onClick={() => openRegenModal('cover')} className="absolute top-2 right-2 bg-white/80 p-2 rounded-full z-20 opacity-0 group-hover:opacity-100"><PencilSquareIcon className="w-4 h-4 text-[#5D4037]" /></button>
                    </div>

                    <div className="absolute bottom-4 right-4 transform -rotate-2">
                       <p className="font-hand-cn text-[10px] text-gray-400">{SIGNATURE}</p>
                    </div>
                </div>
              </div>
            </div>

            {/* ============ CARD 2: STEPS (REDESIGNED) ============ */}
            <div className="relative w-full max-w-[380px] mx-auto flex flex-col">
              <div className="flex justify-end mb-2">
                 <button onClick={() => downloadCard(stepsRef, `${topic}_教程.png`)} className="bg-white border border-[#D7CCC8] text-[#5D4037] rounded-full p-2 shadow-sm hover:bg-[#FFFDF5] active:scale-95 transition-transform" title="下載此圖片">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                 </button>
              </div>
              
              <div 
                ref={stepsRef}
                className="group relative aspect-[3/4] bg-[#FFFDF5] rounded-sm shadow-xl overflow-hidden flex flex-col p-5"
              >
                <div className="texture-overlay"></div>
                <div className="absolute inset-0 bg-[radial-gradient(#D7CCC8_1px,transparent_1px)] bg-[length:16px_16px] opacity-30"></div>
                <WashiTape color="bg-tape-red" className="top-0 left-1/2 -translate-x-1/2 w-32 shadow-sm z-30" />

                {/* --- HEADER TITLE --- */}
                <div className="relative z-10 text-center mb-3 mt-4">
                  <h2 className="text-3xl font-bubbly-cn text-ink-dark inline-block relative tracking-widest">
                     {plan.coverHeadline}
                     <span className="font-hand-cn text-lg ml-2 text-[#8D6E63]">教程</span>
                  </h2>
                </div>

                {/* --- INGREDIENTS SECTION (Small & Cute) --- */}
                <div className="relative z-20 mb-3 flex items-start gap-2 bg-white/40 p-2 rounded-lg border border-[#D7CCC8] border-dashed">
                   <div className="w-14 h-14 flex-shrink-0 group/ing relative">
                       {images.ingredients ? (
                           <img 
                             src={images.ingredients} 
                             className="w-full h-full object-contain mix-blend-multiply filter contrast-125" 
                             alt="Ingredients" 
                           />
                       ) : <div className="w-full h-full bg-gray-100 rounded-full animate-pulse" />}
                       <button onClick={() => openRegenModal('ingredients')} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ing:opacity-100 bg-black/5"><PencilSquareIcon className="w-3 h-3 text-[#5D4037]" /></button>
                   </div>
                   <div className="flex-1 min-w-0 pt-1">
                      <div className="inline-block bg-[#F4D35E] px-2 py-0.5 rounded-sm transform -rotate-1 mb-1">
                        <span className="text-[10px] font-bold text-[#5D4037] font-hand-cn">準備材料</span>
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0 text-[10px] font-hand-cn text-[#5D4037] leading-relaxed">
                          {plan.ingredients.map((ing, i) => (
                             <span key={i}>{ing.name}</span>
                          ))}
                      </div>
                   </div>
                </div>

                {/* --- STEPS GRID (2x2 Collage) --- */}
                <div className="flex-1 grid grid-cols-2 gap-2 relative z-10">
                    {/* Arrows Layer */}
                    <div className="absolute inset-0 pointer-events-none z-0">
                       <ArrowCurvedDownRight className="absolute top-[25%] left-[40%] w-12 h-12 opacity-60" />
                       <ArrowCurvedDownLeft className="absolute top-[50%] right-[30%] w-12 h-12 opacity-60" />
                       <ArrowCurvedDownRight className="absolute bottom-[20%] left-[40%] w-10 h-10 opacity-60" />
                    </div>

                    {plan.steps.map((step, i) => {
                      const stepImage = images.steps[i];
                      const hasError = imageErrors.steps?.[i];

                      return (
                        <div key={i} className="relative flex flex-col items-center group/step">
                            {/* Hand-drawn Image - No Frame, Multiply Blend */}
                            <div className="relative w-full aspect-square flex items-center justify-center">
                               {hasError ? (
                                 <button onClick={() => retryStepImage(i)} className="text-red-400 bg-red-50/50 rounded-full p-2"><ArrowPathIcon className="w-5 h-5" /></button>
                               ) : stepImage ? (
                                 <img 
                                   src={stepImage} 
                                   className="w-[90%] h-[90%] object-contain mix-blend-multiply drop-shadow-sm filter contrast-110" 
                                   alt={`Step ${i+1}`} 
                                 />
                               ) : (
                                 <div className="w-16 h-16 bg-gray-100 rounded-full animate-pulse opacity-50"></div>
                               )}
                               <button onClick={() => openRegenModal('step', i)} className="absolute top-1 right-1 bg-white/50 rounded-full p-1 opacity-0 group-hover/step:opacity-100"><PencilSquareIcon className="w-3 h-3 text-[#5D4037]" /></button>
                               
                               {/* Step Number Badge */}
                               <div className="absolute top-0 left-0 w-6 h-6 bg-[#8D6E63] text-white font-bubbly-cn text-sm flex items-center justify-center rounded-full shadow-sm border-2 border-[#FFFDF5] z-10">
                                 {i+1}
                               </div>
                            </div>
                            
                            {/* Text Description */}
                            <div className="text-center -mt-2 relative z-10 px-1">
                               <h4 className="font-bubbly-cn text-sm text-[#2F4F4F]">{step.action}</h4>
                               <p className="font-hand-cn text-[9px] text-[#8D6E63] leading-tight opacity-90">{step.description}</p>
                            </div>
                        </div>
                      );
                    })}
                </div>

                <div className="text-center mt-1">
                  <p className="font-hand-cn text-[9px] text-gray-300">{SIGNATURE}</p>
                </div>
              </div>
            </div>

            {/* ============ CARD 3: FINAL ============ */}
            <div className="relative w-full max-w-[380px] mx-auto flex flex-col">
              <div className="flex justify-end mb-2">
                 <button onClick={() => downloadCard(finalRef, `${topic}_成品.png`)} className="bg-white border border-[#D7CCC8] text-[#5D4037] rounded-full p-2 shadow-sm hover:bg-[#FFFDF5] active:scale-95 transition-transform" title="下載此圖片">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                 </button>
              </div>
              <div 
                ref={finalRef}
                className="group relative aspect-[3/4] bg-[#FFFDF5] rounded-sm shadow-xl overflow-hidden flex flex-col transition-all hover:shadow-2xl"
              >
                 <div className="texture-overlay"></div>
                 <div className="absolute inset-0 bg-lined-paper opacity-30"></div>
                 
                 <HeartIcon className="absolute top-10 left-10 w-6 h-6 text-red-200 transform -rotate-12" />
                 <StarIcon className="absolute bottom-20 right-8 w-8 h-8 text-yellow-200 transform rotate-45" />

                 <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                    
                    <div className="bg-white p-3 pb-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] transform rotate-2 border border-gray-100 relative w-full group/final">
                        <WashiTape color="bg-tape-teal" className="-top-4 left-1/2 -translate-x-1/2 w-24 opacity-90 shadow-sm" />
                        
                        <div className="aspect-square w-full bg-gray-100 overflow-hidden clip-photo-frame relative">
                            {imageErrors.final ? (
                                <div className="w-full h-full bg-[#FFF0F0] flex flex-col items-center justify-center text-red-400">
                                    <ExclamationCircleIcon className="w-12 h-12 mb-2" />
                                    <button onClick={() => triggerSingleImage(plan.prompts.final.generationPrompt, 'final')} className="px-3 py-1 bg-white border border-red-200 rounded-full text-xs">重試</button>
                                </div>
                            ) : images.final ? (
                                <img src={images.final} alt="Final" className="w-full h-full object-cover scale-105" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#D7CCC8]"><CameraIcon className="w-8 h-8 animate-pulse" /></div>
                            )}
                        </div>
                        <button onClick={() => openRegenModal('final')} className="absolute top-2 right-2 bg-white/80 p-2 rounded-full z-20 opacity-0 group-hover/final:opacity-100"><PencilSquareIcon className="w-5 h-5 text-[#5D4037]" /></button>

                        <div className="mt-4 text-center px-2">
                           <h3 className="font-bubbly-cn text-2xl text-ink-dark">{plan.finalDishName}</h3>
                           <p className="font-hand-cn text-xs text-gray-400 mt-1">{plan.finalDishDescription}</p>
                        </div>

                        <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full border-4 border-stamp-red text-stamp-red flex items-center justify-center transform -rotate-12 opacity-80 mask-rough bg-white/40">
                          <span className="font-bubbly-cn text-xl font-bold tracking-widest leading-tight text-center">絕品<br/>美味</span>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center gap-2 opacity-60">
                        <span className="h-px w-8 bg-[#8D6E63]"></span>
                        <p className="font-hand-cn text-xs text-[#8D6E63]">{SIGNATURE}</p>
                        <span className="h-px w-8 bg-[#8D6E63]"></span>
                    </div>
                 </div>
              </div>
            </div>

          </main>
          
          {/* ============ NEWSLETTER SECTION ============ */}
          <section className="max-w-[800px] mx-auto px-4 mb-20 relative z-10">
            <div className="bg-white p-8 rounded-sm shadow-lg border border-gray-200 relative transform -rotate-1">
               <WashiTape color="bg-tape-teal" className="-top-3 left-1/2 -translate-x-1/2 w-32 shadow-sm" />
               
               <div className="flex items-center gap-3 mb-6 border-b-2 border-gray-100 pb-4">
                  <div className="bg-[#5D4037] p-2 rounded-full text-white">
                     <EnvelopeIcon className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bubbly-cn text-[#5D4037]">給粉絲的悄悄話</h2>
               </div>
               
               <div className="font-hand-cn text-lg text-[#5D4037] leading-loose whitespace-pre-line">
                  {plan.newsletterContent}
               </div>
               
               <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => navigator.clipboard.writeText(plan.newsletterContent)}
                    className="text-sm font-sans text-[#8D6E63] hover:text-[#5D4037] border-b border-dashed border-[#8D6E63]"
                  >
                    複製文字
                  </button>
               </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default App;
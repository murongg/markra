import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

export function useImeInputGuard() {
  const composingRef = useRef(false);

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
  };

  const isComposingEnter = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const keyCode = "keyCode" in event.nativeEvent ? event.nativeEvent.keyCode : 0;

    return event.nativeEvent.isComposing || composingRef.current || keyCode === 229;
  };

  return {
    handleCompositionEnd,
    handleCompositionStart,
    isComposingEnter
  };
}

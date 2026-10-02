// ... existing imports ...
import { BanWordModal } from './BanWordModal';
import { useLongPress } from '../lib/useLongPress';

// ... existing code ...

export function RunScreen() {
  // ... existing state ...
  const [banModalState, setBanModalState] = React.useState<{
    isOpen: boolean;
    word: string;
    category: string;
    gameId?: string;
    recapId?: string;
  }>({ isOpen: false, word: '', category: '' });

  const { user } = useAuth();
  const isModerator = user?.role === 'moderator' || user?.role === 'super_moderator';

  const handleLongPressWord = React.useCallback((word: string, category: string, gameId?: string, recapId?: string) => {
    if (!isModerator) return;
    setBanModalState({ isOpen: true, word, category, gameId, recapId });
  }, [isModerator]);

  const handleBanConfirm = React.useCallback(async () => {
    const { word, category, gameId, recapId } = banModalState;
    try {
      const { data, error } = await supabase.rpc('create_ban_proposal', {
        p_word: word,
        p_category: category,
        p_moderator_id: user?.id,
        p_game_context: { game_id: gameId ?? null, recap_id: recapId ?? null, category }
      });
      if (error) throw error;
      setBanModalState({ isOpen: false, word: '', category: '' });
      // Show success toast
    } catch (err) {
      console.error('Failed to create ban proposal:', err);
      // Show error toast
    }
  }, [banModalState, user]);

  const handleBanCancel = React.useCallback(() => {
    setBanModalState({ isOpen: false, word: '', category: '' });
  }, []);

  // Long press hook for word cells
  const longPressProps = useLongPress(
    (e) => {
      const word = e.currentTarget.getAttribute('data-word');
      const category = e.currentTarget.getAttribute('data-category');
      const gameId = e.currentTarget.getAttribute('data-game-id');
      const recapId = e.currentTarget.getAttribute('data-recap-id');
      if (word && category) handleLongPressWord(word, category, gameId ?? undefined, recapId ?? undefined);
    },
    { threshold: 500 } // 500ms long press
  );

  // In the recap word rendering, add longPressProps and data attributes:
  // <span {...longPressProps} data-word={word} data-category={category} data-game-id={gameId} data-recap-id={recapId}>
  //   {word}
  // </span>

  return (
    <>
      {/* ... existing RunScreen content ... */}
      
      {/* Word cells in recap should have long press */}
      {/* Example integration in recap section: */}
      {/* 
      <div className="recap-words">
        {recap.words.map((w) => (
          <span 
            key={w.id} 
            className="word-cell"
            {...longPressProps}
            data-word={w.word}
            data-category={w.category}
            data-game-id={gameId}
            data-recap-id={recap.id}
          >
            {w.word}
          </span>
        ))}
      </div>
      */}

      <BanWordModal
        isOpen={banModalState.isOpen}
        word={banModalState.word}
        category={banModalState.category}
        onConfirm={handleBanConfirm}
        onCancel={handleBanCancel}
      />
    </>
  );
}

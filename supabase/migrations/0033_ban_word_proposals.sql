-- Migration: Ajouter le support des propositions de bannissement de mots
-- Les modérateurs peuvent proposer de bannir un mot depuis n'importe quel recap de jeu
-- Un mot banni entre dans la liste de modération comme les ajouts
-- Une fois banni, le mot peut toujours être utilisé mais entre en modération
-- Les joueurs pourront reproposer le mot plus tard

-- Ajouter une colonne pour distinguer les propositions de bannissement des ajouts
ALTER TABLE moderation_proposals 
ADD COLUMN IF NOT EXISTS is_ban_proposal BOOLEAN DEFAULT FALSE;

-- Ajouter une colonne pour le type de proposition (add ou ban)
ALTER TABLE moderation_proposals 
ADD COLUMN IF NOT EXISTS proposal_type TEXT CHECK (proposal_type IN ('add', 'ban')) DEFAULT 'add';

-- Ajouter une colonne pour le contexte du jeu (game_id, recap, etc.)
ALTER TABLE moderation_proposals 
ADD COLUMN IF NOT EXISTS game_context JSONB DEFAULT NULL;

-- Index pour filtrer rapidement par type
CREATE INDEX IF NOT EXISTS idx_moderation_proposals_type 
ON moderation_proposals(proposal_type, created_at);

-- Vue pour les propositions de bannissement en attente
CREATE OR REPLACE VIEW v_ban_proposals_pending AS
SELECT * FROM moderation_proposals
WHERE proposal_type = 'ban' 
  AND status = 'pending'
ORDER BY created_at DESC;

-- Fonction pour créer une proposition de bannissement
CREATE OR REPLACE FUNCTION create_ban_proposal(
  p_word TEXT,
  p_category TEXT,
  p_moderator_id UUID,
  p_game_context JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_proposal_id UUID;
BEGIN
  INSERT INTO moderation_proposals (
    word,
    category,
    proposal_type,
    is_ban_proposal,
    status,
    moderator_id,
    game_context,
    created_at
  ) VALUES (
    p_word,
    p_category,
    'ban',
    TRUE,
    'pending',
    p_moderator_id,
    p_game_context,
    NOW()
  ) RETURNING id INTO v_proposal_id;
  
  RETURN v_proposal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour mettre à jour les taux d'apparition quand un mot est banni
CREATE OR REPLACE FUNCTION update_word_appearance_rates_on_ban()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un mot est banni (status passe à 'approved' avec proposal_type = 'ban')
  IF NEW.status = 'approved' 
     AND NEW.proposal_type = 'ban'
     AND OLD.status != 'approved' THEN
    
    -- Réduire le taux d'apparition du mot dans la table words
    UPDATE words 
    SET appearance_rate = GREATEST(0, appearance_rate - 0.1),
        is_banned = TRUE,
        banned_at = NOW(),
        updated_at = NOW()
    WHERE word = NEW.word 
      AND category = NEW.category;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attacher le trigger
DROP TRIGGER IF EXISTS trg_update_word_rates_on_ban ON moderation_proposals;
CREATE TRIGGER trg_update_word_rates_on_ban
  AFTER UPDATE ON moderation_proposals
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND NEW.proposal_type = 'ban' AND OLD.status != 'approved')
  EXECUTE FUNCTION update_word_appearance_rates_on_ban();

-- Ajouter colonne is_banned à la table words si elle n'existe pas
ALTER TABLE words 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

ALTER TABLE words 
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index pour les mots bannis
CREATE INDEX IF NOT EXISTS idx_words_banned 
ON words(is_banned) WHERE is_banned = TRUE;

COMMENT ON TABLE moderation_proposals IS '
Table pour les propositions de modération (ajouts et bannissements de mots).
- proposal_type: ''add'' pour un nouvel mot, ''ban'' pour un bannissement
- is_ban_proposal: true si c''est une proposition de bannissement
- status: ''pending'', ''approved'', ''rejected''
- game_context: JSON avec infos du jeu (game_id, recap, category, etc.)
';

-- Update ModerationScreen to handle ban proposals
-- Labels change based on proposal_type: "Sauver"/"Banir" instead of "Valider"/"Refuser"

-- Update existing view to include proposal type filtering
CREATE OR REPLACE VIEW v_moderation_pending AS
SELECT * FROM moderation_proposals
WHERE status = 'pending'
ORDER BY 
  CASE WHEN proposal_type = 'ban' THEN 0 ELSE 1 END,
  created_at DESC;

-- Add function to get pending proposals with counts
CREATE OR REPLACE FUNCTION get_moderation_queue_stats()
RETURNS TABLE (
  add_count BIGINT,
  ban_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE proposal_type = 'add' OR proposal_type IS NULL) AS add_count,
    COUNT(*) FILTER (WHERE proposal_type = 'ban') AS ban_count,
    COUNT(*) AS total_count
  FROM moderation_proposals
  WHERE status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

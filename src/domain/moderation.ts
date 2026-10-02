import type { Database } from '../lib/database.types';

export type ModerationProposal = Database['public']['Tables']['moderation_proposals']['Row'];
export type BanWordProposal = Omit<ModerationProposal, 'proposal_type' | 'is_ban_proposal'> & {
  proposal_type: 'ban';
  is_ban_proposal: true;
  game_context?: { game_id?: string; recap_id?: string; category?: string } | null;
};

export function isBanProposal(proposal: ModerationProposal): proposal is BanWordProposal {
  return proposal.proposal_type === 'ban' || proposal.is_ban_proposal === true;
}

export function createBanProposalContext(gameId?: string, recapId?: string, category?: string) {
  return { game_id: gameId ?? null, recap_id: recapId ?? null, category: category ?? null };
}

export const MODERATION_LABELS = {
  add: { validate: 'Valider', refuse: 'Refuser', title: 'Proposition d\'ajout' },
  ban: { validate: 'Sauver', refuse: 'Banir', title: 'Proposition de bannissement' }
} as const;

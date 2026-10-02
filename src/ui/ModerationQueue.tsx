import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { MODERATION_LABELS, isBanProposal } from '../domain/moderation';
import type { ModerationProposal } from '../domain/moderation';

interface ModerationQueueProps {
  proposals: ModerationProposal[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ModerationQueue({ proposals, onApprove, onReject }: ModerationQueueProps) {
  const { t } = useTranslation();

  const handleApprove = async (proposal: ModerationProposal) => {
    if (isBanProposal(proposal)) {
      // For ban proposals, approve means "Banir" - word goes to banned list
      await supabase.rpc('approve_ban_proposal', { p_proposal_id: proposal.id });
    } else {
      // For add proposals, approve means "Valider" - word is added
      await supabase.rpc('approve_add_proposal', { p_proposal_id: proposal.id });
    }
    onApprove(proposal.id);
  };

  const handleReject = async (proposal: ModerationProposal) => {
    if (isBanProposal(proposal)) {
      // For ban proposals, reject means word stays available (not banned)
      await supabase.rpc('reject_ban_proposal', { p_proposal_id: proposal.id });
    } else {
      // For add proposals, reject means word is not added
      await supabase.rpc('reject_add_proposal', { p_proposal_id: proposal.id });
    }
    onReject(proposal.id);
  };

  return (
    <div className="moderation-queue">
      {proposals.map((proposal) => {
        const isBan = isBanProposal(proposal);
        const labels = isBan ? MODERATION_LABELS.ban : MODERATION_LABELS.add;
        
        return (
          <div key={proposal.id} className={`moderation-item ${isBan ? 'ban-proposal' : 'add-proposal'}`}>
            <div className="moderation-header">
              <span className="proposal-type-badge">
                {isBan ? '🚫 BAN' : '➕ ADD'}
              </span>
              <span className="proposal-category">{proposal.category}</span>
            </div>
            <div className="moderation-word">{proposal.word}</div>
            {isBan && proposal.game_context && (
              <div className="ban-context">
                <small>
                  {t('moderation.proposed_from', 'Proposé depuis')}:{' '}
                  {proposal.game_context.game_id && `Game ${proposal.game_context.game_id}`}
                </small>
              </div>
            )}
            <div className="moderation-actions">
              <button 
                className="btn-approve" 
                onClick={() => handleApprove(proposal)}
                title={isBan ? 'Bannir ce mot' : 'Valider cet ajout'}
              >
                {labels.validate}
              </button>
              <button 
                className="btn-reject" 
                onClick={() => handleReject(proposal)}
                title={isBan ? 'Ne pas bannir' : 'Refuser cet ajout'}
              >
                {labels.refuse}
              </button>
            </div>
          </div>
        );
      })}
      <style>{`
        .moderation-queue {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .moderation-item {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          padding: 16px;
          border: 2px solid transparent;
        }
        .moderation-item.ban-proposal {
          border-color: var(--accent-ban, #ff6b6b);
          background: linear-gradient(135deg, rgba(255,107,107,0.1) 0%, rgba(26,26,46,0) 100%);
        }
        .moderation-item.add-proposal {
          border-color: var(--accent-add, #4ecdc4);
        }
        .moderation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .proposal-type-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          background: var(--bg-tertiary, #333);
        }
        .ban-proposal .proposal-type-badge {
          background: var(--accent-ban, #ff6b6b);
          color: #fff;
        }
        .add-proposal .proposal-type-badge {
          background: var(--accent-add, #4ecdc4);
          color: #000;
        }
        .proposal-category {
          font-size: 0.875rem;
          color: var(--text-secondary, #aaa);
        }
        .moderation-word {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary, #fff);
          margin: 12px 0;
        }
        .ban-context {
          margin: 8px 0;
          padding: 8px;
          background: var(--bg-tertiary, #333);
          border-radius: 6px;
          font-size: 0.75rem;
          color: var(--text-secondary, #aaa);
        }
        .moderation-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .moderation-actions button {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-approve {
          background: var(--accent-add, #4ecdc4);
          color: #000;
        }
        .ban-proposal .btn-approve {
          background: var(--accent-ban, #ff6b6b);
          color: #fff;
        }
        .btn-approve:hover {
          filter: brightness(1.1);
        }
        .btn-reject {
          background: var(--bg-tertiary, #333);
          color: var(--text-primary, #fff);
        }
        .btn-reject:hover {
          background: var(--bg-quaternary, #444);
        }
      `}</style>
    </div>
  );
}

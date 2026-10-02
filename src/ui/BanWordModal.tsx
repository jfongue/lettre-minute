import React from 'react';
import { useTranslation } from 'react-i18next';

interface BanWordModalProps {
  word: string;
  category: string;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function BanWordModal({ word, category, onConfirm, onCancel, isOpen }: BanWordModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="ban-word-modal-overlay" onClick={onCancel}>
      <div className="ban-word-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('moderation.ban_proposal_title', 'Proposition de bannissement')}</h3>
        <p>
          {t('moderation.ban_proposal_message', 'Vous proposez de bannir le mot')} <strong>{word}</strong>{' '}
          {t('moderation.ban_proposal_category', 'dans la catégorie')} <strong>{category}</strong>.
        </p>
        <p className="ban-word-modal-note">
          {t('moderation.ban_proposal_note', 'Ce mot entrera en phase de modération. Aucun stats ou récompense pour les bannissements.')}
        </p>
        <div className="ban-word-modal-actions">
          <button className="btn-cancel" onClick={onCancel}>
            {t('common.cancel', 'Annuler')}
          </button>
          <button className="btn-confirm" onClick={onConfirm}>
            {t('moderation.ban_confirm', 'Bannir')}
          </button>
        </div>
      </div>
      <style>{`
        .ban-word-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .ban-word-modal {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .ban-word-modal h3 {
          margin: 0 0 16px;
          color: var(--text-primary, #fff);
          font-size: 1.25rem;
        }
        .ban-word-modal p {
          margin: 0 0 12px;
          color: var(--text-secondary, #aaa);
          line-height: 1.5;
        }
        .ban-word-modal strong {
          color: var(--accent, #ff6b6b);
        }
        .ban-word-modal-note {
          font-size: 0.875rem;
          opacity: 0.8;
          border-left: 3px solid var(--accent, #ff6b6b);
          padding-left: 12px;
          margin: 16px 0;
        }
        .ban-word-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .ban-word-modal-actions button {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-cancel {
          background: var(--bg-tertiary, #333);
          color: var(--text-primary, #fff);
        }
        .btn-cancel:hover {
          background: var(--bg-quaternary, #444);
        }
        .btn-confirm {
          background: var(--accent, #ff6b6b);
          color: #fff;
        }
        .btn-confirm:hover {
          background: #ff5252;
        }
      `}</style>
    </div>
  );
}

import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { peso, formatJewelryName } from './utils';
import type { Ticket, PiercingItem } from '../types';

interface Props {
  ticket: Ticket;
  items: PiercingItem[];
  total: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function BreakdownModal({ ticket, items, total, onClose, onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="w-full max-w-xl rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--color-overlay)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between px-8 pt-7 pb-5"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div>
            <p className="text-label-xs mb-1.5" style={{ color: 'var(--color-text-faint)' }}>
              Order Summary
            </p>
            <h2
              className="font-black leading-tight"
              style={{ fontSize: '32px', color: 'var(--color-text)' }}
            >
              {ticket.name}
            </h2>
            <p
              className="font-semibold mt-1"
              style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}
            >
              Ticket #{ticket.ticketNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl mt-1"
            title="Close / Edit ticket"
            style={{
              background: 'transparent',
              color: 'var(--color-text-faint)',
              border: '1px solid transparent',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background   = 'rgba(255,255,255,0.08)';
              el.style.color        = 'var(--color-text)';
              el.style.borderColor  = 'var(--color-border)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background  = 'transparent';
              el.style.color       = 'var(--color-text-faint)';
              el.style.borderColor = 'transparent';
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* ── Items list ── */}
        <div className="px-8 py-5 overflow-y-auto flex-1" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          {items.map((item, idx) => {
            const lineTotal           = (item.basePrice + item.upgradePrice) * item.quantity;
            const isStandaloneJewelry = item.placementName === 'Jewelry' || item.basePrice === 0;
            const hasUpgrade          = item.upgradePrice > 0;
            const isLast              = idx === items.length - 1;

            return (
              <div
                key={item.id}
                className="py-5"
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
                }}
              >
                {/* Member label */}
                {item.memberLabel && (
                  <span
                    className="inline-block px-2 py-0.5 rounded-md text-body-xs font-bold mb-2"
                    style={{
                      background: 'var(--color-brand-bg)',
                      border: '1px solid rgba(124,58,237,0.35)',
                      color: 'var(--color-brand-text)',
                    }}
                  >
                    {item.memberLabel}
                  </span>
                )}

                <div className="flex items-start justify-between gap-4">
                  {/* Line descriptions */}
                  <div className="space-y-0.5">
                    {isStandaloneJewelry ? (
                      <div style={{ fontSize: '20px', lineHeight: '1.3' }}>
                        <span className="font-bold" style={{ color: 'var(--color-warn-text)' }}>
                          {formatJewelryName(item.upgradeLabel)}
                        </span>
                        <span className="font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
                          — {item.upgradePrice}
                        </span>
                        {item.quantity > 1 && (
                          <span className="font-normal ml-2" style={{ color: 'var(--color-text-faint)' }}>
                            × {item.quantity}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Placement line */}
                        <div style={{ fontSize: '20px', lineHeight: '1.3' }}>
                          <span className="font-bold" style={{ color: 'var(--color-text)' }}>
                            {item.placementName}
                          </span>
                          <span className="font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
                            — {item.basePrice}
                          </span>
                          {item.quantity > 1 && !hasUpgrade && (
                            <span className="font-normal ml-2" style={{ color: 'var(--color-text-faint)' }}>
                              × {item.quantity}
                            </span>
                          )}
                        </div>

                        {/* Jewelry upgrade line */}
                        {hasUpgrade && (
                          <div style={{ fontSize: '20px', lineHeight: '1.3' }}>
                            <span className="font-bold" style={{ color: 'var(--color-warn-text)' }}>
                              {formatJewelryName(item.upgradeLabel)}
                            </span>
                            <span className="font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
                              — {item.upgradePrice}
                            </span>
                            {item.quantity > 1 && (
                              <span className="font-normal ml-2" style={{ color: 'var(--color-text-faint)' }}>
                                × {item.quantity}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Line total */}
                  <div className="text-right flex-shrink-0 pt-0.5">
                    <span
                      className="font-black"
                      style={{
                        fontSize: '24px',
                        color: 'var(--color-text)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {peso(lineTotal)}
                    </span>
                    {item.quantity > 1 && (
                      <p className="text-body-xs mt-0.5" style={{ color: 'var(--color-text-faint)' }}>
                        ({peso(item.basePrice + item.upgradePrice)} × {item.quantity})
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Grand total ── */}
        <div
          className="px-8 py-5 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.025)', borderTop: '1px solid var(--color-border)' }}
        >
          <span
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: '18px', color: 'var(--color-text-muted)' }}
          >
            Total
          </span>
          <span
            className="font-black leading-none"
            style={{
              fontSize: '44px',
              color: 'var(--color-success-text)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {peso(total)}
          </span>
        </div>

        {/* ── Complete Order button ── */}
        <div className="px-8 pb-8 pt-3">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black"
            style={{
              fontSize: '20px',
              background: 'var(--color-success)',
              color: '#fff',
              border: 'none',
              boxShadow: 'var(--shadow-success)',
              opacity: confirming ? 0.6 : 1,
            }}
          >
            <CheckCircle2 size={22} />
            {confirming ? 'Completing Order…' : 'Complete Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

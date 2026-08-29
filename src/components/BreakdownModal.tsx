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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-[#13161e] border border-white/12 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-white/8">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">
              Order Summary
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              {ticket.name}
            </h2>
            <p className="text-base sm:text-lg text-slate-400 font-semibold mt-0.5">
              Ticket #{ticket.ticketNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-white/10 text-slate-500 hover:text-white transition-colors mt-1"
            title="Close / Edit ticket"
          >
            <X size={24} />
          </button>
        </div>

        {/* Items breakdown list */}
        <div className="px-8 py-5 overflow-y-auto flex-1 divide-y divide-white/6">
          {items.map((item) => {
            const lineTotal = (item.basePrice + item.upgradePrice) * item.quantity;
            const isStandaloneJewelry = item.placementName === 'Jewelry' || item.basePrice === 0;
            const hasUpgrade = item.upgradePrice > 0;

            return (
              <div key={item.id} className="py-4 first:pt-1 last:pb-1">
                {item.memberLabel && (
                  <span className="inline-block px-2 py-0.5 rounded bg-violet-950/70 border border-violet-600/40 text-violet-300 font-bold text-xs mb-1.5">
                    {item.memberLabel}
                  </span>
                )}

                <div className="flex items-start justify-between gap-4">
                  {/* Item lines */}
                  <div className="space-y-1">
                    {isStandaloneJewelry ? (
                      /* Standalone Jewelry */
                      <div className="text-xl leading-snug">
                        <span className="font-bold text-amber-300">
                          {formatJewelryName(item.upgradeLabel)}
                        </span>
                        <span className="font-normal text-slate-400 ml-2">
                          - {item.upgradePrice}
                        </span>
                        {item.quantity > 1 && (
                          <span className="font-normal text-slate-500 ml-2">
                            × {item.quantity}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Piercing + Optional Jewelry Upgrade */
                      <>
                        {/* Placement line */}
                        <div className="text-xl leading-snug">
                          <span className="font-bold text-white">
                            {item.placementName}
                          </span>
                          <span className="font-normal text-slate-400 ml-2">
                            - {item.basePrice}
                          </span>
                          {item.quantity > 1 && !hasUpgrade && (
                            <span className="font-normal text-slate-500 ml-2">
                              × {item.quantity}
                            </span>
                          )}
                        </div>

                        {/* Jewelry Upgrade line */}
                        {hasUpgrade && (
                          <div className="text-xl leading-snug text-amber-300">
                            <span className="font-bold">
                              {formatJewelryName(item.upgradeLabel)}
                            </span>
                            <span className="font-normal text-slate-400 ml-2">
                              - {item.upgradePrice}
                            </span>
                            {item.quantity > 1 && (
                              <span className="font-normal text-slate-500 ml-2">
                                × {item.quantity}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Line Total */}
                  <div className="text-right flex-shrink-0 pt-0.5">
                    <span className="text-2xl font-black text-white">
                      {peso(lineTotal)}
                    </span>
                    {item.quantity > 1 && (
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        ({peso(item.basePrice + item.upgradePrice)} × {item.quantity})
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grand total */}
        <div className="px-8 py-5 border-t border-white/10 bg-white/3 flex items-center justify-between">
          <span className="text-xl text-slate-400 font-bold uppercase tracking-wide">
            Total
          </span>
          <span className="text-4xl sm:text-5xl font-black text-emerald-400 leading-none">
            {peso(total)}
          </span>
        </div>

        {/* Action Button */}
        <div className="px-8 pb-8 pt-3">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-black text-xl transition-all shadow-xl shadow-emerald-950/50 cursor-pointer"
          >
            <CheckCircle2 size={22} />
            {confirming ? 'Completing Order…' : 'Complete Order'}
          </button>
        </div>

      </div>
    </div>
  );
}

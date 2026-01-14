"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Hash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GiftCard {
  id: string;
  code: string;
  discount_type: 'amount' | 'percent';
  initial_amount_cents: number | null;
  current_balance_cents: number | null;
  percent_off: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function createGiftCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3) code += "-";
  }
  return code;
}

export default function GiftCardsPage() {
  const params = useParams<{ businessId: string }>();
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [newCode, setNewCode] = useState("");
  const [editingCodes, setEditingCodes] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchGiftCards();
  }, [params.businessId]);

  const fetchGiftCards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/business/${params.businessId}/gift-cards`);
      if (response.ok) {
        const data = await response.json();
        setGiftCards(data.giftCards || []);
      } else {
        console.error('Failed to fetch gift cards');
      }
    } catch (error) {
      console.error('Error fetching gift cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = () => {
    const code = createGiftCode();
    setNewCode(code);
  };

  const handleSaveCode = async (giftCardId: string, code: string) => {
    if (!code.trim()) {
      return;
    }

    try {
      setSaving((prev) => ({ ...prev, [giftCardId]: true }));
      const response = await fetch(
        `/api/business/${params.businessId}/gift-cards/${giftCardId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code.toUpperCase().trim() })
        }
      );

      if (response.ok) {
        // Refresh the list
        await fetchGiftCards();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update gift card code');
      }
    } catch (error) {
      console.error('Error saving gift card:', error);
      alert('Failed to save gift card code');
    } finally {
      setSaving((prev) => ({ ...prev, [giftCardId]: false }));
    }
  };

  const handleCreateNewCode = async () => {
    if (!newCode.trim()) {
      return;
    }

    try {
      // Use the onboarding endpoint to create a new gift card
      // First, get the config to determine the type
      const configResponse = await fetch('/api/business/onboarding/step-10-gift-cards');
      let config: any = { enabled: true, amountType: 'amount', amountValue: 100 };
      
      if (configResponse.ok) {
        const configData = await configResponse.json();
        if (configData.giftCards) {
          config = configData.giftCards;
        }
      }

      // Create via onboarding endpoint
      const response = await fetch('/api/business/onboarding/step-10-gift-cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          enabled: true,
          generatedCodes: [...(config.generatedCodes || []), newCode.toUpperCase().trim()]
        })
      });

      if (response.ok) {
        setNewCode("");
        await fetchGiftCards();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create gift card');
      }
    } catch (error) {
      console.error('Error creating gift card:', error);
      alert('Failed to create gift card');
    }
  };

  if (loading) {
    return (
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Gift cards</p>
          <h1 className="font-display text-4xl text-white">Gift card codes</h1>
        </header>
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Gift cards</p>
        <h1 className="font-display text-4xl text-white">Gift card codes</h1>
        <p className="max-w-3xl text-sm text-white/60">
          View and edit gift card codes. Generate new codes during onboarding or create them here.
        </p>
      </header>

      <div className="rounded-3xl border border-white/15 bg-white/5 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Hash className="h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-white">Gift card codes</h2>
              <p className="text-xs text-white/60">
                Edit codes directly or generate new ones. Codes are saved automatically when edited.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerateCode}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Generate code
          </button>
        </div>

        {/* New code input */}
        {newCode && (
          <div className="mb-4 flex items-center gap-2">
            <Input
              type="text"
              value={newCode}
              onChange={(event) => setNewCode(event.target.value.toUpperCase().trim())}
              className="font-mono text-sm"
              placeholder="GIFT-CODE"
            />
            <Button
              type="button"
              onClick={handleCreateNewCode}
              variant="default"
            >
              Create
            </Button>
            <Button
              type="button"
              onClick={() => setNewCode("")}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Existing gift cards */}
        {giftCards.length > 0 ? (
          <div className="space-y-3">
            {giftCards.map((card) => {
              const editingCode = editingCodes[card.id] ?? card.code;
              const cardIsEditing = isEditing[card.id] ?? false;

              return (
                <div key={card.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex-1">
                    {cardIsEditing ? (
                      <Input
                        type="text"
                        value={editingCode}
                        onChange={(event) => setEditingCodes((prev) => ({
                          ...prev,
                          [card.id]: event.target.value.toUpperCase().trim()
                        }))}
                        className="font-mono text-sm"
                        onBlur={() => {
                          if (editingCode !== card.code && editingCode.trim()) {
                            handleSaveCode(card.id, editingCode);
                          } else {
                            setEditingCodes((prev) => {
                              const next = { ...prev };
                              delete next[card.id];
                              return next;
                            });
                          }
                          setIsEditing((prev) => {
                            const next = { ...prev };
                            delete next[card.id];
                            return next;
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            if (editingCode !== card.code && editingCode.trim()) {
                              handleSaveCode(card.id, editingCode);
                            } else {
                              setEditingCodes((prev) => {
                                const next = { ...prev };
                                delete next[card.id];
                                return next;
                              });
                            }
                            setIsEditing((prev) => {
                              const next = { ...prev };
                              delete next[card.id];
                              return next;
                            });
                          } else if (event.key === 'Escape') {
                            setEditingCodes((prev) => {
                              const next = { ...prev };
                              delete next[card.id];
                              return next;
                            });
                            setIsEditing((prev) => {
                              const next = { ...prev };
                              delete next[card.id];
                              return next;
                            });
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="cursor-pointer rounded border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white/80 hover:border-white/25"
                        onClick={() => {
                          setEditingCodes((prev) => ({ ...prev, [card.id]: card.code }));
                          setIsEditing((prev) => ({ ...prev, [card.id]: true }));
                        }}
                      >
                        {card.code}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-white/50">
                    {card.discount_type === 'amount' 
                      ? `$${((card.current_balance_cents || 0) / 100).toFixed(2)}`
                      : `${card.percent_off}%`
                    }
                  </div>
                  {card.expires_at && (
                    <div className="text-xs text-white/50">
                      Expires: {new Date(card.expires_at).toLocaleDateString()}
                    </div>
                  )}
                  <div className="text-xs">
                    <span className={`px-2 py-1 rounded ${card.is_active ? 'bg-emerald-400/20 text-emerald-100' : 'bg-gray-400/20 text-gray-300'}`}>
                      {card.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {saving[card.id] && (
                    <span className="text-xs text-white/50">Saving...</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <HelperText className="mt-4">
            No gift cards found. Generate codes during onboarding or create them above.
          </HelperText>
        )}
      </div>
    </div>
  );
}






import React, { useEffect, useRef, useState } from 'react';
import {
  bruiser,
  silentKnife,
  defaultPoolForClass,
  type CharacterClass,
  type CharacterPool,
} from '@gloomfolk/shared';
import { clearSession, getSavedSession, useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { btn, theme } from '../theme.js';
import { NarrativeModal } from '../board/NarrativeModal.js';
import { PlacementView } from './PlacementView.js';
import { CharacterSelect } from './CharacterSelect.js';
import { BattleGoalPicker } from './BattleGoalPicker.js';
import { LoadoutBuilder } from './LoadoutBuilder.js';
import { Hand } from './Hand.js';
import { Shop } from './Shop.js';
import { ActiveArea, TurnPlay } from './TurnPlay.js';
import { ItemModal } from './ItemModal.js';
import {
  BottomBar,
  BOTTOM_BAR_HEIGHT,
  PlayerHeader,
  ScenarioPanel,
  CharacterPanel,
  type TabId,
} from './BottomBar.js';

const CLASS_BY_ID: Record<string, CharacterClass> = {
  [bruiser.id]: bruiser,
  [silentKnife.id]: silentKnife,
};

function phaseHeadline(phase: string | undefined, hasCharacter: boolean, isMyTurn: boolean): string {
  if (!hasCharacter) return '';
  switch (phase) {
    case 'placement': return 'Choose your starting position';
    case 'card_select': return 'Choose your cards';
    case 'turn_resolution': return isMyTurn ? '' : 'Turn in progress';
    case 'victory': return 'Victory';
    case 'defeat': return 'Defeated';
    default: return '';
  }
}

function readCampaignFromHash(): string | null {
  const h = location.hash.replace(/^#/, '').trim();
  return h || null;
}

/** Modal overlay shown when a monster attack pauses for a reactive-item
 *  decision targeting this player (e.g. Leather Armor → Disadvantage). */
function ReactivePrompt({
  prompt,
  onRespond,
}: {
  prompt: string;
  onRespond: (spend: boolean) => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: theme.panel,
          border: `1px solid ${theme.accent}`,
          borderRadius: 6,
          padding: 24,
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 16, lineHeight: 1.4, margin: '0 0 20px', color: theme.text }}>
          {prompt}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => onRespond(true)}
            style={{
              fontSize: 15,
              padding: '10px 20px',
              background: theme.accent,
              color: '#0e1612',
              border: 'none',
              borderRadius: 3,
              fontFamily: theme.headingFont,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Spend
          </button>
          <button
            onClick={() => onRespond(false)}
            style={{
              fontSize: 15,
              padding: '10px 20px',
              background: 'transparent',
              color: theme.muted,
              border: `1px solid ${theme.border}`,
              borderRadius: 3,
              fontFamily: theme.headingFont,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  background: theme.bgSolid,
  color: theme.text,
  minHeight: '100vh',
  width: '100%',
  fontFamily: theme.font,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  fontSize: 18,
  padding: 8,
  background: theme.panel,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 3,
  fontFamily: theme.font,
  boxSizing: 'border-box',
  marginTop: 4,
};

export function PlayerScreen() {
  const sock = useSocket();
  const role = useStore((s) => s.role);
  const playerId = useStore((s) => s.playerId);
  const gameState = useStore((s) => s.gameState);
  const you = useStore((s) => s.you);

  const [campaignId, setCampaignId] = useState<string>(() => {
    return readCampaignFromHash() ?? (() => {
      try { return localStorage.getItem('gf:campaignId') ?? ''; } catch { return ''; }
    })();
  });

  const [editingLoadout, setEditingLoadout] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('play');
  const [showItemsModal, setShowItemsModal] = useState(false);
  const prevCharIdRef = useRef<string | null | undefined>(undefined);
  const [loadoutByClassId, setLoadoutByClassId] = useState<
    Record<string, readonly string[]>
  >({});
  const [poolByClassId] = useState<Record<string, CharacterPool>>(() => ({
    [bruiser.id]: defaultPoolForClass(bruiser),
    [silentKnife.id]: defaultPoolForClass(silentKnife),
  }));

  useEffect(() => {
    const onHash = () => {
      const c = readCampaignFromHash();
      if (c) setCampaignId(c);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const myCharId = gameState?.players.find((p) => p.playerId === playerId)?.characterId ?? null;
  useEffect(() => {
    if (prevCharIdRef.current === undefined) {
      prevCharIdRef.current = myCharId ?? null;
      return;
    }
    if (myCharId && !prevCharIdRef.current) {
      history.pushState({ gf: 'loadout' }, '');
      setEditingLoadout(true);
    }
    prevCharIdRef.current = myCharId ?? null;
  }, [myCharId]);

  useEffect(() => {
    if (!editingLoadout) return;
    const onPop = () => setEditingLoadout(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [editingLoadout]);

  const meEarly = gameState?.players.find((p) => p.playerId === playerId);
  const phaseEarly = gameState?.phase;
  const viewKey = !meEarly?.characterId
    ? 'character-select'
    : editingLoadout
      ? 'loadout'
      : phaseEarly === 'placement'
        ? 'placement'
        : phaseEarly === 'card_select'
          ? 'card-select'
          : phaseEarly === 'turn_resolution'
            ? 'turn-play'
            : `phase:${phaseEarly ?? 'lobby'}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewKey]);

  if (role !== 'player') {
    const savedSession = getSavedSession();
    if (savedSession) {
      return (
        <div style={shellStyle}>
          <div style={{ padding: 24, maxWidth: 480 }}>
            <p style={{ color: theme.muted }}>Reconnecting…</p>
          </div>
        </div>
      );
    }
    return (
      <div style={shellStyle}>
        <div style={{ padding: 24, maxWidth: 480 }}>
          <h1
            style={{
              fontFamily: theme.headingFont,
              fontWeight: 500,
              letterSpacing: 1,
              color: theme.accent,
            }}
          >
            Join Gloomfolk
          </h1>
          <label style={{ display: 'block', marginBottom: 16, color: theme.muted, fontSize: 13 }}>
            Campaign ID
            <input
              style={inputStyle}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="(from host's screen)"
            />
          </label>
          <button
            style={{
              fontSize: 16,
              padding: '10px 20px',
              background: theme.accent,
              color: '#0e1612',
              border: 'none',
              borderRadius: 3,
              fontFamily: theme.headingFont,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
            disabled={!campaignId.trim()}
            onClick={() => {
              sock.send({
                type: 'player_join',
                campaignId: campaignId.trim(),
              });
            }}
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  const me = gameState?.players.find((p) => p.playerId === playerId);
  const phase = gameState?.phase;
  const submittedCount = gameState?.players.filter((p) => p.submitted).length ?? 0;
  const totalReady = gameState?.players.filter((p) => p.characterId).length ?? 0;
  const cur = gameState?.turnOrder[gameState?.activeTurnIndex ?? -1];
  const isMyTurn = cur?.kind === 'player' && cur.playerId === playerId;

  const myCharInstance = me?.characterId
    ? gameState?.characters.find((c) => c.id === me.characterId)
    : null;
  const myClassId = myCharInstance?.classId ?? null;
  const myClass = myClassId ? CLASS_BY_ID[myClassId] : null;
  const myUnit =
    gameState?.units.find(
      (u) => u.kind === 'player' && u.ownerPlayerId === playerId,
    ) ?? null;

  const showBottomBar = !!me?.characterId;
  const onPlayTab = activeTab === 'play' || !showBottomBar;
  // The header "Items" button is available throughout a scenario when the
  // character brought items — it's always visible, but items can only be used
  // on your turn (enforced inside the modal).
  const showItemsButton =
    phase === 'turn_resolution' &&
    onPlayTab &&
    (myCharInstance?.broughtItemIds.length ?? 0) > 0;
  const headerTitle =
    showBottomBar && activeTab === 'scenario'
      ? 'Scenario'
      : showBottomBar && activeTab === 'character'
        ? 'Character'
        : undefined;

  return (
    <div style={shellStyle}>
      {gameState?.narrative && (
        <NarrativeModal
          entry={gameState.narrative}
          onDismiss={() => sock.send({ type: 'dismiss_narrative' })}
        />
      )}
      {gameState?.pendingReactiveItem?.playerId === playerId && (
        <ReactivePrompt
          prompt={gameState.pendingReactiveItem.prompt}
          onRespond={(spend) =>
            sock.send({ type: 'player_respond_reactive_item', spend })
          }
        />
      )}
      {showItemsModal && gameState && playerId && (
        <ItemModal
          gameState={gameState}
          myPlayerId={playerId}
          you={you}
          context={null}
          isMyTurn={isMyTurn}
          onClose={() => setShowItemsModal(false)}
        />
      )}
      {myCharInstance && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: theme.bgSolid,
          }}
        >
          <PlayerHeader
            character={myCharInstance}
            unit={myUnit}
            {...(headerTitle ? { title: headerTitle } : {})}
            {...(phase === 'lobby' ? { gold: myCharInstance.gold } : {})}
            {...(showItemsButton ? { onOpenItems: () => setShowItemsModal(true) } : {})}
          />
          {you && <ActiveArea you={you} />}
        </div>
      )}
      <div
        style={{
          padding: 16,
          paddingBottom: showBottomBar ? BOTTOM_BAR_HEIGHT + 16 : 16,
          maxWidth: 540,
          color: theme.text,
          boxSizing: 'border-box',
          overflow: 'clip',
        }}
      >
        {onPlayTab && (!myCharInstance || editingLoadout) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <button
              onClick={() => {
                if ((history.state as { gf?: string } | null)?.gf) {
                  history.back();
                  return;
                }
                clearSession();
                useStore.setState({
                  role: null,
                  playerId: null,
                  campaignId: null,
                  gameState: null,
                  you: null,
                });
              }}
              style={{ ...btn.ghost(), padding: '4px 8px', fontSize: 12 }}
            >
              ← Back
            </button>
            {!myCharInstance && (
              <p style={{ color: theme.muted, fontSize: 12, margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>
                {gameState?.campaignName}
              </p>
            )}
          </div>
        )}
        {onPlayTab && (() => {
          const myUnit = gameState?.units.find(
            (u) => u.kind === 'player' && u.ownerPlayerId === playerId,
          );
          const held = myUnit?.moneyTokensHeld ?? 0;
          if (!myCharInstance || held === 0) return null;
          return (
            <p style={{ color: '#d9a441', fontSize: 12, margin: '0 0 8px', letterSpacing: 0.3 }}>
              🪙 {held} token{held === 1 ? '' : 's'} this round
            </p>
          );
        })()}
        {onPlayTab && !(phase === 'placement' && you?.battleGoal && you.battleGoal.chosenGoalId == null && you.battleGoal.dealtGoalIds.length > 0) && phaseHeadline(phase, !!me?.characterId, isMyTurn) && <h1
          style={{
            marginTop: 6,
            marginBottom: 12,
            fontWeight: 500,
            fontSize: 28,
            fontFamily: theme.headingFont,
            color: theme.accent,
            letterSpacing: 0.5,
          }}
        >
          {phaseHeadline(phase, !!me?.characterId, isMyTurn)}
        </h1>}
        {onPlayTab && phase === 'card_select' && me?.characterId && submittedCount > 0 && submittedCount < totalReady && (
          <p style={{ color: theme.muted, fontSize: 13, marginTop: -8, marginBottom: 12 }}>
            Waiting on {totalReady - submittedCount} other {totalReady - submittedCount === 1 ? 'player' : 'players'}.
          </p>
        )}
        {onPlayTab && !me?.characterId && playerId && gameState && (
          <CharacterSelect
            characters={gameState.characters}
            players={gameState.players}
            myPlayerId={playerId}
          />
        )}
        {onPlayTab && myClassId && myClass && editingLoadout && (() => {
          const savedLoadout =
            loadoutByClassId[myClassId] ?? myCharInstance?.loadout ?? undefined;
          return (
            <LoadoutBuilder
              characterClass={myClass}
              pool={poolByClassId[myClassId]!}
              {...(savedLoadout ? { initialChosenIds: savedLoadout } : {})}
              onLockIn={(chosenCardIds) => {
                setLoadoutByClassId((prev) => ({
                  ...prev,
                  [myClassId]: chosenCardIds,
                }));
                sock.send({
                  type: 'player_set_loadout',
                  cardIds: [...chosenCardIds],
                });
                setEditingLoadout(false);
              }}
            />
          );
        })()}
        {onPlayTab && me?.characterId && !editingLoadout && phase === 'lobby' && (() => {
          const hasLoadout = myCharInstance?.loadout != null;
          const ready = myCharInstance?.shoppingDone === true;
          const editBtnStyle: React.CSSProperties = hasLoadout
            ? {
                fontSize: 14,
                padding: '8px 14px',
                background: 'transparent',
                color: theme.accent,
                border: `1px solid ${theme.accent}`,
                borderRadius: 3,
                fontFamily: theme.headingFont,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }
            : {
                fontSize: 16,
                padding: '12px 18px',
                background: theme.accent,
                color: '#0e1612',
                border: 'none',
                borderRadius: 3,
                fontFamily: theme.headingFont,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
              };
          const secondaryBtnStyle: React.CSSProperties = {
            fontSize: 14,
            padding: '8px 14px',
            background: 'transparent',
            color: theme.muted,
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            fontFamily: theme.headingFont,
            letterSpacing: 1,
            textTransform: 'uppercase',
            cursor: 'pointer',
          };

          // Readied up: show the confirmation and a way back to the shop.
          if (ready) {
            return (
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '48px 16px',
                }}
              >
                <div
                  style={{
                    fontSize: 64,
                    fontFamily: theme.headingFont,
                    color: theme.good,
                    letterSpacing: 1,
                    lineHeight: 1,
                  }}
                >
                  ✓ Ready
                </div>
                <p style={{ marginTop: 16, color: theme.muted, fontSize: 14, letterSpacing: 0.5 }}>
                  Waiting for host to start the scenario…
                </p>
                <button
                  onClick={() => sock.send({ type: 'player_reopen_shopping' })}
                  style={{ ...secondaryBtnStyle, marginTop: 24 }}
                >
                  Back to shop
                </button>
              </div>
            );
          }

          // Still setting up: pick a hand, then shop, then ready up.
          return (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => { history.pushState({ gf: 'loadout' }, ''); setEditingLoadout(true); }}
                  style={editBtnStyle}
                >
                  {hasLoadout ? 'Edit hand' : 'Pick cards'}
                </button>
                <button
                  onClick={() => {
                    setEditingLoadout(false);
                    sock.send({ type: 'player_unclaim_character' });
                  }}
                  style={secondaryBtnStyle}
                >
                  Change hero
                </button>
              </div>
              {!hasLoadout && (
                <div
                  style={{
                    marginTop: 48,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '48px 16px',
                  }}
                >
                  <p style={{ color: theme.muted, fontSize: 14 }}>
                    Build your hand, then visit the shop to ready up.
                  </p>
                </div>
              )}
              {hasLoadout && myCharInstance && gameState && (
                <>
                  <Shop character={myCharInstance} shop={gameState.shop} />
                  <button
                    onClick={() => sock.send({ type: 'player_finish_shopping' })}
                    style={{
                      ...btn.primary(false),
                      marginTop: 24,
                      width: '100%',
                      fontSize: 16,
                      padding: '14px 16px',
                    }}
                  >
                    Done shopping — I’m ready
                  </button>
                </>
              )}
            </div>
          );
        })()}
        {onPlayTab && me?.characterId &&
          (phase === 'placement' || phase === 'card_select') && you?.battleGoal &&
          you.battleGoal.chosenGoalId == null &&
          you.battleGoal.dealtGoalIds.length > 0 && (
            <BattleGoalPicker
              dealtGoalIds={you.battleGoal.dealtGoalIds}
              onChoose={(goalId) =>
                sock.send({ type: 'player_choose_battle_goal', goalId })
              }
            />
          )}
        {onPlayTab && me?.characterId && phase === 'card_select' && you &&
          (you.battleGoal?.chosenGoalId != null ||
            !you.battleGoal?.dealtGoalIds?.length) && (
            <Hand you={you} />
          )}
        {onPlayTab && me?.characterId && phase === 'placement' && gameState && playerId &&
          (you?.battleGoal?.chosenGoalId != null ||
            !you?.battleGoal?.dealtGoalIds?.length) && (
            <PlacementView gameState={gameState} myPlayerId={playerId} />
          )}
        {onPlayTab && me?.characterId && phase === 'turn_resolution' && gameState && (
          <TurnPlay gameState={gameState} myPlayerId={playerId!} you={you} />
        )}
        {showBottomBar && activeTab === 'scenario' && (
          <ScenarioPanel gameState={gameState ?? null} you={you} />
        )}
        {showBottomBar && activeTab === 'character' && (
          <CharacterPanel
            you={you}
            character={myCharInstance ?? null}
            characterClass={myClass ?? null}
          />
        )}
      </div>
      {showBottomBar && (
        <BottomBar active={activeTab} onChange={setActiveTab} />
      )}
    </div>
  );
}

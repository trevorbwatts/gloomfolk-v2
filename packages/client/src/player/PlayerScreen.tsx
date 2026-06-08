import React, { useEffect, useRef, useState } from 'react';
import { Swords } from 'lucide-react';
import {
  bruiser,
  silentKnife,
  defaultPoolForClass,
  type CharacterClass,
  type CharacterPool,
} from '@gloomfolk/shared';
import { clearSession, getDeviceId, getSavedSession, useSocket } from '../net/useSocket.js';
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

function phaseHeadline(phase: string | undefined, hasCharacter: boolean): string {
  if (!hasCharacter) return '';
  switch (phase) {
    case 'placement': return 'Choose your starting position';
    case 'card_select': return 'Choose your Cards';
    case 'turn_resolution': return '';
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
  const hasState = !!gameState;
  useEffect(() => {
    // Don't decide anything until the server's state has actually arrived.
    // On a reconnect (device wake / app reopen) the screen briefly mounts with
    // no game state, so myCharId is momentarily null before the real character
    // shows up. Establishing our baseline before state loads would make that
    // null→character transition look like a fresh claim and wrongly yank the
    // player into the loadout builder. Waiting for state means the baseline is
    // set to the character they already had, and no spurious auto-open fires.
    if (!hasState) return;
    if (prevCharIdRef.current === undefined) {
      prevCharIdRef.current = myCharId ?? null;
      return;
    }
    if (myCharId && !prevCharIdRef.current) {
      history.pushState({ gf: 'loadout' }, '');
      setEditingLoadout(true);
    }
    prevCharIdRef.current = myCharId ?? null;
  }, [myCharId, hasState]);

  // Backing out of the loadout builder is the "previous step" in character
  // creation, which is the roster — so it unclaims the character and returns
  // there (the old in-body "Change hero" action), rather than dropping onto an
  // intermediate lobby screen. Both the header Back button (via goBack →
  // history.back) and the device back gesture route through this.
  useEffect(() => {
    if (!editingLoadout) return;
    const onPop = () => {
      setEditingLoadout(false);
      sock.send({ type: 'player_unclaim_character' });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [editingLoadout, sock]);

  const meEarly = gameState?.players.find((p) => p.playerId === playerId);
  const phaseEarly = gameState?.phase;
  const charEarly = meEarly?.characterId
    ? gameState?.characters.find((c) => c.id === meEarly.characterId)
    : null;
  // Reset scroll to the top on any meaningful view change: the active tab, the
  // phase, entering/leaving the loadout builder, and the lobby sub-steps
  // (pick cards → shop → ready). CharacterSelect handles its own inner steps.
  const baseView = !meEarly?.characterId
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
  const viewKey = [
    baseView,
    activeTab,
    charEarly?.loadout ? 'L' : '',
    charEarly?.shoppingDone ? 'S' : '',
  ].join('|');
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
        <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
          <h1
            style={{
              fontFamily: theme.headingFont,
              fontWeight: 500,
              letterSpacing: 1,
              color: theme.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <Swords size={28} /> Gloomfolk
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
              padding: '12px 20px',
              width: '100%',
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
                deviceId: getDeviceId(),
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
  const cur = gameState?.turnOrder[gameState?.activeTurnIndex ?? -1];
  const isMyTurn = cur?.kind === 'player' && cur.playerId === playerId;

  const myCharInstance = me?.characterId
    ? gameState?.characters.find((c) => c.id === me.characterId)
    : null;

  // The page-header line. During another player's turn we show "<character>
  // is playing…" here (in the shared header style) rather than as a muted
  // line in the body; otherwise fall back to the phase headline.
  const activePlayer =
    cur?.kind === 'player'
      ? gameState?.players.find((p) => p.playerId === cur.playerId)
      : null;
  const activeCharName = activePlayer?.characterId
    ? gameState?.characters.find((c) => c.id === activePlayer.characterId)?.name
    : null;
  const headline =
    phase === 'turn_resolution' && !isMyTurn && cur?.kind === 'player'
      ? `${activeCharName ?? activePlayer?.name ?? 'Player'} is playing…`
      : phaseHeadline(phase, !!me?.characterId);
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
    showBottomBar && activeTab === 'active'
      ? 'Active'
      : showBottomBar && activeTab === 'scenario'
        ? 'Scenario'
        : showBottomBar && activeTab === 'character'
          ? 'Character'
          : undefined;

  // Back button: shown during character select/naming and while editing a
  // loadout. Walks back through the CharacterSelect history steps if any,
  // otherwise leaves the campaign entirely.
  const goBack = () => {
    if ((history.state as { gf?: string } | null)?.gf) {
      history.back();
      return;
    }
    // Tell the server we're leaving so an unclaimed lobby slot is dropped now
    // — otherwise rejoining would add a second player for this same phone.
    sock.send({ type: 'player_leave' });
    clearSession();
    useStore.setState({
      role: null,
      playerId: null,
      campaignId: null,
      gameState: null,
      you: null,
    });
  };
  // The shop step (hand built, in the lobby, not yet readied) gets a header
  // Back button that returns to editing the hand — replacing the in-body
  // "Edit hand" button that used to live there.
  const openLoadoutBuilder = () => {
    history.pushState({ gf: 'loadout' }, '');
    setEditingLoadout(true);
  };
  const inLobbySetup =
    onPlayTab && !!myCharInstance && phase === 'lobby' && !editingLoadout;
  const atShopStep =
    inLobbySetup &&
    myCharInstance!.loadout != null &&
    myCharInstance!.shoppingDone !== true;
  // The Ready confirmation step: Back returns to the shop (the old in-body
  // "Back to shop" button), reopening shopping.
  const atReadyStep = inLobbySetup && myCharInstance!.shoppingDone === true;
  const showBack =
    onPlayTab && (!myCharInstance || editingLoadout || atShopStep || atReadyStep);
  const onBack = atReadyStep
    ? () => sock.send({ type: 'player_reopen_shopping' })
    : atShopStep
      ? openLoadoutBuilder
      : goBack;
  // The top header bar renders whenever there's a character, and also during
  // the pre-character select/naming flow so the Back button and campaign name
  // share one consistent header section.
  const showHeader = !!myCharInstance || (onPlayTab && !showBottomBar);
  const headerCampaignTitle =
    headerTitle ?? (!myCharInstance ? gameState?.campaignName ?? '' : undefined);

  return (
    <div style={shellStyle}>
      {gameState?.narrative && !you?.narrativeDismissed && (
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
      {showHeader && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: theme.bgSolid,
          }}
        >
          <PlayerHeader
            character={myCharInstance ?? null}
            unit={myUnit}
            {...(headerCampaignTitle != null ? { title: headerCampaignTitle } : {})}
            {...(myCharInstance && phase === 'lobby' ? { gold: myCharInstance.gold } : {})}
            {...(showItemsButton ? { onOpenItems: () => setShowItemsModal(true) } : {})}
            {...(showBack ? { onBack } : {})}
          />
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
        {onPlayTab && !(phase === 'placement' && you?.battleGoal && you.battleGoal.chosenGoalId == null && you.battleGoal.dealtGoalIds.length > 0) && headline && <h1
          style={{
            marginTop: 6,
            marginBottom: 12,
            fontWeight: 500,
            fontSize: 20,
            fontFamily: theme.headingFont,
            color: theme.accent,
            letterSpacing: 0.5,
          }}
        >
          {headline}
        </h1>}
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
          // Readied up: show the confirmation. Back (in the header) returns to
          // the shop.
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
              </div>
            );
          }

          // Still setting up: pick a hand, then shop, then ready up.
          return (
            <div>
              {!hasLoadout && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { history.pushState({ gf: 'loadout' }, ''); setEditingLoadout(true); }}
                    style={editBtnStyle}
                  >
                    Pick cards
                  </button>
                </div>
              )}
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
                  <div style={{ paddingBottom: 80 }}>
                    <Shop character={myCharInstance} shop={gameState.shop} />
                  </div>
                  <div
                    style={{
                      position: 'fixed',
                      bottom: BOTTOM_BAR_HEIGHT,
                      left: 0,
                      right: 0,
                      background: theme.bgSolid,
                      padding: '8px 16px',
                      borderTop: `1px solid ${theme.border}`,
                      zIndex: 40,
                    }}
                  >
                    <button
                      onClick={() => sock.send({ type: 'player_finish_shopping' })}
                      style={{
                        ...btn.primary(false),
                        width: '100%',
                        fontSize: 15,
                        padding: '10px 16px',
                      }}
                    >
                      Done shopping — I’m ready
                    </button>
                  </div>
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
        {showBottomBar && activeTab === 'active' && (
          you ? <ActiveArea you={you} /> : null
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

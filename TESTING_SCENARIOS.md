# Curious Cat - Comprehensive Testing Scenarios

## Overview
These 10 test scenarios cover all game features and scoring paths. Run them in sequence to test until the application breaks and reveal edge cases to fix.

**Game Constants:**
- MAX_PLAYERS: 8
- MAX_NAME_LENGTH: 10
- MAX_QUESTION_LENGTH: 150
- MIN_ROUNDS: 3 (enforced)
- SUBMISSION_COUNTDOWN: 60s (triggers at ≥50% submitted)
- VOTING_COUNTDOWN: 60s
- GUESSING_PHASE: 7s auto-transition
- ROOM_AUTO_CLOSE: 5 minutes after game ends

**Scoring:**
- +1 per vote on custom question (during voting phase)
- +3 points if author when answerer guesses wrong (snoop failure)
- +5 points per correct guess (snoop success)
- +3 bonus for longest avg question length (unique winner only)
- +3 bonus for most snoops (unique winner only)
- +4 bonus for most-displayed question (unique winner only)

---

## Scenario 1: Happy Path - Full 3-Round Game (Basic Validation)

**Setup:**
- 4 players: Alice, Bob, Charlie, Diana
- 3 rounds (minimum required)
- All custom questions (no defaults)

**Steps:**
1. All 4 join room "TEST1"
2. Each submits unique custom question (50+ chars for content)
3. Voting countdown should trigger (≥50% submitted = 2/4)
4. Vote on different questions to split votes (no clear winner edge case)
5. Skip guessing round
6. Round 2: Repeat with different questions
7. Game ends

**Expected Results:**
- ✅ All phases complete without errors
- ✅ Players see countdown timers (submission 60s, voting 60s)
- ✅ Vote counts increment correctly
- ✅ No bonuses trigger (split votes, all custom questions)
- ✅ Final scores display correctly
- ✅ Room auto-closes after 5 minutes

**Failure Points to Monitor:**
- Timer state not updating
- Socket event ordering issues
- Score state mutation

---

## Scenario 2: Minimum Rounds Validation

**Setup:**
- 1 host player (trying to create room)
- Test minimum rounds enforcement

**Steps:**
1. Host opens "Create Game" screen
2. Attempt to set rounds to 0 (drag slider left)
3. **ERROR: Slider should not go below 3**
4. Attempt to set rounds to 1
5. **ERROR: Slider should not go below 3**
6. Attempt to set rounds to 2
7. **ERROR: Slider should not go below 3**
8. Set rounds to exactly 3 (minimum allowed)
9. Click "Create Game"
10. ✅ Room creation succeeds
11. (Optional) Manually test server validation by spoofing socket event with numberOfRounds: 0

**Expected Results:**
- ✅ UI slider enforces `min="3"` on range input
- ✅ Slider prevents selection below 3 rounds
- ✅ Client-side validation in handleCreateRoom checks `numberOfRounds < 3`
- ✅ Server-side validation rejects room creation with < 3 rounds
- ✅ Error message shown: "Minimum 3 rounds required"
- ✅ Room not created if rounds < 3
- ✅ Room successfully created when rounds = 3

**Failure Points to Monitor:**
- Slider allows selection below 3 (UI bug)
- Room created with 1-2 rounds (validation bypassed)
- No error message displayed (UX issue)
- Server crashes on invalid rounds value
- Error event not handled by client

---

## Scenario 3: Default Question Edge Case

**Setup:**
- 3 players: Eve, Frank, Grace
- 3 rounds (minimum required)
- Test default question behavior

**Steps:**
1. Eve, Frank join room "TEST3"
2. Grace joins (3 total)
3. Eve submits custom question
4. Frank clicks "Give me a question" (selects default)
5. Grace submits custom question
6. Submission countdown triggers (2/3 submitted)
7. Grace votes for Eve's custom question
8. Eve votes for Frank's default question
9. Frank votes for Grace's custom question
10. All votes in → voting finalizes (3/3)
11. Grace "guesses" (the answer phase)
12. Game ends

**Expected Results:**
- ✅ Default question doesn't award +1 vote points during voting
- ✅ Default question author (auto-system) doesn't appear in scoreboard
- ✅ Custom questions award +1 to authors when voted
- ✅ If default question wins: NOT awarded points (checked in server logs)
- ✅ Guessing works against default question author (should be system/unnamed)

**Failure Points to Monitor:**
- Default question marked incorrectly (isDefault flag)
- Vote points awarded to default question author
- Incorrect guess bonus applied to default question author
- Server crash when finding author of default question

---

## Scenario 4: Reconnection Persistence

**Setup:**
- 4 players: Henry, Iris, Jack, Kate
- 3 rounds (minimum required)
- Simulate disconnects/reconnects

**Steps:**
1. All 4 join room "TEST4", start game
2. Submission phase: All 4 submit questions
3. **BREAK** Iris refreshes browser mid-submission countdown
4. Iris clicks "Rejoin previous game" (localStorage should restore)
5. Verify Iris's question still in questions array
6. Iris's score persists
7. Voting phase: Iris votes
8. **BREAK** Henry loses connection for 10 seconds
9. Henry reconnects mid-voting
10. Henry can vote if not already voted
11. Game completes

**Expected Results:**
- ✅ Player data persists in localStorage
- ✅ Reconnect finds player by name (case-insensitive)
- ✅ Socket ID updated properly
- ✅ Questions array updated with new socket ID (if author)
- ✅ Votes map updated with new socket ID (if already voted)
- ✅ Score persists across reconnections
- ✅ No duplicate questions created

**Failure Points to Monitor:**
- Player appears twice in questions array after reconnect
- Old socket ID remains in voting array
- Score resets on reconnect
- "Player not found in room" error even though they were there
- Reconnect fails to restore round/phase state

---

## Scenario 5: Tie-Breaking for Bonuses

**Setup:**
- 3 players: Mike, Nancy, Oscar
- 3 rounds (minimum required)
- Designed to create ties

**Steps:**
1. All 3 join room "TEST5"
2. Mike: submits "ab" (2 chars)
3. Nancy: submits "abc" (3 chars)
4. Oscar: submits "ab" (2 chars) — **tied with Mike**
5. Game auto-fills missing players (shouldn't happen with 3/3)
6. Nancy votes for Mike, Mike votes for Nancy, Oscar votes for Nancy
7. Nancy wins the question (1st to be selected for answering)
8. Oscar guesses correctly (+5 points)
9. All have same snoop attempts in bonus calculation
10. Game ends

**Expected Results:**
- ✅ Bonuses only awarded to **unique winners** (not ties)
- ✅ Longest avg: If tied, NO bonus awarded (not displayed)
- ✅ Most snoops: If all tied, NO bonus awarded
- ✅ Most-displayed question: If tied, NO bonus awarded
- ✅ Bonuses array in game_ended event is empty or short

**Failure Points to Monitor:**
- Multiple players awarded same bonus (tie-breaking broken)
- Bonus awarded to wrong player
- Crash in computeEndGameBonuses when scores are tied
- Bonuses array includes non-winners

---

## Scenario 5: Max Players Edge Case

**Setup:**
- 8 players: P1, P2, P3, P4, P5, P6, P7, P8
- 3 rounds (minimum required)
- Hit MAX_PLAYERS limit

**Steps:**
1. P1-P7 join room "TEST5"
2. All submit questions (7/7 = 100% → submission countdown triggers immediately)
3. P8 tries to join
4. **ERROR: Room should reject 9th player**
5. All 8 vote
6. Guessing phase: Each makes guess
7. Game ends

**Expected Results:**
- ✅ 9th player rejected with "Room is full" error
- ✅ Submission countdown triggers at ≥50% (was 4/7 on submit)
- ✅ All 8 players vote → finalize
- ✅ Guessing works with 8 players (random target selection)
- ✅ Scores, bonuses calculated for 8 players

**Failure Points to Monitor:**
- 9th player allowed to join (no validation)
- UI doesn't show "Room is full" message
- Submission countdown doesn't trigger at ≥50%
- Target player selection crashes with 8 players
- Off-by-one in vote count finalization (requires ALL, not 7/8)

---

## Scenario 6: Self-Question Voting Block

**Setup:**
- 4 players: Quinn, Riley, Sam, Tara
- 3 rounds (minimum required)

**Steps:**
1. All 4 join room "TEST6"
2. Quinn: "What's your favorite movie?"
3. Riley: "Do you like pizza?"
4. Sam: "Best travel destination?"
5. Tara: "Favorite hobby?"
6. Voting phase starts
7. Quinn tries to vote for his own question
8. **ERROR: Should be blocked**
9. Quinn votes for Riley's question instead
10. All vote, finalize
11. Game continues

**Expected Results:**
- ✅ Player cannot vote for own question (server-side check: `isOwnQuestion` flag)
- ✅ Client shows "You wrote this question! No guessing!" UI
- ✅ Skip/alternate vote button functional
- ✅ Vote not recorded if player tries to force their own question

**Failure Points to Monitor:**
- Player able to vote for own question
- No UI warning shown
- Vote count includes self-votes (corrupts voting)
- isOwnQuestion flag not set correctly during reconnect

---

## Scenario 7: Snoop Failure (+3 Bonus) vs Success (+5)

**Setup:**
- 2 players: Uma, Victor
- 3 rounds (minimum required)
- Test scoring for guesses

**Steps:**
1. Uma, Victor join room "TEST7"
2. Uma: "What's my favorite number?" (custom)
3. Victor: clicks "Give me a question" (default)
4. Voting: Uma votes Victor's question, Victor votes Uma's question
5. Uma's custom question selected
6. Victor guesses INCORRECTLY who wrote "What's my favorite number?"
7. Uma gets +3 points (snoop failure bonus)
8. Victor's snoopCounts incremented
9. Round 2: Different roles
10. Victor's question selected
11. Uma guesses CORRECTLY who wrote default question
12. Uma gets +5 points (snoop success)
13. Game ends (only 3 rounds, so should end after round 3)
14. Bonuses check: Most snoops might go to Uma (if she snooped more)

**Expected Results:**
- ✅ Incorrect guess: +3 to author, +1 snoop count to guesser
- ✅ Correct guess: +5 to guesser, +1 snoop count to guesser
- ✅ Most snoops bonus: Awarded to player with highest snoop count
- ✅ Snoop count persists across rounds
- ✅ Author name matches in guessing phase

**Failure Points to Monitor:**
- Points not awarded based on guess correctness
- Snoop count not incremented
- Wrong player receives bonus points
- Author name is undefined/null in guessing phase
- Most snoops bonus calculated incorrectly

---

## Scenario 8: Submission Countdown Auto-Fill

**Setup:**
- 4 players: Wendy, Xavier, Yara, Zane
- 3 rounds (minimum required)
- Test submission timeout auto-fill

**Steps:**
1. All 4 join room "TEST8"
2. Wendy submits custom question
3. Xavier submits custom question
4. **WAIT** 60 seconds (or trigger server-side countdown)
5. Submission countdown should auto-fill Yara & Zane with defaults
6. Voting phase triggered automatically
7. Verify defaults are marked `isDefault: true`
8. Voting ends (count votes)
9. One question wins
10. Guessing phase

**Expected Results:**
- ✅ Countdown emitted when ≥50% submitted (2/4)
- ✅ After 60s: 2 players auto-filled with random defaults
- ✅ All defaults marked `isDefault: true`
- ✅ Default questions don't award +1 vote points
- ✅ Game transitions to voting phase automatically

**Failure Points to Monitor:**
- Countdown not emitted to clients
- Countdown timer runs twice (logic bug)
- Defaults not inserted at 60s mark
- Defaults marked as custom questions
- Default question author ID undefined (crashes voting)
- Game stuck in submission phase after timeout

---

## Scenario 9: Room Auto-Close Timeout

**Setup:**
- 2 players: Alice, Bob
- 3 rounds (minimum required)

**Steps:**
1. Alice, Bob join room "TEST9"
2. Complete game quickly (skip all phases)
3. Game ends
4. **WAIT** 5 minutes (or simulate with server-side time manipulation)
5. Room should emit `room_closed` event
6. Players should see "Room Closed" UI
7. Verify room deleted from `rooms` map

**Expected Results:**
- ✅ `room_closed` event emitted after 5 minutes
- ✅ Players see timeout message (not error)
- ✅ Room deleted from server memory
- ✅ New player cannot join room after timeout

**Failure Points to Monitor:**
- `room_closed` event never emitted
- Room not deleted (memory leak)
- Players see error instead of timeout message
- `room_closed` emitted too early/late
- Timer started but not cleared on reconnect (double-close)

---

## Scenario 10: Chaos Test - Rapid Input, Edge Cases

**Setup:**
- 5 players with extreme names/questions
- 3 rounds (minimum required)
- Push system limits

**Steps:**
1. Players join with names at MAX_NAME_LENGTH (10 chars): "1234567890" (INVALID - contains numbers)
2. **ERROR: Should reject**
3. Retry with valid max-length names: "Wonderland" (10 chars, all letters)
4. Players submit questions at MAX_QUESTION_LENGTH (150 chars)
5. One player submits OVER 150 chars (should truncate or reject)
6. Rapid fire voting: All vote simultaneously
7. Rapid guesses: Try to guess while guessing phase is still loading
8. Disconnect during guess calculation (7s timeout)
9. Reconnect before game_ended event
10. Game ends

**Expected Results:**
- ✅ Names with numbers rejected
- ✅ 10-char names accepted
- ✅ Questions > 150 chars truncated or rejected
- ✅ Rapid votes don't cause race conditions
- ✅ Rapid guesses blocked until phase is active
- ✅ Disconnect during timeout doesn't crash server
- ✅ Reconnect receives game_ended event with bonuses
- ✅ No XSS vulnerabilities (sanitization applied)

**Failure Points to Monitor:**
- Name validation bypassed (XSS risk)
- Question length not enforced (database/memory issue)
- Race condition with simultaneous votes (vote count wrong)
- Guess accepted during non-guessing phase
- Server crash on rapid reconnect
- Scores corrupted by rapid actions
- Sanitization not applied (UI breaks or XSS)

---

## Test Execution Guide

### Setup
```bash
# Terminal 1: Start the server
cd server
npm install
npm start
# Should see: "Server running on http://localhost:3000"

# Terminal 2: Start the client dev server
npm run dev
# Should see: "Local: http://localhost:5173"
```

### Running Each Scenario

**For each scenario:**
1. Open 4+ browser windows (use mobile emulation or actual devices)
2. Follow the steps in order
3. **Watch server console for errors**
4. **Watch browser console for errors**
5. **Check socket.io DevTools for event order**
6. **Note final scores and bonuses**

### Debug Checklist
- [ ] Server console shows all socket events in order
- [ ] No duplicate events (e.g., "submission_countdown_started" twice)
- [ ] Scores only increase, never decrease
- [ ] State is consistent across all clients
- [ ] Timers fire at correct times (check logs for drift)
- [ ] Room deleted after game ends + timeout
- [ ] No memory leaks (rooms map doesn't grow infinitely)

### Expected Errors to Find
1. **Race condition**: Two players' votes trigger finalization simultaneously
2. **Off-by-one**: 50% threshold calculated wrong (4 players = 2 or 3?)
3. **Default question author**: Undefined in guessing phase UI
4. **Snoop count overflow**: Type coercion issue with count tracking
5. **Reconnect socket ID**: Old ID lingers in questions array
6. **Bonus tie-breaking**: Multiple winners get bonus instead of none
7. **Name validation**: XSS vector via angle brackets or quotes
8. **Question truncation**: Long questions break UI layout
9. **Room closure**: Timer doesn't fire, room persists forever
10. **Skip guess logic**: Points awarded when shouldn't be

---

## Scoring Path Summary

### Custom Question Flow
1. **Submission** (+0)
2. **Voting** (+1 per vote on this question)
3. **If selected for guessing**:
   - Guesser correct → +0 to author, +5 to guesser
   - Guesser incorrect → +3 to author, +0 to guesser
4. **End-of-game bonuses** (unique winners only)

### Default Question Flow
1. **Submission** (+0, auto-filled)
2. **Voting** (+0 at vote time, even if voted)
3. **If selected for guessing**:
   - Guesser correct → +0 to author (N/A), +5 to guesser
   - Guesser incorrect → +0 to author (N/A), +0 to guesser
4. **If default question wins**: Author (system) doesn't receive points
5. **End-of-game bonuses**: Applies same as custom questions

### Bonus Calculation
- **Longest avg question** (+3): (totalLength / questionCount) for each author, highest wins
- **Most snoops** (+3): Player with most guess attempts (correct + incorrect)
- **Most-displayed question** (+4): Question ID that was selected most rounds

**Tie rule:** If two players tied for bonus, **NO BONUS AWARDED** to either

---

## Notes for Developers

- Use `sanitizeForDisplay()` on all player names and questions before rendering
- Verify socket connection state before emitting events
- Test with network latency simulation (Chrome DevTools: throttle)
- Monitor memory usage during long test runs (auto-close should prevent leaks)
- Check for console.log spam in production code (remove debug logs)
- Validate all user input on both client and server
- Ensure timers are cleared on room deletion (no orphaned timeouts)


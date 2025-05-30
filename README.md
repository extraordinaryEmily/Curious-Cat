# WIP; AUGMENT AI TEST

This is a test project for Augment AI. It is a simple trivia game where players can create a room, join a room, and play trivia with friends. The game is built with React, Socket.IO, and Node.js. Party game meant for me to play with friends but also experiment with Socket.IO and AI coding.

## Augment Observations

- Has difficulty debugging multiple files and unable to trace which file is causing the error
- Poor CSS decisions
- Does better when instructed to make print statements
- Not straightforward to prep user with installment instrucitons
- 'Apply changes' doesn't seem to SHOW all changes (ie when there are no changes there actually is and when you save, some action has changed but since you didn't see it, you don't know what exactly changed; created a git for this reason so I can save things more clearly)

## All Previous Bugs
- Vote jumps ahead to calculate best question too early
- You are allowed to vote for your own question on the UI
- authorId and isAnswering issue
- targetPlayer is suddenly missing value
- Pages mesh instead of transition
- Question display formatting with spacing and letter cases(broken again)
- Resetting values for new round with 'No' and 'Next' options
- Issue with disconnecting server at authorId
- Scoring was half the points

## TODO
- CSS
- Phone vs desktop; reload warning
- Duplicate names
- Host pages are kinda broken

## Things to note as Augment warns
- Possibly players haven't submitted questions but round proceeds
- Proper clearing of previous round's data
- Screen orientation changes
- Different screen sizes
- Special characters in inputs
- Rapid button clicking
- Double question submissions
- Final scoreboard on ties
- Score preservation during reconnection
- Multiple players submitting or voting simultaneously

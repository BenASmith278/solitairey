# Solitairey

## About

Solitairey is an entirely client-side solitaire game built using only vanilla JavaScript, HTML, and CSS. There are no libraries or frameworks used, hence the name. This project was originally created as a project for CSDS 285 Linux Tools and Scripting, but I will continue to work on this project in my free time to add more features and polish the game (see below).

## How to play

You can either download the source code and open `index.html` in your browser, or you can play the game online at https://benasmith278.github.io/solitairey/.

Click and drag to move cards around the board. Double-click to send a card to a foundation pile. Click the upper right-most pile (the stock) to flip a new card or refresh the pile.

Game state is automatically saved after every move, so you can close the browser and come back to your game later. You can also click the "New Game" button to start a new game, or the "Undo" button to undo your last move.

## Roadmap:

- [x] Basic solitaire game
- [x] Save/load game
- [x] Undo
- [x] View stats from past games
- [x] Replay past games
- [ ] Polish HUD
- [ ] Fix favicon on GitHub Pages
- [ ] Update GitHub deployment to use minified code
- [ ] Deck builder
- [ ] Optimize history storage
- [ ] Intro screen
- [ ] Draw 3
- [ ] Click-to-move functionality
- [ ] Different solitaire variants (e.g. spider, freecell)
- [ ] Themes/skins
- [ ] Multiplayer co-op/ competitive modes

## Issues:

- Win screen disappears on refresh
- Winning a game, refreshing, and winning again saves the same game multiple times 
- Clicking and releasing on a card picks it up and the cards beneath it
- History is incorrect after autocomplete
- Doing anything during replay probably causes a lot of issues
- Pointer cursor on stock pile when waste and stock empty

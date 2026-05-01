const board = document.getElementById("board");

const Store = {
	save: (key, state) => {
		try {
			localStorage.setItem(key, JSON.stringify(state));
		} catch (e) {
			console.error(`Failed to save state to ${key}:`, e);
		}
	},
	load: (key) => {
		try {
			const stateStr = localStorage.getItem(key);
			return stateStr ? JSON.parse(stateStr) : null;
		} catch (e) {
			console.error(`Failed to load state at ${key}:`, e);
			return null;
		}
	},
	clear: (key) => {
		try {
			localStorage.removeItem(key);
		} catch (e) {
			console.error(`Failed to clear state at ${key}:`, e);
		}
	},
};

const Suit = Object.freeze({
	CLUBS: "clubs",
	SPADES: "spades",
	DIAMONDS: "diamonds",
	HEARTS: "hearts",
});

const suits = [Suit.CLUBS, Suit.SPADES, Suit.DIAMONDS, Suit.HEARTS];
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
function getSuitSymbol(suit) {
	switch (suit) {
		case "clubs":
			return "&clubs;";
		case "spades":
			return "&spades;";
		case "hearts":
			return "&hearts;";
		case "diamonds":
			return "&diams;";
		default:
			return "?";
	}
}

function getSuitColor(suit) {
	switch (suit) {
		case "clubs":
		case "spades":
			return "black";
		case "hearts":
		case "diamonds":
			return "red";
		default:
			return "black";
	}
}

function getRankLabel(rank) {
	if (rank === 1) return "A";
	if (rank === 11) return "J";
	if (rank === 12) return "Q";
	if (rank === 13) return "K";
	return rank.toString();
}

var state = {
	version: 1,
	variant: "playthrough",
	stock: [],
	waste: [],
	foundations: [[], [], [], []],
	tableau: [[], [], [], [], [], [], []],
	history: [],
	moves: 0,
	elapsed: 0,
	won: false,
};

var cardDimensions = { width: 0, height: 0, gap: 8 };
var cardMap = {};
var reverseCardMap = {};
var draggingArray = [];
var boardOffset = board.getBoundingClientRect();
var dragPendingTimer = null;
var dragPendingCard = null;
var dragPendingEvent = null;
var isAutoCompleting = false;
var timerTimer = null;
var resizeTimer = null;
var replayHistory = null;
var replayIndex = 0;
var replayRunning = false;
var replayTimer = null;

function buildDeck() {
	var deck = [];
	for (const suit of suits) {
		for (const rank of ranks) {
			deck.push({ suit, rank, faceUp: false });
		}
	}

	return deck;
}

function shuffle(deck) {
	return deck.sort(() => Math.random() - 0.5);
}

function deal(deck) {
	for (let i = 0; i < 7; i++) {
		for (let j = 0; j <= i; j++) {
			const card = deck.pop();
			card.faceUp = j === i;
			state.tableau[i].push(card);
		}
	}

	state.stock = deck;
}

function onClickReplay(event) {
	const key = event.target.dataset.key;
	const history = Store.load("history") || {};
	replayHistory = history[key]?.history;
	if (replayHistory) {
		const gameState = JSON.parse(replayHistory[0]);
		console.log("replaying:", gameState);

		gameState.history = gameState.history || [];

		newGame(gameState);

		document.getElementById("controls").hidden = false;
		document.getElementById("step").disabled = false;
		document.getElementById("play").disabled = false;
		document.getElementById("pause").disabled = true;

		state.variant = "replay";
		replayIndex = 1;
	}
}

function buildHistoryTable() {
	table = document.getElementById("history-table");
	table.innerHTML = "";
	const header = table.createTHead();
	const headerRow = header.insertRow();
	headerRow.innerHTML = `
		<th>Date</th>
		<th>Moves</th>
		<th>Time</th>
		<th>Won</th>
		<th><button style='background: red' type='button' onclick='Store.clear("history"); buildHistoryTable();'>Clear</button></th>
	`;
	const history = Store.load("history") || {};
	for (const [date, stats] of Object.entries(history)) {
		const row = document.createElement("tr");
		row.innerHTML = `
			<td>${date.split("T")[0]}</td>
			<td>${stats.moves}</td>
			<td>${Math.floor(stats.time / 60)}:${String(stats.time % 60).padStart(2, "0")}</td>
			<td>${stats.won ? "Yes" : "No"}</td>
			<td><button class='replay' type='button' data-key='${date}'>Replay</button></td>
		`;
		table.appendChild(row);
		row.querySelector(".replay").onclick = onClickReplay;
	}
}

function checkWin() {
	if (
		state.foundations[0].length === 13 &&
		state.foundations[0].length === state.foundations[1].length &&
		state.foundations[1].length === state.foundations[2].length &&
		state.foundations[2].length === state.foundations[3].length
	) {
		state.won = true;
		Store.save("gameState", state);
		saveToStateHistory();
		saveGameToHistory();
		showNewGameScreen();
	}
}

function showNewGameScreen() {
	winScreen = document.getElementById("win-screen");
	text = document.getElementById("win-text");
	text.textContent = state.won ? "You won!" : "Game over!";
	winScreen.hidden = false;
	winScreen.style.display = "flex";
	buildHistoryTable();
}

function checkAutoComplete() {
	for (const pile of state.tableau) {
		for (const card of pile) {
			if (!card.faceUp) return false;
		}
	}

	if (state.stock.length > 0 || state.waste.length > 0) return false;

	const autoCompleteButton = document.getElementById("autocomplete");
	if (!isAutoCompleting) autoCompleteButton.disabled = false;
	return true;
}

function cardKey(card) {
	return `${card.suit}-${card.rank}`;
}

function cardElKey(cardEl) {
	return cardEl.dataset.key;
}

function createCardElement(card) {
	const rankLabel = getRankLabel(card.rank);
	const suitSymbol = getSuitSymbol(card.suit);

	const topLeft = document.createElement("span");
	topLeft.classList.add("corner", "top-left");
	topLeft.innerHTML = `${rankLabel} ${suitSymbol}`;

	const bottomRight = document.createElement("span");
	bottomRight.classList.add("corner", "bottom-right");
	bottomRight.innerHTML = `${rankLabel} ${suitSymbol}`;

	const middle = document.createElement("span");
	middle.classList.add("middle");
	middle.innerHTML = `${suitSymbol}${rankLabel}${suitSymbol}`;

	const cardFace = document.createElement("div");
	cardFace.classList.add("card-face", card.suit);
	cardFace.appendChild(topLeft);
	cardFace.appendChild(bottomRight);
	cardFace.appendChild(middle);

	const cardBack = document.createElement("div");
	cardBack.classList.add("card-back");

	const cardEl = document.createElement("div");
	cardEl.classList.add("face-down", "card");
	cardEl.dataset.key = cardKey(card);
	cardEl.appendChild(cardFace);
	cardEl.appendChild(cardBack);

	cardMap[cardKey(card)] = cardEl;
	reverseCardMap[cardElKey(cardEl)] = card;
}

function initCardElements() {
	for (const card of state.stock) {
		createCardElement(card);
	}

	for (const card of state.waste) {
		createCardElement(card);
	}

	for (const pile of state.tableau) {
		for (const card of pile) {
			createCardElement(card);
		}
	}

	for (const pile of state.foundations) {
		for (const card of pile) {
			createCardElement(card);
		}
	}
}

function computeCardSize() {
	const cardWidth = Math.floor(
		(window.innerWidth - cardDimensions.gap * cardDimensions.gap) / 7,
	);
	const cardHeight = Math.floor(cardWidth * 1.4);

	document.documentElement.style.setProperty("--card-w", `${cardWidth}px`);
	document.documentElement.style.setProperty("--card-h", `${cardHeight}px`);

	cardDimensions = { width: cardWidth, height: cardHeight, gap: 8 };
}

function positionPile(cards, x, y, stackVertically, dataKeys) {
	var zIndex = 1;
	var yOffset = 0;

	const pile = document.createElement("div");
	pile.classList.add("pile-slot");
	pile.dataset.pileType = dataKeys[0];
	pile.dataset.pileIndex = dataKeys[1];
	pile.style.transform = `translate(${x}px, ${y}px)`;
	pile.style.zIndex = "1";
	board.appendChild(pile);

	if (dataKeys[0] === "stock") {
		pile.onclick = onStockClick;
		pile.style.cursor = "pointer";
	}

	if (typeof cards === "object") {
		for (const key in cards) {
			const card = cards[key];
			const cardEl = cardMap[cardKey(card)];
			cardEl.style.zIndex = `${zIndex}`;
			cardEl.classList.toggle("face-up", card.faceUp);
			cardEl.classList.toggle("face-down", !card.faceUp);
			cardEl.style.transform = `translate(${x}px, ${y + (stackVertically ? yOffset : 0)}px)`;
			zIndex++;
			yOffset += card.faceUp ? 18 : 8;

			board.appendChild(cardEl);
		}
	}
}

function layout() {
	board.innerHTML = "";
	const movesCounter = document.getElementById("moves");
	movesCounter.textContent = `Moves: ${state.moves}`;
	if (state.history.length === 0 || isAutoCompleting)
		document.getElementById("undo").disabled = true;
	else document.getElementById("undo").disabled = false;

	computeCardSize();
	const stride = cardDimensions.width + cardDimensions.gap;

	positionPile(state.stock, 6 * stride, cardDimensions.gap, false, [
		"stock",
		-1,
	]);
	if (state.stock.length > 0) {
		const stockTop = cardMap[cardKey(state.stock[state.stock.length - 1])];
		stockTop.onclick = onStockClick;
		stockTop.style.cursor = "pointer";
	}

	positionPile(state.waste, 5 * stride, cardDimensions.gap, false, [
		"waste",
		-1,
	]);

	var index = 0;
	for (const key in state.foundations) {
		const foundation = state.foundations[key];
		positionPile(foundation, index * stride, cardDimensions.gap, false, [
			"foundations",
			index,
		]);
		index++;
	}

	index = 0;
	for (const key in state.tableau) {
		const pile = state.tableau[key];
		positionPile(
			pile,
			index * stride,
			cardDimensions.height + cardDimensions.gap * 2,
			true,
			["tableau", index],
		);
		index++;
	}
}

function isValidMove(destination, card) {
	if (destination.type === "tableau") {
		if (destination.pile.length === 0) {
			return card.rank === 13;
		} else {
			const topCard = destination.pile[destination.pile.length - 1];
			return (
				topCard.faceUp &&
				getSuitColor(topCard.suit) !== getSuitColor(card.suit) &&
				card.rank === topCard.rank - 1
			);
		}
	} else if (destination.type === "foundations") {
		return canMoveToFoundation(card) === destination.index;
	}

	return false;
}

function canMoveToFoundation(card) {
	if (card === undefined) return -1;

	for (const foundation of state.foundations) {
		if (foundation.length === 0) {
			return card.rank === 1 ? state.foundations.indexOf(foundation) : -1;
		} else {
			const topCard = foundation[foundation.length - 1];
			if (topCard.suit === card.suit && card.rank === topCard.rank + 1) {
				return state.foundations.indexOf(foundation);
			}
		}
	}

	return -1;
}

function resolvePileFromElement(el) {
	if (el === undefined || el === null) {
		return undefined;
	}

	if (el.classList?.contains("pile-slot")) {
		const pileType = el.dataset.pileType;
		const pileIndex = parseInt(el.dataset.pileIndex, 10);
		const pile =
			pileIndex === -1 ? state[pileType] : state[pileType][pileIndex];
		return { pile: pile, type: pileType, index: pileIndex };
	}

	if (el.classList?.contains("card")) {
		return resolvePileFromElement(el.previousElementSibling);
	}

	return resolvePileFromElement(el.parentElement);
}

function findDropTarget(x, y) {
	const el = document.elementFromPoint(x, y);
	return resolvePileFromElement(el);
}

function undo() {
	if (state.history.length === 0) return;
	if (isAutoCompleting) return;
	const lastState = JSON.parse(state.history.pop());

	state.stock = lastState.stock;
	state.waste = lastState.waste;
	state.foundations = lastState.foundations;
	state.tableau = lastState.tableau;
	state.moves = lastState.moves;
	state.won = lastState.won;

	cardMap = {};
	reverseCardMap = {};
	initCardElements();
	layout();
	Store.save("gameState", state);
	if (state.variant === "replay") replayIndex--;
}

function saveToStateHistory() {
	const snapshot = {
		stock: state.stock,
		waste: state.waste,
		foundations: state.foundations,
		tableau: state.tableau,
		moves: state.moves,
		won: state.won,
		elapsed: state.elapsed,
	};
	state.history.push(JSON.stringify(snapshot));
}

function applyMove(fromPile, toPile, cards) {
	console.log("Applying move from", fromPile, "to", toPile, "cards:", cards);
	document.getElementById("play").disabled = true;
	document.getElementById("step").disabled = true;
	document.getElementById("pause").disabled = true;

	if (fromPile === toPile) return;

	for (const cardEl of cards) {
		const card = reverseCardMap[cardElKey(cardEl)];
		const fromIndex = fromPile.indexOf(card);
		if (fromIndex !== -1) {
			fromPile.splice(fromIndex, 1);
		}
		if (fromIndex > 0) {
			const newTopCard = fromPile[fromIndex - 1];
			newTopCard.faceUp = true;
		}
		toPile.push(card);
	}

	state.moves++;
	checkWin();
	checkAutoComplete();
	layout();
}

function onClickAutoComplete() {
	if (isAutoCompleting) return;
	saveToStateHistory();
	Store.save("gameState", state);
	autoComplete();
}

function autoComplete() {
	const autoCompleteButton = document.getElementById("autocomplete");
	const undoButton = document.getElementById("undo");
	const topCards = [];
	autoCompleteButton.disabled = true;
	undoButton.disabled = true;
	isAutoCompleting = true;

	for (const pile of state.tableau) {
		topCards.push({ card: pile[pile.length - 1], pile: pile });
	}

	for (const key of topCards) {
		const foundationIndex = canMoveToFoundation(key.card);
		if (foundationIndex > -1) {
			applyMove(key.pile, state.foundations[foundationIndex], [
				cardMap[cardKey(key.card)],
			]);
			setTimeout(autoComplete, 120);
			return;
		}
	}

	isAutoCompleting = false;
	autoCompleteButton.disabled = false;
	undoButton.disabled = state.history.length === 0;
}

function startDrag() {
	const card = dragPendingCard;
	if (card) {
		// If the card is face-down, do nothing
		if (!card.classList.contains("face-up")) {
			return;
		}

		// Collect the dragged card plus all face-up cards below it
		draggingArray = [card];
		let next = card.nextElementSibling;
		while (next?.classList.contains("face-up")) {
			if (next.classList.contains("card")) {
				draggingArray.push(next);
			}
			next = next.nextElementSibling;
		}

		// Apply no-transition to all dragged cards and elevate them
		for (const el of draggingArray) {
			el.classList.add("no-transition");
			el.style.zIndex = "1000";
		}

		// Capture pointer events and track movement and release
		board.setPointerCapture(dragPendingEvent.pointerId);
		board.onpointermove = onPointerMove;
		board.onpointerup = onPointerUp;
		boardOffset = board.getBoundingClientRect();
	}
}

function onStockClick(event) {
	const resolved = resolvePileFromElement(event.target);
	if (!resolved || resolved.pile !== state.stock) return;
	if (state.stock.length + state.waste.length === 0) return;

	document.getElementById("play").disabled = true;
	document.getElementById("step").disabled = true;
	document.getElementById("pause").disabled = true;

	saveToStateHistory();
	if (state.stock.length > 0) {
		const card = state.stock.pop();
		card.faceUp = true;
		state.waste.push(card);
	} else {
		while (state.waste.length > 0) {
			const card = state.waste.pop();
			card.faceUp = false;
			state.stock.push(card);
		}
	}

	state.moves++;
	layout();
	Store.save("gameState", state);
}

function onPointerDown(event) {
	if (isAutoCompleting) return;

	// Walk up from event.target to find the nearest .card
	var card = event.target;
	while (card && !card.classList.contains("card")) {
		card = card.parentElement;
	}

	if (card === null) return;
	if (card.classList?.contains("face-down")) return;

	// Check for double-click
	if (dragPendingTimer !== null) {
		clearTimeout(dragPendingTimer);
		dragPendingTimer = null;
		dragPendingCard = null;
		dragPendingEvent = null;
		return;
	}

	dragPendingCard = card;
	dragPendingEvent = event;
	dragPendingTimer = setTimeout(() => {
		startDrag();
		dragPendingCard = null;
		dragPendingEvent = null;
		dragPendingTimer = null;
	}, 250);
}

function onPointerMove(e) {
	const x = e.clientX - cardDimensions.width / 2 - boardOffset.left;
	const y = e.clientY - cardDimensions.height / 2 - boardOffset.top;
	var yOffset = 0;

	for (const el of draggingArray) {
		el.style.transform = `translate(${x}px, ${y + yOffset}px)`;
		yOffset += 18;
	}
}

function onPointerUp(e) {
	const dropTarget = findDropTarget(e.clientX, e.clientY);
	const rootCard = reverseCardMap[cardElKey(draggingArray[0])];

	if (dropTarget && isValidMove(dropTarget, rootCard)) {
		console.log(state.tableau);
		saveToStateHistory();
		applyMove(
			resolvePileFromElement(draggingArray[0]).pile,
			dropTarget.pile,
			draggingArray,
		);
		Store.save("gameState", state);
	} else {
		layout();
	}

	// Reset board and dragged cards
	board.onpointermove = null;
	board.onpointerup = null;

	for (const el of draggingArray) {
		el.classList.remove("no-transition");
	}

	draggingArray = [];
}

function onDoubleClick(event) {
	if (isAutoCompleting) return;

	// Walk up from event.target to find the nearest .card
	var cardEl = event.target;
	while (cardEl && !cardEl.classList.contains("card")) {
		cardEl = cardEl.parentElement;
	}

	if (cardEl === null) return;
	if (cardEl.classList?.contains("face-down")) return;

	const card = reverseCardMap[cardElKey(cardEl)];
	const foundationIndex = canMoveToFoundation(card);
	const fromPile = resolvePileFromElement(cardEl).pile;
	if (foundationIndex > -1 && fromPile.indexOf(card) === fromPile.length - 1) {
		saveToStateHistory();
		applyMove(fromPile, state.foundations[foundationIndex], [cardEl]);
		Store.save("gameState", state);
	}
}

function startTimer() {
	timerTimer = setInterval(() => {
		if (state.won) {
			clearInterval(timerTimer);
			return;
		}
		state.elapsed++;
		const timerEl = document.getElementById("time");
		const minutes = Math.floor(state.elapsed / 60)
			.toString()
			.padStart(2, "0");
		const seconds = (state.elapsed % 60).toString().padStart(2, "0");
		timerEl.textContent = `Time: ${minutes}:${seconds}`;
	}, 1000);
}

function saveGameToHistory() {
	const history = Store.load("history") || {};
	const gameStats = {
		moves: state.moves,
		time: state.elapsed,
		won: state.won,
		history: state.history,
	};
	history[new Date().toISOString()] = gameStats;
	Store.save("history", history);
}

function newGame(saveState = null) {
	if (saveState) {
		state = saveState;
	} else {
		Store.clear("gameState");
		if (timerTimer) clearInterval(timerTimer);
		state.elapsed = 0;
		state.moves = 0;
		state.stock = [];
		state.waste = [];
		state.foundations = [[], [], [], []];
		state.tableau = [[], [], [], [], [], [], []];
		state.history = [];
		state.won = false;

		deal(shuffle(buildDeck()));
		Store.save("gameState", state);
	}
	state.variant = "playthrough";
	const winScreen = document.getElementById("win-screen");
	winScreen.hidden = true;
	winScreen.style.display = "none";

	document.getElementById("controls").hidden = true;

	console.log(state);
	initCardElements();
	layout();
	if (!checkAutoComplete())
		document.getElementById("autocomplete").disabled = true;
	startTimer();
}

function replayStep() {
	if (!replayHistory) return;
	if (replayIndex >= replayHistory.length) {
		replayRunning = false;
		return;
	}

	const gameState = JSON.parse(replayHistory[replayIndex]);
	state.stock = gameState.stock;
	state.waste = gameState.waste;
	state.foundations = gameState.foundations;
	state.tableau = gameState.tableau;
	state.moves = gameState.moves;
	state.won = gameState.won;
	replayIndex++;

	cardMap = {};
	reverseCardMap = {};
	initCardElements();
	layout();
	saveToStateHistory();
}

function replayRun() {
	if (!replayRunning) {
		if (replayTimer) clearTimeout(replayTimer);
		document.getElementById("step").disabled = false;
		document.getElementById("play").disabled = false;
		document.getElementById("pause").disabled = true;
		return;
	}
	document.getElementById("step").disabled = true;
	document.getElementById("play").disabled = true;
	document.getElementById("pause").disabled = false;
	replayStep();
	replayTimer = setTimeout(replayRun, 400);
}

window.addEventListener("load", () => {
	const savedState = Store.load("gameState");
	newGame(savedState);
});

window.addEventListener("resize", () => {
	if (resizeTimer) clearTimeout(resizeTimer);
	resizeTimer = setTimeout(layout(), 100);
});

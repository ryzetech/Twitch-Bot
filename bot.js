const tmi = require('tmi.js');
const sharp = require('sharp');
const fetch = require('node-fetch');
const axios = require("axios").default;
const { client_token, deconz } = require("./token.json");
const colors = require('./colors');

const opts = {
  identity: {
    username: "finnleythebot",
    password: client_token
  },
  channels: [
    "ryzetech"
  ]
};

var timeouts = {
  light: {
    stamp: 0,
    timeout: 900000
  }
};

const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

// VARS BEGIN
let currentC4Game = null;


// CLASSES BEGIN

class Connect4game {
  constructor(opponent1, opponent2) {
    this.opponent1 = opponent1;
    this.opponent2 = opponent2;
    this.turn = opponent1;
    this.board = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ];
    this.winner = null;
    this.gameOver = false;
  }

  switchTurn() {
    if (this.turn === this.opponent1) {
      this.turn = this.opponent2;
    } else {
      this.turn = this.opponent1;
    }
  }

  placeChip(column) {
    column--;

    // check if column is full
    if (this.board[0][column] !== 0) {
      return false;
    }
    // check if game is over
    if (this.gameOver) {
      return false;
    }
    // place piece
    for (let i = 5; i >= 0; i--) {
      if (this.board[i][column] === 0) {
        this.board[i][column] = this.turn;
        break;
      }
    }

    if (this.checkForWinner()) {
      this.renderBoard();
      this.gameOver = true;
      this.winner = this.turn;
      client.say("ryzetech", `${this.winner} wins the game!`);
      currentC4Game = null;
      setTimeout(this.clearBoard, 3000);
    }

    this.switchTurn();

    return true;
  }

  checkForWinner() {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 7; j++) {
        if (this.board[i][j] !== 0) {
          // check horizontal
          try {
            if (this.board[i][j] === this.board[i][j + 1] && this.board[i][j] === this.board[i][j + 2] && this.board[i][j] === this.board[i][j + 3]) {
              this.winner = this.board[i][j];
              this.gameOver = true;
              return true;
            }
          } catch (e) {
            // do nothing
          }
          try {
            // check vertical
            if (this.board[i][j] === this.board[i + 1][j] && this.board[i][j] === this.board[i + 2][j] && this.board[i][j] === this.board[i + 3][j]) {
              this.winner = this.board[i][j];
              this.gameOver = true;
              return true;
            }
          } catch (e) {
            // do nothing
          }
          try {
            // check diagonal
            if (i < 3) {
              if (this.board[i][j] === this.board[i + 1][j + 1] && this.board[i][j] === this.board[i + 2][j + 2] && this.board[i][j] === this.board[i + 3][j + 3]) {
                this.winner = this.board[i][j];
                this.gameOver = true;
                return true;
              }
            }
          } catch (e) {
            // do nothing
          }
          try {
            // check anti-diagonal
            if (i > 2) {
              if (this.board[i][j] === this.board[i - 1][j + 1] && this.board[i][j] === this.board[i - 2][j + 2] && this.board[i][j] === this.board[i - 3][j + 3]) {
                this.winner = this.board[i][j];
                this.gameOver = true;
                return true;
              }
            }
          } catch (e) {
            // do nothing
          }
        }
      }
    }
  }

  renderBoard() {
    let chipstack = [];

    if (!this.gameOver) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 7; j++) {
          let column = this.board[i][j];
          if (column === this.opponent1) {
            chipstack.push(new Object({ input: "./imgs/chip_red.png", top: (25 + 300 * i), left: (25 + 300 * j) }));
          } else if (column === this.opponent2) {
            chipstack.push(new Object({ input: "./imgs/chip_yellow.png", top: (25 + 300 * i), left: (25 + 300 * j) }));
          }
        }
      }

      sharp("./imgs/board.png")
        .composite(chipstack)
        .toFile("./current.png", (err, info) => {
          if (err !== null) console.log(err);
        });
    } else {

    }
  }

  clearBoard() {
    sharp("./imgs/board.png")
      .composite([{ input: "./imgs/txt.png" }])
      .toFile("./current.png", (err, info) => {
        if (err !== null) console.log(err);
      });
  }
}


// FUNCTS BEGIN

function hexToXy(hexstring) {
  if (hexstring.length != 6) {
    throw "Only six-digit hex colors are allowed.";
  }

  var aRgbHex = hexstring.match(/.{1,2}/g);
  let red = parseInt(aRgbHex[0], 16);
  let green = parseInt(aRgbHex[1], 16);
  let blue = parseInt(aRgbHex[2], 16);

  let redC = (red / 255)
  let greenC = (green / 255)
  let blueC = (blue / 255)
  // console.log(redC, greenC, blueC)

  let redN = (redC > 0.04045) ? Math.pow((redC + 0.055) / (1.0 + 0.055), 2.4) : (redC / 12.92)
  let greenN = (greenC > 0.04045) ? Math.pow((greenC + 0.055) / (1.0 + 0.055), 2.4) : (greenC / 12.92)
  let blueN = (blueC > 0.04045) ? Math.pow((blueC + 0.055) / (1.0 + 0.055), 2.4) : (blueC / 12.92)
  // console.log(redN, greenN, blueN)

  let X = redN * 0.664511 + greenN * 0.154324 + blueN * 0.162028;
  let Y = redN * 0.283881 + greenN * 0.668433 + blueN * 0.047685;
  let Z = redN * 0.000088 + greenN * 0.072310 + blueN * 0.986039;
  // console.log(X, Y, Z)

  let x = X / (X + Y + Z);
  let y = Y / (X + Y + Z);
  return [x, y];
}

function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
  sharp("./imgs/board.png")
    .composite([{ input: "./imgs/txt.png" }])
    .toFile("./current.png", (err, info) => {
      if (err !== null) console.log(err);
    });
}

async function onMessageHandler(target, context, msg, self) {
  if (self || !msg.startsWith("!")) { return; }
  const commandName = msg.trim().slice(1);

  if (commandName === "help") {
    client.say(target, `${context['display-name']} A full reference can be found at https://bit.ly/3Hgd7WG`);
  }

  // Random Stuff
  if (commandName.startsWith("dice")) {
    let sides = commandName.slice(5).split("d")[1];
    if (!sides) sides = 6;
    const roll = Math.floor(Math.random() * sides) + 1;
    client.say(target, `${context['display-name']} rolled a ${roll} on a ${sides} sided die.`);
  }

  if (commandName.startsWith("8ball")) {
    const responses = [
      "It is certain",
      "It is decidedly so",
      "Without a doubt",
      "Yes, definitely",
      "You may rely on it",
      "As I see it, yes",
      "Most likely",
      "Outlook good",
      "Yes",
      "Signs point to yes",
      "Reply hazy try again",
      "Ask again later",
      "Better not tell you now",
      "Cannot predict now",
      "Concentrate and ask again",
      "Don't count on it",
      "My reply is no",
      "My sources say no",
      "Outlook not so good",
      "Very doubtful"
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    client.say(target, `${context['display-name']} asked the magic 8 ball: ${msg.slice(7)}... ${response}`);
  }

  if (commandName.startsWith("fact")) {
    fetch("https://uselessfacts.jsph.pl/random.json?language=en")
      .then(res => res.json())
      .then(json => client.say(target, `${context['display-name']} asked for a fact: "${json.text}"`));
  }

  if (commandName.startsWith("randomquote")) {
    fetch("https://api.quotable.io/random")
      .then(res => res.json())
      .then(json => client.say(target, `${context['display-name']} asked for a quote: "${json.content}" ~ ${json.author}`));
  }

  if (commandName.startsWith("connect4")) {
    // const subcommand = commandName.slice(9);
    if (currentC4Game === null) {
      currentC4Game = "looking " + context['display-name'];
      client.say(target, `${context['display-name']} is looking for a game of connect 4! Type !connect4 to join.`);
    }
    else if (currentC4Game.toString().startsWith("looking ")) {
      if (currentC4Game.slice(8) === context['display-name']) {
        client.say(target, `${context['display-name']} you can't play with yourself!`);
        return;
      }
      const game = new Connect4game(currentC4Game.slice(8), context['display-name']);
      game.renderBoard();
      currentC4Game = game;
      client.say(target, `${context['display-name']} has joined the game of connect 4! Type "!move <column>" to make a move.`);
    } else {
      client.say(target, `${context['display-name']} A game of connect 4 is already in progress.`);
    }
  }

  if (commandName.startsWith("move")) {
    const column = parseInt(commandName.slice(5));

    if (!currentC4Game || currentC4Game.toString().startsWith("looking ")) {
      client.say(target, `${context['display-name']} You have to create or join the game first! Type "!connect4" to do so.`);
    } else {
      if (currentC4Game.turn !== context['display-name']) {
        client.say(target, `${context['display-name']} It's not your turn!`);
        return;
      }
      if (column < 1 || column > 7) {
        client.say(target, `${context['display-name']} Column must be between 1 and 7.`);
      } else {
        let success = currentC4Game.placeChip(column);
        if (success) {
          if (!currentC4Game) {
            return;
          }
          client.say(target, "Chip placed!");
          currentC4Game.renderBoard();
        } else {
          client.say(target, "Column is full.");
        }
      }
    }
  }

  if (commandName.startsWith("light")) {
    if (!(context['mod'] || ("#" + context.username === target))) {
      if (timeouts.light.stamp + timeouts.light.timeout > Date.now()) {
        client.say(target, `${context['display-name']} You can't do that yet.`);
        return;
      } else {
        timeouts.light.stamp = Date.now();
      }
    }

    const light = commandName.slice(6);

    if (light === "on" || light === "off" || light.startsWith("#000000") || light === "black") {
      const response = await axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: (light === "on") });
      const resdata = await response.data;
      client.say(target, `${context['display-name']} turned the light ${(light === "on") ? "on" : "off"}.`);
    }
    else {
      if (!light) {
        const response = await axios.get("http://homeassistant.local:6942/api/" + deconz + "/lights/7");
        const resdata = await response.data;
        client.say(target, `${context['display-name']} lights are ${resdata.state.on ? "on" : "off"}.`);
      }

      else if (light.startsWith("#")) {
        const response = await axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: true, xy: hexToXy(light.slice(1, 7)) });
        const resdata = await response.data;
        client.say(target, `${context['display-name']} turned the light to ${light}`);
      }
      else {
        const color = light.toLowerCase();
        const colorList = colors.map(c => c.name.toLowerCase());
        const colorIndex = colorList.indexOf(color);
        if (colorIndex === -1) {
          client.say(target, `${context['display-name']} I don't know the color ${color}.`);
          return;
        }
        const colorHex = colors[colorIndex].hex;

        const xy = hexToXy(colorHex.slice(1));

        const response = await axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", {
          on: true,
          xy: xy
        });
        const resdata = await response.data;
        client.say(target, `${context['display-name']} turned the light ${color}`);
      }
    }
  }
}
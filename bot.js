// importing things
const tmi = require('tmi.js');
const sharp = require('sharp');
const fetch = require('node-fetch');
const axios = require("axios").default;
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { client_token, deconz } = require("./token.json");
const colors = require('./colors');
const colorList = colors.map(c => c.name.toLowerCase());

// options for chat client
const opts = {
  identity: {
    username: "finnleythebot",
    password: client_token
  },
  channels: [
    "ryzetech"
  ]
};

// timeout save object
var timeouts = {
  light: {
    stamp: 0,
    timeout: 90000
  }
};

// do client stuff
const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

// VARS BEGIN
let currentC4Game = null;
let lightLock = false;
let currentColor = [];

// CLASSES BEGIN

class Connect4game {
  constructor(opponent1, opponent2) {
    if (this.opponent2 === undefined) {
      this.isLooking = true;
      return;
    }

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
    lightLock = true;
    axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: true, xy: hexToXy("00FF00") });
  }

  switchTurn() {
    if (this.turn === this.opponent1) {
      this.turn = this.opponent2;
      axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: true, xy: hexToXy("FFFF00") });
    } else {
      this.turn = this.opponent1;
      axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: true, xy: hexToXy("FF0000") });
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

    if (this.checkBoardFull()) {
      this.renderBoard();
      client.say("ryzetech", `The game is a draw! Well played!`);
      currentC4Game = null;
      setTimeout(this.clearBoard, 3000);
    }

    if (this.checkForWinner()) {
      this.renderBoard();
      this.winner = this.turn;
      client.say("ryzetech", `${this.winner.username} wins the game!`);
      let data2 = (this.winner === this.opponent1) ? true : false;
      let data1 = prisma.user.update({
        where: {
          id: this.winner.id
        },
        data: {
          connect4played: {
            increment: 1
          },
          connect4won: {
            increment: 1
          },
          coins: {
            increment: 150
          }
        }
      });
      data2 = prisma.user.update({
        where: {
          id: (data2) ? this.opponent1.id : this.opponent2.id
        },
        data: {
          connect4played: {
            increment: 1
          }
        }
      });
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

  checkBoardFull() {
    for (let i = 1; i < 7; i++) {
      if (this.board[0][i] === 0) {
        return false;
      }
    }
    return true;
  }

  renderBoard() {
    let chipstack = [];

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
  }

  clearBoard() {
    sharp("./imgs/board.png")
      .composite([{ input: "./imgs/txt.png" }])
      .toFile("./current.png", (err, info) => {
        if (err !== null) console.log(err);
      });
    lightLock = false;
    axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: true, xy: currentColor });
  }
}


// FUNCTS BEGIN

// hex to xy colors 
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

  // honestly, i have idea what this is doing
  let redN = (redC > 0.04045) ? Math.pow((redC + 0.055) / (1.0 + 0.055), 2.4) : (redC / 12.92)
  let greenN = (greenC > 0.04045) ? Math.pow((greenC + 0.055) / (1.0 + 0.055), 2.4) : (greenC / 12.92)
  let blueN = (blueC > 0.04045) ? Math.pow((blueC + 0.055) / (1.0 + 0.055), 2.4) : (blueC / 12.92)

  let X = redN * 0.664511 + greenN * 0.154324 + blueN * 0.162028;
  let Y = redN * 0.283881 + greenN * 0.668433 + blueN * 0.047685;
  let Z = redN * 0.000088 + greenN * 0.072310 + blueN * 0.986039;

  let x = X / (X + Y + Z);
  let y = Y / (X + Y + Z);
  return [x, y];
}

// do things on connect
function onConnectedHandler(addr, port) {
  // print connector message
  console.log(`* Connected to ${addr}:${port}`);

  // reset board for connect4
  sharp("./imgs/board.png")
    .composite([{ input: "./imgs/txt.png" }])
    .toFile("./current.png", (err, info) => {
      if (err !== null) console.log(err);
    });

  // turn on light
  try {
    axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: true, bri: 50 });
  } catch (e) {
    console.error(e);
  }
}

// message handler
async function onMessageHandler(target, context, msg, self) {
  // ignore messages from self
  if (self) return;

  // find the user in the database
  let user = await prisma.user.findUnique({
    where: {
      id: context["user-id"]
    }
  });

  // if there is no user, create one
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: context["user-id"],
        username: context.username
      }
    });
  }

  // update msg count
  user = await prisma.user.update(
    {
      where: {
        id: user.id
      },
      data: {
        messages: {
          increment: 1
        },
        coins: {
          increment: Math.floor(Math.random() * 9) + 1
        }
      }
    }
  )

  // check if message is a number between 1 and 7 (connect 4)
  if ((msg.length === 1 && msg.match(/^[1-7]$/)) && currentC4Game !== null && !currentC4Game.toString().startsWith("looking ")) {
    let column = parseInt(msg);

    if (context['display-name'] === currentC4Game.opponent1 || context['display-name'] === currentC4Game.opponent2) {
      // reject if the user is not the current player
      if (currentC4Game.turn !== context['display-name']) {
        client.say(target, `${context['display-name']} It's not your turn!`);
        const response = await axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { alert: "lselect" });
        return;
      }

      // try to place chip
      let success = currentC4Game.placeChip(column);

      if (success) {
        // check if the game is over
        if (!currentC4Game) {
          return;
        }
        client.say(target, "Chip placed!");
        currentC4Game.renderBoard();
      }
      else {
        client.say(target, "Column is full.");
      }
    }
    else return;
  }

  // check if message contains "zollstock"
  if (msg.toLowerCase().includes("zollstock")) {
    client.say(target, `${context['display-name']} DAS HEIßT GLIEDERMAßSTAB!!!!`);
  }

  // ignore if message does not contain a command
  if (!msg.startsWith("!")) { return; }

  // parse
  const commandName = msg.trim().slice(1);

  if (commandName === "help") {
    // i got lazy here dont judge me
    client.say(target, `${context['display-name']} A full reference can be found at https://bit.ly/3Hgd7WG`);
  }

  if (commandName.startsWith("dice")) {
    // take sides parameter
    let sides = commandName.slice(5).split("d")[1];

    // if it doesn't exist, default to 6
    if (!sides) sides = 6;
    const roll = Math.floor(Math.random() * sides) + 1;
    client.say(target, `${context['display-name']} rolled a ${roll} on a ${sides} sided die.`);
  }

  if (commandName.startsWith("8ball")) {
    // responses yes yes
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

    // pick a random response
    const response = responses[Math.floor(Math.random() * responses.length)];

    client.say(target, `${context['display-name']} asked the magic 8 ball: ${msg.slice(7)}... ${response}`);
  }

  if (commandName.startsWith("fact")) {
    fetch("https://uselessfacts.jsph.pl/random.json?language=en")
      .then(res => res.json())
      .then(json => client.say(target, `${context['display-name']} asked for a fact: "${json.text}"`));
  }

  if (commandName.startsWith("quote")) {
    let id = parseInt(commandName.slice(6));

    // if there is no id give, pick a random quote
    if (!id) {
      const quotes = await prisma.quote.findMany();
      id = Math.floor(Math.random() * quotes.length);
      client.say(target, `${context['display-name']} asked for a random quote: "${quotes[id].quote}"`);
    }
    else {
      const q = await prisma.quote.findUnique({
        where: {
          id: id
        }
      });

      client.say(target, `${context['display-name']} asked for a quote: "${q.quote}"`);
      if (!q) {
        client.say(target, `${context['display-name']} That quote doesn't exist.`);
        return;
      }
    }
  }

  if (commandName.startsWith("connect4")) { // the original connecting four classic
    // check if there is a game existing
    if (currentC4Game === null) {
      currentC4Game = new Connect4game(user);
      client.say(target, `${context['display-name']} is looking for a game of connect 4! Type !connect4 to join.`);
    }
    // check if the game is looking for a player
    else if (currentC4Game.isLooking) {
      // check if the user tries to join the game they are already in
      if (currentC4Game.opponent1.username === context.username){
        client.say(target, `${context['display-name']} you can't play with yourself!`);
        return;
      }

      // create new game and link the users to it
      const game = new Connect4game(currentC4Game.opponent1, user);
      currentC4Game = game;
      game.renderBoard();
      currentC4Game = game;
      client.say(target, `${context['display-name']} has joined the game of connect 4! Type the column as a number to make a move.`);
      client.say(target, `It's ${currentC4Game.opponent1}'s turn!`);
    } else {
      // reject if the game is already in progress
      client.say(target, `${context['display-name']} A game of connect 4 is already in progress.`);
    }
  }

  if (commandName.startsWith("light")) {
    // override timeout if the user is a moderator or the broadcaster
    // else
    if (!(context['mod'] || ("#" + context.username === target))) {
      // reject if command is in timeout or locked
      if (((timeouts.light.stamp + timeouts.light.timeout) > Date.now()) || lightLock) {
        client.say(target, `${context['display-name']} You can't do that yet. ${(lightLock) ? "The light is currently locked by another bot application." : `Try again in ${Math.ceil(((timeouts.light.stamp + timeouts.light.timeout) - Date.now()) / 1000)} seconds.`} `);
        return;
      } else {
        // reset timeout
        timeouts.light.stamp = Date.now();
      }
    }

    // check if the user has enough coins
    if (user.coins < options.light.cost) {
      client.say(target, `${context['display-name']} You don't have enough coins! You need at least ${options.light.cost} coins to use this command (you have ${user.coins}).`);
      return;
    } else {
      user = await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          coins: {
            decrement: options.light.cost
          }
        }
      });
    }

    // get option
    const light = commandName.slice(6);

    // check if option has to do with light state
    if (light === "on" || light === "off" || light.startsWith("#000000") || light === "black") {
      const response = await axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: (light === "on") });
      const resdata = await response.data;
      client.say(target, `${context['display-name']} turned the light ${(light === "on") ? "on" : "off"}.`);
    }
    else {
      // if there is no option, return state
      if (!light) {
        const response = await axios.get("http://homeassistant.local:6942/api/" + deconz + "/lights/7");
        const resdata = await response.data;
        client.say(target, `${context['display-name']} lights are ${resdata.state.on ? "on" : "off"}.`);
      }

      // if there is a hex color, set color
      else if (light.startsWith("#")) {
        let xy = hexToXy(light.slice(1, 7));
        currentColor = xy;

        const response = await axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", { on: true, xy: xy });
        const resdata = await response.data;
        client.say(target, `${context['display-name']} turned the light to ${light}`);
      }
      else {
        // try to find the color by word
        const color = light.toLowerCase();
        const colorIndex = colorList.indexOf(color);
        // reject if color couldn't be found
        if (colorIndex === -1) {
          client.say(target, `${context['display-name']} I don't know the color ${color}.`);
          user = await prisma.user.update({
            where: {
              id: user.id
            },
            data: {
              coins: {
                increment: options.light.cost
              }
            }
          });
          return;
        }
        // get hex value of the color
        const colorHex = colors[colorIndex].hex;

        // get xy value of the color
        const xy = hexToXy(colorHex.slice(1));
        currentColor = xy;

        // send changes to deconz
        const response = await axios.put("http://homeassistant.local:6942/api/" + deconz + "/lights/7/state", {
          on: true,
          xy: xy
        });
        const resdata = await response.data;
        client.say(target, `${context['display-name']} turned the light ${color}`);
      }
    }
  }

  if (commandName.startsWith("lurk")) {
    client.say(target, `${context['display-name']} Thank you for your lurk! Bring cookies and coffee when you come back! ryzeHug`);
  }

  if (commandName.startsWith("coins")) {
    client.say(target, `${context['display-name']} You have ${user.coins} coins.`);
  }

  // mod section
  if (commandName.startsWith("addquote")) {
    if (context.badges.broadcaster || context['mod']) {
      const quote = commandName.slice(9);
      
      let qouteObj = await prisma.quote.create({
        data: {
          quote: quote
        }
      });

      client.say(target, `${context['display-name']} Quote added with ID ${qouteObj.id}`);
    } else {
      client.say(target, `${context['display-name']} You are not a moderator!`);
    }
  }

  if (commandName.startsWith("clearc4")) {
    if (context.badges.broadcaster || context['mod']) {
      currentC4Game.clearBoard();
      currentC4Game = null;
      client.say(target, `${context['display-name']} The game of connect 4 has been cleared and new players can start a game.`);
    } else {
      client.say(target, `${context['display-name']} You are not a moderator!`);
    }
  }
}
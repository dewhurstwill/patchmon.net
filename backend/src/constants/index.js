const time = require("./time");
const defaults = require("./defaults");
const tfa = require("./tfa");

module.exports = {
  ...defaults,
  ...tfa,
  ...time
}

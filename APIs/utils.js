const moment = require('moment');

const isToday = (date) => moment(date).isSame(moment(), "day");

module.exports = { isToday };
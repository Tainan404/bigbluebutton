/* eslint-disable global-require */
// Preserve the original rule and plugin ordering while composing focused fragments.
module.exports = [
  require('./base'), require('./cache'), require('./scripts'), require('./styles'), require('./assets'),
  require('./optimization'), require('./html'), require('./mini-css'), require('./static-files'), require('./define'),
  require('./dev-server'), require('./compression'),
];

// Emit an entry manifest so the gate never reconstructs webpack filenames.
const EntryManifestPlugin = require('../plugins/entry-manifest');

module.exports = (options) => ({ name: 'entry-manifest', plugins: [new EntryManifestPlugin(options.target)] });

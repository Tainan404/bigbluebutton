/* eslint-disable import/no-extraneous-dependencies */
// Emit the single initial JavaScript entry that the browser gate loads.
const { RawSource } = require('webpack').sources;

class EntryManifestPlugin {
  constructor(target) { this.target = target; }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('EntryManifestPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'EntryManifestPlugin',
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
      }, () => {
        const files = compilation.entrypoints.get('main').getFiles().filter((file) => file.endsWith('.js'));
        if (files.length !== 1) throw new Error(`Expected one initial main JS file, received: ${files.join(', ')}`);
        compilation.emitAsset(`${this.target}.entry.json`, new RawSource(`${JSON.stringify(files)}\n`));
      });
    });
  }
}

module.exports = EntryManifestPlugin;

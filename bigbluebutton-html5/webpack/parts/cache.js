/* eslint-disable max-len */
// Configure persistent cache and local tldraw development behavior.
module.exports = (options, paths) => ({
  name: 'cache',
  config: {
    cache: {
      type: 'filesystem',
      allowCollectingMemory: true,
      name: `${options.mode}-${options.target}`,
      buildDependencies: {
        config: [paths.config, paths.babelConfig],
        // why: yalc never bumps tldraw's version, so its external build id invalidates stale cache entries (PR #25090).
        ...(options.tldrawBuildIdExists && { tldraw: [paths.tldrawBuildId] }),
      },
    },
    snapshot: {
    // why: hash tldraw contents because yalc keeps its package version unchanged (PR #25090).
      managedPaths: [/^(.+?[\\/]node_modules[\\/])(?!@bigbluebutton[\\/]tldraw[\\/])/],
    },
    // why: ignore partial yalc remove/add operations that otherwise cache ENOENT failures (PR #25090).
    watchOptions: { ignored: /node_modules|\.yalc/ },
  },
});

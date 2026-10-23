# HTML5 webpack build

`webpack.config.js` composes focused fragments from `webpack/parts/`. Environment variables are read only by `options.js`.

| Variable | Values | Default |
| --- | --- | --- |
| `NODE_ENV` | `development`, `production` | `development` |
| `TARGET` | `default`, `safari` | `default` |
| `HOT_RELOAD` | `true`, `false` | `false` |
| `DETAILED_LOGS` | `true`, `false` | `false` |

`npm start` runs the proxied hot development server. `npm run build` emits the minified default production bundle. `npm run build-safari` emits the unminified Safari compatibility bundle. `deploy.sh`, the package `build.sh`, and repository-level `dev.sh` retain their public interfaces.

Local tldraw development writes `.tldraw-build-id`; webpack uses it to invalidate cache and hashes yalc package contents because yalc does not change its version. Special compatibility settings and their provenance are documented beside the relevant fragments.

If output appears stale, remove `node_modules/.cache/webpack` and rebuild.

`.browserslistrc` is the supported browser contract used by Babel, autoprefixer, webpack, and
`npm run verify:build`. Babel stays on version 7 with `bugfixes` enabled; the explicit contract also
prevents a future Babel 8 upgrade from silently adopting a newer default browser floor.

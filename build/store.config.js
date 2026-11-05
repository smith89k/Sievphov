// electron-builder's config for the Microsoft Store package (`pnpm run dist:store`): package.json's "build", plus the Store
// copy's update helpers (store-update/out, made by scripts/build-store-update.js) in resources\store-update. As Sastra PDF:
// only the Store package carries them; the installer (`pnpm run dist`) never does.
const base = require('../package.json').build;

module.exports = {
  ...base,
  extraResources: [
    ...base.extraResources,
    { from: 'store-update/out', to: 'store-update', filter: ['SievphovStoreUpdate.exe', 'SievphovRestart.node'] }
  ],
  win: { ...base.win, target: 'appx' }
};

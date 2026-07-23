# Living Materials

A standalone, mobile-friendly canvas experience with clay, straw, and timber modes.

## Put it on your existing GitHub + Netlify site

1. Unzip `living-materials-netlify.zip`.
2. Open your existing website repository on GitHub.
3. Click **Add file**, then **Upload files**.
4. Drag the files from inside the unzipped folder onto GitHub. Upload the files themselves, not the outer folder.
5. Make sure `index.html` is at the repository's top level.
6. Enter `Add Living Materials` in the commit box.
7. Click **Commit changes**.
8. Netlify should deploy the update automatically from the same repository and domain.

You do not need to reconnect your domain or create a different Netlify project.

## Files

- `index.html`: page structure
- `styles.css`: layout and controls
- `app.js`: material animation and interaction
- `service-worker.js`: clears stale caches from an older site
- `netlify.toml`: Netlify settings

No npm, build command, backend, account, or API is required.

## Controls

- Use the material button at the top to switch modes.
- Clay: press and drag through the mass.
- Straw: move or drag to create wind.
- Timber: grab a piece, move fast, and release to throw it.
- Use the round arrow at the bottom-right to reset the current material.

## Browser support

Current Chrome, Edge, Safari, and Firefox on desktop and mobile.

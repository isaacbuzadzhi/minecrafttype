# Uptown Charlotte Browser World

This repository deploys a browser-based Minecraft-style client with a real-world Uptown Charlotte map.

## Files

- `game.zip`: browser game engine
- `world.zip`: replaceable Charlotte world
- `netlify.toml`: tells Netlify how to assemble the site
- `charlotte-preview.png`: preview image, not required by the build

## Update the existing site

1. Open the existing `isaacbuzadzhi/minecrafttype` repository on GitHub.
2. Choose **Add file**, then **Upload files**.
3. Drag all files from this package into GitHub.
4. Choose **Commit changes**.
5. Wait for Netlify to deploy the new commit. Your existing Netlify project and domain stay connected.

The old `site.zip` can remain in the repository, but Netlify no longer uses it.

## Change the world later

Replace only `world.zip`, keep that exact filename, and commit the change. Netlify will redeploy automatically.

## World details

- Approximately 1.5 km by 1.5 km at 1 block per meter
- Spawn near Trade Street and Tryon Street
- Minecraft Java 1.21.4 world format
- Creative mode

Use a current desktop Chrome, Edge, Firefox, or Safari browser for the best chance of loading the map. Mobile devices may run out of memory.

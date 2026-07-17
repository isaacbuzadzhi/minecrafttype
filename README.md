# Simple Village World — Netlify Update

This package replaces the current browser world with a lightweight Minecraft Java 1.20.4 world.

## What is in the world

- Starts at a generated plains village
- Creative mode
- Peaceful difficulty
- Normal Minecraft terrain and structures
- A cherry grove exists elsewhere in the same world

## Put it on your existing website

1. Unzip this download on your computer.
2. Open your existing `isaacbuzadzhi/minecrafttype` repository on GitHub.
3. Click **Add file** and then **Upload files**.
4. Upload `game.zip`, `world.zip`, `netlify.toml`, and `README.md` from this package.
5. Click **Commit changes**.
6. Netlify will redeploy the same project and domain automatically.

The new deployed world uses the filename `simple-village-v2.zip`, which prevents the browser from reusing the old Charlotte world from its cache.

The old `site.zip` and other unused files may remain in the repository; Netlify does not use them with this configuration.

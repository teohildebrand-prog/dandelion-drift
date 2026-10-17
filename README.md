# Dandelion Drift

A 3D platformer about Pip, a plant bug who glides on a dandelion seed up Thistledown Gorge to the Old Oak crown. Plain HTML, CSS and JavaScript with a hand-written WebGL renderer and procedural audio: no build step, no dependencies at runtime.

## Play it

```bash
./scripts/serve.sh        # then open http://localhost:8000
```

Opening `src/index.html` straight from disk also works.

## Layout

```
src/
  index.html      page, HUD, menus and the field manual
  css/game.css
  js/             loaded in this order by index.html
    engine.js     math, matrices, mesh builder, WebGL renderer
    audio.js      procedural sound effects and sequenced music
    level.js      Thistledown Gorge: solids, lifts, winds, pickups, collision grid
    models.js     Pip, enemies and props (built once, posed per frame)
    game.js       tuning, player physics, threats, game state
    render.js     camera and per-frame drawing
    ui.js         HUD, menus, keyboard/gamepad/touch input, main loop
tests/            headless browser smoke test (pytest + Playwright)
scripts/          serve.sh, test.sh, check_syntax.js
```

The files are classic scripts that share one global scope, so their order in `index.html` matters. That kept the split from the original single file a pure cut with no behaviour change. Moving to ES modules with explicit imports is a later step.

## Test

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium   # once, if you have no Chromium for Playwright yet
./scripts/test.sh
```

The test serves `src/`, starts the game in headless Chromium with software WebGL, runs and jumps, and fails on any JavaScript error. It saves a screenshot to `test-artifacts/smoke.png`.

CI runs the same script: `Jenkinsfile` for Jenkins (needs the Docker Pipeline plugin) and `.github/workflows/test.yml` for GitHub Actions.

## Tuning

Movement and glide feel live in the `TUNE` object at the top of `src/js/game.js` (run speed, jump, gravity, glide sink, dive speed).

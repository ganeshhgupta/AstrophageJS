# astrophage.js

A JavaScript particle library recreating the astrophage bioluminescence scene from *Project Hail Mary*.

## Inspiration

In Andy Weir's *Project Hail Mary*, astrophage are microscopic alien organisms that feed on solar energy and emit a deep crimson bioluminescence. The 2025 film adaptation brought this to life in a scene that genuinely stopped me — the astronaut standing on the hull of the *Hail Mary*, surrounded by an endless swarm of glowing crimson particles drifting through space. The whole frame bathed in red. Thousands of soft bokeh discs blinking in and out, some flaring white before fading. It looked alive.

I couldn't stop thinking about it, so I built this.

## What it does

`astrophage.js` renders a full-screen Canvas 2D particle field that replicates that scene — radially streaming crimson bokeh particles with depth-based perspective, randomised blinking, white flash events, and a mouse parallax effect. No dependencies. No WebGL. Drop in one file.

## Usage

**1. Add the script**

```html
<script src="astrophage.js"></script>
```

**2. Create a container**

```html
<div id="scene" style="position:fixed;inset:0;"></div>
```

**3. Init**

```html
<script>
  const scene = Astrophage.init('scene', {
    count:      1200,   // particle count
    driftSpeed: 0.30,   // how fast particles stream outward
    sourceZ:    0.75,   // perspective depth — low = tight tunnel, high = uniform field
    baseSize:   14,     // particle size scale (px)
  });
</script>
```

**4. Control at runtime**

```js
scene.setOptions({ count: 3000, sourceZ: 2.0 })
scene.stop()
scene.start()
scene.destroy()
```

## All options

| Option | Default | Description |
|---|---|---|
| `count` | `1200` | Number of particles |
| `driftSpeed` | `0.30` | Z advancement rate |
| `sourceZ` | `0.75` | Depth of radiation source. Low → tight tunnel from centre. High → nearly uniform spread across frame. |
| `baseSize` | `14` | Size scale factor in px |
| `mouseParallax` | `true` | Vanishing point follows mouse |
| `background` | `true` | Draw dark crimson background on canvas |
| `onFps` | `null` | Callback `(fps: number) => void` fired every ~600ms |

## Preview

Open `astrophage.html` in any browser — no server needed, just a local file open.

It includes a live HUD with sliders for density, drift speed, source Z, and particle size.

---

*Inspired by Project Hail Mary — Andy Weir / Amazon MGM Studios*

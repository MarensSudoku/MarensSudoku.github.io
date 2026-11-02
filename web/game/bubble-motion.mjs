const DENSITY = 42;
export const MAX_BUBBLES = DENSITY * 36;

export function emitBubbles(cells, bounds, viewport, time, random = Math.random) {
  const bubbles = [];
  for (const [order, cell] of [...new Set(cells)].entries()) {
    for (let i = 0; i < DENSITY; i++) {
      const seed = random(), group = i % 14, size = group === 0 ? .35 + seed * .22 : group < 4 ? .12 + seed * .14 : .025 + seed * .085;
      const diameter = size * bounds.width / 9 / viewport.height;
      const birth = time + order * .008 + random() * .16;
      bubbles.push({
        x:(bounds.left + (cell % 9 + .5 + (random() - .5) * .86) * bounds.width / 9) / viewport.height,
        y:(bounds.top + (Math.floor(cell / 9) + .62 + (random() - .5) * .7) * bounds.height / 9) / viewport.height,
        diameter, birth, seed, vx:0, vy:.12, speed:.32 + Math.sqrt(diameter) * .9 + seed * .08,
        changeAfter:birth + .2, splitAt:group === 0 && random() < .25 ? birth + .35 + random() * .35 : Infinity,
      });
    }
  }
  return bubbles;
}

export function advanceBubbles(bubbles, time, delta, random = Math.random) {
  const live = bubbles.filter(bubble => bubble.y + bubble.diameter > 0 && time - bubble.birth < 6);
  for (const bubble of live) {
    const age = time - bubble.birth, step = Math.max(0, Math.min(delta, age));
    bubble.vy += (bubble.speed - bubble.vy) * (1 - Math.exp(-5 * step));
    bubble.x += (bubble.vx + Math.sin(age * (9 + bubble.seed * 5) + bubble.seed * 31) * .045) * step;
    bubble.vx *= Math.exp(-3 * step);
    bubble.y -= bubble.vy * step;
  }
  let changes = 0;
  for (const bubble of [...live]) {
    if (changes >= 2 || live.length + 4 > MAX_BUBBLES) break;
    if (time < bubble.splitAt || time < bubble.changeAfter) continue;
    const count = 3 + Math.floor(random() * 2), weights = Array.from({length:count}, () => .5 + random());
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    live.splice(live.indexOf(bubble), 1);
    weights.forEach((weight, i) => {
      const angle = i * Math.PI * 2 / count + bubble.seed * 6;
      live.push({...bubble,
        x:bubble.x + Math.cos(angle) * bubble.diameter * .18,
        y:bubble.y + Math.sin(angle) * bubble.diameter * .12,
        diameter:bubble.diameter * Math.cbrt(weight / total), seed:random(),
        vx:Math.cos(angle) * .065, vy:bubble.vy - Math.sin(angle) * .04,
        changeAfter:time + .4, splitAt:Infinity,
      });
    });
    changes++;
  }
  // Only larger bubbles can merge; the fixed particle cap bounds the pair checks.
  const candidates = live.filter(bubble => bubble.diameter > .009 && time > bubble.changeAfter);
  const merged = new Set();
  for (let i = 0; i < candidates.length && changes < 2; i++) {
    const a = candidates[i]; if (merged.has(a)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j]; if (merged.has(b)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > (a.diameter + b.diameter) * .38 || random() >= 1 - Math.exp(-delta * 3)) continue;
      const volumeA = a.diameter ** 3, volumeB = b.diameter ** 3, volume = volumeA + volumeB;
      const mix = key => (a[key] * volumeA + b[key] * volumeB) / volume;
      live.push({...a, x:mix('x'), y:mix('y'), diameter:Math.cbrt(volume),
        vx:mix('vx'), vy:mix('vy'), speed:mix('speed'), changeAfter:time + .35,
        splitAt:random() < .3 ? time + .4 : Infinity,
      });
      merged.add(a); merged.add(b); changes++; break;
    }
  }
  return live.filter(bubble => !merged.has(bubble)).slice(-MAX_BUBBLES);
}

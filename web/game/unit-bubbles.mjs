import { emitBubbles, advanceBubbles, MAX_BUBBLES } from './bubble-motion.mjs';

const VERTEX = `
attribute vec4 a_bubble;
attribute float a_seed;
uniform float u_time;
uniform vec2 u_viewport;
uniform float u_ratio;
varying mediump float v_alpha;
varying mediump float v_phase;
varying mediump float v_large;
varying mediump float v_size;
void main() {
  float age = u_time - a_bubble.w;
  gl_Position = vec4(a_bubble.x * u_viewport.y / u_viewport.x * 2.0 - 1.0, 1.0 - a_bubble.y * 2.0, 0.0, 1.0);
  v_size = a_bubble.z * u_viewport.y;
  gl_PointSize = max(1.0, v_size * u_ratio);
  v_alpha = smoothstep(0.0, 0.08, age);
  v_phase = a_seed * 25.0 + age * (11.0 + a_seed * 4.0);
  v_large = smoothstep(3.0, 18.0, v_size);
}`;
const FRAGMENT = `
precision mediump float;
uniform float u_map;
varying mediump float v_alpha;
varying mediump float v_phase;
varying mediump float v_large;
varying mediump float v_size;
void main() {
  vec2 point = (gl_PointCoord * 2.0 - 1.0) * 1.1;
  float angle = sin(v_phase * 0.7) * 0.2 * v_large;
  point = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * point;
  float shape = mix(0.98, 0.77 + sin(v_phase) * 0.12, v_large);
  point.y /= shape;
  point.x += sin(v_phase * 0.83 + point.y * 3.0) * 0.13 * v_large * max(0.0, 1.0 - point.y * point.y);
  float radius = length(point);
  if (radius >= 1.0 || v_alpha <= 0.0) discard;
  float depth = sqrt(max(0.0, 1.0 - radius * radius));
  vec3 normal = normalize(vec3(point.x, point.y / shape, depth));
  float edge = 1.0 - smoothstep(0.91, 1.0, radius);
  if (u_map > 0.5) {
    vec2 offset = point * (0.3 + (1.0 - depth) * 0.7) * min(1.0, v_size / 24.0);
    vec3 map = vec3(0.5 + offset * 0.48, 0.5);
    float alpha = edge * v_alpha;
    gl_FragColor = vec4(map * alpha, alpha);
    return;
  }
  float light = max(dot(normal, normalize(vec3(-0.3, -0.65, 0.85))), 0.0);
  float cap = pow(light, 9.0), glint = pow(light, 48.0);
  float rim = smoothstep(0.68, 0.85, radius);
  float sky = smoothstep(-0.2, 0.5, -point.y);
  vec3 color = mix(vec3(0.38, 0.7, 0.76), vec3(0.87, 0.98, 1.0), sky);
  color = mix(color, vec3(1.0), clamp(cap * 0.7 + glint, 0.0, 1.0));
  float alpha = v_alpha * edge * min(0.95, 0.015 + rim * 0.65 + cap * 0.55 + glint * 0.8);
  gl_FragColor = vec4(color * alpha, alpha);
}`;

export function createUnitBubbles(board) {
  const canvas = document.createElement('canvas');
  canvas.className = 'unit-bubbles'; canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true;
  let gl, program, buffer, origin, seed, time, viewport, ratio, mapMode, frame = 0, epoch = 0, last = 0, particles = [];
  let filter, image, svg, originalFilter;
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { gl.deleteShader(result); throw new Error('Bubble shader unavailable'); }
    return result;
  }
  function setup() {
    const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('Bubble shader unavailable'); }
    buffer = gl.createBuffer();
    origin = gl.getAttribLocation(program, 'a_bubble'); seed = gl.getAttribLocation(program, 'a_seed');
    time = gl.getUniformLocation(program, 'u_time'); viewport = gl.getUniformLocation(program, 'u_viewport');
    ratio = gl.getUniformLocation(program, 'u_ratio'); mapMode = gl.getUniformLocation(program, 'u_map');
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    canvas.dataset.status = 'ready';
  }
  try {
    gl = canvas.getContext('webgl', {alpha:true, premultipliedAlpha:true, preserveDrawingBuffer:true, depth:false, stencil:false, antialias:false});
    if (!gl) return null;
    setup();
  } catch { return null; }
  document.body.append(canvas);
  const element = (name, attributes) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  function startRefraction(width, height) {
    if (!svg) {
      svg = element('svg', {'aria-hidden':'true', class:'bubble-filter'});
      filter = element('filter', {id:'unit-bubble-refraction', filterUnits:'userSpaceOnUse', 'color-interpolation-filters':'sRGB', x:0, y:0});
      image = element('feImage', {result:'bubble-map', preserveAspectRatio:'none', x:0, y:0});
      filter.append(image, element('feDisplacementMap', {in:'SourceGraphic', in2:'bubble-map', scale:18, xChannelSelector:'R', yChannelSelector:'G'}));
      svg.append(filter); document.body.append(svg);
    }
    for (const node of [filter, image]) { node.setAttribute('width', width); node.setAttribute('height', height); }
    if (originalFilter === undefined) originalFilter = document.body.style.filter;
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0; particles = []; canvas.hidden = true;
    if (originalFilter !== undefined) { document.body.style.filter = originalFilter; originalFilter = undefined; }
    image?.removeAttribute('href');
    if (!gl.isContextLost()) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  function draw(now) {
    frame = 0;
    if (now - last < 1000 / 30 - 2) { frame = requestAnimationFrame(draw); return; }
    const elapsed = (now - epoch) / 1000, delta = Math.min((now - last) / 1000, .08); last = now;
    particles = advanceBubbles(particles, elapsed, delta);
    if (!particles.length || gl.isContextLost()) { stop(); return; }
    const width = innerWidth, height = innerHeight;
    const pixelsRatio = Math.min(devicePixelRatio || 1, 1.5, 1024 / Math.max(width, height));
    const pixels = [Math.max(1, Math.round(width * pixelsRatio)), Math.max(1, Math.round(height * pixelsRatio))];
    if (canvas.width !== pixels[0] || canvas.height !== pixels[1]) { canvas.width = pixels[0]; canvas.height = pixels[1]; }
    gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particles.flatMap(particle => [particle.x, particle.y, particle.diameter, particle.birth, particle.seed])), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(origin); gl.vertexAttribPointer(origin, 4, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(seed); gl.vertexAttribPointer(seed, 1, gl.FLOAT, false, 20, 16);
    gl.uniform1f(time, elapsed); gl.uniform2f(viewport, width, height); gl.uniform1f(ratio, pixelsRatio);
    // A regular SVG filter also refracts HTML in Safari; backdrop-filter displacement does not.
    gl.clearColor(.5, .5, .5, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(mapMode, 1);
    gl.drawArrays(gl.POINTS, 0, particles.length);
    try {
      image.setAttribute('href', canvas.toDataURL());
      document.body.style.filter = `${originalFilter ? originalFilter + ' ' : ''}url("#unit-bubble-refraction")`;
    } catch { document.body.style.filter = originalFilter || ''; }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(mapMode, 0);
    gl.drawArrays(gl.POINTS, 0, particles.length);
    frame = requestAnimationFrame(draw);
  }
  window.addEventListener('resize', stop);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stop(); canvas.dataset.status = 'lost'; });
  canvas.addEventListener('webglcontextrestored', () => { try { setup(); } catch { canvas.dataset.status = 'unavailable'; } });
  return {
    burst(cells) {
      if (canvas.dataset.status !== 'ready' || gl.isContextLost()) return;
      const now = performance.now(); if (!frame) { epoch = now; last = now; }
      particles.push(...emitBubbles(cells, board.getBoundingClientRect(), {width:innerWidth, height:innerHeight}, (now - epoch) / 1000));
      particles = particles.slice(-MAX_BUBBLES); canvas.hidden = false;
      startRefraction(innerWidth, innerHeight);
      if (!frame) frame = requestAnimationFrame(draw);
    },
    stop,
  };
}

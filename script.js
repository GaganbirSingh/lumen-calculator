/* ==========================================================================
   Lumen Calculator: behaviour
   1. Elements        4. Rendering and fitting long numbers
   2. Arithmetic      5. Mouse, touch and keyboard input
   3. Actions         6. Cursor-driven motion (tilt, light, magnets, parallax)
   Plain JavaScript, no libraries.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- 1. Elements ---------- */
  const calculator = document.getElementById('calculator');
  const stage = document.querySelector('.stage');
  const display = document.querySelector('.display');
  const valueEl = document.getElementById('display-value');
  const expressionEl = document.getElementById('display-expression');
  const keypad = document.getElementById('keypad');
  const keys = Array.from(keypad.querySelectorAll('.key'));
  const operatorKeys = keys.filter((key) => key.dataset.action === 'operator');

  // Keyboard key -> on-screen button (from each button's data-key attribute)
  const keyByShortcut = new Map(keys.map((key) => [key.dataset.key, key]));
  const SHORTCUT_ALIASES = { ',': '.', '=': 'Enter', x: '*', X: '*', Delete: 'Escape', Clear: 'Escape' };

  /* ---------- 2. Arithmetic ---------- */
  const MAX_DIGITS = 15;   // longest number a person can type
  const PRECISION = 15;    // significant digits kept in results (removes float noise: 0.1 + 0.2 = 0.3)
  const SHOWN_DECIMALS = 14; // significant digits shown for non-whole results (1 ÷ 3 × 3 shows 1)

  class CalculationError extends Error {}

  function round(number) {
    const rounded = Number.parseFloat(number.toPrecision(PRECISION));
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function compute(a, operator, b) {
    let result;
    switch (operator) {
      case '+': result = a + b; break;
      case '−': result = a - b; break;
      case '×': result = a * b; break;
      case '÷':
        if (b === 0) throw new CalculationError("Can't divide by zero");
        result = a / b;
        break;
      default:
        throw new CalculationError('Unknown operation');
    }
    if (!Number.isFinite(result)) throw new CalculationError('Number too large');
    return round(result);
  }

  // Number -> plain string without grouping, e.g. 1234.5 -> "1234.5", 1e20 -> "1e20"
  function toPlain(number) {
    const size = Math.abs(number);
    if (size !== 0 && (size >= 1e15 || size < 1e-9)) {
      const [mantissa, exponent] = number.toExponential(9).split('e');
      return `${mantissa.replace(/\.?0+$/, '')}e${exponent.replace('+', '')}`;
    }
    const digits = Number.isInteger(number) ? PRECISION : SHOWN_DECIMALS;
    return number.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: digits });
  }

  // Plain string -> what the screen shows, e.g. "-1234.50" -> "−1,234.50"
  function formatNumber(text) {
    if (text.includes('e')) return text.replace(/-/g, '−');
    const negative = text.startsWith('-');
    const [integer, fraction] = (negative ? text.slice(1) : text).split('.');
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${negative ? '−' : ''}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
  }

  const format = (number) => formatNumber(toPlain(number));
  const countDigits = (text) => text.replace(/\D/g, '').length;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  /* ---------- 3. Actions ---------- */
  const state = {
    input: '0',             // number on screen, as a plain string
    value: null,            // exact value behind a calculated result (null while the person is typing)
    stored: null,           // left-hand number of the pending operation
    operator: null,         // pending operator: + − × ÷
    awaitingOperand: false, // an operator was just chosen; the next digit starts a new number
    freshStart: false,      // a result is showing; the next digit replaces it
    lastOperator: null,     // remembered so pressing = again repeats the last step
    lastOperand: null,
    expression: '',         // the smaller line above the number
    error: null,
  };

  function clearAll({ silent = false } = {}) {
    Object.assign(state, {
      input: '0', value: null, stored: null, operator: null, awaitingOperand: false, freshStart: false,
      lastOperator: null, lastOperand: null, expression: '', error: null,
    });
    if (!silent) render();
  }

  function showError(message) {
    clearAll({ silent: true });
    state.error = message;
    state.expression = 'Press AC or a number to restart';
    render({ shake: true });
  }

  function attempt(calculation) {
    try {
      return calculation();
    } catch (error) {
      if (!(error instanceof CalculationError)) throw error;
      showError(error.message);
      return null;
    }
  }

  // The number currently on screen
  const currentValue = () => state.value ?? Number.parseFloat(state.input);

  function showResult(number) {
    state.value = number;
    state.input = toPlain(number);
  }

  function startNewEntry(text) {
    if (state.freshStart && !state.operator) {
      state.expression = '';
      state.lastOperator = null;
    }
    state.input = text;
    state.value = null;
    state.awaitingOperand = false;
    state.freshStart = false;
  }

  function signalLimit() {
    replayClass(valueEl, 'is-shaking');
  }

  function inputDigit(digit) {
    if (state.error) clearAll({ silent: true });
    if (state.awaitingOperand || state.freshStart) {
      startNewEntry(digit);
    } else if (state.input === '0') {
      state.input = digit;
    } else if (countDigits(state.input) >= MAX_DIGITS) {
      signalLimit();
      return;
    } else {
      state.input += digit;
    }
    render();
  }

  function inputDecimal() {
    if (state.error) clearAll({ silent: true });
    if (state.awaitingOperand || state.freshStart) {
      startNewEntry('0.');
    } else if (!state.input.includes('.')) {
      if (countDigits(state.input) >= MAX_DIGITS) {
        signalLimit();
        return;
      }
      state.input += '.';
    }
    render();
  }

  function chooseOperator(operator) {
    if (state.error) return;
    const value = currentValue();

    if (state.operator && !state.awaitingOperand) {
      // Chained calculation: 2 + 3 × works out 2 + 3 first
      const result = attempt(() => compute(state.stored, state.operator, value));
      if (result === null) return;
      state.stored = result;
      showResult(result);
    } else if (!state.operator) {
      state.stored = value;
    }
    // If an operator was already waiting, choosing another one simply replaces it

    state.operator = operator;
    state.awaitingOperand = true;
    state.freshStart = false;
    state.lastOperator = null;
    state.expression = `${format(state.stored)} ${operator}`;
    render();
  }

  function evaluate() {
    if (state.error) return;
    let a;
    let operator;
    let b;

    if (state.operator) {
      a = state.stored;
      operator = state.operator;
      b = state.awaitingOperand ? state.stored : currentValue();
    } else if (state.lastOperator) {
      a = currentValue();
      operator = state.lastOperator;
      b = state.lastOperand;
    } else {
      // Nothing pending: tidy the entry, so "5." becomes "5"
      const value = currentValue();
      showResult(value);
      state.expression = `${format(value)} =`;
      state.freshStart = true;
      render({ settle: true });
      return;
    }

    const result = attempt(() => compute(a, operator, b));
    if (result === null) return;

    showResult(result);
    Object.assign(state, {
      expression: `${format(a)} ${operator} ${format(b)} =`,
      stored: null,
      operator: null,
      awaitingOperand: false,
      freshStart: true,
      lastOperator: operator,
      lastOperand: b,
    });
    render({ settle: true });
  }

  // 50 % -> 0.5   ·   200 + 10 % -> 200 + 20   ·   50 × 10 % -> 50 × 0.1
  function percent() {
    if (state.error) return;
    const entered = state.awaitingOperand ? state.stored : currentValue();
    let result;

    if (state.operator === '+' || state.operator === '−') {
      result = round((state.stored * entered) / 100);
    } else {
      result = round(entered / 100);
      if (!state.operator) {
        state.expression = `${format(entered)}%`;
        state.lastOperator = null;
      }
    }

    showResult(result);
    state.awaitingOperand = false;
    state.freshStart = true;
    render({ settle: true });
  }

  function backspace() {
    if (state.error) {
      clearAll();
      return;
    }
    if (state.awaitingOperand || state.freshStart) return; // only typed digits can be deleted
    const trimmed = state.input.slice(0, -1);
    state.input = trimmed === '' || trimmed === '-' ? '0' : trimmed;
    render();
  }

  function runAction(key) {
    const { action, value } = key.dataset;
    switch (action) {
      case 'digit': inputDigit(value); break;
      case 'decimal': inputDecimal(); break;
      case 'operator': chooseOperator(value); break;
      case 'equals': evaluate(); break;
      case 'percent': percent(); break;
      case 'backspace': backspace(); break;
      case 'clear': clearAll(); break;
      default: break;
    }
  }

  /* ---------- 4. Rendering and fitting long numbers ---------- */
  const measure = document.createElement('span');
  measure.className = 'display__measure';
  measure.setAttribute('aria-hidden', 'true');
  display.append(measure);

  // As a number grows, the digits first get narrower (Mona Sans width axis), then smaller
  const WIDTHS = [112, 100, 87.5, 75];

  function fitValue() {
    const styles = getComputedStyle(display);
    const available = display.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const largest = parseFloat(styles.getPropertyValue(state.error ? '--error-size' : '--value-size')) || 64;

    measure.textContent = valueEl.textContent;
    measure.classList.toggle('is-error', Boolean(state.error));
    measure.style.fontSize = `${largest}px`;

    let stretch = WIDTHS[WIDTHS.length - 1];
    let size = largest;
    let fits = false;

    for (const width of WIDTHS) {
      measure.style.fontStretch = `${width}%`;
      if (measure.getBoundingClientRect().width <= available) {
        stretch = width;
        fits = true;
        break;
      }
    }
    if (!fits) {
      const widest = measure.getBoundingClientRect().width;
      size = Math.max(18, Math.floor((largest * available) / widest));
    }

    valueEl.style.fontStretch = `${stretch}%`;
    valueEl.style.fontSize = `${size}px`;
  }

  function replayClass(element, className) {
    element.classList.remove(className);
    void element.offsetWidth; // restart the CSS animation
    element.classList.add(className);
  }

  function render({ settle = false, shake = false } = {}) {
    valueEl.textContent = state.error ?? formatNumber(state.input);
    valueEl.classList.toggle('is-error', Boolean(state.error));
    expressionEl.textContent = state.expression;

    operatorKeys.forEach((key) => {
      const active = state.awaitingOperand && key.dataset.value === state.operator;
      key.setAttribute('aria-pressed', String(active));
    });

    fitValue();
    if (settle) replayClass(valueEl, 'is-settling');
    if (shake) replayClass(valueEl, 'is-shaking');
  }

  valueEl.addEventListener('animationend', () => valueEl.classList.remove('is-settling', 'is-shaking'));

  /* ---------- 5. Mouse, touch and keyboard input ---------- */
  function playPress(key) {
    replayClass(key, 'is-pressed');
  }

  keys.forEach((key) => {
    key.addEventListener('animationend', (event) => {
      if (event.target === key) key.classList.remove('is-pressed');
    });
  });

  keypad.addEventListener('pointerdown', (event) => {
    const key = event.target.closest('.key');
    if (key && event.button === 0) playPress(key);
  });

  keypad.addEventListener('click', (event) => {
    const key = event.target.closest('.key');
    if (!key) return;
    if (event.detail === 0) playPress(key); // activated with Enter or Space while focused
    runAction(key);
    if (event.detail > 0) key.blur();       // after a mouse click, keep Enter free for "="
  });

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return; // leave browser shortcuts alone
    const onControl = event.target instanceof Element && event.target.closest('button, a, input, select, textarea');
    if ((event.key === 'Enter' || event.key === ' ') && onControl) return; // let the focused control handle it

    const key = keyByShortcut.get(SHORTCUT_ALIASES[event.key] ?? event.key);
    if (!key) return;
    event.preventDefault();
    playPress(key);
    runAction(key);
  });

  /* ---------- 6. Cursor-driven motion ---------- */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const cursorLight = document.querySelector('.cursor-light');

  const MAX_TILT = 7;        // degrees
  const LIFT = 1.018;        // scale while the cursor is over the calculator
  const MAGNET_PULL = 0.3;   // how far a magnetic key's face follows the cursor
  const MAGNET_LIMIT = 7;    // px
  const STIFFNESS = 180;     // spring constants: slightly under-damped, so it wobbles once
  const DAMPING = 15;

  const makeSpring = (value) => ({ value, target: value, velocity: 0 });
  const springs = { rx: makeSpring(0), ry: makeSpring(0), scale: makeSpring(1) };
  const orbs = Array.from(document.querySelectorAll('.orb')).map((el) => ({
    el, depth: Number(el.dataset.depth) || 0, x: 0, y: 0, tx: 0, ty: 0,
  }));
  const light = { x: window.innerWidth / 2, y: window.innerHeight / 2, tx: window.innerWidth / 2, ty: window.innerHeight / 2 };
  const pointer = { x: 0, y: 0, onPage: false };

  let motionEnabled = false;
  let frame = 0;
  let lastTime = 0;

  function stepSpring(spring, dt) {
    const acceleration = STIFFNESS * (spring.target - spring.value) - DAMPING * spring.velocity;
    spring.velocity += acceleration * dt;
    spring.value += spring.velocity * dt;
  }

  const springAtRest = (spring) => Math.abs(spring.target - spring.value) < 0.001 && Math.abs(spring.velocity) < 0.001;

  function updateTargets() {
    const rect = stage.getBoundingClientRect();
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;
    const nx = (pointer.x - (rect.left + halfWidth)) / halfWidth;
    const ny = (pointer.y - (rect.top + halfHeight)) / halfHeight;
    const inside = pointer.onPage && Math.abs(nx) <= 1.08 && Math.abs(ny) <= 1.06;

    springs.ry.target = inside ? clamp(nx, -1, 1) * MAX_TILT : 0;
    springs.rx.target = inside ? clamp(-ny, -1, 1) * MAX_TILT : 0;
    springs.scale.target = inside ? LIFT : 1;
    calculator.classList.toggle('is-lit', inside);

    if (inside) {
      calculator.style.setProperty('--gx', `${((pointer.x - rect.left) / rect.width) * 100}%`);
      calculator.style.setProperty('--gy', `${((pointer.y - rect.top) / rect.height) * 100}%`);
    }

    const px = pointer.onPage ? pointer.x / window.innerWidth - 0.5 : 0;
    const py = pointer.onPage ? pointer.y / window.innerHeight - 0.5 : 0;
    orbs.forEach((orb) => {
      orb.tx = -px * orb.depth;
      orb.ty = -py * orb.depth;
    });

    if (pointer.onPage) {
      light.tx = pointer.x;
      light.ty = pointer.y;
    }
    cursorLight.classList.toggle('is-visible', pointer.onPage);
  }

  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 1 / 20);
    lastTime = now;

    // Fixed small steps keep the springs identical on 60 Hz and 120 Hz screens
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) {
      const step = Math.min(remaining, 1 / 120);
      stepSpring(springs.rx, step);
      stepSpring(springs.ry, step);
      stepSpring(springs.scale, step);
    }

    const ease = 1 - Math.exp(-dt * 6);
    light.x += (light.tx - light.x) * ease;
    light.y += (light.ty - light.y) * ease;
    orbs.forEach((orb) => {
      orb.x += (orb.tx - orb.x) * ease * 0.6;
      orb.y += (orb.ty - orb.y) * ease * 0.6;
      orb.el.style.transform = `translate3d(${orb.x.toFixed(2)}px, ${orb.y.toFixed(2)}px, 0)`;
    });

    calculator.style.transform =
      `perspective(1100px) rotateX(${springs.rx.value.toFixed(3)}deg) ` +
      `rotateY(${springs.ry.value.toFixed(3)}deg) scale(${springs.scale.value.toFixed(4)})`;
    cursorLight.style.transform = `translate3d(${light.x.toFixed(1)}px, ${light.y.toFixed(1)}px, 0)`;

    const settled =
      Object.values(springs).every(springAtRest) &&
      Math.abs(light.tx - light.x) < 0.5 && Math.abs(light.ty - light.y) < 0.5 &&
      orbs.every((orb) => Math.abs(orb.tx - orb.x) < 0.05 && Math.abs(orb.ty - orb.y) < 0.05);

    frame = settled ? 0 : requestAnimationFrame(tick);
  }

  function wake() {
    if (frame || !motionEnabled) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', (event) => {
    if (!motionEnabled || event.pointerType === 'touch') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.onPage = true;
    updateTargets();
    wake();
  }, { passive: true });

  const leavePage = () => {
    pointer.onPage = false;
    if (!motionEnabled) return;
    updateTargets();
    wake();
  };
  document.documentElement.addEventListener('mouseleave', leavePage);
  window.addEventListener('blur', leavePage);
  window.addEventListener('scroll', () => {
    if (!motionEnabled || !pointer.onPage) return;
    updateTargets();
    wake();
  }, { passive: true });

  // Magnetic keys: the face drifts toward the cursor, then springs back on leave
  function releaseKey(key) {
    key.style.setProperty('--mx', '0px');
    key.style.setProperty('--my', '0px');
    key.classList.remove('is-magnetized');
  }

  keypad.addEventListener('pointermove', (event) => {
    if (!motionEnabled || event.pointerType === 'touch') return;
    const key = event.target.closest('.key');
    if (!key) return;

    const rect = key.getBoundingClientRect();
    key.style.setProperty('--kx', `${event.clientX - rect.left}px`);
    key.style.setProperty('--ky', `${event.clientY - rect.top}px`);

    if (!key.hasAttribute('data-magnetic')) return;
    const x = clamp((event.clientX - (rect.left + rect.width / 2)) * MAGNET_PULL, -MAGNET_LIMIT, MAGNET_LIMIT);
    const y = clamp((event.clientY - (rect.top + rect.height / 2)) * MAGNET_PULL, -MAGNET_LIMIT, MAGNET_LIMIT);
    key.style.setProperty('--mx', `${x.toFixed(2)}px`);
    key.style.setProperty('--my', `${y.toFixed(2)}px`);
    key.classList.add('is-magnetized');
  });

  keypad.addEventListener('pointerout', (event) => {
    const key = event.target.closest('.key');
    if (key && !key.contains(event.relatedTarget)) releaseKey(key);
  });

  // Cursor effects only run with a mouse or trackpad, and never when reduced motion is requested
  function setMotionMode() {
    motionEnabled = finePointer.matches && !reducedMotion.matches;
    root.classList.toggle('motion-on', motionEnabled);
    if (motionEnabled) return;

    cancelAnimationFrame(frame);
    frame = 0;
    springs.rx = makeSpring(0);
    springs.ry = makeSpring(0);
    springs.scale = makeSpring(1);
    calculator.style.transform = '';
    calculator.classList.remove('is-lit');
    cursorLight.style.transform = '';
    orbs.forEach((orb) => {
      Object.assign(orb, { x: 0, y: 0, tx: 0, ty: 0 });
      orb.el.style.transform = '';
    });
    keys.forEach(releaseKey);
  }

  [finePointer, reducedMotion].forEach((query) => {
    if (query.addEventListener) query.addEventListener('change', setMotionMode);
    else query.addListener(setMotionMode); // older Safari
  });

  /* ---------- Start ---------- */
  setMotionMode();
  render();
  if (document.fonts) document.fonts.ready.then(fitValue);

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fitValue);
  });
})();

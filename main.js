(() => {
  const deck = document.querySelector('#deck');
  const slides = [...document.querySelectorAll('.slide')];
  const cue = document.querySelector('#navigationCue');
  const cueArrow = document.querySelector('#cueArrow');
  const cueLabel = document.querySelector('#cueLabel');
  const cueSeparator = document.querySelector('#cueSeparator');
  const cueCount = document.querySelector('#cueCount');
  const previousSlide = document.querySelector('#previousSlide');
  const nextSlide = document.querySelector('#nextSlide');
  const closingActions = document.querySelector('#closingActions');
  const returnHome = document.querySelector('#returnHome');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let current = 0;
  let target = 0;
  let navigating = false;
  let hasNavigated = false;
  let wheelGesture = false;
  let wheelTriggered = false;
  let wheelDistance = 0;
  let wheelDirection = 0;
  let wheelTriggeredAt = -Infinity;
  let lastWheelAt = -Infinity;
  let lastWheelMagnitude = 0;
  let wheelIdleTimer;
  let cueHideTimer;
  let cueCycleTimer;
  let settleFrame;
  let pointer = null;

  const pad = value => String(value).padStart(2, '0');
  const clamp = index => Math.max(0, Math.min(slides.length - 1, index));
  const behavior = () => reducedMotion.matches ? 'auto' : 'smooth';

  const updateEdgeControls = index => {
    previousSlide.hidden = index === 0;
    nextSlide.hidden = index === slides.length - 1;
    closingActions.hidden = index !== slides.length - 1;
  };

  const scheduleEdgeCue = index => {
    clearTimeout(cueHideTimer);
    clearTimeout(cueCycleTimer);
    cue.classList.add('is-hinting');

    cueHideTimer = setTimeout(() => {
      cue.classList.remove('is-hinting');
      cueCycleTimer = setTimeout(() => {
        if (current === index && !navigating) scheduleEdgeCue(index);
      }, 7000);
    }, 4600);
  };

  const updateCue = index => {
    const isHome = index === 0;
    const isEnd = index === slides.length - 1;
    const isInitial = isHome && !hasNavigated;
    const isCountOnly = !isHome && !isEnd;

    cue.classList.toggle('is-initial', isInitial);
    cue.classList.toggle('is-home', isHome);
    cue.classList.toggle('is-end', isEnd);
    cue.classList.toggle('is-count-only', isCountOnly);
    cue.classList.toggle('is-edge', isHome || isEnd);
    cueArrow.hidden = isCountOnly;
    cueArrow.textContent = isEnd ? '→' : '←';
    cueLabel.textContent = isEnd
      ? 'End · Swipe right'
      : isInitial
        ? 'Swipe left'
        : isHome
          ? 'Home · Swipe left'
          : '';
    cueSeparator.hidden = isCountOnly;
    cueCount.textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
    updateEdgeControls(index);

    if (isHome || isEnd) scheduleEdgeCue(index);
    else {
      clearTimeout(cueHideTimer);
      clearTimeout(cueCycleTimer);
      cue.classList.remove('is-hinting');
    }
  };

  const resetWheelGesture = () => {
    wheelGesture = false;
    wheelTriggered = false;
    wheelDistance = 0;
    wheelDirection = 0;
    lastWheelMagnitude = 0;
  };

  const noteWheelActivity = delta => {
    const now = performance.now();
    const direction = Math.sign(delta);
    const magnitude = Math.abs(delta);

    if (now - lastWheelAt > 100) resetWheelGesture();
    lastWheelAt = now;

    clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(resetWheelGesture, 100);

    if (!wheelGesture) {
      wheelGesture = true;
      wheelDistance = 0;
    }

    if (!wheelTriggered) {
      wheelDistance += delta;
      lastWheelMagnitude = magnitude;
      if (Math.abs(wheelDistance) < 24) return 0;

      wheelTriggered = true;
      wheelDirection = Math.sign(wheelDistance);
      wheelTriggeredAt = now;
      return wheelDirection;
    }
    lastWheelMagnitude = magnitude;
    return 0;
  };

  const finishNavigation = index => {
    current = index;
    target = index;
    navigating = false;
    history.replaceState(null, '', `#${slides[index].id}`);
    updateCue(index);
  };

  const waitUntilSettled = index => {
    cancelAnimationFrame(settleFrame);
    const destination = index * deck.clientWidth;
    let previous = deck.scrollLeft;
    let stableFrames = 0;

    const check = () => {
      const position = deck.scrollLeft;
      const atDestination = Math.abs(position - destination) < 1;
      const stoppedMoving = Math.abs(position - previous) < 0.25;
      stableFrames = atDestination && stoppedMoving ? stableFrames + 1 : 0;
      previous = position;

      if (stableFrames >= 4) finishNavigation(index);
      else settleFrame = requestAnimationFrame(check);
    };

    settleFrame = requestAnimationFrame(check);
  };

  const goTo = (index, options = {}) => {
    const { smooth = true, markInteraction = true } = options;
    const next = clamp(index);
    if (markInteraction && next !== current) hasNavigated = true;

    target = next;
    updateCue(next);

    if (next === current && !navigating) {
      history.replaceState(null, '', `#${slides[next].id}`);
      return;
    }

    navigating = true;
    deck.scrollTo({
      left: next * deck.clientWidth,
      behavior: smooth ? behavior() : 'auto'
    });
    waitUntilSettled(next);
  };

  const syncFromHash = () => {
    const requested = slides.findIndex(slide => `#${slide.id}` === location.hash);
    if (requested < 0 || requested === current) return;
    cancelAnimationFrame(settleFrame);
    navigating = false;
    current = requested;
    target = requested;
    updateCue(requested);
    const priorBehavior = deck.style.scrollBehavior;
    deck.style.scrollBehavior = 'auto';
    deck.scrollLeft = requested * deck.clientWidth;
    requestAnimationFrame(() => { deck.style.scrollBehavior = priorBehavior; });
  };

  const requestStep = direction => {
    const step = Math.sign(direction);
    if (!step) return;
    goTo((navigating ? target : current) + step);
  };

  const activateEdgeControl = (button, direction) => {
    button.classList.remove('is-pressed');
    requestAnimationFrame(() => button.classList.add('is-pressed'));
    setTimeout(() => button.classList.remove('is-pressed'), 180);
    requestStep(direction);
  };

  previousSlide.addEventListener('click', () => activateEdgeControl(previousSlide, -1));
  nextSlide.addEventListener('click', () => activateEdgeControl(nextSlide, 1));
  returnHome.addEventListener('click', () => goTo(0));
  window.addEventListener('hashchange', syncFromHash);
  window.addEventListener('popstate', syncFromHash);

  deck.addEventListener('wheel', event => {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const direction = noteWheelActivity(delta);
    if (!direction) return;
    requestStep(direction);
  }, { passive: false });

  deck.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    deck.setPointerCapture(event.pointerId);
  });

  deck.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer = null;

    if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      requestStep(deltaX < 0 ? 1 : -1);
    } else if (!navigating) {
      goTo(current, { markInteraction: false });
    }
  });

  deck.addEventListener('pointercancel', () => { pointer = null; });

  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const next = ['ArrowRight', 'ArrowDown', 'PageDown'];
    const previous = ['ArrowLeft', 'ArrowUp', 'PageUp'];

    if (next.includes(event.key) || (event.key === ' ' && !event.shiftKey)) {
      event.preventDefault();
      requestStep(1);
    } else if (previous.includes(event.key) || (event.key === ' ' && event.shiftKey)) {
      event.preventDefault();
      requestStep(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      goTo(slides.length - 1);
    }
  });

  window.addEventListener('resize', () => {
    cancelAnimationFrame(settleFrame);
    navigating = false;
    target = current;
    deck.scrollTo({ left: current * deck.clientWidth, behavior: 'auto' });
  });

  const requested = slides.findIndex(slide => `#${slide.id}` === location.hash);
  current = requested >= 0 ? requested : 0;
  target = current;
  updateCue(current);
  requestAnimationFrame(() => {
    const priorBehavior = deck.style.scrollBehavior;
    deck.style.scrollBehavior = 'auto';
    deck.scrollLeft = current * deck.clientWidth;
    requestAnimationFrame(() => { deck.style.scrollBehavior = priorBehavior; });
    history.replaceState(null, '', `#${slides[current].id}`);
  });
})();

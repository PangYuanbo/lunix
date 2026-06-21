const directions = {
  compact: {
    index: '01 / 05', title: 'Compact Center', copy: 'The original Liquid Glass direction with a tighter, more balanced macOS title bar.',
    thesis: 'Preserve the familiar centered Mac window title while removing unused vertical space.', best: 'The safest refinement of the direction you already selected.', tradeoff: 'Still visibly uses a traditional title bar.'
  },
  leading: {
    index: '02 / 05', title: 'Leading Toolbar', copy: 'A slimmer productivity-style bar with identity and actions aligned to the window edges.',
    thesis: 'Treat the title bar as a compact working toolbar, closer to Finder and Xcode.', best: 'Agent and workspace windows with frequent actions.', tradeoff: 'Less symmetrical than the classic centered Mac layout.'
  },
  floating: {
    index: '03 / 05', title: 'Floating Glass', copy: 'A narrow glass capsule floats above the content instead of occupying a full chrome row.',
    thesis: 'Window controls become a light overlay so the content surface feels larger.', best: 'A premium, distinctive consumer-facing Lunix identity.', tradeoff: 'Needs careful contrast over changing content.'
  },
  minimal: {
    index: '04 / 05', title: 'Content First', copy: 'An ultra-thin, nearly borderless strip keeps only the controls and essential window identity.',
    thesis: 'The app content—not its frame—defines the window.', best: 'Maximum usable canvas and the calmest desktop composition.', tradeoff: 'Window hierarchy is subtler when many surfaces overlap.'
  },
  fused: {
    index: '05 / 05', title: 'Fused Chrome', copy: 'The app title and local browser controls share one compact continuous glass header.',
    thesis: 'Merge adjacent chrome layers instead of stacking title bars and toolbars.', best: 'Browser, preview, terminal, and tool-heavy applications.', tradeoff: 'Each app type needs a thoughtfully composed fused toolbar.'
  }
};

const buttons = [...document.querySelectorAll('.direction')];
function select(value) {
  const data = directions[value];
  if (!data) return;
  document.body.dataset.direction = value;
  buttons.forEach((button) => {
    const active = button.dataset.value === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelector('.review-index').textContent = data.index;
  document.querySelector('.review-title').textContent = data.title;
  document.querySelector('.review-copy').textContent = data.copy;
  document.querySelector('.summary-thesis').textContent = data.thesis;
  document.querySelector('.summary-best').textContent = data.best;
  document.querySelector('.summary-tradeoff').textContent = data.tradeoff;
}
buttons.forEach((button) => button.addEventListener('click', () => {
  select(button.dataset.value);
  history.replaceState(null, '', `#${button.dataset.value}`);
}));
window.addEventListener('keydown', (event) => {
  const values = ['compact', 'leading', 'floating', 'minimal', 'fused'];
  const value = values[Number(event.key) - 1];
  if (value) {
    select(value);
    history.replaceState(null, '', `#${value}`);
  }
});

select(location.hash.slice(1) || 'compact');

export default async function decorate(block) {
  const items = [...block.children];
  block.innerHTML = '';

  const strip = document.createElement('div');
  strip.className = 'filmstrip-track';

  items.forEach((row) => {
    const cells = [...row.children];
    const slide = document.createElement('div');
    slide.className = 'filmstrip-slide';

    const img = cells[0] ? cells[0].querySelector('img, picture') : null;
    if (img) {
      const figure = document.createElement('figure');
      figure.className = 'filmstrip-figure';
      figure.append(img.closest('picture') || img);
      slide.append(figure);
    }

    if (cells[1]) {
      const caption = document.createElement('figcaption');
      caption.className = 'filmstrip-caption';
      caption.innerHTML = cells[1].innerHTML;
      slide.append(caption);
    }

    strip.append(slide);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'filmstrip-viewport';
  wrapper.append(strip);

  const prevBtn = document.createElement('button');
  prevBtn.className = 'filmstrip-btn filmstrip-btn--prev';
  prevBtn.setAttribute('aria-label', 'Previous slide');
  prevBtn.innerHTML = '&#8249;';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'filmstrip-btn filmstrip-btn--next';
  nextBtn.setAttribute('aria-label', 'Next slide');
  nextBtn.innerHTML = '&#8250;';

  let current = 0;
  const slides = () => [...strip.querySelectorAll('.filmstrip-slide')];

  function goTo(index) {
    const all = slides();
    if (!all.length) return;
    current = (index + all.length) % all.length;
    strip.style.transform = `translateX(-${current * 100}%)`;
    all.forEach((s, i) => s.setAttribute('aria-hidden', i !== current));
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  block.append(prevBtn, wrapper, nextBtn);
  goTo(0);
}

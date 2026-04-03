export default async function decorate(block) {
  const items = [...block.children];
  block.innerHTML = '';

  const board = document.createElement('ul');
  board.className = 'corkboard-board';
  board.setAttribute('role', 'list');

  items.forEach((row, idx) => {
    const cells = [...row.children];
    const card = document.createElement('li');
    card.className = 'corkboard-card';
    card.setAttribute('role', 'listitem');

    const img = cells[0] ? cells[0].querySelector('img, picture') : null;
    if (img) {
      const figure = document.createElement('figure');
      figure.className = 'corkboard-figure';
      const picture = img.closest('picture') || img;
      if (!picture.querySelector('img[alt]') && picture.tagName === 'IMG') {
        picture.setAttribute('alt', `Card image ${idx + 1}`);
      }
      figure.append(picture);
      card.append(figure);
    }

    if (cells[1]) {
      const body = document.createElement('div');
      body.className = 'corkboard-body';
      body.innerHTML = cells[1].innerHTML;
      card.append(body);
    }

    if (cells[2]) {
      const footer = document.createElement('footer');
      footer.className = 'corkboard-footer';
      footer.innerHTML = cells[2].innerHTML;
      card.append(footer);
    }

    board.append(card);
  });

  block.append(board);
}

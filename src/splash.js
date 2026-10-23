const PALETTE = ['#e55388', '#e57d88', '#e59f88', '#e5d988', '#e3d5cc', '#bad5cc', '#6dd5cc', '#5ac5cc'];
const CELLS = 40, STEP_CHANCE = 0.18, MAX_HOP = 2;

const grid = document.getElementById('grid');
const swatch = Array.from({ length: CELLS }, () => Math.floor(Math.random() * PALETTE.length));
const cells = swatch.map(index => {
  const cell = document.createElement('div');
  cell.style.backgroundColor = PALETTE[index];
  grid.append(cell);
  return cell;
});
setInterval(() => {
  cells.forEach((cell, i) => {
    if (Math.random() >= STEP_CHANCE) return;
    swatch[i] = (swatch[i] + 1 + Math.floor(Math.random() * MAX_HOP)) % PALETTE.length;
    cell.style.backgroundColor = PALETTE[swatch[i]];
  });
}, 500);

document.getElementById('version').textContent = 'v' + new URLSearchParams(location.search).get('version');

const finish = () => {
  document.body.classList.add('out');
  setTimeout(() => window.close(), 300);
};
const at = (ms, fn) => setTimeout(fn, ms);
requestAnimationFrame(() => document.body.classList.add('studio-in'));
at(1700, () => document.body.classList.replace('studio-in', 'title-in'));
at(3900, finish);
addEventListener('mousedown', finish);
addEventListener('keydown', finish);

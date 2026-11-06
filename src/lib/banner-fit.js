/**
 * How the Trophy Room banners fit under the beam without the rafters ever growing: every banner stays in one row at full size while they fit,
 * shrinks (all together, the gaps with them) so more of them still fit in that one row, and only once they would be smaller than `min` does
 * the row break onto a second (third, ...) line, still at the small size, with the lines as even as possible and the longer ones first
 * (7 banners three to a line: 3, 2 and 2, never 3, 3 and 1).
 * @param {{ count: number, width: number, max: number, min: number, gapRatio: number }} room
 *   count banners, width of the space under the beam, max (full) and min banner widths, and the gap as a share of a banner's width (all in px)
 * @returns {{ size: number, gap: number, lines: number[] }} the banner width and gap (px), and how many banners hang on each line
 */
export function fitBanners({ count, width, max, min, gapRatio }) {
  if (count <= 0) return { size: max, gap: max * gapRatio, lines: [] };
  if (width <= 0) return { size: max, gap: max * gapRatio, lines: [count] };
  const filling = (n) => width / (n + (n - 1) * gapRatio);   // the width at which n banners and their gaps exactly fill the row
  const oneRow = Math.min(max, filling(count));
  if (oneRow >= min) return { size: oneRow, gap: oneRow * gapRatio, lines: [count] };
  const most = Math.max(1, Math.floor((width + min * gapRatio) / (min * (1 + gapRatio))));   // how many fit in a row at the small size
  const rows = Math.ceil(count / most), short = Math.floor(count / rows), long = count % rows;
  const size = Math.min(max, filling(most), width);
  return { size, gap: size * gapRatio, lines: Array.from({ length: rows }, (_, row) => short + (row < long ? 1 : 0)) };
}

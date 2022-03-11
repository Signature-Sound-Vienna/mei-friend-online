const svgNS = "http://www.w3.org/2000/svg";

export function addDragSelector(v, vp) {

  let dragging = false;
  let svgPm;
  var svgEls;
  var obobj = {}; // object storing x, y coordinates of svg elements
  let oldEls = [];
  let newEls = [];
  var start = {};
  var end = {};
  var rect;

  vp.addEventListener('mousedown', ev => {
    dragging = true;
    // clear selected elements, if no CMD/CTRL key is pressed
    if (!((navigator.appVersion.indexOf("Mac") !== -1) && ev.metaKey) && !ev.ctrlKey) {
      v.selectedElements = [];
      v.updateHighlight();
    }
    oldEls = [];
    obobj = {};
    v.selectedElements.forEach(el => oldEls.push(el)); // remember selected els
    // create selection rectangle
    rect = document.createElementNS(svgNS, 'rect');
    svgPm = document.querySelector('g.page-margin');
    svgPm.appendChild(rect);

    // remember click/mousedown point
    start.x = ev.clientX;
    start.y = ev.clientY;

    svgEls = document.querySelectorAll(
      'g .note, .rest, .mRest, .beatRpt, .halfmRpt, .mRpt');
    svgEls.forEach(el => {
      let bb = el.getBBox();
      if (Array.from(el.classList).includes('note'))
        bb = el.querySelector('.notehead').getBBox();
      let x = Math.round((bb.x + bb.width / 2) * 1000); // center of element
      let y = Math.round((bb.y + bb.height / 2) * 1000);
      if (!Object.keys(obobj).includes(x.toString())) obobj[x] = {};
      if (Object.keys(obobj).includes(x.toString()) &&
        Object.keys(obobj[x]).includes(y.toString())) {
        obobj[x][y].push(el);
      } else {
        obobj[x][y] = [el];
      }
    });
  });

  vp.addEventListener('mousemove', ev => {
    if (dragging) {
      newEls = [];
      end.x = ev.clientX;
      end.y = ev.clientY;
      var mx = document.querySelector('g.page-margin').getScreenCTM().inverse();
      // transform mouse/screen coordinates to SVG coordinates
      let s = transformCTM(start, mx);
      let e = transformCTM(end, mx);
      let x = s.x;
      let width = Math.abs(e.x - s.x);
      let y = s.y;
      let height = Math.abs(e.y - s.y);
      if (e.x < s.x) x = e.x;
      if (e.y < s.y) y = e.y;

      updateRect(rect, x, y, width, height, 'var(--notationColor)');

      // without Firefox support:
      // svgEls.forEach(el => {
      //   if (svgPm.checkIntersection(el, rect))
      //     newEls.push(el.id);
      // });

      let xx = Math.round(x * 1000);
      let xx2 = Math.round((x + width) * 1000);
      let yy = Math.round(y * 1000);
      let yy2 = Math.round((y + height) * 1000);
      let selX = Object.keys(obobj)
        .filter(kx => (parseInt(kx) >= xx && parseInt(kx) <= xx2));
      if (selX.length > 0) {
        selX.forEach(xKey => {
          let yKeys = Object.keys(obobj[xKey])
            .filter(ky => (parseInt(ky) >= yy && parseInt(ky) <= yy2));
          if (yKeys) yKeys.forEach(yKey => {
            let els = obobj[xKey][yKey];
            if (els) els.forEach(e => {
              if (!newEls.includes(e.id))
                newEls.push(e.id);
            });
          });
        });
      }
      v.selectedElements = [];
      oldEls.forEach(el => v.selectedElements.push(el));
      newEls.forEach(el => v.selectedElements.push(el));
      v.updateHighlight();
    }
  });

  vp.addEventListener('mouseup', () => {
    dragging = false;
    document.querySelector('g.page-margin').removeChild(rect);
    oldEls = [];
  });

}

function transformCTM(point, matrix) {
  let r = {};
  r.x = matrix.a * point.x + matrix.c * point.y + matrix.e;
  r.y = matrix.b * point.x + matrix.d * point.y + matrix.f;
  return r;
}

function updateRect(rect, x, y, width, height, color = "black",
  strokeWidth = 4, strokeDashArray = '50') {
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', width);
  rect.setAttribute('height', height);
  rect.setAttribute('stroke-width', strokeWidth);
  rect.setAttribute('stroke-dasharray', strokeDashArray);
  rect.setAttribute('stroke', color);
  rect.setAttribute('fill', 'none');
}
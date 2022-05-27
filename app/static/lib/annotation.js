import {
  v,
  cm
} from './main.js';
import {
  convertCoords,
  generateUUID,
  rmHash,
  setCursorToId
} from './utils.js';
import {
  meiNameSpace,
  xmlNameSpace,
  xmlToString
} from './dom-utils.js';
import {
  highlight,
  pencil,
  circle,
  link,
  flipToEncoding,
  symLinkFile,
  diffRemoved
} from '../css/icons.js';

let annotations = [];

export function refreshAnnotationsList() {
  situateAnnotations();
  const list = document.getElementById("listAnnotations");
  list.innerHTML = annotations.length ? "" : "No annotations present.";
  annotations.forEach((a, aix) => {
    const annoDiv = document.createElement("div");
    annoDiv.classList.add("annotationListItem");
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const annoListItemButtons = document.createElement("div");
    annoListItemButtons.classList.add("annotationListItemButtons");
    const flipToAnno = document.createElement("a");
    flipToAnno.innerHTML = symLinkFile; //flipToEncoding;
    flipToAnno.title = "Flip page to this annotation";
    flipToAnno.classList.add('icon');
    if (!'selection' in a) flipToAnno.classList.add('disabled');
    const deleteAnno = document.createElement("a");
    deleteAnno.innerHTML = diffRemoved;
    deleteAnno.title = "Delete this annotation";
    switch (a.type) {
      case 'annotateHighlight':
        summary.innerHTML = highlight;
        break;
      case 'annotateCircle':
        summary.innerHTML = circle;
        break;
      case 'annotateLink':
        summary.innerHTML = link;
        details.innerHTML = a.url;
        break;
      case 'annotateDescribe':
        summary.innerHTML = pencil;
        details.innerHTML = a.description;
        break;
      default:
        console.warn("Unknown type when drawing annotation in list: ", a);
    }
    let annotationLocationLabel = '';
    if (a.firstPage === 'meiHead') {
      annotationLocationLabel = `MEI head (${a.selection.length} elements)`;
    } else if (a.firstPage === 'unsituated') {
      annotationLocationLabel = 'Unsituated';
    } else {
      annotationLocationLabel = 'p. ' + (a.firstPage === a.lastPage ?
        a.firstPage : a.firstPage + "&ndash;" + a.lastPage) +
        `(${a.selection.length} elements)`;
    }
    summary.innerHTML += annotationLocationLabel;
    flipToAnno.addEventListener("click", (e) => {
      console.debug("Flipping to annotation: ", a);
      v.updatePage(cm, a.firstPage);
    });
    deleteAnno.addEventListener("click", (e) => {
      const reallyDelete = confirm("Are you sure you wish to delete this annotation?");
      if (reallyDelete) {
        deleteAnnotation(a.id);
      }
    });
    if (!details.innerHTML.length) {
      // some annotation types don't have any annotation body to display
      summary.classList.add("noDetails");
    }
    details.prepend(summary);
    annoDiv.appendChild(details);
    annoListItemButtons.appendChild(flipToAnno);
    annoListItemButtons.appendChild(deleteAnno);
    annoDiv.appendChild(annoListItemButtons);
    list.appendChild(annoDiv);
  });
}

// call whenever layout reflows to re-situate annotations appropriately
export function situateAnnotations() {
  annotations.forEach(a => {
    // for each element in a.selection, ask Verovio for the page number
    // set a.firstPage and a.lastPage to min/max page numbers returned
    a.firstPage = 'unsituated';
    a.lastPage = -1;
    if ('selection' in a) {
      a.firstPage = v.getPageWithElement(a.selection[0]);
      a.lastPage = v.getPageWithElement(a.selection[a.selection.length - 1]);
      if (a.firstPage < 0) {
        if (v.xmlDoc.querySelector('[*|id=' + a.selection[0] + ']').closest('meiHead')) a.firstPage = 'meiHead';
        else console.warn('Cannot locate annotation ', a);
      }
    }
  })
}

export function deleteAnnotation(uuid) {
  const ix = annotations.findIndex(a => a.id === uuid);
  if (ix >= 0) {
    annotations.splice(ix, 1);
    refreshAnnotationsList();
  }
}

// functions to draw annotations
function drawHighlight(a) {
  if ("selection" in a) {
    const els = a.selection.map(s => document.getElementById(s));
    els.filter(e => e !== null) // (null if not on current page)
      .forEach(e => e.classList.add("annotationHighlight"));
  } else {
    console.warn("failing to draw highlight annotation without selection: ", a);
  }
}

function drawCircle(a) {
  if ("selection" in a) {
    // mission: draw an ellipse into the raSvg that encompasses a collection of selection objects
    let raSvg = document.querySelector('#renderedAnnotationsSvg');
    // find bounding boxes of all selected elements on page:
    const bboxes = a.selection.map(s => convertCoords(document.getElementById(s)));
    // determine enveloping bbox
    const minX = Math.min(...bboxes.map((b) => b.x));
    const minY = Math.min(...bboxes.map((b) => b.y));
    const maxX2 = Math.max(...bboxes.map((b) => b.x2));
    const maxY2 = Math.max(...bboxes.map((b) => b.y2));
    // now create our ellipse
    const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse")
    ellipse.setAttribute("cx", (minX + maxX2) / 2)
    ellipse.setAttribute("cy", (minY + maxY2) / 2)
    // Add padding so we don't circle too tightly -- but not too much!
    const paddedRx = Math.min((maxX2 - minX) / 1.6, maxX2 - minX + 20)
    const paddedRy = Math.min((maxY2 - minY) / 1.3, maxY2 - minY + 20)
    ellipse.setAttribute("rx", paddedRx)
    ellipse.setAttribute("ry", paddedRy)
    ellipse.classList.add("highlightEllipse");
    raSvg.appendChild(ellipse);
  } else {
    console.warn("Failing to draw circle annotation without selection: ", a);
  }

}

function drawDescribe(a) {
  if ("selection" in a && "description" in a) {
    const els = a.selection.map(s => document.getElementById(s));
    els.filter(e => e !== null) // (null if not on current page)
      .forEach(e => {
        e.classList.add("annotationDescribe");
        // create a title element within the described element to house the description (which will be available on hover)
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.innerHTML = a.description;
        // slot it in as the first child of the selected element
        e.insertBefore(title, e.firstChild);
      });
  } else {
    console.warn("Failing to draw describe annotation missing selection and/or description: ", a);
  }
}

function drawLink(a) {
  if ("selection" in a && "url" in a) {
    const els = a.selection.map(s => document.getElementById(s));
    els.filter(e => e !== null) // (null if not on current page)
      .forEach(e => {
        e.classList.add("annotationLink");
        // create a title element within the linked element to house the url (which will be available on hover)
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.innerHTML = "Open in new tab: " + a.url;
        // slot it in as the first child of the selected element
        e.insertBefore(title, e.firstChild);
        // make the element clickable
        e.addEventListener("click", () => window.open(a.url, "_blank"), true);
      });
  } else {
    console.warn("Failing to draw link annotation missing selection and/or url: ", a);
  }
}

// Draws annotations in Verovio notation panel
export function refreshAnnotations() {
  // clear rendered annotations container
  const rac = document.getElementById("renderedAnnotationsContainer");
  rac.innerHTML = "";
  // reset annotations-containing svg
  const scoreSvg = document.querySelector(".verovio-panel svg");
  if (!scoreSvg) return;
  const annoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  annoSvg.setAttribute("width", scoreSvg.getAttribute("width"))
  annoSvg.setAttribute("height", scoreSvg.getAttribute("height"))
  annoSvg.setAttribute("id", "renderedAnnotationsSvg");
  annoSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  annoSvg.setAttribute("xmlnsXlink", "http://www.w3.org/1999/xlink");
  console.log("rac: ", rac);
  rac.appendChild(annoSvg);
  // drawing handlers can draw into renderedAnnotationsSvg if they need to
  annotations.forEach(a => {
    if ("type" in a) {
      switch (a.type) {
        case 'annotateHighlight':
          drawHighlight(a);
          break;
        case 'annotateCircle':
          drawCircle(a);
          break;
        case 'annotateLink':
          drawLink(a);
          break;
        case 'annotateDescribe':
          drawDescribe(a);
          break;
        default:
          console.warn("Don't have a drawing function for this type of annotation", a);
      }
    } else {
      console.warn("Skipping annotation without type: ", a);
    }
  });
  refreshAnnotationsList();
}

export function addAnnotationHandlers() {
  // TODO extend this to allow app to consume (TROMPA-style) Annotation Toolkit descriptions

  const annotationHandler = (e) => {
    console.log("Clicked to make new annotation!", e);
    console.log("Selected elements: ", v.selectedElements);
    switch (e.target.getAttribute("id")) {
      case 'annotateHighlight':
        createHighlight(e);
        break;
      case 'annotateCircle':
        createCircle(e);
        break;
      case 'annotateLink':
        createLink(e);
        break;
      case 'annotateDescribe':
        createDescribe(e);
        break;
      default:
        console.warn("Don't have a handler for this type of annotation", e);
    }
    refreshAnnotations();
  }

  // functions to create annotations
  const createHighlight = (e) =>
    annotations.push({
      "id": generateUUID(),
      "type": "annotateHighlight",
      "selection": v.selectedElements
    });
  const createCircle = (e) =>
    annotations.push({
      "id": generateUUID(),
      "type": "annotateCircle",
      "selection": v.selectedElements
    });
  const createDescribe = (e => {
    // TODO improve UX!
    const desc = window.prompt("Please enter a textual description to apply");
    const a = {
      "id": generateUUID(),
      "type": "annotateDescribe",
      "selection": v.selectedElements,
      "description": desc
    };
    annotations.push(a);
    if (document.getElementById('writeAnnotInline').checked) {
      let el = document.querySelector('[*|id="' + v.selectedElements[0] + '"]');
      if (el) writeAnnot(el, a.id, a.selection, a.description)
      else console.warn('createDescribe(): Cannot find beforeThis element for ' + a.id);
    }
  })
  const createLink = (e => {
    // TODO improve UX!
    const url = window.prompt("Please enter a url to link to");
    annotations.push({
      "id": generateUUID(),
      "type": "annotateLink",
      "selection": v.selectedElements,
      "url": url
    });
  })

  document.querySelectorAll(".annotationToolsIcon").forEach(a => a.removeEventListener("click", annotationHandler));
  document.querySelectorAll(".annotationToolsIcon").forEach(a => a.addEventListener("click", annotationHandler));
}

// reads <annot> elements from XML DOM and adds them into annotations array
export function readAnnots() {
  if (!v.xmlDoc) return;
  let annots = Array.from(v.xmlDoc.querySelectorAll('annot'));
  annots = annots.filter(annot => annotations.findIndex(a => a.id !== 'annot-' + annot.getAttribute('xml:id')));
  annots.forEach(annot => {
    let annotation = {
      "type": annot.textContent ? "annotateDescribe" : "annotateHighlight",
    };
    if (annot.textContent.length) annotation.description = annot.textContent;
    if (annot.hasAttribute('xml:id')) annotation.id = annot.getAttribute('xml:id').replace('annot-', '');
    if (annot.hasAttribute('plist')) {
      annotation.selection = annot.getAttribute('plist').split(' ').map(id => rmHash(id));
    } else if (annot.parentNode.hasAttribute('xml:id')) {
      annotation.selection = [annot.parentNode.getAttribute('xml:id')];
    } else {
      console.warn('readAnnots(): found annot without id ', annot);
    }
    annotations.push(annotation);
  });
  refreshAnnotations();
}

// inserts new annot element before beforeThis element,
// with @xml:id, @plist and optional payload (string or ptr)
export function writeAnnot(beforeThis, xmlId, plist, payload) {
  let parent = beforeThis.parentNode;
  if (parent) {
    let annot = document.createElementNS(meiNameSpace, 'annot');
    annot.setAttributeNS(xmlNameSpace, 'id', 'annot-' + xmlId);
    annot.setAttribute('plist', plist.map(p => '#' + p).join(' '));
    if (payload) annot.textContent = payload;
    parent.insertBefore(annot, beforeThis);

    setCursorToId(cm, beforeThis.getAttribute('id'))
    cm.replaceRange(xmlToString(annot) + '\n', cm.getCursor());
    cm.execCommand('indentAuto');
  }
}

export function clearAnnotations() {
  annotations = [];
}
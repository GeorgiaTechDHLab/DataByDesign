import HighlightContextMenu from "../components/HighlightContextMenu";
import Vue from 'vue';
import {mapState, mapActions, mapGetters} from 'vuex'
import { notebookTypes } from "dxd-common"

const highlightClass = "nb-user-highlight";
const overflowNextClass = "nb-overflow-next";
const overflowPrevClass = "nb-overflow-prev";
const dragImageId = "drag-image-ghost";

const blockContainer = node => {
  if (!node) return;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const style = getComputedStyle(node, null);
    if (style.display === "block") {
      return node;
    }
  }
  return blockContainer(node.parentElement);
}

function Highlightable(rootElementSelector, highlightableElements = ['P']) {
  return {
    data: function () {
      return {
        clicked: false,
        contextMenu: null
      }
    },
    mounted: function () {
      let el = rootElementSelector ? document.querySelector(rootElementSelector) : this.$el;
      if (!el) {
        console.error("Highlightable mixin doesn't see any HTML element. Be sure to pass in an HTML Element to the Highlightable(element) constructor.");
      } else {
        el.onmouseup = this.onMouseUp;
      }
    },
    computed: {
      ...mapState("chapters", ["highlightSpanCount"]),
      ...mapGetters(["isLoggedIn"])
    },
    watch: {
      isLoggedIn(isLoggedIn) {
        if (isLoggedIn) {
          const notebook = this.$store.getters.notebook;
          notebook.filter(obj => obj.type === notebookTypes.TEXT_HIGHLIGHT)
            .map(obj => this.deserializeRange(obj.metadata.rangeData))
            .forEach(this.createHighlightFromRange);
        } else {
          this.removeAllHighlights();
        }
      }
    },
    methods: {
      ...mapActions("chapters", ["incrementHighlightSpans"]),
      onMouseUp(event) {
        if (event.button !== 0) {
          return;
        }
        const selection = window.getSelection();
        if (selection.rangeCount === 0) {
          return;
        }
        const range = selection.getRangeAt(0);
        if (range.startContainer === range.endContainer && range.startOffset === range.endOffset) {
          return;
        }
        this.createHighlightFromRange(range);
        selection.removeAllRanges();
      },
      onClick(event) {
        if (!this.clicked) {
          const componentClass = Vue.extend(HighlightContextMenu);
          const instance = new componentClass();
          instance.$mount();
          instance.$on('removeClicked', () => this.removeHighlightSpan(this.clicked));
          document.body.appendChild(instance.$el);
          this.contextMenu = instance;
        }
        this.clicked = event.target;
        let totalHeight = event.target.offsetTop + event.target.offsetHeight;
        let curr = event.target;
        while (curr.offsetParent) {
          curr = curr.offsetParent;
          totalHeight += curr.offsetTop;
        }
        const element = this.contextMenu.$el;
        element.style.display = 'block';
        element.style.left = event.clientX + "px";
        element.style.top = totalHeight + "px";
      },
      analyzeRange(range) {
        const isHighlightable = (el) => {
          const container = blockContainer(el);
          if (!container) return false;
          const allowed = highlightableElements.map(el => el.toUpperCase());
          return allowed.includes(container.tagName.toUpperCase())
        }

        const startBlock = blockContainer(range.startContainer);
        const endBlock = blockContainer(range.endContainer);

        if (startBlock == endBlock) {
          return isHighlightable(startBlock) ? [range] : []
        }

        if (startBlock.parentNode != endBlock.parentNode) {
          console.error('start and end blocks not on the same level')
        } else {
          const subranges = [];
          let startEl = isHighlightable(startBlock) ? startBlock : null;
          let endEl = startEl;
          let curr = startBlock.nextSibling;
          let done = false;
          while (!done) {
            if (curr == endBlock) done = true;
            if (isHighlightable(curr)) {
              if (startEl == null) {
                startEl = curr;
              }
              endEl = curr;
            } else {
              if (startEl) {
                const subRange = document.createRange();
                subRange.setStartBefore(startEl.firstChild);
                subRange.setEndAfter(endEl.lastChild)
                if (startEl == startBlock) {
                  subRange.setStart(range.startContainer, range.startOffset);
                }
                if (endEl == endBlock) {
                  subRange.setEnd(range.endContainer, range.endOffset);
                }

                startEl = null;
                subranges.push(subRange);
              }
            }
            curr = curr.nextSibling;
          }
          if (startEl) {
            const subRange = range.cloneRange();
            if (startEl != startBlock) {
              subRange.setStartBefore(startEl.lastChild)
            }
            // subRange.setEnd(range.endContainer, range.endOffset);
            subranges.push(subRange)
          }
          console.log(subranges)
          return subranges;
        }
      },
      createHighlightFromRange(initialRange) {
        const subranges = this.analyzeRange(initialRange)

        if (subranges) subranges.forEach( range => {
          const startParent = blockContainer(range.startContainer);
          const endParent = blockContainer(range.endContainer);
          const sameParent = startParent.isEqualNode(endParent);
          const rangeData = this.serializeRange(range);
          console.dir(range);
          console.log(range.cloneContents())

          if (!(sameParent && startParent.className == highlightClass)) {
            if (range.cloneContents().childElementCount < 2) {
              const highlight = this.createHighlight(range.extractContents());
              if (highlight) {
                highlight.dataset.rangeData = rangeData;
                range.insertNode(highlight);
              }
            } else {
              const contents = range.extractContents();
              const firstSection = this.createHighlight(contents.firstChild.innerHTML);
              firstSection.classList.add(overflowNextClass);
              firstSection.dataset.rangeData = rangeData;
              const lastSection = this.createHighlight(contents.lastChild.innerHTML);
              lastSection.classList.add(overflowPrevClass);
              startParent.appendChild(firstSection);
              endParent.prepend(lastSection);
              if (contents.childElementCount > 2) {
                Array.from(contents.childNodes)
                  .slice(1, contents.childNodes.length - 1)
                  .forEach(element => {
                    const section = this.createHighlight(element);
                    section.classList.add(overflowPrevClass, overflowNextClass);
                    endParent.before(section);
                  });
              }
            }
          }
        })
      },
      removeAllHighlights() {
        document.querySelectorAll(`.${highlightClass}`).forEach(this.removeHighlightSpan);
      },
      removeHighlightSpan(span) {
        console.log(span);
        if (!span) {
          console.error("Bad span!")
          return;
        }
        const classList = span.classList;
        if (!(classList && classList.contains(highlightClass))) {
          return;
        }

        const alsoRemove = [];

        if (classList.contains(overflowNextClass)) {
          const block = blockContainer(span);
          if (block) {
            const nextHighlight =
              block.nextElementSibling.classList.contains(highlightClass) ?
                block.nextElementSibling : block.nextElementSibling.firstElementChild;
            if (nextHighlight && nextHighlight.classList.contains(highlightClass)) {
              alsoRemove.push(nextHighlight)
            }
          }
        }

        if (classList.contains(overflowPrevClass)) {
          const block = blockContainer(span);
          if (block) {
            const prevHighlight =
              block.previousElementSibling.classList.contains(highlightClass) ?
                block.previousElementSibling : block.previousElementSibling.lastElementChild;
            if (prevHighlight && prevHighlight.classList.contains(highlightClass)) {
              alsoRemove.push(prevHighlight);
            }
          }
        }

        if (blockContainer(span) == span) {
          span.classList.remove(highlightClass, overflowNextClass, overflowPrevClass);
          delete span.dataset.rangeData;
        } else if (span.parentNode) {
          const prevSibling = span.prevSibling;
          const nextSibling = span.nextSibling;
          const firstChild = span.firstChild;
          const lastChild = span.lastChild;

          const tag = elem => elem.outerHTML.slice(0, elem.outerHTML.indexOf(elem.innerHTML));

          if (prevSibling && firstChild
            && prevSibling.nodeType === Node.ELEMENT_NODE
            && firstChild.nodeType === Node.ELEMENT_NODE
            && tag(prevSibling) === tag(firstChild)) {
            prevSibling.innerHTML += firstChild.innerHTML;
            firstChild.remove();
          }

          if (nextSibling && lastChild
            && nextSibling.nodeType === Node.ELEMENT_NODE
            && lastChild.nodeType === Node.ELEMENT_NODE
            && tag(nextSibling) === tag(lastChild)) {
            nextSibling.innerHTML = lastChild.innerHTML + nextSibling.innerHTML;
            lastChild.remove();
          }

          span.outerHTML = span.innerHTML;
        }
        alsoRemove.forEach(this.removeHighlightSpan);
      },
      createHighlight(contents) {
        const span = this.createHighlightSpan(contents);
        span.childNodes.forEach((value, key) => {
          if (value.className == highlightClass) {
            value.replaceWith(value.innerHTML);
          }
        });
        return span;
      },
      createHighlightSpan(contents) {
        if (!contents) {
          return;
        }
        let span = document.createElement("span");
        if (typeof contents === 'string') {
          span.innerHTML = contents;
        } else if (contents instanceof DocumentFragment) {
          span.appendChild(contents);
        } else if (contents.style) {
          span = contents;
        } else {
          return null;
        }
        // span.style.backgroundColor = "yellow";
        span.classList.add(highlightClass);
        span.onclick = this.onClick;
        span.id = `${highlightClass}-${this.highlightSpanCount}`;
        this.incrementHighlightSpans();

        //Draggability
        const onDragStart = (event) => {
          //We have event.target, which is the element that the user clicked on; let's make sure we get the full highlight span.
          let currEl = span;
          let rangeData, html, dragImage;

          //Let's make sure we get its connected spans in cases where a highlight overflows into consecutive paragraph(s)
          if (currEl.classList.contains(overflowPrevClass) || currEl.classList.contains(overflowNextClass)) {
            //Treating a JavaScript array as a double-sided queue allows us to efficiently traverse above and below the clicked-on element to find the full flow
            let deque = [currEl];
            while (deque[0].classList.contains(overflowPrevClass)) {
              let prevEl = deque[0].previousElementSibling;
              if (prevEl == null) {
                prevEl = deque[0].parentElement.previousElementSibling;
              }
              if (prevEl.classList.contains(highlightClass)) {
                deque.unshift(prevEl);
              } else if (prevEl.lastElementChild.classList.contains(highlightClass)) {
                deque.unshift(prevEl.lastElementChild);
              }
            }
            while (deque[deque.length - 1].classList.contains(overflowNextClass)) {
              let nextEl = deque[deque.length - 1].nextElementSibling;
              if (nextEl == null) {
                nextEl = deque[deque.length - 1].parentElement.nextElementSibling;
              }
              if (nextEl.classList.contains(highlightClass)) {
                deque.push(nextEl);
              } else if (nextEl.firstElementChild.classList.contains(highlightClass)) {
                deque.push(nextEl.firstElementChild);
              }
            }

            rangeData = deque[0].dataset.rangeData;
            html = deque
              .map(strippedAttributes)
              .map(el => el.outerHTML) //grab the element's html
              .join(' ');

            if (deque.length > 1) {
              dragImage = document.createElement("div")
              dragImage.id = dragImageId;
              dragImage.style.position = "absolute";
              dragImage.style.top = "-1500px";
              deque.forEach(el => {
                if (el != blockContainer(el)) {
                  const p = document.createElement("p");
                  p.append(el.cloneNode(true));
                  dragImage.append(p);
                } else {
                  dragImage.append(el.cloneNode(true))
                }
              });
              blockContainer(deque[0]).appendChild(dragImage);
            }
          } else {
            rangeData = currEl.dataset.rangeData;
            html = strippedAttributes(currEl).outerHTML;
          }
          this.$store.dispatch("startDrag", {html, metadata: { rangeData }, type: notebookTypes.TEXT_HIGHLIGHT})
          event.dataTransfer.setData("spanId", span.id);

          if (dragImage)
            event.dataTransfer.setDragImage(dragImage, 0, 0);

          function strippedAttributes(el) {
            const clone = el.cloneNode(true);
            Array.from(clone.attributes).forEach(attr => clone.removeAttribute(attr.name));
            return clone;
          }
        }
        span.setAttribute("draggable", "true");
        span.addEventListener("dragstart", onDragStart);
        span.addEventListener("dragend", e => {
          const dragImage = document.getElementById(dragImageId);
          if (dragImage) dragImage.remove();
        });

        return span;
      },
      serializeRange(range) {
        const pathToElement = (element) => {
          let parents = []
          let curr = element;
          while (!curr.id && curr !== document.body) {
            let siblingIndex = 0;
            let currSibling = curr.previousSibling;
            while (currSibling !== null) {
              siblingIndex++;
              currSibling = currSibling.previousSibling;
            }
            parents.unshift(`${curr.nodeName}[${siblingIndex}]`);
            curr = curr.parentNode;
          }
          if (curr.id) parents.unshift(`#'${curr.id}'`);
          return parents.join('/');
        }
        let startPath = pathToElement(range.startContainer);
        let endPath = pathToElement(range.endContainer);
        return `${startPath}-${range.startOffset};${endPath}-${range.endOffset}`
      },
      deserializeRange(string) {
        const dividersOutsideQuotes = /[-/](?=(?:[^']*'[^']*')*[^']*$)/g;
        const startEnd = string.split(';');
        const startPath = startEnd[0].split(dividersOutsideQuotes);
        const endPath = startEnd[1].split(dividersOutsideQuotes);
        const startOffset = startPath.pop();
        const endOffset = endPath.pop();

        const pathToNode = path =>
          path.slice(1).reduce((prev, curr) => {
            const split = curr.split(/\[|\]/g);
            const name = split[0];
            const index = split[1];
            const child = prev.childNodes[index];
            if (!child) {
            }
            if (child.nodeName.toUpperCase() !== name.toUpperCase()) {
              console.warn(`Element ${curr} has changed since the last highlight`);
            }
            return child;
          }, document.querySelector(path[0].replace(/'/g, "")))

        const range = new Range();
        range.setStart(pathToNode(startPath), startOffset);
        range.setEnd(pathToNode(endPath), endOffset);
        return range;
      }
    }
  }
}
export default Highlightable;

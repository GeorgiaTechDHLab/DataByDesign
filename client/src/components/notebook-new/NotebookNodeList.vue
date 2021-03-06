<template>
  <div class="node-list-container">

    <ul>
        <AddNew @addNote="addNoteTop"></AddNew>
        <div class="drag-target" data-insert-at="0"></div>
        <li v-for="(item, index) in items" :key="item.notebookId">
          <ListItem :item="item"></ListItem>
          <div class="drag-target" :data-insert-at="index + 1"></div>
        </li>
        <AddNew @addNote="addNoteBottom"></AddNew>
    </ul>
  </div>
</template>

<script>

import { notebookTypes } from "dxd-common"

import ListItem from "./NotebookNodeListItem"
import AddNew from "./NotebookNodeAddNew.vue"
import { mapGetters, mapState, mapActions } from "vuex"

export default {
  components: {
    ListItem,
    AddNew
  },
  mounted: function () {
    const container = document.getElementsByClassName("node-list-container")[0];
    container.addEventListener("drop", this.onDrop);
    container.addEventListener("dragover", this.onDragOver);
    container.addEventListener("dragenter", this.onDragEnter);
    container.addEventListener("dragleave", this.onDragLeave);

    this.registerDropTargetEvents();
  },
  methods: {
    ...mapActions(["completeDrag"]),
    ...mapActions("mutableStore", ["loadMutableData"]),
    ...mapActions("chapters", ["registerHighlight"]),
    addNoteTop(note) {
      this.addNote(note, true);
    },
    addNoteBottom(note) {
      this.addNote(note, false);
    },
    addNote(note, addToTop = false) {
      const id = this.greatestId + 1;
      const newItem = {
        html: note,
        notebookId: id,
        type: notebookTypes.TYPED_NOTE,
        metadata: {}
      }
      if (addToTop) {
        this.items.unshift(newItem)
      } else {
        this.items.push(newItem)
      }
    },
    onDrop (event) {
      this.$el.classList.remove("dragging");
      event.target.classList.remove("dragging-over");

      const newItem = this.currentDragData;

      if (!newItem) {
        return;
      }

      this.completeDrag();

      if (newItem.type === notebookTypes.TEXT_HIGHLIGHT) {
        const id = event.dataTransfer.getData("spanId")
        if (id) {
          this.registerHighlight({id});
        }
      }

      let insertAt = event.target.dataset.insertAt;
      const prevId = newItem.notebookId;
      if (prevId != null) {
        for (let i = 0; i < this.items.length; i++) {
          if (this.items[i].notebookId == prevId) {
            this.items.splice(i, 1);
            if (i < insertAt) {
              insertAt--;
            }
            break;
          }
        }
      }
      if (prevId == null) {
        newItem.notebookId = this.greatestId + 1;
      }
      if (insertAt) {
        console.log("insert at " + insertAt);
        this.items.splice(insertAt, 0, newItem)
      } else {
        this.items.push(newItem);
      }
      setTimeout(this.registerDropTargetEvents, 10);

      event.preventDefault();
      event.stopPropagation();

    },
    onDragOver (event) {
      event.preventDefault();
    },
    onDragEnter (event) {
      this.$el.classList.toggle("dragging");
      event.preventDefault();
    },
    onDragLeave (event) {
      this.$el.classList.toggle("dragging");
      event.preventDefault();
    },

    registerDropTargetEvents() {
    document.querySelectorAll(".drag-target").forEach((element) => {
      if (!element.dataset.listenersAttached) {
        element.addEventListener("dragenter", function() {
          element.classList.add("dragging-over");
          event.preventDefault();
        });
        element.addEventListener("dragleave", function() {
          element.classList.remove("dragging-over");
          event.preventDefault();
        });
        element.addEventListener("dragover", this.onDragOver);
        element.addEventListener("drop", this.onDrop);
        element.setAttribute("data-listeners-attached", "true");
      }
    });
    }
  },
  computed: {
    ...mapState({
      // currentNotebookRequest: state => state.notebook.currentNotebookRequest,
      currentDragData: state => state.notebook.currentDragData,
      mutableData: state => state.notebook.mutableStore.mutableData
    }),
    ...mapGetters(['isLoggedIn']),
    greatestId () {
      return Math.max(...this.items.map(item => item.notebookId), -1);
    }
  },
  data () {
    return {
      items: [
        // {
        //   html: "<span>this is a highlight, yay</span>",
        //   notebookId: 0,
        //   metadata: "serialization info goes here",
        // },
        // {
        //   html: "<span>so is <i>this</i> one</span>",
        //   notebookId: 1,
        //   metadata: "serialization info goes here",
        // },
      ]
    }
  },

  watch: {
    items: {
      handler (val) {
        // const nonReactiveCopy = this.items.map(obj => ({html: obj.item, notebookId: obj.notebookId, metadata: obj.metadata}))
        this.$store.dispatch('updateNotebook', {notebookArray: this.items});
      },
      deep: true
    },
    mutableData: {
      handler (val) {
        this.$store.dispatch('updateNotebook', {mutableData: val })
      },
      deep: true
    },
    isLoggedIn: {
      handler (isLoggedIn) {
        if (isLoggedIn)  {
          this.items = this.$store.getters.notebook;
          this.loadMutableData(this.$store.getters.mutableData);
        } else {
          this.items = []
        }
      }
    },
    // Vuex State
    // currentNotebookRequest: {
    //   handler (newNotebook) {
    //     if (newNotebook.length > this.items.length)
    //     this.items = newNotebook;
    //   },
    //   deep: true
    // }
  }
}
</script>

<style>
.node-list-container {
  background-color:lavender;
}

.node-list-container ul {
  list-style: square;
}

/*.node-list-container ul li span:not(.note),*/
/*.node-list-container ul li p{*/
/*  background-color: yellow;*/
/*}*/

.node-list-container ul li .note {
  white-space: pre-wrap;
}

.node-list-container .drag-target {
  width: 100%;
  margin: auto;
  height: 3px;
}

.dragging .drag-target {
  height: 6px;
  background-color: lightgray;
}

.node-list-container .drag-target.dragging-over {
  background-color: gray;
}
</style>

import { mapGetters, mapMutations } from 'vuex'
import EventBus from '@/helpers/EventBus'
// This mixin helps the visualization interface with vuex to get its data
const Visualization = {
  props: {
    datasetId: {
      type: String,
      required: true
    },
    width: {
      type: String,
      required: true
    }
  },
  data () {
    return {

    }
  },
  methods: {
    widthTimes(scalar) {
      return this.calcWidth(`* ${scalar}`)
    },
    calcWidth(expression) {
      return `calc(${this.width} ${expression})`
    }
  },
  computed: {
    dataset () {
      if (this.rawDataset){
        return this.$store.state.dataset.datasets[this.datasetId].data
      }
    },
    isMutable () {
      return (this.rawDataset) ? this.rawDataset.isMutable : false
    },
    formattedData () {
      return this.dataFormatter(this.dataset)
    },
    styles () {
      return this.options.styles || {}
    }
  },
  created () {

  }
}

export default Visualization

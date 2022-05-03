import Skeleton from 'primevue/skeleton'

const created = function() {
}

const computed = {
	skeletonListClass() {
		return this.theme + '-skeleton-list-' + this.themeVariety
	},
	locale() {
		return this.$store.getters['previewer/getLocale']
	},
	theme() {
		return this.$store.getters['previewer/getTheme']
	},
	themeVariety() {
		return this.$store.getters['previewer/getThemeVariety']
	}
}

const watch = {
}

const mounted = async function() {
}

const methods = {
}

const beforeDestroy = function() {
}

const destroyed = function() {
}

export default {
	mixins: [
	],
	components: {
		Skeleton
	},
	directives: {
	},
	props: [
	],
	name: 'SkeletonList',
	data () {
		return {
		}
	},
	created: created,
	computed: computed,
	watch: watch,
	mounted: mounted,
	methods: methods,
	beforeDestroy: beforeDestroy,
	destroyed: destroyed
}  